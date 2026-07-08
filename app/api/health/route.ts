import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { NextResponse } from "next/server";
import { findYtDlp } from "@/lib/ytdlp/binary";

export const runtime = "nodejs";

const execFileAsync = promisify(execFile);

export async function GET() {
  const binPath = findYtDlp();
  if (!binPath) {
    return NextResponse.json({ available: false, version: null, path: null });
  }

  try {
    const { stdout } = await execFileAsync(binPath, ["--version"], { timeout: 10_000 });
    return NextResponse.json({ available: true, version: stdout.trim(), path: binPath });
  } catch {
    return NextResponse.json({ available: false, version: null, path: binPath });
  }
}
