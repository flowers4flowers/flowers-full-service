import axios from 'axios';

const openRouterApiKey = process.env.OPEN_ROUTER_API_KEY;

export interface ExtractedDealData {
  dealName: string | null;
  associatedCompanies: string[] | null;
  dealValue: number | null;
  budgetRange: string | null;
  inquirySource: 'Email';
  collaboratorsNeeded: string[] | null;
  location: string | null;
  shootDate: string | null; // ISO date string
  usageTerms: string | null;
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
- dealValue: number (total value in currency)
- budgetRange: string (budget range: "<25k", "25k-50k", "50k-100k", "100k-200k", "200k-500k", or "500k+")
- collaboratorsNeeded: array of strings (roles needed: "Photographer", "Videographer", "Editor", "Producer", etc.)
- location: string (shoot location)
- shootDate: ISO date string (YYYY-MM-DD format)
- usageTerms: string (3 months, 6 months, 1 year, 2 years, 3 years, 4 years, 5 years, Perpetuity)

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