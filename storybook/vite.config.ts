// Storybook's own Vite config. The app's vite.config.ts is the Lovable TanStack
// preset (tanstackStart, nitro, a Cloudflare target), which Storybook must not load.
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const here = path.dirname(fileURLToPath(import.meta.url));
const app = path.resolve(here, "..");

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Load env files from storybook/ only, never the app's .env.
  envDir: here,
  resolve: {
    alias: {
      "@": path.resolve(app, "src"),
      // One React: the copy the app ships, not the one Storybook's packages pull in.
      react: path.resolve(app, "node_modules/react"),
      "react-dom": path.resolve(app, "node_modules/react-dom"),
      // docs/design/*.mdx sit outside this package, so their imports cannot find its node_modules.
      "@storybook/addon-docs/blocks": createRequire(import.meta.url).resolve(
        "@storybook/addon-docs/blocks",
      ),
    },
  },
  server: { fs: { allow: [app] } },
});
