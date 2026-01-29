import crypto from 'crypto';

/**
 * Generates a consistent hash of message content for duplicate detection.
 * Combines content with sender and date to create a unique fingerprint.
 * 
 * @param content - The message body content
 * @param from - The sender's email address
 * @param date - The message date (null if unavailable)
 * @returns 16-character hash string
 */
export function generateContentHash(
  content: string,
  from: string,
  date: Date | null
): string {
  // Normalize content to handle minor formatting differences
  const normalizedContent = content
    .toLowerCase()
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .trim();
  
  // Combine sender, date, and content into single string
  const dateString = date ? date.toISOString() : 'no-date';
  const combinedString = `${from}|${dateString}|${normalizedContent}`;
  
  // Generate SHA-256 hash
  const hash = crypto
    .createHash('sha256')
    .update(combinedString)
    .digest('hex');
  
  // Return first 16 characters (same length as threadId for consistency)
  return hash.substring(0, 16);
}