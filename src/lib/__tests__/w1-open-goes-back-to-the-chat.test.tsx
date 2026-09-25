// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ChatUrlLink } from "@/components/work/ChatUrlLink";
import { deriveChatUrl, effectiveChatUrl, safeChatUrl } from "@/lib/chat-url";
import { NO_SOURCE_LINK_LABEL, canOpenAtSource, keptContentLabel, resolveWorkOpen } from "@/lib/work-open";
import type { WorkItemRow } from "@/lib/work-types";

const CPT_CONVERSATION_ID = "04883dd3-81b8-5032-ab6e-029f37fedaa7";

afterEach(cleanup);

function item(overrides: Partial<WorkItemRow> = {}): WorkItemRow {
  return {
    id: "w1",
    title: "CPT 0511U and the PARIS test",
    type: "ai_thread",
    source: "mcp:claude",
    visibility: "unmapped",
    captured_at: "2026-09-01T00:00:00Z",
    content_ref: null,
    created_at_source: null,
    work_date: null,
    content_fidelity: "transcribed",
    source_vendor: "claude",
    orig_conversation_id: null,
    source_meta: null,
    meta: null,
    work_item_tasks: [],
    ...overrides,
  } as WorkItemRow;
}

/** The push as it landed: a transcript row and an attachment row, no URL anywhere. */
const transcript = item({
  orig_conversation_id: CPT_CONVERSATION_ID,
  source_meta: { vendor: "claude", role: "transcript" },
});
const attachment = item({
  id: "w2",
  type: "document",
  content_ref: "pushes/w2-artifact.md",
  orig_conversation_id: CPT_CONVERSATION_ID,
  source_meta: { vendor: "claude", role: "attachment", kind: "artifact_markdown" },
});

describe("W1 — the reproduction", () => {
  it("the push carries no URL of any kind", () => {
    expect(safeChatUrl(transcript.source_meta?.url)).toBeNull();
    expect(safeChatUrl(attachment.source_meta?.url)).toBeNull();
  });

  it("the attachment row is the one holding a stored file, and it is not the chat", () => {
    expect(attachment.content_ref).toBeTruthy();
    expect(transcript.content_ref).toBeNull();
  });
});

describe("W1 — a bare origin is not a link", () => {
  it("treats the three vendor front doors as absent", () => {
    expect(safeChatUrl("https://claude.ai/")).toBeNull();
    expect(safeChatUrl("https://chatgpt.com/")).toBeNull();
    expect(safeChatUrl("https://gemini.google.com/app")).toBeNull();
  });

  it("still keeps a URL that points at a conversation", () => {
    expect(safeChatUrl("https://claude.ai/chat/abc")).toBe("https://claude.ai/chat/abc");
    expect(safeChatUrl("https://gemini.google.com/app/abc")).toContain("/app/abc");
  });
});

describe("W1 — deriving, and refusing to derive", () => {
  it("derives for Claude from a real conversation UUID", () => {
    expect(deriveChatUrl("claude", CPT_CONVERSATION_ID)).toBe(
      `https://claude.ai/chat/${CPT_CONVERSATION_ID}`,
    );
  });

  it("never derives for ChatGPT, whose ids are invented slugs", () => {
    expect(deriveChatUrl("chatgpt", "38bcca81ec8b-lasso-design-system")).toBeNull();
    expect(deriveChatUrl("chatgpt", CPT_CONVERSATION_ID)).toBeNull();
  });

  it("never derives for any other vendor", () => {
    for (const vendor of ["gemini", "copilot", "granola", null]) {
      expect(deriveChatUrl(vendor, CPT_CONVERSATION_ID)).toBeNull();
    }
  });

  it("ignores a front door URL and derives instead", () => {
    expect(effectiveChatUrl("https://claude.ai/", "claude", CPT_CONVERSATION_ID)).toBe(
      `https://claude.ai/chat/${CPT_CONVERSATION_ID}`,
    );
  });
});

describe("W1 — what Open does", () => {
  it("goes back to the chat when a conversation URL exists", () => {
    const plan = resolveWorkOpen(transcript);
    expect(plan).toEqual({
      kind: "source",
      url: `https://claude.ai/chat/${CPT_CONVERSATION_ID}`,
    });
  });

  it("reads it here when there is no URL and none can be derived", () => {
    const orphan = item({ source_vendor: "chatgpt", orig_conversation_id: "38bcca81ec8b-lasso" });
    expect(resolveWorkOpen(orphan)).toEqual({ kind: "reader" });
  });

  it("shows the stored file only when there is no chat to go back to", () => {
    const filed = item({ type: "document", content_ref: "pushes/x.md", source_vendor: null });
    expect(resolveWorkOpen(filed)).toEqual({ kind: "file" });
  });
});

describe("W1 — the card is honest about it", () => {
  it("offers the way back when there is one", () => {
    expect(canOpenAtSource(transcript)).toBe(true);
    render(<ChatUrlLink item={transcript} showAbsence />);
    expect(screen.getByRole("link", { name: /Open in Claude/ })).toBeTruthy();
  });

  it("says plainly when there is not", () => {
    const orphan = item({ source_vendor: "chatgpt", orig_conversation_id: "38bcca81ec8b-lasso" });
    expect(canOpenAtSource(orphan)).toBe(false);
    render(<ChatUrlLink item={orphan} showAbsence />);
    expect(screen.getByText(NO_SOURCE_LINK_LABEL)).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("states what was kept from already-loaded card data", () => {
    expect(keptContentLabel(item(), 1)).toBe("1 turn kept in full");
    expect(keptContentLabel(item(), 12)).toBe("12 turns kept in full");
    expect(keptContentLabel(item({ type: "document", content_fidelity: "verbatim" }))).toBe("Kept in full");
    expect(keptContentLabel(item({ type: "document", content_fidelity: "summary" }))).toBe("Summary kept");
  });

  it("stays silent where it always was silent", () => {
    const orphan = item({ source_vendor: "chatgpt", orig_conversation_id: "38bcca81ec8b-lasso" });
    const { container } = render(<ChatUrlLink item={orphan} />);
    expect(container.innerHTML).toBe("");
  });
});
