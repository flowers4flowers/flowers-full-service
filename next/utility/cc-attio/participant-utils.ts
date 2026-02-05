import { config } from './config';
import { ParsedMessage } from './email-parser';

/**
 * Checks if an email address should be excluded based on configuration
 */
function isExcluded(email: string): boolean {
  // Check full email matches
  if (config.excludedParticipants.emails.includes(email)) {
    return true;
  }
  
  // Check domain matches
  for (const domain of config.excludedParticipants.domains) {
    if (email.includes(domain)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Cleans an email address by removing any non-email content
 * (newlines, message content, etc.)
 */
function cleanEmail(email: string): string {
  if (!email) return '';
  
  // Take only the first line (in case there are newlines)
  const firstLine = email.split('\n')[0].trim();
  
  // Extract just the email address using regex
  const emailMatch = firstLine.match(/<?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>?/);
  
  return emailMatch ? emailMatch[1] : firstLine;
}

/**
 * Extracts valid participants from parsed email messages, excluding configured
 * internal domains and email addresses.
 * 
 * @param parsedMessages - Array of parsed email message objects
 * @param additionalParticipants - Optional array of additional emails to include (e.g., forwarder)
 * @returns Array of unique, non-excluded email addresses
 * 
 * @example
 * const participants = extractValidParticipants(messages);
 * // Returns: ['client@example.com', 'vendor@supplier.com']
 * // Excludes: ['team@fullservice.art']
 */
export function extractValidParticipants(
  parsedMessages: ParsedMessage[],
  additionalParticipants?: string[]
): string[] {
  // Use Set for automatic deduplication
  const allParticipants = new Set<string>();
  
  // Extract from parsed messages
  parsedMessages.forEach((msg) => {
    if (msg.from) {
      const cleanedFrom = cleanEmail(msg.from);
      if (cleanedFrom) {
        allParticipants.add(cleanedFrom);
      }
    }
    if (msg.to) {
      const cleanedTo = cleanEmail(msg.to);
      if (cleanedTo && cleanedTo !== 'unknown') {
        allParticipants.add(cleanedTo);
      }
    }
  });
  
  // Add any additional participants
  if (additionalParticipants) {
    additionalParticipants.forEach((email) => {
      const cleaned = cleanEmail(email);
      if (cleaned) {
        allParticipants.add(cleaned);
      }
    });
  }
  
  // Filter out excluded participants
  const validParticipants = Array.from(allParticipants).filter(
    (email) => !isExcluded(email)
  );
  
  return validParticipants;
}