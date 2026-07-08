import { NextResponse } from "next/server";
import { resolveRequestSchema } from "@/lib/api-schemas";
import { resolveStreams } from "@/lib/ytdlp/resolve";
import { ProbeError, YtDlpNotFoundError } from "@/lib/ytdlp/probe";
import { createStreamToken } from "@/lib/proxy/token";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = resolveRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }

  try {
    const streams = await resolveStreams(parsed.data.url, parsed.data.formatIds, parsed.data.cookies);
    return NextResponse.json({
      streams: streams.map((s) => ({
        formatId: s.formatId,
        filesize: s.filesize,
        token: createStreamToken(s.url, s.headers),
      })),
    });
  } catch (err) {
    if (err instanceof YtDlpNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    if (err instanceof ProbeError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Unexpected error while resolving streams.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
