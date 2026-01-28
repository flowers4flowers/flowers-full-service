import { NextResponse } from "next/server";
import { getDb } from "../../../../utility/db";
import { generateThreadId } from "../../../../utility/thread-id";

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
        
        const db = await getDb();
        console.log("Connected to DB");

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

        console.log("Email saved:", body.MessageID, "Thread:", threadId);
      })(),
      timeoutPromise
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed:", error);
    return NextResponse.json({ ok: false, error: String(error) });
  }
}