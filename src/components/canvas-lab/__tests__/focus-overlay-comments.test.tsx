// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const turns = [
  {
    id: "t2",
    turn_no: 2,
    role: "assistant",
    content: "The pricing floor is 40 percent.",
    content_hash: "h2",
    ts: null,
    model: null,
    meta: null,
  },
];

vi.mock("@tanstack/react-query", () => ({ useQuery: () => ({ data: turns, error: null }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

const { FocusOverlay } = await import("@/components/canvas-lab/FocusOverlay");

const item = {
  id: "thread-1",
  title: "A conversation",
  type: "ai_thread",
  source: "paste",
  visibility: "private",
  captured_at: "2026-09-16T00:00:00Z",
  content_ref: null,
  created_at_source: null,
  work_date: null,
  work_item_tasks: [],
} as never;

const node = {
  id: "n1",
  kind: "ai_work",
  typeLabel: "AI work",
  title: "A conversation",
  summary: "",
  ownership: "yours",
  x: 0,
  y: 0,
  width: 320,
  height: 200,
} as never;

const thread = {
  id: "c1",
  parentId: null,
  authorProfileId: "p2",
  authorName: "Dana",
  isMine: false,
  body: "Worth a second look.",
  excerpt: "pricing floor",
  turnNo: 2,
  charStart: 4,
  charEnd: 17,
  stale: false,
  version: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  edited: false,
  replies: [],
} as never;

function renderOverlay(canWrite: boolean) {
  render(
    <FocusOverlay
      node={node}
      item={item}
      onSummarize={() => undefined}
      onBranch={() => undefined}
      onClose={() => undefined}
      canWrite={canWrite}
      threads={[thread]}
    />,
  );
}

describe("comments in the reader", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });
  afterEach(cleanup);

  it("shows a thread to someone who can only read, with no way to add", () => {
    renderOverlay(false);
    expect(screen.getByText("Worth a second look.")).toBeTruthy();
    expect(screen.queryByText("Reply")).toBeNull();
    expect(screen.queryByText("Comment")).toBeNull();
    expect(screen.queryByText("Highlight")).toBeNull();
  });

  it("offers a reply to someone on the engagement", () => {
    renderOverlay(true);
    expect(screen.getByText("Reply")).toBeTruthy();
  });

  it("keeps the old unsaved margin notes out of the panel", () => {
    renderOverlay(true);
    expect(screen.queryByText("notes in the margin")).toBeNull();
  });
});
