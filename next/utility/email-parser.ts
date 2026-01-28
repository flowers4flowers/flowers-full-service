/**
 * Email Parser Utility
 * Extracts individual messages from forwarded email threads.
 * Supports Gmail, Outlook, and Apple Mail formats.
 */

export interface ParsedMessage {
  from: string;           // Extracted sender email
  to: string;             // Extracted recipient email (may be empty)
  date: Date | null;      // Parsed date (null if unparseable)
  subject: string;        // Message subject (may be empty)
  content: string;        // Message body content
  originalIndex: number;  // Position in thread (0 = oldest)
}

/**
 * Checks if an email is a forwarded message based on subject line
 */
export function isForwardedEmail(subject: string): boolean {
  const lowerSubject = subject.toLowerCase().trim();
  return lowerSubject.startsWith('fwd:') || lowerSubject.startsWith('fw:');
}

/**
 * Detects which email client was used based on content markers
 */
export function detectEmailClient(
  body: string
): 'gmail' | 'outlook' | 'apple' | 'unknown' {
  if (body.includes('---------- Forwarded message ---------')) {
    return 'gmail';
  }
  if (body.includes('Begin forwarded message:')) {
    return 'apple';
  }
  // Outlook pattern: "From:" at start of line followed by email
  if (/^From:\s+.+@.+$/m.test(body)) {
    return 'outlook';
  }
  return 'unknown';
}

/**
 * Parses Gmail-formatted forwarded emails
 * Format: ---------- Forwarded message ---------
 *         From: Name <email>
 *         Date: Wed, Jan 28, 2026 at 2:40 PM
 *         Subject: subject line
 *         To: <email>
 */
export function parseGmailThread(
  htmlBody: string,
  textBody: string
): ParsedMessage[] {
  const messages: ParsedMessage[] = [];
  const bodyToUse = textBody || htmlBody;
  
  try {
    // Split by Gmail's forwarded message delimiter
    const parts = bodyToUse.split('---------- Forwarded message ---------');
    
    // First part is the most recent message (before the delimiter)
    // Remaining parts are the forwarded history
    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];
      
      // Extract From
      const fromMatch = part.match(/From:\s*(.+?)(?:\r?\n|$)/i);
      const fromRaw = fromMatch ? fromMatch[1].trim() : '';
      const fromEmail = extractEmail(fromRaw);
      
      // Extract Date
      const dateMatch = part.match(/Date:\s*(.+?)(?:\r?\n|$)/i);
      const dateStr = dateMatch ? dateMatch[1].trim() : '';
      const date = parseEmailDate(dateStr);
      
      // Extract Subject
      const subjectMatch = part.match(/Subject:\s*(.+?)(?:\r?\n|$)/i);
      const subject = subjectMatch ? subjectMatch[1].trim() : '';
      
      // Extract To
      const toMatch = part.match(/To:\s*(.+?)(?:\r?\n|$)/i);
      const toRaw = toMatch ? toMatch[1].trim() : '';
      const toEmail = extractEmail(toRaw);
      
      // Extract content (everything after To: field)
      const contentMatch = part.match(/To:\s*.+?(?:\r?\n)+(.+)/is);
      const content = contentMatch ? contentMatch[1].trim() : part.trim();
      
      if (fromEmail) {
        messages.push({
          from: fromEmail,
          to: toEmail,
          date,
          subject,
          content: cleanContent(content),
          originalIndex: i - 1
        });
      }
    }
  } catch (error) {
    console.error('Error parsing Gmail thread:', error);
  }
  
  return messages;
}

/**
 * Parses Outlook-formatted forwarded emails
 * Format: From: email
 *         Sent: date
 *         To: email
 *         Subject: subject
 */
export function parseOutlookThread(
  htmlBody: string,
  textBody: string
): ParsedMessage[] {
  const messages: ParsedMessage[] = [];
  const bodyToUse = textBody || htmlBody;
  
  try {
    // Split by "From:" at start of line (indicates new message)
    const parts = bodyToUse.split(/(?=^From:\s+.+@.+$)/m);
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      
      // Must contain "From:" to be a valid message
      if (!part.match(/^From:\s+.+@.+$/m)) {
        continue;
      }
      
      // Extract From
      const fromMatch = part.match(/From:\s*(.+?)(?:\r?\n|$)/i);
      const fromRaw = fromMatch ? fromMatch[1].trim() : '';
      const fromEmail = extractEmail(fromRaw);
      
      // Extract Date (Outlook uses "Sent:")
      const dateMatch = part.match(/Sent:\s*(.+?)(?:\r?\n|$)/i);
      const dateStr = dateMatch ? dateMatch[1].trim() : '';
      const date = parseEmailDate(dateStr);
      
      // Extract To
      const toMatch = part.match(/To:\s*(.+?)(?:\r?\n|$)/i);
      const toRaw = toMatch ? toMatch[1].trim() : '';
      const toEmail = extractEmail(toRaw);
      
      // Extract Subject
      const subjectMatch = part.match(/Subject:\s*(.+?)(?:\r?\n|$)/i);
      const subject = subjectMatch ? subjectMatch[1].trim() : '';
      
      // Extract content (everything after the headers)
      const contentMatch = part.match(/Subject:\s*.+?(?:\r?\n)+(.+)/is);
      const content = contentMatch ? contentMatch[1].trim() : '';
      
      if (fromEmail) {
        messages.push({
          from: fromEmail,
          to: toEmail,
          date,
          subject,
          content: cleanContent(content),
          originalIndex: i
        });
      }
    }
  } catch (error) {
    console.error('Error parsing Outlook thread:', error);
  }
  
  return messages;
}

