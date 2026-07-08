// Netlify build plugin: downloads the Linux yt-dlp binary into bin/yt-dlp
// before `next build` runs, so next.config.ts's outputFileTracingIncludes
// has something to bundle into the probe/resolve/health functions.
const { execFileSync } = require("node:child_process");
const path = require("node:path");

module.exports = {
  onPreBuild: ({ utils }) => {
    try {
      execFileSync(process.execPath, [path.join(__dirname, "..", "..", "..", "scripts", "fetch-ytdlp-linux.mjs")], {
        stdio: "inherit",
      });
    } catch (err) {
      utils.build.failBuild("Failed to download the Linux yt-dlp binary", { error: err });
    }
  },
};
