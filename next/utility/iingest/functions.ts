import { inngest } from "./client";
import { processThreadDirect } from "../../app/api/process-thread/route";

export const processEmailThread = inngest.createFunction(
  { id: "process-email-thread" },
  { event: "email/thread.received" },
  async ({ event, step }) => {
    const { parsedMessages, threadId } = event.data;

    console.log(`Inngest: Processing thread ${threadId} with ${parsedMessages.length} messages`);

    await processThreadDirect(parsedMessages, threadId);

    console.log(`Inngest: Completed processing thread ${threadId}`);

    return { threadId, success: true };
  }
);