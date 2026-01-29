import { NextResponse } from "next/server";
import { getDb } from "../../../../utility/db";
import { generateThreadId, generateThreadIdFromParsedMessages } from "../../../../utility/thread-id";
import { isForwardedEmail, parseForwardedEmail } from "../../../../utility/email-parser";
import { generateContentHash } from "../../../../utility/content-hash";
import { checkForDuplicates } from "../../../../utility/duplicate-checker";  

export const runtime = "nodejs";

export async function POST(req: Request) {
  console.log("=== WEBHOOK HIT ===");
  
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Request timeout')), 8000)
  );

  try {
    await Promise.race([
      (async () => {
        const body = await req.json();
        console.log("Received email from:", body.From);
        console.log("Subject:", body.Subject);
        
        const db = await getDb();
        console.log("Connected to DB");

        // Check if this is a forwarded email
        const isForwarded = isForwardedEmail(body.Subject);
        
        if (!isForwarded) {
          // NOT FORWARDED - Use existing single-email logic
          console.log("Not a forwarded email, using standard flow");
          
          const threadId = generateThreadId(body.Subject, body.Headers);
          const receivedAt = new Date();

          await db.collection('inbound_emails').insertOne({
            messageId: body.MessageID,
            threadId,
            from: body.From,
            to: body.To,
            subject: body.Subject,
            body: body.TextBody || body.HtmlBody,
            htmlBody: body.HtmlBody,
            textBody: body.TextBody,
            headers: body.Headers,
            receivedAt,
            rawPostmarkData: body
          });

          const threadUpdate = {
            $set: {
              subject: body.Subject.replace(/^(re|fwd|fw):\s*/gi, '').trim(),
              lastEmailAt: receivedAt
            },
            $addToSet: {
              participants: { $each: [body.From, body.To] }
            },
            $inc: {
              emailCount: 1
            },
            $setOnInsert: {
              threadId,
              firstEmailAt: receivedAt,
              processed: false,
              processingStatus: 'unprocessed',
              attioDealId: null,
              dealData: null,
              processingError: null
            }
          };

          await db.collection('email_threads').updateOne(
            { threadId },
            threadUpdate,
            { upsert: true }
          );

          console.log("Single email saved:", body.MessageID, "Thread:", threadId);
          return;
        }

        // FORWARDED EMAIL - Parse conversation history
        console.log("Forwarded email detected, parsing conversation history");
        
        const parsedMessages = parseForwardedEmail(
          body.Subject,
          body.HtmlBody,
          body.TextBody
        );

        if (parsedMessages.length === 0) {
          // Parsing failed, fall back to single-email save
          console.warn("Failed to parse forwarded email, falling back to single-email save");
          
          const threadId = generateThreadId(body.Subject, body.Headers);
          const receivedAt = new Date();

          await db.collection('inbound_emails').insertOne({
            messageId: body.MessageID,
            threadId,
            from: body.From,
            to: body.To,
            subject: body.Subject,
            body: body.TextBody || body.HtmlBody,
            htmlBody: body.HtmlBody,
            textBody: body.TextBody,
            headers: body.Headers,
            receivedAt,
            rawPostmarkData: body,
            parsingFailed: true
          });

          const threadUpdate = {
            $set: {
              subject: body.Subject.replace(/^(re|fwd|fw):\s*/gi, '').trim(),
              lastEmailAt: receivedAt
            },
            $addToSet: {
              participants: { $each: [body.From, body.To] }
            },
            $inc: {
              emailCount: 1
            },
            $setOnInsert: {
              threadId,
              firstEmailAt: receivedAt,
              processed: false,
              processingStatus: 'unprocessed',
              attioDealId: null,
              dealData: null,
              processingError: 'Failed to parse forwarded email'
            }
          };

          await db.collection('email_threads').updateOne(
            { threadId },
            threadUpdate,
            { upsert: true }
          );

          console.log("Fallback save completed:", body.MessageID);
          return;
        }

        console.log(`Successfully parsed ${parsedMessages.length} messages from forwarded email`);

        // Generate threadId using hybrid strategy
        const threadId = generateThreadIdFromParsedMessages(
          parsedMessages,
          body.Subject
        );

        console.log("Generated threadId:", threadId);

        // Generate content hashes for all messages
        const contentHashes = parsedMessages.map(msg => 
          generateContentHash(msg.content, msg.from, msg.date)
        );

        // Check for duplicates
        const existingHashes = await checkForDuplicates(
          db,
          threadId,
          contentHashes
        );

        // Filter out duplicate messages
        const messagesToSave = parsedMessages.filter((msg, index) => 
          !existingHashes.includes(contentHashes[index])
        );

        if (messagesToSave.length === 0) {
          console.log("All messages are duplicates, skipping inserts but updating thread metadata");
          
          // Still update the thread's lastEmailAt
          await db.collection('email_threads').updateOne(
            { threadId },
            {
              $set: {
                lastEmailAt: new Date()
              }
            }
          );

          return;
        }

        console.log(`${messagesToSave.length} new messages to save (${existingHashes.length} duplicates skipped)`);

        // Create email documents for all non-duplicate messages
        const emailDocuments = messagesToSave.map((msg, index) => {
          const originalIndex = parsedMessages.indexOf(msg);
          const contentHash = contentHashes[originalIndex];
          
          return {
            messageId: `synthetic-${contentHash}`,
            threadId,
            from: msg.from,
            to: msg.to || 'unknown',
            subject: msg.subject || body.Subject.replace(/^(re|fwd|fw):\s*/gi, '').trim(),
            body: msg.content,
            htmlBody: msg.content,
            textBody: msg.content,
            headers: [],
            receivedAt: msg.date || new Date(),
            rawPostmarkData: {
              note: 'Extracted from forwarded email',
              originalForwardId: body.MessageID,
              extractedIndex: msg.originalIndex,
              forwardedBy: body.From,
              forwardedAt: new Date()
            },
            contentHash,
            isExtracted: true
          };
        });

        // Bulk insert all email documents
        try {
          if (emailDocuments.length > 0) {
            await db.collection('inbound_emails').insertMany(emailDocuments, {
              ordered: false // Continue on duplicate key errors
            });
            console.log(`Inserted ${emailDocuments.length} email documents`);
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
        parsedMessages.forEach(msg => {
          if (msg.from) allParticipants.add(msg.from);
          if (msg.to) allParticipants.add(msg.to);
        });
        // Add the person who forwarded
        allParticipants.add(body.From);

        // Calculate date range from parsed messages
        const dates = parsedMessages
          .map(msg => msg.date)
          .filter(d => d !== null) as Date[];

        const firstEmailAt = dates.length > 0 
          ? new Date(Math.min(...dates.map(d => d.getTime())))
          : new Date();

        const lastEmailAt = dates.length > 0
          ? new Date(Math.max(...dates.map(d => d.getTime())))
          : new Date();

        // Update thread metadata
        const threadUpdate = {
          $set: {
            subject: body.Subject.replace(/^(re|fwd|fw):\s*/gi, '').trim(),
            lastEmailAt,
            firstEmailAt
          },
          $addToSet: {
            participants: { $each: Array.from(allParticipants) }
          },
          $inc: {
            emailCount: messagesToSave.length
          },
          $setOnInsert: {
            threadId,
            processed: false,
            processingStatus: 'unprocessed',
            attioDealId: null,
            dealData: null,
            processingError: null
          }
        };

        await db.collection('email_threads').updateOne(
          { threadId },
          threadUpdate,
          { upsert: true }
        );

        console.log("Thread metadata updated successfully");
        console.log(`Saved ${messagesToSave.length} messages to thread ${threadId}`);
      })(),
      timeoutPromise
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to process email:", error);
    return NextResponse.json({ ok: false, error: String(error) });
  }
}