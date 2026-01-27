import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

// 👇 THIS IS THE CRITICAL LINE
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Writable temp directory (Node runtime only)
    const inboundDir = path.join("/tmp", "inbound");
    await mkdir(inboundDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const messageIdSafe = body.MessageID
      ? body.MessageID.replace(/[^a-zA-Z0-9]/g, "")
      : "unknown";

    const filename = `postmark-${timestamp}-${messageIdSafe}.json`;
    const filePath = path.join(inboundDir, filename);

    await writeFile(filePath, JSON.stringify(body, null, 2), "utf-8");

    console.log("📨 Postmark inbound email saved:", filename);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("❌ Failed to process inbound email", error);
    return NextResponse.json(
      { ok: false, error: "Failed to process inbound email" },
      { status: 500 }
    );
  }
}
