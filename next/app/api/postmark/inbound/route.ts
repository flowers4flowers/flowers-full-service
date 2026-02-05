// next/app/api/postmark/inbound/route.ts

import { NextResponse } from "next/server";
import { getDb } from "../../../../utility/db";
import {
  generateThreadId,
  generateThreadIdFromParsedMessages,
} from "../../../../utility/cc-attio/thread-id";
import {
  isForwardedEmail,
  parseForwardedEmail,
  parseNestedReplies,
  stripQuoteMarkers,
  isBoilerplate,
} from "../../../../utility/cc-attio/email-parser";
import { generateContentHash } from "../../../../utility/cc-attio/content-hash";
import { checkForDuplicates } from "../../../../utility/cc-attio/duplicate-checker";
import { inngest } from "../../../../utility/inngest/client";

export const runtime = "nodejs";

export async function POST(req: Request) {
  console.log("=== WEBHOOK HIT ===");

  try {
    const body = await req.json();
    console.log("Received email from:", body.From);
    console.log("Subject:", body.Subject);

    const db = await getDb();
    console.log("Connected to DB");

    // Check if this is a forwarded email
    const isForwarded = isForwardedEmail(body.Subject);

    const parsedMessages = parseForwardedEmail(
      body.Subject,
      body.HtmlBody,
      body.TextBody,
    );

    if (!isForwarded) {
      // NOT FORWARDED - Use existing single-email logic
      console.log("Not a forwarded email, using standard flow");

      const threadId = generateThreadId(body.Subject, body.Headers);
      const receivedAt = new Date();

      await db.collection("inbound_emails").insertOne({
        messageId: body.MessageID,
        threadId,
        from: body.From,
        to: body.To,
        subject: body.Subject,
        body: body.TextBody || body.HtmlBody,
        headers: body.Headers,
        receivedAt,
        rawPostmarkData: body,
      });

      const threadUpdate = {
        $set: {
          subject: body.Subject.replace(/^(re|fwd|fw):\s*/gi, "").trim(),
          lastEmailAt: receivedAt,
        },
        $addToSet: {
          participants: { $each: [body.From, body.To] },
        },
        $inc: {
          emailCount: 1,
        },
        $setOnInsert: {
          threadId,
          firstEmailAt: receivedAt,
          processed: false,
          processingStatus: "unprocessed",
          attioDealId: null,
          dealData: null,
          processingError: null,
        },
      };

      await db
        .collection("email_threads")
        .updateOne({ threadId }, threadUpdate, { upsert: true });

      console.log("Single email saved:", body.MessageID, "Thread:", threadId);

      // Trigger async processing via Inngest
      await inngest.send({
        name: "email/thread.received",
        data: {
          parsedMessages: [
            {
              from: body.From,
              to: body.To,
              date: receivedAt,
              subject: body.Subject.replace(/^(re|fwd|fw):\s*/gi, "").trim(),
              content: body.TextBody || body.HtmlBody,
              originalIndex: 0,
            },
          ],
          threadId,
        },
      });
      console.log(`Triggered Inngest processing for thread: ${threadId}`);

      return NextResponse.json({ ok: true });
    }

    // FORWARDED EMAIL - Parse conversation history
    console.log("Forwarded email detected, parsing conversation history");

    if (parsedMessages.length === 0) {
      // Parsing failed, fall back to single-email save
      console.warn(
        "Failed to parse forwarded email, falling back to single-email save",
      );

      const threadId = generateThreadId(body.Subject, body.Headers);
      const receivedAt = new Date();

      await db.collection("inbound_emails").insertOne({
        messageId: body.MessageID,
        threadId,
        from: body.From,
        to: body.To,
        subject: body.Subject,
        body: body.TextBody || body.HtmlBody,
        headers: body.Headers,
        receivedAt,
        rawPostmarkData: body,
        parsingFailed: true,
      });

      const threadUpdate = {
        $set: {
          subject: body.Subject.replace(/^(re|fwd|fw):\s*/gi, "").trim(),
          lastEmailAt: receivedAt,
        },
        $addToSet: {
          participants: { $each: [body.From, body.To] },
        },
        $inc: {
          emailCount: 1,
        },
        $setOnInsert: {
          threadId,
          firstEmailAt: receivedAt,
          processed: false,
          processingStatus: "unprocessed",
          attioDealId: null,
          dealData: null,
          processingError: "Failed to parse forwarded email",
        },
      };

      await db
        .collection("email_threads")
        .updateOne({ threadId }, threadUpdate, { upsert: true });

      console.log("Fallback save completed:", body.MessageID);

      // Trigger async processing via Inngest
      await inngest.send({
        name: "email/thread.received",
        data: {
          parsedMessages: [
            {
              from: body.From,
              to: body.To,
              date: new Date(),
              subject: body.Subject.replace(/^(re|fwd|fw):\s*/gi, "").trim(),
              content: body.TextBody || body.HtmlBody,
              originalIndex: 0,
            },
          ],
          threadId,
        },
      });
      console.log(`Triggered Inngest processing for thread: ${threadId}`);

      return NextResponse.json({ ok: true });
    }

    console.log(
      `Successfully parsed ${parsedMessages.length} messages from forwarded email`,
    );

    // Extract the covering message (the newest one that wraps the forward)
    const bodyToUse = body.TextBody || body.HtmlBody;
    const parts = bodyToUse.split("---------- Forwarded message ---------");
    const coveringMessageRaw = parts[0]?.trim();

    console.log("\n=== Checking for covering message ===");
    console.log("Parts found:", parts.length);
    console.log(
      "Covering message raw length:",
      coveringMessageRaw?.length || 0,
    );
    console.log(
      "Covering message preview:",
      coveringMessageRaw?.substring(0, 300),
    );

    // If there's content before the first forward delimiter, it's the newest message
    if (coveringMessageRaw && coveringMessageRaw.length > 10) {
      console.log("Found covering message (most recent)");

      const dateMatch = coveringMessageRaw.match(
        /Date:\s*(.+?)(?=\r?\n(?:Subject:|To:|$))/is,
      );
      const dateStr = dateMatch ? dateMatch[1].trim() : "";
      const coveringDate = dateStr ? new Date(dateStr) : new Date();

      console.log("Covering message date string:", dateStr);
      console.log("Covering message parsed date:", coveringDate);

      const cleanedCovering = coveringMessageRaw
        .replace(/From:\s*.+?(?=\r?\n)/is, "")
        .replace(/Date:\s*.+?(?=\r?\n)/is, "")
        .replace(/Subject:\s*.+?(?=\r?\n)/is, "")
        .replace(/To:\s*.+?(?=\r?\n)/is, "")
        .split(/Dev work\/play at/)[0]
        .split(/--\s*$/m)[0]
        .split(/Best regards/i)[0]
        .split(/Thanks/i)[0]
        .trim();

      console.log("Cleaned covering message:", cleanedCovering);
      console.log("Cleaned covering message length:", cleanedCovering.length);

      // NEW: Strip quote markers
      const strippedCovering = stripQuoteMarkers(cleanedCovering);

      console.log("Stripped covering message:", strippedCovering);
      console.log("Stripped covering message length:", strippedCovering.length);

      // NEW: Skip if boilerplate
      if (isBoilerplate(strippedCovering)) {
        console.log("Covering message is boilerplate, skipping");
      } else if (strippedCovering.length > 0) {
        // Check for nested replies (now with depth tracking)
        const nestedInCovering = parseNestedReplies(
          strippedCovering,
          parsedMessages.length,
          0, // Start at depth 0
        );

        if (nestedInCovering.length > 0) {
          console.log(
            `Found ${nestedInCovering.length} nested replies in covering message`,
          );
          parsedMessages.push(...nestedInCovering);
        } else {
          // No nested replies, add as single message
          const coveringMessage = {
            from: body.From,
            to: body.To,
            date: coveringDate,
            subject: body.Subject.replace(/^(re|fwd|fw):\s*/gi, "").trim(),
            content: strippedCovering, // Use stripped content
            originalIndex: parsedMessages.length,
          };

          parsedMessages.push(coveringMessage);
        }
      } else {
        console.log("Covering message empty after stripping, skipping");
      }
    } else {
      console.log("No covering message found or too short");
    }

    console.log(`Total messages including covering: ${parsedMessages.length}`);

    // Generate threadId using hybrid strategy
    const threadId = generateThreadIdFromParsedMessages(
      parsedMessages,
      body.Subject,
    );

    console.log("Generated threadId:", threadId);

    // STEP 1: Renumber all messages sequentially
    parsedMessages.forEach((msg, index) => {
      msg.originalIndex = index;
    });

    console.log(
      `Total parsed messages before deduplication: ${parsedMessages.length}`,
    );

    // STEP 2: Generate content hashes
    const contentHashes = parsedMessages.map((msg) =>
      generateContentHash(msg.content, msg.from, msg.date),
    );

    console.log(`Generated ${contentHashes.length} content hashes`);

    // STEP 3: Check for duplicates against DB
    const existingHashes = await checkForDuplicates(
      db,
      threadId,
      contentHashes,
    );

    console.log(`Found ${existingHashes.length} existing messages in DB`);

    // STEP 4: Filter out messages that already exist in DB
    const messagesToSave = parsedMessages.filter(
      (msg, index) => !existingHashes.includes(contentHashes[index]),
    );

    console.log(
      `Messages to save after DB deduplication: ${messagesToSave.length}`,
    );

    // STEP 5: Additional in-memory deduplication
    const seenHashes = new Set<string>();
    const uniqueMessagesToSave = messagesToSave.filter((msg, index) => {
      const hashIndex = parsedMessages.indexOf(msg);
      const hash = contentHashes[hashIndex];

      if (seenHashes.has(hash)) {
        console.log(`Skipping in-memory duplicate from ${msg.from}`);
        return false;
      }

      seenHashes.add(hash);
      return true;
    });

    console.log(
      `Final unique messages to save: ${uniqueMessagesToSave.length}`,
    );

    // STEP 6: Renumber final messages sequentially
    uniqueMessagesToSave.forEach((msg, index) => {
      msg.originalIndex = index;
    });

    if (uniqueMessagesToSave.length === 0) {
      console.log(
        "All messages are duplicates, skipping inserts but updating thread metadata",
      );

      // Still update the thread's lastEmailAt
      await db.collection("email_threads").updateOne(
        { threadId },
        {
          $set: {
            lastEmailAt: new Date(),
          },
        },
      );

      // Trigger async processing via Inngest (even for duplicates, to update thread)
      await inngest.send({
        name: "email/thread.received",
        data: {
          parsedMessages,
          threadId,
        },
      });
      console.log(`Triggered Inngest processing for thread: ${threadId}`);

      return NextResponse.json({ ok: true });
    }

    console.log(
      `${uniqueMessagesToSave.length} new messages to save (${existingHashes.length} duplicates skipped)`,
    );

    // Create email documents for all non-duplicate messages
    const emailDocuments = uniqueMessagesToSave.map((msg, index) => {
      const originalIndex = parsedMessages.indexOf(msg);
      const contentHash = contentHashes[originalIndex];

      console.log(`Creating document ${index + 1}/${messagesToSave.length}:`, {
        from: msg.from,
        contentHash,
        originalIndex: msg.originalIndex,
      });

      return {
        messageId: `synthetic-${contentHash}`,
        threadId,
        from: msg.from,
        to: msg.to || "unknown",
        subject:
          msg.subject || body.Subject.replace(/^(re|fwd|fw):\s*/gi, "").trim(),
        body: msg.content,
        headers: [],
        receivedAt: msg.date || new Date(),
        rawPostmarkData: {
          note: "Extracted from forwarded email",
          originalForwardId: body.MessageID,
          extractedIndex: msg.originalIndex,
          forwardedBy: body.From,
          forwardedAt: new Date(),
        },
        contentHash,
        isExtracted: true,
      };
    });

    // Bulk insert all email documents
    try {
      if (emailDocuments.length > 0) {
        const insertResult = await db
          .collection("inbound_emails")
          .insertMany(emailDocuments, {
            ordered: false,
          });
        console.log(`Inserted ${insertResult.insertedCount} email documents`);
      }
    } catch (error: any) {
      // Some inserts may have failed due to duplicate messageId, but that's okay
      if (error.code === 11000) {
        console.log("Some documents were duplicates, continuing...");
      } else {
        throw error;
      }
    }

    // Extract all unique participants from parsed messages
    const allParticipants = new Set<string>();
    parsedMessages.forEach((msg) => {
      if (msg.from) allParticipants.add(msg.from);
      if (msg.to) allParticipants.add(msg.to);
    });
    // Add the person who forwarded
    allParticipants.add(body.From);

    console.log("All participants:", Array.from(allParticipants));

    // Calculate date range from parsed messages
    const dates = parsedMessages
      .map((msg) => msg.date)
      .filter((d) => d !== null) as Date[];

    const firstEmailAt =
      dates.length > 0
        ? new Date(Math.min(...dates.map((d) => d.getTime())))
        : new Date();

    const lastEmailAt =
      dates.length > 0
        ? new Date(Math.max(...dates.map((d) => d.getTime())))
        : new Date();

    console.log("Date range:", {
      firstEmailAt: firstEmailAt.toISOString(),
      lastEmailAt: lastEmailAt.toISOString(),
    });

    // Update thread metadata
    const threadUpdate = {
      $set: {
        subject: body.Subject.replace(/^(re|fwd|fw):\s*/gi, "").trim(),
        lastEmailAt,
        firstEmailAt,
      },
      $addToSet: {
        participants: { $each: Array.from(allParticipants) },
      },
      $inc: {
        emailCount: uniqueMessagesToSave.length,
      },
      $setOnInsert: {
        threadId,
        processed: false,
        processingStatus: "unprocessed",
        attioDealId: null,
        dealData: null,
        processingError: null,
      },
    };

    await db
      .collection("email_threads")
      .updateOne({ threadId }, threadUpdate, { upsert: true });

    console.log("Thread metadata updated successfully");
    console.log(
      `Saved ${uniqueMessagesToSave.length} messages to thread ${threadId}`,
    );
    console.log("=== WEBHOOK PROCESSING COMPLETE ===\n");

    // Process the thread in background (don't await)
    console.log("Processing thread in background...");
    await inngest.send({
      name: "email/thread.received",
      data: {
        parsedMessages,
        threadId,
      },
    });
    console.log(`Triggered Inngest processing for thread: ${threadId}`);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to process email:", error);
    return NextResponse.json({ ok: false, error: String(error) });
  }
}
