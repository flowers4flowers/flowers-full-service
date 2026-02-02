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
      allParticipants.add(msg.from);
    }
    if (msg.to) {
      allParticipants.add(msg.to);
    }
  });
  
  // Add any additional participants
  if (additionalParticipants) {
    additionalParticipants.forEach((email) => {
      allParticipants.add(email);
    });
  }
  
  // Filter out excluded participants
  const validParticipants = Array.from(allParticipants).filter(
    (email) => !isExcluded(email)
  );
  
  return validParticipants;
}