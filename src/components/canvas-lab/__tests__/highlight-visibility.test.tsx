// @vitest-environment jsdom
import { readFileSync } from "node:fs";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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

const mine = {
  id: "h1",
  turnNo: 2,
  charStart: 4,
  charEnd: 17,
  excerpt: "pricing floor",
  stale: false,
  version: 1,
  visibility: "engagement" as const,
  isMine: true,
  authorName: "You",
};

const theirs = {
  id: "h2",
  turnNo: 2,
  charStart: 0,
  charEnd: 3,
  excerpt: "The",
  stale: false,
  version: 1,
  visibility: "engagement" as const,
  isMine: false,
  authorName: "Dana",
};

describe("a new highlight is shared by default", () => {
  it("saves at engagement visibility, not just the author", () => {
    const server = readFileSync("src/lib/canvas-lab-annotations.server.ts", "utf8");
    const create = server.slice(server.indexOf("export async function createHighlight"));
    expect(create.slice(0, create.indexOf("archiveHighlight"))).toContain('visibility: "engagement"');
  });
});

describe("the per highlight visibility choice", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });
  afterEach(cleanup);

  function renderOverlay(
    highlights: readonly unknown[],
    onSetHighlightVisibility?: (highlight: unknown, visibility: string) => void,
  ) {
    render(
      <FocusOverlay
        node={node}
        item={item}
        onSummarize={() => undefined}
        onBranch={() => undefined}
        onClose={() => undefined}
        canWrite
        highlights={highlights as never}
        onSetHighlightVisibility={onSetHighlightVisibility as never}
      />,
    );
  }

  it("shows the current state and flips it to just the author", () => {
    const calls: Array<[string, string]> = [];
    renderOverlay([mine], (highlight, visibility) =>
      calls.push([(highlight as { id: string }).id, visibility]),
    );
    const toggle = screen.getByText("Visible to your engagement team");
    fireEvent.click(toggle);
    expect(calls).toEqual([["h1", "just_me"]]);
  });

  it("flips a private one back to the team", () => {
    const calls: Array<[string, string]> = [];
    renderOverlay([{ ...mine, visibility: "just_me" }], (highlight, visibility) =>
      calls.push([(highlight as { id: string }).id, visibility]),
    );
    fireEvent.click(screen.getByText("Just me"));
    expect(calls).toEqual([["h1", "engagement"]]);
  });

  it("shows a teammate's highlight with their name and no controls", () => {
    renderOverlay([theirs], () => undefined);
    expect(screen.getByText(/Dana/)).toBeTruthy();
    expect(screen.queryByText("Remove")).toBeNull();
  });
});
