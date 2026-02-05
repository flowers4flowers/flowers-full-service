import axios from "axios";

const openRouterApiKey = process.env.OPEN_ROUTER_API_KEY;

export interface ExtractedDealData {
  dealName: string | null;
  associatedCompanies: string[] | null;
  dealValue: number | null;
  budgetRange: string | null;
  inquirySource: "Email";
  collaboratorsNeeded: string[] | null;
  location: string | null;
  shootDate: string | null; // ISO date string
  usageTerms: string | null;
}

/**
 * Extracts deal information from a cleaned email thread
 */
export async function extractDealData(
  cleanedThread: string,
): Promise<ExtractedDealData> {
  if (!openRouterApiKey) {
    throw new Error("OPEN_ROUTER_API_KEY not found in environment variables");
  }

  const prompt = `Extract deal information from this email thread and return as JSON.

Context:
- These emails relate to photography or video shoots handled by FLOWERS, a full-service production company.
- "FLOWERS" is the name of the production company and must NEVER be referenced directly or indirectly in the deal name.
- Do NOT use synonyms, themes, or related words for FLOWERS (e.g. floral, flowers, bouquet, botanical, arrangement, bloom, etc.).
- The name "Cait" (or any variation of it) must NEVER be used in the deal name.

Deal name rules (STRICT):
- dealName must be based ONLY on:
  - the client or brand name, OR
  - the campaign name, OR
  - the shoot type (e.g. "Brand Campaign")
- dealName must NOT include shoot descriptors or production terms, including but not limited to:
  "photo", "photos", "photography", "photo shoot", "shoot",
  "video", "videography", "film", "filming",
  "campaign", "project", "production"
- dealName must consist ONLY of the client name or brand name.
- If no client, brand, or campaign name is mentioned, use EXACTLY:
  "Unnamed Client"
- Do NOT invent creative or thematic names.

Fields to extract (return null if not found or low confidence):
- dealName: string
- associatedCompanies: array of strings 
  (Client or brand names mentioned; exclude "FLOWERS")
- dealValue: number 
  (Total value in currency)
- budgetRange: string 
  ("<25k", "25k-50k", "50k-100k", "100k-200k", "200k-500k", or "500k+")
- collaboratorsNeeded: array of strings 
  (Roles needed, e.g. "Photographer", "Videographer", "Editor", "Producer")
- location: string 
  (Shoot location)
- shootDate: ISO date string 
  (YYYY-MM-DD format)
- usageTerms: string 
  ("3 months", "6 months", "1 year", "2 years", "3 years", "4 years", "5 years", "Perpetuity")

Thread:
${cleanedThread}

Return only valid JSON. No markdown formatting, no commentary.
If a field has low confidence or is not found, set it to null.`;

  try {
    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "anthropic/claude-3-haiku",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        max_tokens: 2000,
        temperature: 0.3,
      },
      {
        headers: {
          Authorization: `Bearer ${openRouterApiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://github.com",
          "X-Title": "FLOWERS Deal Extractor",
        },
      },
    );

    const content = response.data.choices[0]?.message?.content || "{}";

    // Remove markdown code blocks if present
    const cleanedContent = content
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    const parsedData = JSON.parse(cleanedContent);

    // Ensure all fields match ExtractedDealData interface
    const extractedData: ExtractedDealData = {
      dealName: parsedData.dealName ?? null,
      associatedCompanies: parsedData.associatedCompanies ?? null,
      dealValue: parsedData.dealValue ?? null,
      budgetRange: parsedData.budgetRange ?? null,
      inquirySource: "Email",
      collaboratorsNeeded: parsedData.collaboratorsNeeded ?? null,
      location: parsedData.location ?? null,
      shootDate: parsedData.shootDate ?? null,
      usageTerms: parsedData.usageTerms ?? null,
    };

    console.log("Successfully extracted deal data");
    return extractedData;
  } catch (error) {
    console.error("Error extracting deal data:", error);
    throw error;
  }
}
