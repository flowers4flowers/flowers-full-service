import crypto from "crypto";

/**
 * Strips quote markers from content for normalization.
 * This is used only for hashing, not for display.
 */
function stripQuoteMarkersForHash(content: string): string {
  return content
    .split("\n")
    .map((line) => line.replace(/^>+\s*/, ""))
    .join("\n")
    .trim();
}

/**
 * Generates a consistent hash of message content for duplicate detection.
 * Combines content with sender and date to create a unique fingerprint.
 *
 * IMPORTANT: Strips quote markers before hashing so that quoted versions
 * of the same message are recognized as duplicates.
 *
 * @param content - The message body content
 * @param from - The sender's email address
 * @param date - The message date (null if unavailable)
 * @returns 16-character hash string
 */
export function generateContentHash(
  content: string,
  from: string,
  date: Date | null,
): string {
  // STEP 1: Strip quote markers (NEW)
  const strippedContent = stripQuoteMarkersForHash(content);

  // STEP 2: Normalize content to handle minor formatting differences
  const normalizedContent = strippedContent
    .toLowerCase()
    .replace(/\s+/g, " ") // Replace multiple spaces with single space
    .trim();

  // STEP 3: Combine with metadata
  const dateString = date ? date.toISOString() : "no-date";
  const combinedString = `${from}|${dateString}|${normalizedContent}`;

  // STEP 4: Generate hash
  const hash = crypto.createHash("sha256").update(combinedString).digest("hex");

  return hash.substring(0, 16);
}
