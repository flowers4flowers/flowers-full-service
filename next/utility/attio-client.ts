import axios, { AxiosError } from "axios";

const ATTIO_API_KEY = process.env.ATTIO_API_KEY;
const ATTIO_BASE_URL = "https://api.attio.com/v2";
const DEALS_OBJECT_ID = "f0bbe06d-66d9-4fab-a960-e3cc828a2873";

interface AttioUser {
  id: { workspace_member_id: string };
  first_name: string;
  last_name: string;
  email_address: string;
}

interface AttioPerson {
  id: { record_id: string };
  values: {
    email_addresses?: Array<{
      email_address: string;
    }>;
  };
}

interface AttioSelectOption {
  id: string;
  title: string;
}

interface AttioAttribute {
  id: { attribute_id: string };
  api_slug: string;
  title: string;
  type: string;
  config?: {
    options?: AttioSelectOption[];
  };
}

export interface AttioDealPayload {
  values: {
    [key: string]: any;
  };
}

class AttioClient {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    if (!ATTIO_API_KEY) {
      throw new Error("ATTIO_API_KEY not found in environment variables");
    }
    this.apiKey = ATTIO_API_KEY;
    this.baseUrl = ATTIO_BASE_URL;
  }

  private getHeaders() {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };
  }

  private async handleError(error: any, context: string) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      console.error(`Attio API Error (${context}):`, {
        status: axiosError.response?.status,
        statusText: axiosError.response?.statusText,
        data: axiosError.response?.data,
      });
      throw new Error(
        `Attio ${context} failed: ${axiosError.response?.status} ${JSON.stringify(axiosError.response?.data)}`,
      );
    }
    throw error;
  }

  async findUserByName(name: string): Promise<string | null> {
    try {
      console.log(`Searching for user: ${name}`);
      const response = await axios.get(`${this.baseUrl}/workspace_members`, {
        headers: this.getHeaders(),
      });

      const members = response.data.data;
      const member = members.find((m: any) => {
        const fullName = `${m.first_name || ""} ${m.last_name || ""}`
          .trim()
          .toLowerCase();
        const email = m.email_address?.toLowerCase() || "";
        return fullName === name.toLowerCase() || email === name.toLowerCase();
      });

      if (member) {
        console.log(
          `Found user: ${member.first_name} ${member.last_name} (${member.id.workspace_member_id})`,
        );
        return member.id.workspace_member_id;
      }

      console.warn(`User not found: ${name}`);
      return null;
    } catch (error) {
      console.error(`Error finding user ${name}:`, error);
      return null;
    }
  }

  async findOrCreatePerson(email: string): Promise<string | null> {
    try {
      console.log(`Searching for person: ${email}`);

      const searchResponse = await axios.post(
        `${this.baseUrl}/objects/people/records/query`,
        {
          filter: {
            email_addresses: {
              email_address: {
                $eq: email,
              },
            },
          },
          limit: 1,
        },
        {
          headers: this.getHeaders(),
        },
      );

      if (searchResponse.data.data && searchResponse.data.data.length > 0) {
        const personId = searchResponse.data.data[0].id.record_id;
        console.log(`Found existing person: ${email} (${personId})`);
        return personId;
      }

      // Replace the entire create section in findOrCreatePerson:
      console.log(`Person not found, creating: ${email}`);
      const createResponse = await axios.put(
        `${this.baseUrl}/objects/people/records`,
        {
          data: {
            values: {
              email_addresses: [
                {
                  email_address: email,
                },
              ],
            },
          },
        },
        {
          headers: this.getHeaders(),
          params: {
            matching_attribute: "email_addresses",
          },
        },
      );

      const personId = createResponse.data.data.id.record_id;
      console.log(`Created person: ${email} (${personId})`);
      return personId;
    } catch (error) {
      console.error(`Error finding/creating person ${email}:`, error);
      return null;
    }
  }

  async findOrCreateSelectOption(
    attributeSlug: string,
    optionTitle: string,
  ): Promise<AttioSelectOption | null> {
    try {
      console.log(
        `Checking select option: ${attributeSlug} = "${optionTitle}"`,
      );

      // Fetch options using the correct endpoint
      const optionsResponse = await axios.get(
        `${this.baseUrl}/objects/${DEALS_OBJECT_ID}/attributes/${attributeSlug}/options`,
        {
          headers: this.getHeaders(),
        },
      );

      const existingOptions = optionsResponse.data.data || [];

      const existingOption = existingOptions.find(
        (opt: AttioSelectOption) =>
          opt.title.toLowerCase() === optionTitle.toLowerCase(),
      );

      if (existingOption) {

        return existingOption;
      }

      console.log(`Option not found, creating: "${optionTitle}"`);
      const createResponse = await axios.post(
        `${this.baseUrl}/objects/${DEALS_OBJECT_ID}/attributes/${attributeSlug}/options`,
        {
          data: {
            title: optionTitle,
          },
        },
        {
          headers: this.getHeaders(),
        },
      );

      const newOption = createResponse.data.data;
      console.log(`Created option: "${optionTitle}" (${newOption.id})`);
      return newOption;
    } catch (error) {
      // Handle 409 conflict - option was created by another request
      if (axios.isAxiosError(error) && error.response?.status === 409) {
        console.log(`Option already exists: "${optionTitle}", fetching again`);
        try {
          const optionsResponse = await axios.get(
            `${this.baseUrl}/objects/${DEALS_OBJECT_ID}/attributes/${attributeSlug}/options`,
            {
              headers: this.getHeaders(),
            },
          );
          const existingOptions = optionsResponse.data.data || [];
          const existingOption = existingOptions.find(
            (opt: AttioSelectOption) =>
              opt.title.toLowerCase() === optionTitle.toLowerCase(),
          );
          if (existingOption) {
            console.log(
              `Found after conflict: "${optionTitle}" (${existingOption.id})`,
            );
            return existingOption;
          }
          console.error(
            `Option "${optionTitle}" still not found after conflict resolution`,
          );
          return null;
        } catch (retryError) {
          console.error(`Error fetching after conflict:`, retryError);
          return null;
        }
      }

      console.error(
        `Error finding/creating option for ${attributeSlug}:`,
        error,
      );
      return null;
    }
  }

  async createDeal(
    payload: AttioDealPayload,
  ): Promise<{ id: string; url: string }> {
    try {
      console.log("Creating deal in Attio...");
      console.log("Payload:", JSON.stringify(payload, null, 2));

      const response = await axios.post(
        `${this.baseUrl}/objects/${DEALS_OBJECT_ID}/records`,
        { data: payload }, // Don't access .values, send entire payload wrapped in data
        {
          headers: this.getHeaders(),
        },
      );

      const dealId = response.data.data.id.record_id;
      const dealUrl = `https://app.attio.com/objects/${DEALS_OBJECT_ID}/records/${dealId}`;

      console.log(`Deal created successfully: ${dealId}`);
      return { id: dealId, url: dealUrl };
    } catch (error) {
      await this.handleError(error, "createDeal");
      throw error;
    }
  }
}

let attioClientInstance: AttioClient | null = null;

export const attioClient = {
  get instance(): AttioClient {
    if (!attioClientInstance) {
      attioClientInstance = new AttioClient();
    }
    return attioClientInstance;
  },

  async findUserByName(name: string) {
    return this.instance.findUserByName(name);
  },

  async findOrCreatePerson(email: string) {
    return this.instance.findOrCreatePerson(email);
  },

  async findOrCreateSelectOption(attributeSlug: string, optionTitle: string) {
    return this.instance.findOrCreateSelectOption(attributeSlug, optionTitle);
  },

  async createDeal(payload: AttioDealPayload) {
    return this.instance.createDeal(payload);
  },
};
