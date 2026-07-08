import { NextResponse } from "next/server";
import { probeRequestSchema } from "@/lib/api-schemas";
import { probeUrl, ProbeError, YtDlpNotFoundError } from "@/lib/ytdlp/probe";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = probeRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }

  try {
    const result = await probeUrl(parsed.data.url);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof YtDlpNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    if (err instanceof ProbeError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Unexpected error while probing URL.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
