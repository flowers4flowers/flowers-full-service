import { cleanEmailBody } from "../../../utility/cc-attio/email-cleaner";
import { extractDealData } from "../../../utility/cc-attio/deal-extractor";
import { getDb } from "../../../utility/db";
import { syncDealToAttio } from "../../../utility/cc-attio/attio-sync";
import { extractValidParticipants } from "../../../utility/cc-attio/participant-utils";

/**
 * Processes a thread of parsed email messages:
 * 1. Cleans each email using AI (removes greetings, signatures, etc.)
 * 2. Combines cleaned emails into single thread text
 * 3. Extracts deal data using AI
 * 4. Saves to extracted_deals collection
 * 5. Syncs to Attio CRM
 * 6. Updates thread status
 * 
 * @param parsedMessages - Array of parsed email objects from webhook
 * @param threadId - Unique thread identifier
 * 
 * Note: This function operates on in-memory parsed messages, not DB records.
 * This avoids redundant DB queries since data is already in memory from webhook.
 */
export async function processThreadDirect(
  parsedMessages: any[],
  threadId: string,
) {
  console.log(`\n========================================`);
  console.log(`PROCESSING THREAD DIRECTLY: ${threadId}`);
  console.log(`========================================\n`);

  try {
    const db = await getDb();
    
    // CHECK IF ALREADY PROCESSED
    const existingThread = await db.collection("email_threads").findOne({ threadId });
    
    if (existingThread?.processed && existingThread?.attioDealId) {
      console.log(`Thread ${threadId} already processed with Attio deal ${existingThread.attioDealId}`);
      console.log("Skipping to avoid duplicate deals");
      return;
    }

    console.log(`Processing ${parsedMessages.length} messages`);

    // Clean emails with AI in parallel
    console.log("\n--- Cleaning emails with AI (parallel) ---");
    const cleaningPromises = parsedMessages.map(async (msg, index) => {
      console.log(
        `Starting cleaning for email ${index + 1}/${parsedMessages.length} from ${msg.from}`,
      );

      try {
        const cleaned = await cleanEmailBody(msg.content);
        console.log(`Successfully cleaned email ${index + 1}`);

        return {
          from: msg.from,
          cleaned: cleaned,
        };
      } catch (error) {
        console.error(`Error cleaning email ${index + 1}:`, error);
        // Fallback to raw content on error
        return {
          from: msg.from,
          cleaned: msg.content,
        };
      }
    });

    const cleanedEmails = await Promise.all(cleaningPromises);
    console.log(`Finished cleaning all ${cleanedEmails.length} emails`);

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

    // Get participants using utility function
    console.log("\n--- Extracting valid participants ---");
    const associatedPeople = extractValidParticipants(parsedMessages);
    console.log(`Found ${associatedPeople.length} valid participants`);
    console.log("Participants:", associatedPeople);

    // Convert dates
    const shootDate = extractedData.shootDate
      ? new Date(extractedData.shootDate)
      : null;

    // Save to DB
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