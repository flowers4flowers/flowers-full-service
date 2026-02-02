import { cleanEmailBody } from "../../../utility/email-cleaner";
import { extractDealData } from "../../../utility/deal-extractor";
import { getDb } from "../../../utility/db";
import { processThread } from "../../../utility/thread-processor";
import { NextResponse } from "next/server";
import { syncDealToAttio } from "../../../utility/attio-sync";

// Timeout helper to prevent hanging requests
const withTimeout = <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Timeout after ${timeoutMs}ms`)),
        timeoutMs,
      ),
    ),
  ]);
};

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

    // TEMPORARILY SKIP AI CLEANING FOR TESTING
    console.log("\n--- SKIPPING AI cleaning (using raw content) ---");
    const cleanedEmails = parsedMessages.map((msg, index) => {
      console.log(
        `Using raw content for email ${index + 1}/${parsedMessages.length}`,
      );
      return {
        from: msg.from,
        cleaned: msg.content,
      };
    });

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
    await db
      .collection("extracted_deals")
      .updateOne({ threadId }, { $set: dealDocument }, { upsert: true });
    console.log("Saved/updated deal for thread:", threadId);

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
