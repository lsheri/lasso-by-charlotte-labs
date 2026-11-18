import type { Decorator, Preview } from "@storybook/react-vite";
import { useEffect, type ReactNode } from "react";

import { SkinContext } from "@/components/skin/use-skin";

import "../../src/styles.css";
// Skins come in through styles.css (Charlotte since Phase 3 PR2), the same way the app gets them.
// The proof skin never ships: only Storybook and the reskin audit load it, to show a brand change needs only skin values.
import "../../src/design/skins/proof.css";

/** Every skin the stories can show. */
const SKINS = ["lasso", "charlotte", "proof"] as const;

/** Stories render inside the app shell's attribute, as every signed-in surface does. */
/** Also provides the skin to React, so components that branch in code (GraphiteIcon, work kinds, the thinking mark)
    switch with the toolbar, not only the CSS. */
function SkinFrame({ skin, children }: { skin: (typeof SKINS)[number]; children: ReactNode }) {
  useEffect(() => {
    document.documentElement.dataset["skin"] = skin;
  }, [skin]);
  return (
    <div
      data-lasso="on"
      data-skin={skin}
      style={{ padding: 16, background: "var(--surface-page)" }}
    >
      {/* The proof skin is CSS only; code that still branches by name sees Charlotte, as a new brand would today. */}
      <SkinContext.Provider value={skin === "proof" ? "charlotte" : skin}>{children}</SkinContext.Provider>
    </div>
  );
}

const withSkin: Decorator = (Story, context) => (
  <SkinFrame skin={(SKINS as readonly string[]).includes(context.globals["skin"]) ? (context.globals["skin"] as (typeof SKINS)[number]) : "lasso"}>
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
