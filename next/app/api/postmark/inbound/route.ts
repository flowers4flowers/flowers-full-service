import { NextResponse } from "next/server";
import { getDb } from "../../../../utility/db";
import { generateThreadId } from "../../../../utility/thread-id";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const db = await getDb();

    const threadId = generateThreadId(body.Subject, body.Headers);
    const receivedAt = new Date();

    // Insert the email into inbound_emails collection
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

    // Upsert the email thread
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

    console.log("Email saved to MongoDB:", body.MessageID, "Thread:", threadId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to process inbound email", error);
    return NextResponse.json(
      { ok: false, error: "Failed to process inbound email" },
      { status: 500 }
    );
  }
}