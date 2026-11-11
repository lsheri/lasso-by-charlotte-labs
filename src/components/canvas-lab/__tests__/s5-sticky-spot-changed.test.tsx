// @vitest-environment jsdom
// S5 (10 Nov): a sticky on a page, section, row, picture or the whole piece says so when the work under it has
// changed since it was left (a new version, a re-import). Before, only turn stickies knew, and nothing showed it.
import { readFileSync } from "node:fs";
import { cleanup, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/telemetry", () => ({ logEvent: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { rpc: vi.fn() } }));

import { STICKY_UI_COPY, StickiesPanel, StickyLayer } from "@/components/canvas-lab/LiftedStickies";
import { stickyDto, workChangedSince } from "@/lib/stickies.server";
import type { StickyDto } from "@/lib/stickies-shared";

afterEach(() => cleanup());

const sticky = (over: Partial<StickyDto> = {}): StickyDto => ({
  id: "s1",
  workItemId: "deck",
  anchor: { kind: "page", pageNo: 2 },
  posX: 0.5,
  posY: 0.5,
  fill: "yellow",
  body: "Lead with the 41% here.",
  visibility: "engagement",
  isMine: true,
  authorName: "You",
  assigneeId: null,
  assigneeName: null,
  isAssignedToMe: false,
  canMarkDone: true,
  doneAt: null,
  doneByName: null,
  stale: false,
  version: 1,
  createdAt: "2026-11-10T10:00:00Z",
  ...over,
});

const row = (over: Record<string, unknown> = {}) =>
  ({
    id: "s1", work_item_id: "deck", anchor_kind: "page", page_no: 2, turn_no: null, section_key: null, row_key: null,
    turn_hash: null, source_hash: "h1", pos_x: 0.5, pos_y: 0.5, fill: "yellow", body: "x", visibility: "engagement",
    author_profile_id: "me", assignee_profile_id: null, done_at: null, done_by: null, version: 1, created_at: "t",
    ...over,
  }) as never;

describe("S5 when the work has changed", () => {
  it("a different hash now is a change; unknown on either side is not", () => {
    expect(workChangedSince("h1", "h2")).toBe(true);
    expect(workChangedSince("h1", "h1")).toBe(false);
    expect(workChangedSince(null, "h2")).toBe(false);
    expect(workChangedSince("h1", null)).toBe(false);
  });
  it("a page sticky is stale when the deck changed under it, and not before", () => {
    expect(stickyDto(row(), "me", "You", null, undefined, "h2").stale).toBe(true);
    expect(stickyDto(row(), "me", "You", null, undefined, "h1").stale).toBe(false);
    // Stickies left before S5 carry no hash, so they never claim a change.
    expect(stickyDto(row({ source_hash: null }), "me", "You", null, undefined, "h2").stale).toBe(false);
  });
  it("a turn sticky still uses its turn, never the whole piece", () => {
    expect(stickyDto(row({ anchor_kind: "turn", turn_no: 3, turn_hash: "t1" }), "me", "You", "t1", undefined, "h2").stale).toBe(false);
    expect(stickyDto(row({ anchor_kind: "turn", turn_no: 3, turn_hash: "t1" }), "me", "You", "t2", undefined, "h1").stale).toBe(true);
  });
});

function Layer({ stickies }: { stickies: StickyDto[] }) {
  const [body, setBody] = useState<HTMLElement | null>(null);
  return (
    <div ref={(el) => setBody((el?.firstElementChild as HTMLElement | null) ?? null)}>
      <div data-testid="body">
        <div>
          <div data-anchor-page="1">Slide 1</div>
          <div data-anchor-page="2">Slide 2</div>
        </div>
      </div>
      <StickyLayer
        body={body}
        workKind="deck"
        stickies={stickies}
        canWrite
        draft={null}
        openId="s1"
        onOpen={vi.fn()}
        onCancelDraft={vi.fn()}
        onCreate={vi.fn() as never}
        onEdit={vi.fn() as never}
        onRemove={vi.fn(async () => true)}
        people={[]}
      />
    </div>
  );
}

describe("S5 the sticky says so, and stays where it was", () => {
  it("the open sticky carries the note; a fresh one does not", async () => {
    const { unmount } = render(<Layer stickies={[sticky({ stale: true })]} />);
    expect((await screen.findByTestId("sticky-card-changed")).textContent).toBe(STICKY_UI_COPY.changed);
    expect(screen.getByTestId("sticky-pin").getAttribute("data-stale")).toBe("true");
    unmount();
    render(<Layer stickies={[sticky()]} />);
    await screen.findByTestId("sticky-card");
    expect(screen.queryByTestId("sticky-card-changed")).toBeNull();
  });
  it("the Stickies list marks it changed since", () => {
    render(<StickiesPanel body={null} workKind="deck" stickies={[sticky({ stale: true })]} onGo={vi.fn()} />);
    expect(screen.getByTestId("stickies-panel").textContent).toContain(`· ${STICKY_UI_COPY.changedShort}`);
  });
});

describe("S5 wiring (pinned in source)", () => {
  const server = readFileSync("src/lib/stickies.server.ts", "utf8");
  it("a new non-turn sticky remembers the work's hash in the existing source_hash column", () => {
    expect(server).toContain('if (input.anchor.kind !== "turn") {');
    expect(server).toContain("source_hash: sourceHash,");
  });
  it("the list reads the work's hash once, only when a sticky needs it", () => {
    expect(server).toContain('const needsItemHash = rows.some((row) => row.anchor_kind !== "turn" && row.source_hash);');
  });
});
