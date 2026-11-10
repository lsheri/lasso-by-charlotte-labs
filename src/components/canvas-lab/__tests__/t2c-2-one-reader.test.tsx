// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const turns = [
  {
    id: "t1",
    turn_no: 1,
    role: "user",
    content: "What is the floor?",
    content_hash: "h1",
    ts: null,
    model: null,
    meta: null,
  },
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
vi.mock("@/hooks/use-vendor-display", () => ({ useVendorVisible: () => true }));

const { LiftedNoteBody, LIFT_NOTE_COPY } = await import("@/components/canvas-lab/LiftedNoteBody");
const { LiftedChatBody } = await import("@/components/canvas-lab/LiftedChat");
const { useChatNotesState } = await import("@/components/canvas-lab/chat-notes");

// jsdom has no scrolling; the turn is still found and lit.
Element.prototype.scrollTo = function scrollTo() {} as never;

afterEach(cleanup);

const item = {
  id: "thread-1",
  title: "A conversation",
  type: "ai_thread",
  source: "claude",
  source_vendor: "claude",
  source_meta: {},
  visibility: "private",
  captured_at: "2026-09-16T00:00:00Z",
  content_ref: null,
  created_at_source: null,
  work_date: null,
  work_item_tasks: [],
} as never;

function Chat({ turn }: { turn: number | null }) {
  const notes = useChatNotesState(true, "thread-1");
  return (
    <LiftedChatBody item={item} notes={notes} focusTurnNo={turn} threads={[]} highlights={[]} />
  );
}

describe("T2c-2 a note, or a card still loading, opens in the same view", () => {
  it("shows the note's words", () => {
    render(
      <LiftedNoteBody
        summary="Client wants the floor held"
        prompt="Check with finance"
        state="note"
      />,
    );
    expect(screen.getByTestId("lift-note").textContent).toContain("Client wants the floor held");
    expect(screen.getByTestId("lift-note").textContent).toContain("Check with finance");
    expect(screen.getByTestId("lift-note").textContent).not.toContain(LIFT_NOTE_COPY.unavailable);
  });
  it("says the work is on the way while it loads", () => {
    render(<LiftedNoteBody summary="" state="loading" />);
    expect(screen.getByTestId("lift-note").getAttribute("aria-busy")).toBe("true");
    expect(screen.getByTestId("lift-note").textContent).toContain(LIFT_NOTE_COPY.loading);
  });
  it("says plainly when the work could not be read", () => {
    render(<LiftedNoteBody summary="Deck" state="unavailable" />);
    expect(screen.getByTestId("lift-note").textContent).toContain(LIFT_NOTE_COPY.unavailable);
  });
});

describe("T2c-2 a decision's source opens the chat at its turn, in the one view", () => {
  it("lights the cited turn", async () => {
    render(<Chat turn={2} />);
    await waitFor(() =>
      expect(document.querySelector('[data-turn-no="2"][data-turn-focus="true"]')).toBeTruthy(),
    );
    expect(document.querySelector('[data-turn-no="1"][data-turn-focus="true"]')).toBeNull();
  });
  it("lights nothing when no turn is asked for", () => {
    render(<Chat turn={null} />);
    expect(document.querySelector("[data-turn-focus]")).toBeNull();
  });
});

describe("T2c-2 on the board (wiring pinned in source)", () => {
  const page = readFileSync("src/pages/CanvasLabPage.tsx", "utf8");
  it("the old full-screen reader and the Lab review are gone from the signed-in board", () => {
    expect(page).not.toMatch(/<FocusOverlay|<CanvasLabReview|setFocusId|setReviewId/);
  });
  it("every card opens in the one view; only the decisions document's Expand opens its ledger", () => {
    const fn = page.slice(
      page.indexOf("function openNode"),
      page.indexOf("/* ---------------- B4"),
    );
    expect(fn).toContain("setLedgerId(node.id);");
    expect(fn).toContain("liftCard(node, item, origin);");
  });
  it("a card with no work, or work still loading, lifts into the same view", () => {
    expect(page).toContain(
      "{liftedNode && !liftedPicture && lifted ? <LiftedWork key={liftedNode.id}",
    );
    expect(page).toContain(
      'state={!liftedNode.workItemId ? "note" : pendingBoardItemIds.has(liftedNode.workItemId) ? "loading" : "unavailable"}',
    );
  });
  it("one view for a card whether its work has landed or not, so it never re-mounts or replays the grow (review 2)", () => {
    expect(page).toContain("{(bodyWidth) => !liftedItem ? <LiftedNoteBody");
    expect(page).not.toContain("{liftedNode && !liftedItem && !liftedPicture && lifted ?");
  });
  it("closing a pointer's chat returns focus to the ledger, and the board under the ledger takes no keys (review 1, 3)", () => {
    expect(page).toContain("returnFocusTo={() => (lifted.still ? stillFocusRef.current :");
    expect(page).toContain("if (liftedRef.current || ledgerRef.current) return;");
    expect(page).toContain("...(lifted.still ? { still: true } : {})");
  });
  it("a ledger pointer lifts the chat in place at its turn; a chat not on the board keeps the source reader", () => {
    expect(page).toContain(
      "setLifted({ id: chat.id, origin: null, still: true, ...(turn ? { turn } : {}) });",
    );
    expect(page).toContain("focusTurnNo={lifted.turn ?? null}");
    expect(page).toContain("setPointerChatId(parentId);");
  });
  it("shared boards and demos keep the focus reader, read only", () => {
    expect(readFileSync("src/components/canvas-lab/SharedBoardView.tsx", "utf8")).toContain(
      "<FocusOverlay",
    );
  });
});
