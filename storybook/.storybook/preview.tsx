import type { Decorator, Preview } from "@storybook/react-vite";
import { useEffect, type ReactNode } from "react";

import "../../src/styles.css";
// Skins come in through styles.css (Charlotte since Phase 3 PR2), the same way the app gets them.

/** Every skin the stories can show. */
const SKINS = ["lasso", "charlotte"] as const;

/** Stories render inside the app shell's attribute, as every signed-in surface does. */
function SkinFrame({ skin, children }: { skin: string; children: ReactNode }) {
  useEffect(() => {
    document.documentElement.dataset["skin"] = skin;
  }, [skin]);
  return (
    <div
      data-lasso="on"
      data-skin={skin}
      style={{ padding: 16, background: "var(--surface-page)" }}
    >
      {children}
    </div>
  );
}

const withSkin: Decorator = (Story, context) => (
  <SkinFrame skin={String(context.globals["skin"] ?? "lasso")}>
    <Story />
  </SkinFrame>
);

const preview: Preview = {
  decorators: [withSkin],
  globalTypes: {
    skin: {
      description: "Brand skin",
      toolbar: { title: "Skin", icon: "paintbrush", items: [...SKINS], dynamicTitle: true },
    },
  },
  initialGlobals: { skin: "lasso" },
  parameters: { layout: "fullscreen", a11y: { test: "todo" } },
};

export default preview;
