import axios from 'axios';

const openRouterApiKey = process.env.OPEN_ROUTER_API_KEY;

export interface ExtractedDealData {
  dealName: string | null;
  associatedCompanies: string[] | null;
  workflowType: string[] | null;
  dealValue: number | null;
  clientTier: string | null;
  budgetRange: string | null;
  projectType: string[] | null;
  inquirySource: string[] | null;
  collaboratorsNeeded: string[] | null;
  location: string | null;
  shootDate: string | null; // ISO date string
  usageTerms: string | null;
  paymentTerms: string | null;
  depositInvoiceNumber: string | null;
  finalInvoiceNumber: string | null;
  contractSigned: string | null; // ISO date string
  allowedToUseMedia: boolean | null;
  backupVerified: boolean | null;
  picturesUsed: string | null; // ISO date string
  rejectionReason: string[] | null;
  profit: number | null;
}

/**
 * Extracts deal information from a cleaned email thread
 */
export async function extractDealData(cleanedThread: string): Promise<ExtractedDealData> {
  if (!openRouterApiKey) {
    throw new Error('OPEN_ROUTER_API_KEY not found in environment variables');
  }

  const prompt = `Extract deal information from this email thread and return as JSON.

Fields to extract (return null if not found or low confidence):
- dealName: string (a descriptive name for this project/deal)
- associatedCompanies: array of strings (company names mentioned)
- workflowType: array of strings (types of workflow: "Photography", "Videography", "Post-production", "Consulting", etc.)
- dealValue: number (total value in currency)
- clientTier: string (tier of client: "Enterprise", "Mid-market", "Small business", "Startup")
- budgetRange: string (budget range like "$10k-$25k", "$25k-$50k", "$50k-$100k", "$100k+")
- projectType: array of strings (types like "Commercial", "Editorial", "Event", "Product", "Brand Content", etc.)
- inquirySource: array of strings (how they found you: "Referral", "Website", "Social Media", "Email", etc.)
- collaboratorsNeeded: array of strings (roles needed: "Photographer", "Videographer", "Editor", "Producer", etc.)
- location: string (shoot location)
- shootDate: ISO date string (YYYY-MM-DD format)
- usageTerms: string (usage rights, licensing terms)
- paymentTerms: string (payment terms and conditions)
- depositInvoiceNumber: string (deposit invoice number if mentioned)
- finalInvoiceNumber: string (final invoice number if mentioned)
- contractSigned: ISO date string (date contract was signed)
- allowedToUseMedia: boolean (whether media usage is allowed)
- backupVerified: boolean (whether backup is verified)
- picturesUsed: ISO date string (date pictures were used)
- rejectionReason: array of strings (reasons for rejection if deal was rejected)
- profit: number (profit amount if mentioned)

Thread:
${cleanedThread}

Return only valid JSON. No markdown formatting, no commentary. If a field has low confidence or is not found, set it to null.`;

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
      }
    );

    const content = response.data.choices[0]?.message?.content || '{}';
    
    // Remove markdown code blocks if present
    const cleanedContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    const extractedData: ExtractedDealData = JSON.parse(cleanedContent);
    
    console.log('Successfully extracted deal data');
    return extractedData;
  } catch (error) {
    console.error('Error extracting deal data:', error);
    throw error;
  }
}