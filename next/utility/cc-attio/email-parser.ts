/**
 * Email Parser Utility
 * Extracts individual messages from forwarded email threads.
 * Supports Gmail, Outlook, and Apple Mail formats.
 */

export interface ParsedMessage {
  from: string; // Extracted sender email
  to: string; // Extracted recipient email (may be empty)
  date: Date | null; // Parsed date (null if unparseable)
  subject: string; // Message subject (may be empty)
  content: string; // Message body content
  originalIndex: number; // Position in thread (0 = oldest)
}

/**
 * Strips Gmail-style quote markers (>) from the beginning of each line.
 * Handles any number of quote markers.
 *
 * Examples:
 *   "> Hello" -> "Hello"
 *   ">>> Hello" -> "Hello"
 *   "Normal line" -> "Normal line"
 *
 * @param content - Raw email content with quote markers
 * @returns Content with quote markers removed
 */
export function stripQuoteMarkers(content: string): string {
  return content
    .split("\n")
    .map((line) => line.replace(/^>+\s*/, ""))
    .join("\n")
    .trim();
}

/**
 * Checks if content consists entirely of quoted lines (lines starting with >).
 * Used to detect messages that are pure quote blocks with no new content.
 *
 * @param content - Raw email content
 * @returns true if all non-empty lines start with >
 */
export function isOnlyQuotedContent(content: string): boolean {
  const lines = content.split("\n").filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    return false;
  }

  const quotedLines = lines.filter((line) => /^>+\s*/.test(line));

  // If 100% of non-empty lines are quoted, this is pure quoted content
  return quotedLines.length === lines.length;
}

/**
 * Checks if content is just boilerplate (signature, disclaimer, etc).
 * Returns true for common patterns that aren't real message content.
 *
 * @param content - Message content to check
 * @returns true if content is boilerplate
 */
export function isBoilerplate(content: string): boolean {
  const trimmed = content.trim();

  // Empty or very short
  if (trimmed.length < 20) {
    return true;
  }

  // Common signature patterns
  const boilerplatePatterns = [
    /^Dev\s+work\/play at/i,
    /^Sent from (my )?iPhone/i,
    /^Sent from (my )?iPad/i,
    /^Get Outlook for/i,
    /^Best regards?,?\s*$/i,
    /^Thanks?,?\s*$/i,
    /^Cheers?,?\s*$/i,
    /^\s*--\s*$/, // Signature delimiter
  ];

  // Check if content only contains boilerplate
  for (const pattern of boilerplatePatterns) {
    if (pattern.test(trimmed)) {
      return true;
    }
  }

  // Check if content is only URLs and whitespace
  const withoutUrls = trimmed.replace(/https?:\/\/[^\s]+/g, "");
  if (withoutUrls.trim().length < 10) {
    return true;
  }

  return false;
}

/**
 * Checks if an email is a forwarded message based on subject line
 */
export function isForwardedEmail(subject: string): boolean {
  const lowerSubject = subject.toLowerCase().trim();
  return lowerSubject.startsWith("fwd:") || lowerSubject.startsWith("fw:");
}

/**
 * Recursively parses nested Gmail-style replies from email content
 * Pattern: "On [Date] at [Time], [Name] <email@domain.com> wrote:"
 *       or "On [Date], [Name] <email@domain.com> wrote:"
 */
/**
 * Recursively parses nested Gmail-style replies from email content.
 * NOW HANDLES QUOTED CONTENT by stripping markers and recursing.
 *
 * Pattern: "On [Date] at [Time], [Name] <email@domain.com> wrote:"
 *
 * @param content - Raw email content (may contain quote markers)
 * @param currentIndex - Current position in message array (for indexing)
 * @param depth - Current recursion depth (for debugging)
 * @param maxDepth - Maximum recursion depth (default 50)
 * @returns Array of parsed messages
 */
