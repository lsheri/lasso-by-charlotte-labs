import { describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { sessionBelongsHere } from "@/components/reflect/use-ask-lasso";

const where = { engagementId: "this-board", mappedItemIds: ["card-1"], taskIds: [] as string[] };

describe("LOOK-2 Only this board", () => {
  it("excludes a session stamped with another board even when it shares a card", () => {
    expect(sessionBelongsHere({ mode: "items", ids: ["card-1"], board: "other" }, where)).toBe(false);
  });
  it("keeps a session stamped with this board", () => {
    expect(sessionBelongsHere({ mode: "items", ids: ["card-9"], board: "this-board" }, where)).toBe(true);
  });
  it("a scope with no board key keeps today's result", () => {
    expect(sessionBelongsHere({ mode: "items", ids: ["card-1"] }, where)).toBe(true);
    expect(sessionBelongsHere({ mode: "items", ids: ["card-9"] }, where)).toBe(false);
  });
});
