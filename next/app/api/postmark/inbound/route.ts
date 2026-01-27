import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json();

  console.log("📨 Postmark inbound email received");
  console.log(body);

  return NextResponse.json({ ok: true });
}
