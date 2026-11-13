import path from "node:path";
import { fileURLToPath } from "node:url";

import type { StorybookConfig } from "@storybook/react-vite";
import remarkGfm from "remark-gfm";

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const config: StorybookConfig & {
  resolvedReact: () => Promise<{ react: string; reactDom: string }>;
} = {
  stories: ["../../docs/design/**/*.mdx", "../stories/**/*.stories.@(ts|tsx)"],
  addons: [
    // Tables and other GitHub markdown in docs/design/*.mdx.
    {
      name: "@storybook/addon-docs",
      options: { mdxPluginOptions: { mdxCompileOptions: { remarkPlugins: [remarkGfm] } } },
    },
    "@storybook/addon-a11y",
  ],
  framework: {
    name: "@storybook/react-vite",
    options: { builder: { viteConfigPath: "vite.config.ts" } },
  },
  core: { disableTelemetry: true },
  // One React: the copy the app ships. addon-docs brings its own, and Storybook
  // would otherwise alias React to that one and ignore vite.config.ts.
  resolvedReact: async () => ({
    react: path.join(app, "node_modules/react"),
    reactDom: path.join(app, "node_modules/react-dom"),
  }),
};

export default config;