export function parseNestedReplies(
  content: string,
  currentIndex: number,
  depth: number = 0,
  maxDepth: number = 50,
): ParsedMessage[] {
  // Recursion safety check
  if (depth >= maxDepth) {
    console.warn(`Max recursion depth ${maxDepth} reached, stopping`);
    return [];
  }

  const messages: ParsedMessage[] = [];

  // STEP 1: Strip quote markers from content
  const strippedContent = stripQuoteMarkers(content);

  // STEP 2: Find all "On X wrote:" patterns
  const replyPattern = /On\s+([^<]+?)\s+([^<]+?)\s+<([^>]+?)>\s+wrote:/gi;
  const matches = Array.from(strippedContent.matchAll(replyPattern));

  console.log(`[Depth ${depth}] Found ${matches.length} nested reply patterns`);

  if (matches.length === 0) {
    // No patterns found, we're done
    return messages;
  }

  // STEP 3: Process each pattern match
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const dateAndName = match[1].trim();
    const name = match[2].trim();
    const email = match[3].trim();
    const matchIndex = match.index || 0;

    // Extract content between this match and the next
    const nextMatchIndex =
      i < matches.length - 1
        ? matches[i + 1].index || strippedContent.length
        : strippedContent.length;

    const rawMessageContent = strippedContent
      .substring(matchIndex + match[0].length, nextMatchIndex)
      .trim();

    // Skip if boilerplate
    if (isBoilerplate(rawMessageContent)) {
      console.log(`[Depth ${depth}] Skipping boilerplate from ${email}`);
      continue;
    }

    // Parse date
    let parsedDate: Date | null = null;
    try {
      const dateMatch = dateAndName.match(/(.+?)\s+(?=\S+\s+\S+\s*$)/);
      const dateStr = dateMatch ? dateMatch[1] : dateAndName;
      parsedDate = new Date(dateStr);
      if (isNaN(parsedDate.getTime())) {
        parsedDate = null;
      }
    } catch (e) {
      console.warn(`[Depth ${depth}] Failed to parse date: ${dateAndName}`);
      parsedDate = null;
    }

    // STEP 4: Add this message
    messages.push({
      from: email,
      to: "unknown",
      date: parsedDate,
      subject: "",
      content: rawMessageContent,
      originalIndex: currentIndex + messages.length,
    });

    console.log(
      `[Depth ${depth}] Extracted message from ${email}, length: ${rawMessageContent.length}`,
    );

    // STEP 5: RECURSIVELY parse this message's content
    // This is the key fix - we dig deeper into the content
    const nestedMessages = parseNestedReplies(
      rawMessageContent,
      currentIndex + messages.length,
      depth + 1,
      maxDepth,
    );

    if (nestedMessages.length > 0) {
      console.log(
        `[Depth ${depth}] Found ${nestedMessages.length} nested messages within message from ${email}`,
      );
      messages.push(...nestedMessages);
    }
  }

  console.log(`[Depth ${depth}] Extracted ${messages.length} total messages`);
  return messages;
}

/**
 * Detects which email client was used based on content markers
 */
