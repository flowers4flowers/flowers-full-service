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