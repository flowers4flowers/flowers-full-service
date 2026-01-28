import crypto from 'crypto';
import { ParsedMessage } from './email-parser';

/**
 * Generates a thread ID from parsed messages using hybrid strategy:
 * 1. Try to extract original Message-ID from first message
 * 2. Fall back to subject-based hashing
 */
export function generateThreadIdFromParsedMessages(
  parsedMessages: ParsedMessage[],
  subject: string
): string {
  if (parsedMessages.length === 0) {
    // No parsed messages, use subject-based fallback
    return generateThreadIdFromSubject(subject);
  }
  
  // Try to extract Message-ID from the first (oldest) message
  const firstMessage = parsedMessages[0];
  const messageId = extractMessageId(firstMessage.content);
  
  if (messageId) {
    // Found a Message-ID, use it for threading
    return crypto
      .createHash('sha256')
      .update(messageId)
      .digest('hex')
      .substring(0, 16);
  }
  
  // No Message-ID found, fall back to subject-based
  return generateThreadIdFromSubject(subject);
}

/**
 * Generates thread ID from subject line (fallback method)
 */
function generateThreadIdFromSubject(subject: string): string {
  const cleanSubject = subject
    .replace(/^(re|fwd|fw):\s*/gi, '')
    .trim()
    .toLowerCase();
  
  return crypto
    .createHash('sha256')
    .update(cleanSubject)
    .digest('hex')
    .substring(0, 16);
}

/**
 * Attempts to extract Message-ID from email content
 * Common patterns: "Message-ID: <value>" or "Message-Id: <value>"
 */
function extractMessageId(content: string): string | null {
  // Pattern 1: Message-ID: <some-id@domain.com>
  const pattern1 = /Message-I[Dd]:\s*<?([^\s>]+@[^\s>]+)>?/i;
  const match1 = content.match(pattern1);
  if (match1) {
    return match1[1];
  }
  
  // Pattern 2: In headers, might be formatted differently
  const pattern2 = /Message-I[Dd]:\s*<([^>]+)>/i;
  const match2 = content.match(pattern2);
  if (match2) {
    return match2[1];
  }
  
  return null;
}

/**
 * Original function for generating thread ID from subject and headers
 * Used for single (non-forwarded) emails
 */
export function generateThreadId(subject: string, headers?: any): string {
  // Clean the subject line by removing Re:, Fwd:, etc.
  let cleanSubject = subject
    .replace(/^(re|fwd|fw):\s*/gi, '')
    .trim()
    .toLowerCase();
  
  // If there's an In-Reply-To or References header, use that for threading
  // Postmark provides these in the Headers array
  if (headers) {
    const inReplyTo = headers.find((h: any) => 
      h.Name.toLowerCase() === 'in-reply-to'
    );
    const references = headers.find((h: any) => 
      h.Name.toLowerCase() === 'references'
    );
    
    if (inReplyTo?.Value) {
      // Use the first message ID from the thread
      return crypto
        .createHash('sha256')
        .update(inReplyTo.Value)
        .digest('hex')
        .substring(0, 16);
    }
    
    if (references?.Value) {
      // Use the first reference
      const firstRef = references.Value.split(' ')[0];
      return crypto
        .createHash('sha256')
        .update(firstRef)
        .digest('hex')
        .substring(0, 16);
    }
  }
  
  // Fallback to subject-based threading
  return crypto
    .createHash('sha256')
    .update(cleanSubject)
    .digest('hex')
    .substring(0, 16);
}