export function detectEmailClient(
  body: string,
): "gmail" | "outlook" | "apple" | "unknown" {
  if (body.includes("---------- Forwarded message ---------")) {
    return "gmail";
  }
  if (body.includes("Begin forwarded message:")) {
    return "apple";
  }
  // Outlook pattern: "From:" at start of line followed by email
  if (/^From:\s+.+@.+$/m.test(body)) {
    return "outlook";
  }
  return "unknown";
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
  textBody: string,
): ParsedMessage[] {
  const messages: ParsedMessage[] = [];
  const bodyToUse = textBody || htmlBody;

  console.log("=== Gmail Parser Start ===");
  console.log("Body length:", bodyToUse.length);
  console.log("First 500 chars:", bodyToUse.substring(0, 500));

  try {
    // Split by Gmail's forwarded message delimiter
    const parts = bodyToUse.split("---------- Forwarded message ---------");

    console.log(`Split into ${parts.length} parts`);
    console.log(`Will process ${parts.length - 1} forwarded messages`);

    // First part is the most recent message (before the delimiter)
    // Remaining parts are the forwarded history
    // Replace lines 71-170 in email-parser.ts:

    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];

      console.log(`\n--- Processing part ${i} ---`);
      console.log("Part length:", part.length);
      console.log("Part preview:", part.substring(0, 300));

      // Strip Gmail quote markers (>>) from the beginning of lines
      const cleanedPart = part.replace(/^>+\s*/gm, "");

      // Extract From - more flexible pattern that stops at next header
      const fromMatch = cleanedPart.match(
        /From:\s*(.+?)(?=\r?\n(?:Date:|Subject:|To:|$))/is,
      );
      const fromRaw = fromMatch ? fromMatch[1].trim() : "";
      const fromEmail = extractEmail(fromRaw);

      console.log(
        "From match:",
        fromMatch ? fromMatch[0].substring(0, 100) : "NOT FOUND",
      );
      console.log("From raw:", fromRaw);
      console.log("From email:", fromEmail);

      // Extract Date - more flexible pattern
      const dateMatch = cleanedPart.match(
        /Date:\s*(.+?)(?=\r?\n(?:Subject:|To:|$))/is,
      );
      const dateStr = dateMatch ? dateMatch[1].trim() : "";
      const date = parseEmailDate(dateStr);

      console.log(
        "Date match:",
        dateMatch ? dateMatch[0].substring(0, 100) : "NOT FOUND",
      );
      console.log("Date string:", dateStr);
      console.log("Parsed date:", date);

      // Extract Subject - more flexible pattern
      const subjectMatch = cleanedPart.match(
        /Subject:\s*(.+?)(?=\r?\n(?:To:|$))/is,
      );
      const subject = subjectMatch ? subjectMatch[1].trim() : "";

      console.log(
        "Subject match:",
        subjectMatch ? subjectMatch[0].substring(0, 100) : "NOT FOUND",
      );
      console.log("Subject:", subject);

      // Extract To - more flexible pattern
      const toMatch = cleanedPart.match(/To:\s*(.+?)(?=\r?\n|$)/is);
      const toRaw = toMatch ? toMatch[1].trim() : "";
      const toEmail = extractEmail(toRaw);

      console.log(
        "To match:",
        toMatch ? toMatch[0].substring(0, 100) : "NOT FOUND",
      );
      console.log("To raw:", toRaw);
      console.log("To email:", toEmail);

      // Extract content - everything after the last header field
      const contentStart = Math.max(
        cleanedPart.lastIndexOf("To:"),
        cleanedPart.lastIndexOf("Subject:"),
        cleanedPart.lastIndexOf("Date:"),
        cleanedPart.lastIndexOf("From:"),
      );

      let content = "";
      if (contentStart !== -1) {
        // Get everything after the last header, skip the header line itself
        const afterHeader = cleanedPart.substring(contentStart);
        content = afterHeader.replace(/^[^:]+:.+?(\r?\n)+/s, "").trim();
      } else {
        content = cleanedPart.trim();
      }

      console.log("Content start position:", contentStart);
      console.log("Content length:", content.length);
      console.log("Content preview:", content.substring(0, 200));

      // Check for nested quoted replies within this content
      const quotedReplies = extractQuotedReplies(content);
      console.log(
        `Found ${quotedReplies.length} quoted replies within this message`,
      );

      if (fromEmail) {
        const message = {
          from: fromEmail,
          to: toEmail,
          date,
          subject,
          content: cleanContent(content),
          originalIndex: i - 1,
        };

        console.log("Adding message:", {
          from: message.from,
          to: message.to,
          subject: message.subject,
          contentLength: message.content.length,
          originalIndex: message.originalIndex,
        });

        messages.push(message);

        // Add the quoted replies as separate messages
        quotedReplies.forEach((quotedReply, idx) => {
          console.log(`Adding quoted reply ${idx + 1}:`, {
            from: quotedReply.from,
            contentPreview: quotedReply.content.substring(0, 100),
          });
          messages.push({
            ...quotedReply,
            originalIndex: i - 1 + idx + 1, // Sequential index
          });
        });
      } else {
        console.log("Skipping part - no from email found");
      }
    }
  } catch (error) {
    console.error("Error parsing Gmail thread:", error);
  }

  console.log(
    `\n=== Gmail Parser Complete: ${messages.length} messages parsed ===\n`,
  );

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
  textBody: string,
): ParsedMessage[] {
  const messages: ParsedMessage[] = [];
  const bodyToUse = textBody || htmlBody;

  console.log("=== Outlook Parser Start ===");
  console.log("Body length:", bodyToUse.length);

  try {
    // Split by "From:" at start of line (indicates new message)
    const parts = bodyToUse.split(/(?=^From:\s+.+@.+$)/m);

    console.log(`Split into ${parts.length} parts`);

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];

      console.log(`\n--- Processing part ${i} ---`);

      // Must contain "From:" to be a valid message
      if (!part.match(/^From:\s+.+@.+$/m)) {
        console.log("Skipping - no From: header found");
        continue;
      }

      // Extract From
      const fromMatch = part.match(/From:\s*(.+?)(?:\r?\n|$)/i);
      const fromRaw = fromMatch ? fromMatch[1].trim() : "";
      const fromEmail = extractEmail(fromRaw);

      console.log("From email:", fromEmail);

      // Extract Date (Outlook uses "Sent:")
      const dateMatch = part.match(/Sent:\s*(.+?)(?:\r?\n|$)/i);
      const dateStr = dateMatch ? dateMatch[1].trim() : "";
      const date = parseEmailDate(dateStr);

      console.log("Date:", dateStr);

      // Extract To
      const toMatch = part.match(/To:\s*(.+?)(?:\r?\n|$)/i);
      const toRaw = toMatch ? toMatch[1].trim() : "";
      const toEmail = extractEmail(toRaw);

      console.log("To email:", toEmail);

      // Extract Subject
      const subjectMatch = part.match(/Subject:\s*(.+?)(?:\r?\n|$)/i);
      const subject = subjectMatch ? subjectMatch[1].trim() : "";

      console.log("Subject:", subject);

      // Extract content (everything after the headers)
      const contentMatch = part.match(/Subject:\s*.+?(?:\r?\n)+(.+)/is);
      const content = contentMatch ? contentMatch[1].trim() : "";

      console.log("Content length:", content.length);

      if (fromEmail) {
        const message = {
          from: fromEmail,
          to: toEmail,
          date,
          subject,
          content: cleanContent(content),
          originalIndex: i,
        };

        console.log("Adding message:", {
          from: message.from,
          originalIndex: message.originalIndex,
        });

        messages.push(message);
      }
    }
  } catch (error) {
    console.error("Error parsing Outlook thread:", error);
  }

  console.log(
    `\n=== Outlook Parser Complete: ${messages.length} messages parsed ===\n`,
  );

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
  textBody: string,
): ParsedMessage[] {
  const messages: ParsedMessage[] = [];
  const bodyToUse = textBody || htmlBody;

  console.log("=== Apple Mail Parser Start ===");
  console.log("Body length:", bodyToUse.length);

  try {
    // Split by Apple Mail's forwarded message delimiter
    const parts = bodyToUse.split(/Begin forwarded message:/i);

    console.log(`Split into ${parts.length} parts`);

    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];

      console.log(`\n--- Processing part ${i} ---`);

      // Extract From
      const fromMatch = part.match(/From:\s*(.+?)(?:\r?\n|$)/i);
      const fromRaw = fromMatch ? fromMatch[1].trim() : "";
      const fromEmail = extractEmail(fromRaw);

      console.log("From email:", fromEmail);

      // Extract Subject
      const subjectMatch = part.match(/Subject:\s*(.+?)(?:\r?\n|$)/i);
      const subject = subjectMatch ? subjectMatch[1].trim() : "";

      console.log("Subject:", subject);

      // Extract Date
      const dateMatch = part.match(/Date:\s*(.+?)(?:\r?\n|$)/i);
      const dateStr = dateMatch ? dateMatch[1].trim() : "";
      const date = parseEmailDate(dateStr);

      console.log("Date:", dateStr);

      // Extract To
      const toMatch = part.match(/To:\s*(.+?)(?:\r?\n|$)/i);
      const toRaw = toMatch ? toMatch[1].trim() : "";
      const toEmail = extractEmail(toRaw);

      console.log("To email:", toEmail);

      // Extract content (everything after To: field)
      const contentMatch = part.match(/To:\s*.+?(?:\r?\n)+(.+)/is);
      const content = contentMatch ? contentMatch[1].trim() : part.trim();

      console.log("Content length:", content.length);

      if (fromEmail) {
        const message = {
          from: fromEmail,
          to: toEmail,
          date,
          subject,
          content: cleanContent(content),
          originalIndex: i - 1,
        };

        console.log("Adding message:", {
          from: message.from,
          originalIndex: message.originalIndex,
        });

        messages.push(message);
      }
    }
  } catch (error) {
    console.error("Error parsing Apple Mail thread:", error);
  }

  console.log(
    `\n=== Apple Mail Parser Complete: ${messages.length} messages parsed ===\n`,
  );

  return messages;
}

