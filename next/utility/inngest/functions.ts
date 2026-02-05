import { inngest } from "./client";
import { getDb } from "../db";
import { cleanEmailBody } from "../cc-attio/email-cleaner";
import { ExtractedDealData, extractDealData } from "../cc-attio/deal-extractor";
import { extractValidParticipants } from "../cc-attio/participant-utils";
import { syncDealToAttio } from "../cc-attio/attio-sync";

export const processEmailThread = inngest.createFunction(
  {
    id: "process-email-thread",
    name: "Process Email Thread",
    retries: 3,
  },
  { event: "email/thread.received" },
  async ({ event, step }) => {
    const { parsedMessages, threadId } = event.data;

    console.log(
      `Inngest: Processing thread ${threadId} with ${parsedMessages.length} messages`,
    );

    // Step 1: Check if already processed
    const shouldProcess = await step.run("check-if-processed", async () => {
      const db = await getDb();
      const existingThread = await db
        .collection("email_threads")
        .findOne({ threadId });

      if (existingThread?.processed && existingThread?.attioDealId) {
        console.log(`Thread ${threadId} already processed`);
        return false;
      }
      return true;
    });

    if (!shouldProcess) {
      return { skipped: true };
    }

    // Step 2: Clean emails
    const cleanedEmails = await step.run("clean-emails", async () => {
      console.log(`Cleaning ${parsedMessages.length} emails`);
      const cleaningPromises = parsedMessages.map(async (msg) => {
        const cleaned = await cleanEmailBody(msg.content);
        return { from: msg.from, cleaned };
      });
      return await Promise.all(cleaningPromises);
    });

    // Step 3: Extract deal data
    const extractedData = await step.run(
      "extract-deal-data",
      async (): Promise<ExtractedDealData> => {
        const combinedThread = cleanedEmails
          .map(
            (email, index) =>
              `Email ${index + 1} from ${email.from}:\n${email.cleaned}`,
          )
          .join("\n\n");
        return await extractDealData(combinedThread);
      },
    );

    // Add this validation step
    const isValidDealData =
      extractedData.dealName && extractedData.dealName.trim() !== "";

    if (!isValidDealData) {
      console.log(
        `Thread ${threadId} missing required deal data, skipping Attio sync`,
      );
      // Still save to DB but mark as needing manual review
      await step.run("save-incomplete-to-db", async () => {
        const db = await getDb();
        await db.collection("email_threads").updateOne(
          { threadId },
          {
            $set: {
              processed: true,
              processedAt: new Date(),
              processingStatus: "incomplete_data",
              attioSyncError: "Missing required deal data (dealName)",
            },
          },
        );
      });
      return { success: false, error: "incomplete_data" };
    }

    // Step 4: Save to DB
    await step.run("save-to-db", async () => {
      const db = await getDb();
      const associatedPeople = extractValidParticipants(parsedMessages);
      const shootDate = extractedData.shootDate
        ? new Date(extractedData.shootDate)
        : null;

      await db.collection("extracted_deals").updateOne(
        { threadId },
        {
          $set: {
            threadId,
            dealName: extractedData.dealName!, // Add ! since we validated above
            dealStage: "Lead",
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
          },
        },
        { upsert: true },
      );

      await db
        .collection("email_threads")
        .updateOne(
          { threadId },
          { $set: { processed: true, processedAt: new Date() } },
        );
    });

    // Step 5: Sync to Attio
    const attioResult = await step.run("sync-to-attio", async () => {
      const associatedPeople = extractValidParticipants(parsedMessages);
      // Create a properly typed object
      const validDealData: ExtractedDealData = {
        dealName: extractedData.dealName!,
        associatedCompanies: extractedData.associatedCompanies,
        dealValue: extractedData.dealValue,
        budgetRange: extractedData.budgetRange,
        inquirySource: extractedData.inquirySource,
        collaboratorsNeeded: extractedData.collaboratorsNeeded,
        location: extractedData.location,
        shootDate: extractedData.shootDate,
        usageTerms: extractedData.usageTerms,
      };
      return await syncDealToAttio(validDealData, associatedPeople, threadId);
    });

    // Step 6: Update with Attio results
    await step.run("update-attio-results", async () => {
      const db = await getDb();
      if (attioResult.success) {
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
      } else {
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
    });

    return { success: true, attioDealId: attioResult.attioDealId };
  },
);
