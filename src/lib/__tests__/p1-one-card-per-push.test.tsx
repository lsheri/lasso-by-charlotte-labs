// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { bucketKeyForEntry } from "@/components/work/work-buckets";
import {
  entryHead,
  entryItems,
  groupConversations,
  groupedCount,
  isConversationGroup,
  type WorkItemRow,
} from "@/lib/work-types";

const NOW = Date.now();

function item(over: Partial<WorkItemRow> = {}): WorkItemRow {
  return {
    id: "i1",
    owner_id: "me",
    client_id: null,
    title: "Diligence chat",
    type: "ai_thread",
    source: "mcp:claude",
    visibility: "unmapped",
    captured_at: new Date(NOW - 60_000).toISOString(),
    content_ref: null,
    created_at_source: null,
    work_date: null,
    content_fidelity: null,
    source_vendor: "claude",
    orig_conversation_id: null,
    source_meta: null,
    meta: null,
    work_item_tasks: [],
    ...over,
  } as WorkItemRow;
}

/** One push: a transcript plus one artifact typed as a document. */
const push = [
  item({ id: "t", orig_conversation_id: "c1", type: "ai_thread" }),
  item({ id: "a", orig_conversation_id: "c1", type: "document", title: "Readout v3" }),
];

describe("P1 — one card per pushed conversation", () => {
  it("makes one entry out of a push, with the transcript at the head", () => {
    const entries = groupConversations(push);
    expect(entries).toHaveLength(1);
    const entry = entries[0]!;
    expect(isConversationGroup(entry)).toBe(true);
    expect(entryHead(entry).id).toBe("t");
    expect(entryItems(entry).map((piece) => piece.id)).toEqual(["t", "a"]);
  });

  it("files the whole push under AI conversations, never the artifact's own column", () => {
    const entries = groupConversations(push);
    expect(bucketKeyForEntry(entries[0]!)).toBe("llm");
    // The artifact on its own would have gone to Documents.
    expect(bucketKeyForEntry(push[1]!)).toBe("documents");
    const columns = ["llm", "documents", "sheets", "calls"].map((key) => ({
      key,
      count: entries.filter((entry) => bucketKeyForEntry(entry) === key).length,
    }));
    expect(columns.find((c) => c.key === "documents")?.count).toBe(0);
  });

  it("counts a push as one thing, not as its rows", () => {
    expect(groupedCount(push)).toBe(1);
    expect(groupedCount([...push, item({ id: "lone" })])).toBe(2);
  });

  it("keeps a lone item that happens to carry a conversation id as an ordinary row", () => {
    const entries = groupConversations([item({ id: "solo", orig_conversation_id: "c9" })]);
    expect(isConversationGroup(entries[0]!)).toBe(false);
  });
});

/* ---------- the arrivals strip shows the push once ---------- */

vi.mock("@/hooks/use-profile", () => ({
  useProfile: () => ({ data: { id: "me", org_id: "org", org_type: "company" } }),
}));
vi.mock("@/lib/telemetry", () => ({ logEvent: () => {} }));
vi.mock("@/components/work/SourceMark", () => ({ SourceMark: () => null }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
      insert: () => Promise.resolve({ error: null }),
    }),
  },
}));
vi.mock("sonner", () => ({
  toast: Object.assign(() => {}, { error: () => {}, success: () => {} }),
}));

import { ArrivalsStrip } from "@/components/work/ArrivalsStrip";

describe("P1 — the arrivals strip", () => {
  beforeEach(() => cleanup());
  afterEach(() => cleanup());

  it("shows one row for a push, naming the conversation and counting the pieces", () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <ArrivalsStrip items={push} />
      </QueryClientProvider>,
    );
    expect(screen.getAllByTestId("arrival-row")).toHaveLength(1);
    expect(screen.getByText("Diligence chat")).toBeTruthy();
    expect(screen.getByText("2 pieces")).toBeTruthy();
    expect(screen.queryByText("Readout v3")).toBeNull();
  });
});