/**
 * Main parsing function - detects client and routes to appropriate parser
 */
export function parseForwardedEmail(
  subject: string,
  htmlBody: string,
  textBody: string,
): ParsedMessage[] {
  const bodyToUse = textBody || htmlBody;
  const messages: ParsedMessage[] = [];

  // Split by forward delimiter
  const parts = bodyToUse.split("---------- Forwarded message ---------");

  if (parts.length <= 1) {
    console.log("No forward delimiter found");
    return messages;
  }

  // Skip the first part (it's the covering message, handled separately in route.ts)
  // Process each forwarded section
  for (let i = 1; i < parts.length; i++) {
    const section = parts[i].trim();

    // Extract headers from forwarded message
    const fromMatch = section.match(/From:\s*(.+?)\s*<(.+?)>/i);
    const dateMatch = section.match(
      /Date:\s*(.+?)(?=\n(?:Subject:|To:|From:|$))/is,
    );
    const subjectMatch = section.match(
      /Subject:\s*(.+?)(?=\n(?:To:|From:|Date:|$))/is,
    );
    const toMatch = section.match(/To:\s*<?(.+?)>?(?=\n|$)/i);

    if (!fromMatch || !dateMatch) {
      console.warn(`Skipping section ${i}: missing From or Date`);
      continue;
    }

    const from = fromMatch[2].trim();
    const to = toMatch ? toMatch[1].trim() : "unknown";
    const dateStr = dateMatch[1].trim();
    const subjectStr = subjectMatch ? subjectMatch[1].trim() : null;

    // Parse date
    let parsedDate: Date | null = null;
    try {
      parsedDate = new Date(dateStr);
      if (isNaN(parsedDate.getTime())) {
        parsedDate = null;
      }
    } catch (e) {
      parsedDate = null;
    }

    // Extract content (everything after headers)
    const contentStartRegex = /(?:Subject:|To:|From:|Date:).+?\n\n/is;
    const contentMatch = section.match(contentStartRegex);
    let rawContent = section;

    if (contentMatch) {
      const headerEndIndex = (contentMatch.index || 0) + contentMatch[0].length;
      rawContent = section.substring(headerEndIndex);
    }

    // Clean up the content
    const cleanedContent = rawContent
      .split(/Dev work\/play at/)[0]
      .split(/--\s*$/m)[0]
      .trim();

    // NEW: Strip quote markers before processing
    const strippedContent = stripQuoteMarkers(cleanedContent);

    // NEW: Skip if only quoted content (entire message is a quote)
    if (isOnlyQuotedContent(cleanedContent)) {
      console.log(`Skipping section ${i}: entirely quoted content`);
      continue;
    }

    // NEW: Skip if boilerplate
    if (isBoilerplate(strippedContent)) {
      console.log(`Skipping section ${i}: boilerplate content`);
      continue;
    }

    // Check for nested replies (now recursive)
    const nestedMessages = parseNestedReplies(
      strippedContent, // Use stripped content instead of cleanedContent
      messages.length, // Changed from messages.length + 1 to messages.length
      0, // Start at depth 0
    );

    if (nestedMessages.length > 0) {
      console.log(
        `Section ${i}: Found ${nestedMessages.length} nested messages`,
      );
      messages.push(...nestedMessages);
    } else {
      // No nested replies, add this as single message
      messages.push({
        from,
        to,
        date: parsedDate,
        subject: subjectStr,
        content: strippedContent, // Use stripped content instead of cleanedContent
        originalIndex: messages.length,
      });
    }
  }

  console.log(`Parsed ${messages.length} messages from forwarded email`);
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
  const emailMatch = text.match(
    /<?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>?/,
  );
  return emailMatch ? emailMatch[1] : "";
}

