import { cleanEmailBody } from "../../../utility/email-cleaner";
import { extractDealData } from "../../../utility/deal-extractor";
import { getDb } from "../../../utility/db";
import { processThread } from "../../../utility/thread-processor";
import { NextResponse } from "next/server";
import { syncDealToAttio } from '../../../utility/attio-sync';

// Keep the existing POST handler for manual triggers
export async function POST(req: Request) {
  const { threadId } = await req.json();

  try {
    await processThread(threadId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Processing failed:", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 },
    );
  }
}

// Add new function that processes messages directly
export async function processThreadDirect(
  parsedMessages: any[],
  threadId: string,
) {
  console.log(`\n========================================`);
  console.log(`PROCESSING THREAD DIRECTLY: ${threadId}`);
  console.log(`========================================\n`);

  try {
    console.log(`Processing ${parsedMessages.length} messages`);

    // Clean emails in parallel
    console.log("\n--- Cleaning emails with AI (parallel) ---");
    const cleaningPromises = parsedMessages.map(async (msg, i) => {
      console.log(
        `\nCleaning email ${i + 1}/${parsedMessages.length} from ${msg.from}`,
      );
      console.log("Original body length:", msg.content.length);

      try {
        const cleaned = await cleanEmailBody(msg.content);
        console.log("Cleaned body length:", cleaned.length);
        return { from: msg.from, cleaned };
      } catch (error) {
        console.error(`Error cleaning email ${i + 1}:`, error);
        return { from: msg.from, cleaned: msg.content };
      }
    });

    const cleanedEmails = await Promise.all(cleaningPromises);

    // Combine cleaned emails
    console.log("\n--- Combining cleaned emails ---");
    const combinedThread = cleanedEmails
      .map(
        (email, index) =>
          `Email ${index + 1} from ${email.from}:\n${email.cleaned}`,
      )
      .join("\n\n");

    console.log("Combined thread length:", combinedThread.length);

    // Extract deal data
    console.log("\n--- Extracting deal data with AI ---");
    const extractedData = await extractDealData(combinedThread);
    console.log("Extracted deal data:", JSON.stringify(extractedData, null, 2));

    // Get participants
    const allParticipants = new Set<string>();
    parsedMessages.forEach((msg) => {
      if (!msg.from.includes("@fullservice.art")) {
        allParticipants.add(msg.from);
      }
      if (msg.to && !msg.to.includes("@fullservice.art")) {
        allParticipants.add(msg.to);
      }
    });

    const associatedPeople = Array.from(allParticipants);

    // Convert dates
    const shootDate = extractedData.shootDate
      ? new Date(extractedData.shootDate)
      : null;

    // Save to DB
    const db = await getDb();
    const dealDocument = {
      threadId,
      dealName: extractedData.dealName,
      dealStage: "Lead" as const,
      dealOwner: "cait@fullservice.art",
      associatedPeople,
      associatedCompanies: extractedData.associatedCompanies,
      dealValue: extractedData.dealValue,
      budgetRange: extractedData.budgetRange,
      inquirySource: extractedData.inquirySource,
      collaboratorsNeeded: extractedData.collaboratorsNeeded,
      location: extractedData.location,
      shootDate,
      usageTerms: extractedData.usageTerms,
      extractedAt: new Date(),
    };

    console.log("\n--- Saving to extracted_deals collection ---");
    const insertResult = await db
      .collection("extracted_deals")
      .insertOne(dealDocument);
    console.log("Inserted deal with _id:", insertResult.insertedId);

    // Mark thread as processed
    console.log("\n--- Marking thread as processed ---");
    await db.collection("email_threads").updateOne(
      { threadId },
      {
        $set: {
          processed: true,
          processedAt: new Date(),
        },
      },
    );

    // Sync to Attio
    console.log("\n--- Syncing to Attio ---");
    const attioResult = await syncDealToAttio(
      extractedData,
      associatedPeople,
      threadId,
    );

    // Update thread with Attio sync results
    if (attioResult.success) {
      console.log("\n--- Updating thread with Attio deal ID ---");
      await db.collection("email_threads").updateOne(
        { threadId },
        {
          $set: {
            attioDealId: attioResult.attioDealId,
            attioUrl: attioResult.attioUrl,
            processingStatus: "synced_to_attio",
            attioSyncError: null,
            lastAttioSyncAt: new Date(),
          },
        },
      );
      console.log(`Successfully synced to Attio: ${attioResult.attioDealId}`);
    } else {
      console.error("\n--- Attio sync failed ---");
      console.error("Error:", attioResult.error);
      await db.collection("email_threads").updateOne(
        { threadId },
        {
          $set: {
            attioDealId: null,
            attioUrl: null,
            processingStatus: "attio_sync_failed",
            attioSyncError: attioResult.error,
            lastAttioSyncAt: new Date(),
          },
        },
      );
    }

    console.log("\n========================================");
    console.log("PROCESSING COMPLETE");
    console.log(`========================================\n`);
  } catch (error) {
    console.error("Processing failed:", error);
    throw error;
  }
}

// Keep existing processThreadBackground for backward compatibility
export async function processThreadBackground(threadId: string) {
  try {
    await processThread(threadId);
    console.log("Background processing completed for thread:", threadId);
  } catch (error) {
    console.error("Background processing failed for thread:", threadId, error);
  }
}
