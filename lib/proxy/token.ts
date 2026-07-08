import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// Server-only. Signs short-lived stream tokens so the browser only ever sees
// an opaque token instead of the resolved CDN URL (which often embeds a
// visible auth signature) — and so a token can't be replayed past its TTL.
//
// The secret is generated once per server process. Tokens are only ever
// meant to live for a few seconds within the same running server, so this
// is sufficient for a local single-user app; set YTDLP_UI_TOKEN_SECRET to
// pin it across restarts/instances if ever needed.
const SECRET = process.env.YTDLP_UI_TOKEN_SECRET ?? randomBytes(32).toString("hex");
const TOKEN_TTL_MS = 90_000;

export interface StreamTokenPayload {
  url: string;
  headers: Record<string, string>;
  exp: number;
}

function base64url(input: Buffer): string {
  return input.toString("base64url");
}

function sign(payload: string): string {
  return base64url(createHmac("sha256", SECRET).update(payload).digest());
}

export function createStreamToken(url: string, headers: Record<string, string>): string {
  const payload: StreamTokenPayload = { url, headers, exp: Date.now() + TOKEN_TTL_MS };
  const encoded = base64url(Buffer.from(JSON.stringify(payload), "utf-8"));
  const signature = sign(encoded);
  return `${encoded}.${signature}`;
}

export class InvalidTokenError extends Error {
  constructor(reason: string) {
    super(`Invalid stream token: ${reason}`);
    this.name = "InvalidTokenError";
  }
}

export function verifyStreamToken(token: string): StreamTokenPayload {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) throw new InvalidTokenError("malformed");

  const expected = sign(encoded);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new InvalidTokenError("signature mismatch");
  }

  let payload: StreamTokenPayload;
  try {
    payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf-8"));
  } catch {
    throw new InvalidTokenError("unparseable payload");
  }

  if (Date.now() > payload.exp) throw new InvalidTokenError("expired");
  if (!/^https?:\/\//i.test(payload.url)) throw new InvalidTokenError("unsupported scheme");

  return payload;
}
