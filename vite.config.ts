// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv } from "vite";

const dirname = path.dirname(fileURLToPath(import.meta.url));

// Server routes read non VITE_ vars from process.env; the preset only injects
// VITE_ prefixed ones into the client bundle.
Object.assign(process.env, loadEnv(process.env["NODE_ENV"] ?? "development", process.cwd(), ""));

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    resolve: {
      alias: {
        // React Email's html parser needs entities v4.5.0; nested newer copies
        // dropped these deep paths.
        "entities/lib/decode.js": path.resolve(dirname, "node_modules/entities/lib/decode.js"),
        "entities/lib/encode.js": path.resolve(dirname, "node_modules/entities/lib/encode.js"),
        entities: path.resolve(dirname, "node_modules/entities"),
      },
    },
  },
});
