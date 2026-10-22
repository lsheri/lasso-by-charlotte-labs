/** BUNDLE-1: a pushed chat and its attachment with no task link still bundle. */
import { describe, expect, it } from "vitest";

import { chatBundles, type BundleItem } from "@/components/canvas-lab/canvas-lab-model";

describe("BUNDLE-1 untasked board items bundle", () => {
  it("a transcript and an attachment placed as nodes, with no task link, form one bundle", () => {
    const items: BundleItem[] = [
      { id: "chat", type: "ai_thread", owner_id: "me", orig_conversation_id: "conv-1", captured_at: "2026-10-01T00:00:00Z" },
      {
        id: "piece",
        type: "document",
        owner_id: "me",
        orig_conversation_id: "conv-1",
        captured_at: "2026-10-01T00:00:00Z",
        source_meta: { role: "attachment", produced_at_turn: 1 },
      },
    ];
    const nodes = [
      { id: "n-chat", workItemId: "chat" },
      { id: "n-piece", workItemId: "piece" },
    ];
    const bundles = chatBundles(nodes, items);
    expect(bundles.size).toBe(1);
    const [members] = [...bundles.values()];
    expect(members && members.length).toBeGreaterThan(0);
  });
});