/**
 * Helper: Extracts quoted inline replies from email content
 * Looks for pattern: "On [date] [name] <email> wrote:" followed by quoted text (lines starting with >)
 */
function extractQuotedReplies(content: string): ParsedMessage[] {
  const replies: ParsedMessage[] = [];

  // Pattern: On Thu, Jan 29, 2026 at 3:49 PM FLOWERS (Studio) <studio@flowersfullservice.art> wrote:
  // Followed by optional blank lines, then quoted text starting with >
  const quotePattern =
    /On\s+.+?\s+(.+?)\s*<(.+?)>\s+wrote:\s*\n+((?:(?:>\s*.+\n?)+)?)/gi;

  let match;
  while ((match = quotePattern.exec(content)) !== null) {
    const name = match[1].trim();
    const email = match[2].trim();
    const quotedText = match[3];

    console.log("Found potential quoted reply:", {
      name,
      email,
      quotedTextLength: quotedText.length,
    });

    // Remove the > characters from quoted text
    const cleanedContent = quotedText
      .split("\n")
      .map((line) => line.replace(/^>\s?/, ""))
      .filter((line) => line.trim().length > 0) // Remove empty lines
      .join("\n")
      .trim();

    console.log("Cleaned quoted content:", cleanedContent.substring(0, 100));

    if (cleanedContent.length > 0) {
      replies.push({
        from: email,
        to: "", // We don't know the recipient from quoted text
        date: null, // Could try to parse the date from "On [date]" but it's complex
        subject: "", // Not available in quoted text
        content: cleanedContent,
        originalIndex: 0, // Will be set by caller
      });
    }
  }

  return replies;
}

