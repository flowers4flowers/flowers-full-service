import { ExtractedDealData } from "./deal-extractor";
import { attioClient, AttioDealPayload } from "./attio-client";

export interface AttioSyncResult {
  success: boolean;
  attioDealId: string | null;
  attioUrl: string | null;
  error: string | null;
}

export async function syncDealToAttio(
  extractedData: ExtractedDealData,
  threadParticipants: string[],
  threadId: string,
): Promise<AttioSyncResult> {
  console.log(`\n--- Syncing deal to Attio for thread ${threadId} ---`);

  try {
    // 1. Find Cait Oppermann as owner
    console.log("\n1. Finding deal owner...");
    const ownerId = await attioClient.findUserByName("Cait Oppermann");
    if (!ownerId) {
      console.warn(
        "Could not find Cait Oppermann, deal will be created without owner",
      );
    }

    // 2. Create/find people for all thread participants
    console.log("\n2. Processing associated people...");
    const validEmails = threadParticipants.filter((email) => {
      const isValid = email.includes("@") && email.includes(".");
      if (!isValid) {
        console.warn(`Invalid email format, skipping: ${email}`);
      }
      return isValid;
    });

    console.log(`Processing ${validEmails.length} valid email addresses`);
    const personIdPromises = validEmails.map((email) =>
      attioClient.findOrCreatePerson(email),
    );
    const personIds = (await Promise.all(personIdPromises)).filter(
      (id) => id !== null,
    ) as string[];
    console.log(`Successfully processed ${personIds.length} people`);

    // 3. Prepare select/multiselect fields
    console.log("\n3. Preparing select/multiselect options...");

    // Budget Range (select - single value, but Attio expects array)
    let budgetRangeOption = null;
    if (extractedData.budgetRange) {
      budgetRangeOption = await attioClient.findOrCreateSelectOption(
        "budget_range",
        extractedData.budgetRange,
      );
    }

    // Inquiry Source (multiselect - always "Email")
    const inquirySourceOption = await attioClient.findOrCreateSelectOption(
      "inquiry_source",
      "Email",
    );

    // Collaborators Needed (multiselect)
    let collaboratorsOptions: any[] = [];
    if (
      extractedData.collaboratorsNeeded &&
      extractedData.collaboratorsNeeded.length > 0
    ) {
      const collaboratorPromises = extractedData.collaboratorsNeeded.map(
        (collaborator) =>
          attioClient.findOrCreateSelectOption(
            "collaborators_needed",
            collaborator,
          ),
      );
      const results = await Promise.all(collaboratorPromises);
      collaboratorsOptions = results.filter((opt) => opt !== null);
    }

    // Usage Terms (multiselect - single value but in array)
    let usageTermsOptions: any[] = [];
    if (extractedData.usageTerms) {
      const usageOption = await attioClient.findOrCreateSelectOption(
        "usage_terms_1",
        extractedData.usageTerms,
      );
      if (usageOption) {
        usageTermsOptions = [usageOption];
      }
    }

    // 4. Build Attio payload
    console.log("\n4. Building Attio deal payload...");
    const payload: AttioDealPayload = {
      values: {},
    };

    // Text fields
    if (extractedData.dealName) {
      payload.values.name = extractedData.dealName;
    } else {
      payload.values.name = "Untitled Deal";
    }

    // Stage (status field - always "Lead")
    payload.values.stage = "Lead";

    // Owner (user field)
    if (ownerId) {
      payload.values.owner = ownerId;
    }

    // Associated People (relationship field)
    if (personIds.length > 0) {
      payload.values.associated_people = personIds.map((id) => ({
        target_record_id: id,
      }));
    }

    // Currency field (value in cents)
    if (extractedData.dealValue && extractedData.dealValue > 0) {
      payload.values.value = Math.round(extractedData.dealValue * 100);
    }

    // Select field (budget_range)
    if (budgetRangeOption) {
      payload.values.budget_range = [budgetRangeOption];
    }

    // Multiselect field (inquiry_source)
    if (inquirySourceOption) {
      payload.values.inquiry_source = [inquirySourceOption];
    }

    // Multiselect field (collaborators_needed)
    if (collaboratorsOptions.length > 0) {
      payload.values.collaborators_needed = collaboratorsOptions;
    }

    // Location field
    if (extractedData.location) {
      payload.values.location = extractedData.location;
    }

    // Date field (shoot_date)
    if (extractedData.shootDate) {
      payload.values.shoot_date = extractedData.shootDate;
    }

    // Multiselect field (usage_terms_1)
    if (usageTermsOptions.length > 0) {
      payload.values.usage_terms_1 = usageTermsOptions;
    }

    // 5. Create deal in Attio
    console.log("\n5. Creating deal in Attio...");
    const { id, url } = await attioClient.createDeal(payload);

    console.log(`\nSuccessfully synced deal to Attio!`);
    console.log(`Deal ID: ${id}`);
    console.log(`Deal URL: ${url}`);

    return {
      success: true,
      attioDealId: id,
      attioUrl: url,
      error: null,
    };
  } catch (error) {
    console.error("\nFailed to sync deal to Attio:", error);
    return {
      success: false,
      attioDealId: null,
      attioUrl: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
