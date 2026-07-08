import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The probe/resolve/health API routes shell out to a yt-dlp binary via
  // child_process. Next's automatic file tracer can't see that dependency
  // (it's a runtime `path.join` + `existsSync` lookup, not a static
  // import/require), so on serverless targets (e.g. Netlify) the binary
  // would silently be missing from the deployed function unless we force
  // it into the trace here. See scripts/fetch-ytdlp-linux.mjs, which fetches
  // bin/yt-dlp (a Linux build) during the Netlify build — this only makes
  // the trace include it *if present*; local Windows dev is unaffected.
  outputFileTracingIncludes: {
    "/api/probe": ["./bin/yt-dlp"],
    "/api/resolve": ["./bin/yt-dlp"],
    "/api/health": ["./bin/yt-dlp"],
  },
  // Turbopack's dev filesystem cache (auto-enabled by default since Next
  // v16.1.0) leaks working-set memory across Fast Refresh/recompile cycles
  // in this project: measured ~60MB retained per recompile with it on
  // (unbounded — 20+ recompiles kept climbing), completely flat memory
  // across 20 recompiles with it off. Over a long dev session that default
  // is what turns into multi-GB `next dev` memory usage. Re-test on future
  // Next upgrades in case this gets fixed upstream.
  experimental: {
    turbopackFileSystemCacheForDev: false,
  },
};

export default nextConfig;