/**
 * Helper: Parses various date formats into Date object
 * Handles common formats from Gmail, Outlook, Apple Mail
 */
function parseEmailDate(dateStr: string): Date | null {
  if (!dateStr) return null;

  try {
    // Gmail format: "Sat, Jan 31, 2026 at 11:26 AM"
    // Need to replace "at" with nothing to make it parseable
    const normalizedDateStr = dateStr.replace(/ at /i, " ");

    const date = new Date(normalizedDateStr);
    if (!isNaN(date.getTime())) {
      return date;
    }
  } catch (error) {
    console.warn("Failed to parse date:", dateStr);
  }

  return null;
}

/**
 * Helper: Cleans content by removing common artifacts
 */
function cleanContent(content: string): string {
  return content
    .replace(/Begin forwarded message:/gi, "")
    .replace(/---------- Forwarded message ---------/g, "")
    .replace(/^From:\s*.+$/gm, "") // Remove nested From: lines
    .replace(/^Sent:\s*.+$/gm, "") // Remove nested Sent: lines
    .replace(/^Date:\s*.+$/gm, "") // Remove nested Date: lines
    .replace(/^To:\s*.+$/gm, "") // Remove nested To: lines
    .replace(/^Subject:\s*.+$/gm, "") // Remove nested Subject: lines
    .trim();
}
