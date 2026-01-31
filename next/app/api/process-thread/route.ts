import { NextResponse } from "next/server";
import { processThread } from "../../../utility/thread-processor";

export async function POST(req: Request) {
  const { threadId } = await req.json();
  
  try {
    await processThread(threadId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Processing failed:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function processThreadBackground(threadId: string) {
  try {
    await processThread(threadId);
    console.log('Background processing completed for thread:', threadId);
  } catch (error) {
    console.error('Background processing failed for thread:', threadId, error);
  }
}