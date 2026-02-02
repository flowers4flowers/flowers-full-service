import axios from "axios";

const openRouterApiKey = process.env.OPEN_ROUTER_API_KEY;

/**
 * Cleans a single email body by removing greetings, signatures, pleasantries
 * using Claude Haiku to extract only important business information
 */
export async function cleanEmailBody(emailBody: string): Promise<string> {
  if (!openRouterApiKey) {
    throw new Error("OPEN_ROUTER_API_KEY not found in environment variables");
  }

  const prompt = `You are an assistant for a production company called FLOWERS.
Read the entire email carefully and extract only the meaningful information.

Remove:
   * greetings and pleasantries
   * small talk or filler language
   * apologies, thanks, and niceties
   * email signatures, sign-offs, and job titles
   * disclaimers, legal text, and branding fluff

Keep:
   * concrete requests or decisions
   * dates, times, deadlines
   * deliverables and requirements
   * questions that need answers
   * attachments or links mentioned
   * any constraints, approvals, or next steps

Rewrite the result as clear, concise bullet points using neutral, professional language.
Do not add new information or assumptions. Do not summarise beyond what is explicitly stated.
Output only the extracted information. No commentary.

Email:
${emailBody}`;

  try {
    console.log("Calling OpenRouter API for email cleaning...");
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
        max_tokens: 1000,
        temperature: 0.5,
      },
      {
        headers: {
          Authorization: `Bearer ${openRouterApiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://github.com",
          "X-Title": "FLOWERS Email Processor",
        },
      },
    );

    console.log("OpenRouter response received:", {
      status: response.status,
      hasContent: !!response.data.choices?.[0]?.message?.content,
    });

    const cleanedContent = response.data.choices[0]?.message?.content || "";
    return cleanedContent.trim();
  } catch (error) {
    console.error("Error cleaning email body:", error);
    if (axios.isAxiosError(error)) {
      console.error("API Error details:", {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
      });
    }
    throw error;
  }
}