/**
 * Parses Apple Mail-formatted forwarded emails
 * Format: Begin forwarded message:
 *         From: Name <email>
 *         Subject: subject
 *         Date: date
 *         To: email
 */
export function parseAppleMailThread(
  htmlBody: string,
  textBody: string
): ParsedMessage[] {
  const messages: ParsedMessage[] = [];
  const bodyToUse = textBody || htmlBody;
  
  try {
    // Split by Apple Mail's forwarded message delimiter
    const parts = bodyToUse.split(/Begin forwarded message:/i);
    
    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];
      
      // Extract From
      const fromMatch = part.match(/From:\s*(.+?)(?:\r?\n|$)/i);
      const fromRaw = fromMatch ? fromMatch[1].trim() : '';
      const fromEmail = extractEmail(fromRaw);
      
      // Extract Subject
      const subjectMatch = part.match(/Subject:\s*(.+?)(?:\r?\n|$)/i);
      const subject = subjectMatch ? subjectMatch[1].trim() : '';
      
      // Extract Date
      const dateMatch = part.match(/Date:\s*(.+?)(?:\r?\n|$)/i);
      const dateStr = dateMatch ? dateMatch[1].trim() : '';
      const date = parseEmailDate(dateStr);
      
      // Extract To
      const toMatch = part.match(/To:\s*(.+?)(?:\r?\n|$)/i);
      const toRaw = toMatch ? toMatch[1].trim() : '';
      const toEmail = extractEmail(toRaw);
      
      // Extract content (everything after To: field)
      const contentMatch = part.match(/To:\s*.+?(?:\r?\n)+(.+)/is);
      const content = contentMatch ? contentMatch[1].trim() : part.trim();
      
      if (fromEmail) {
        messages.push({
          from: fromEmail,
          to: toEmail,
          date,
          subject,
          content: cleanContent(content),
          originalIndex: i - 1
        });
      }
    }
  } catch (error) {
    console.error('Error parsing Apple Mail thread:', error);
  }
  
  return messages;
}

/**
 * Main parsing function - detects client and routes to appropriate parser
 */
export function parseForwardedEmail(
  subject: string,
  htmlBody: string,
  textBody: string
): ParsedMessage[] {
  if (!isForwardedEmail(subject)) {
    return [];
  }
  
  const bodyToUse = textBody || htmlBody;
  const client = detectEmailClient(bodyToUse);
  
  let messages: ParsedMessage[] = [];
  
  switch (client) {
    case 'gmail':
      messages = parseGmailThread(htmlBody, textBody);
      break;
    case 'outlook':
      messages = parseOutlookThread(htmlBody, textBody);
      break;
    case 'apple':
      messages = parseAppleMailThread(htmlBody, textBody);
      break;
    default:
      console.warn('Unknown email client format, attempting Gmail parser');
      messages = parseGmailThread(htmlBody, textBody);
  }
  
  console.log(`Parsed ${messages.length} messages from ${client} format`);
  return messages;
}

/**
 * Helper: Extracts email address from various formats
 * Examples:
 *   "John Doe <john@example.com>" -> "john@example.com"
 *   "john@example.com" -> "john@example.com"
 *   "<john@example.com>" -> "john@example.com"
 */
function extractEmail(text: string): string {
  const emailMatch = text.match(/<?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>?/);
  return emailMatch ? emailMatch[1] : '';
}

/**
 * Helper: Parses various date formats into Date object
 * Handles common formats from Gmail, Outlook, Apple Mail
 */
function parseEmailDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  
  try {
    // Try standard Date parsing first
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date;
    }
  } catch (error) {
    console.warn('Failed to parse date:', dateStr);
  }
  
  return null;
}

/**
 * Helper: Cleans content by removing common artifacts
 */
function cleanContent(content: string): string {
  return content
    .replace(/Begin forwarded message:/gi, '')
    .replace(/---------- Forwarded message ---------/g, '')
    .replace(/^From:\s*.+$/gm, '') // Remove nested From: lines
    .replace(/^Sent:\s*.+$/gm, '') // Remove nested Sent: lines
    .replace(/^Date:\s*.+$/gm, '') // Remove nested Date: lines
    .replace(/^To:\s*.+$/gm, '')   // Remove nested To: lines
    .replace(/^Subject:\s*.+$/gm, '') // Remove nested Subject: lines
    .trim();
}