import { NextResponse } from "next/server";
import { verifyStreamToken, InvalidTokenError } from "@/lib/proxy/token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FORWARDED_RESPONSE_HEADERS = ["content-type", "content-length", "accept-ranges", "content-range"];

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  let payload;
  try {
    payload = verifyStreamToken(token);
  } catch (err) {
    if (err instanceof InvalidTokenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    throw err;
  }

  const upstreamHeaders: Record<string, string> = { ...payload.headers };
  const range = request.headers.get("range");
  if (range) upstreamHeaders["Range"] = range;

  let upstream: Response;
  try {
    upstream = await fetch(payload.url, {
      headers: upstreamHeaders,
      signal: request.signal,
    });
  } catch {
    return NextResponse.json({ error: "Failed to reach the source server." }, { status: 502 });
  }

  if (!upstream.ok && upstream.status !== 206) {
    return NextResponse.json(
      { error: `Source server responded with ${upstream.status}` },
      { status: 502 },
    );
  }

  const headers = new Headers();
  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }

  return new NextResponse(upstream.body, { status: upstream.status, headers });
}
