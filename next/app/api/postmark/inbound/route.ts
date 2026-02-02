import { NextResponse } from "next/server";
import { getDb } from "../../../../utility/db";
import {
  generateThreadId,
  generateThreadIdFromParsedMessages,
} from "../../../../utility/thread-id";
import {
  isForwardedEmail,
  parseForwardedEmail,
} from "../../../../utility/email-parser";
import { generateContentHash } from "../../../../utility/content-hash";
import { checkForDuplicates } from "../../../../utility/duplicate-checker";
import {
  processThreadBackground,
  processThreadDirect,
} from "../../process-thread/route";

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

      // Process the thread before responding
      console.log("Processing thread (blocking until complete)...");
      await processThreadDirect(parsedMessages, threadId);

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

      // Process the thread before responding
      console.log("Processing thread (blocking until complete)...");
      await processThreadDirect(parsedMessages, threadId);

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

      // Extract the date from the covering message headers
      const dateMatch = coveringMessageRaw.match(
        /Date:\s*(.+?)(?=\r?\n(?:Subject:|To:|$))/is,
      );
      const dateStr = dateMatch ? dateMatch[1].trim() : "";
      const coveringDate = dateStr ? new Date(dateStr) : new Date();

      console.log("Covering message date string:", dateStr);
      console.log("Covering message parsed date:", coveringDate);

      // Clean the covering message content (remove headers)
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

      if (cleanedCovering.length > 0) {
        // Add the covering message as the newest message
        const coveringMessage = {
          from: body.From,
          to: body.To,
          date: coveringDate,
          subject: body.Subject.replace(/^(re|fwd|fw):\s*/gi, "").trim(),
          content: cleanedCovering,
          originalIndex: parsedMessages.length,
        };

        parsedMessages.push(coveringMessage);

        console.log("Added covering message:", {
          from: coveringMessage.from,
          contentPreview: coveringMessage.content.substring(0, 100),
          originalIndex: coveringMessage.originalIndex,
        });
      } else {
        console.log("Covering message too short after cleaning, skipping");
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

    // Generate content hashes for all messages
    const contentHashes = parsedMessages.map((msg) =>
      generateContentHash(msg.content, msg.from, msg.date),
    );

    console.log("Generated content hashes:", contentHashes);

    // Check for duplicates
    const existingHashes = await checkForDuplicates(
      db,
      threadId,
      contentHashes,
    );

    console.log("Existing hashes found:", existingHashes);

    // Filter out duplicate messages
    const messagesToSave = parsedMessages.filter(
      (msg, index) => !existingHashes.includes(contentHashes[index]),
    );

    if (messagesToSave.length === 0) {
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

      // Process the thread before responding
      console.log("Processing thread (blocking until complete)...");
      await processThreadDirect(parsedMessages, threadId);

      return NextResponse.json({ ok: true });
    }

    console.log(
      `${messagesToSave.length} new messages to save (${existingHashes.length} duplicates skipped)`,
    );

    // Create email documents for all non-duplicate messages
    const emailDocuments = messagesToSave.map((msg, index) => {
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
        emailCount: messagesToSave.length,
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
      `Saved ${messagesToSave.length} messages to thread ${threadId}`,
    );
    console.log("=== WEBHOOK PROCESSING COMPLETE ===\n");

    // Process the thread in background (don't await)
    console.log("Processing thread in background...");
    processThreadDirect(parsedMessages, threadId)
      .then(() => {
        console.log("✅ Background processing completed successfully");
      })
      .catch((error) => {
        console.error("❌ Background processing failed:", error);
      });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to process email:", error);
    return NextResponse.json({ ok: false, error: String(error) });
  }
}
