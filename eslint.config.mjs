import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated third-party asset, copied in by scripts/copy-ffmpeg-core.mjs.
    "public/ffmpeg-core/**",
    // Netlify build plugin — CommonJS per Netlify's plugin conventions, not app source.
    "netlify/plugins/**",
  ]),
]);

export default eslintConfig;
