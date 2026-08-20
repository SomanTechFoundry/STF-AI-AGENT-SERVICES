import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "stf-ai-agent-services",
    version: "0.1.0",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV ?? "unknown",
  });
}
