// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

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

const vendor = { visible: true };
vi.mock("@tanstack/react-query", () => ({ useQuery: () => ({ data: turns, error: null }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/hooks/use-vendor-display", () => ({ useVendorVisible: () => vendor.visible }));
vi.mock("@/lib/telemetry", () => ({ logEvent: vi.fn() }));
vi.mock("@/lib/turn-selection", () => ({
  resolveTurnSelection: () => ({ kind: "ok", selection: { turnNo: 2, charStart: 4, charEnd: 17 } }),
}));

const { LiftedChatBody, LiftedCommentsPanel, LIFT_NOTES_COPY } =
  await import("@/components/canvas-lab/LiftedChat");
const { useChatNotesState } = await import("@/components/canvas-lab/chat-notes");
const { LiftedWork, LIFT_COPY } = await import("@/components/canvas-lab/LiftedWork");

afterEach(() => {
  cleanup();
  vendor.visible = true;
  window.getSelection()?.removeAllRanges();
});

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

type Handlers = Record<string, ReturnType<typeof vi.fn>>;

function Harness({
  chatId = "thread-1",
  canWrite = true,
  handlers = {} as Handlers,
  threads = [thread] as never[],
}) {
  const notes = useChatNotesState(true, chatId);
  return (
    <>
      <LiftedChatBody item={item} notes={notes} threads={threads} highlights={[]} />
      <LiftedCommentsPanel
        notes={notes}
        canWrite={canWrite}
        threads={threads}
        highlights={[]}
        mentionCandidates={[]}
        {...handlers}
      />
    </>
  );
}

function selectInReader() {
  const reader = screen.getByTestId("workboard-expanded-conversation");
  const text = reader.querySelector("p, div, span") ?? reader;
  const range = document.createRange();
  range.selectNodeContents(text);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  vi.spyOn(selection as Selection, "toString").mockReturnValue("pricing floor");
  fireEvent.mouseUp(reader);
}

describe("T2c-1 a chat in the one view: its whole conversation", () => {
  it("shows the full conversation inside the one view's frame, scrolling in place", () => {
    render(<Harness />);
    const frame = screen.getByTestId("lift-chat");
    expect(frame.querySelector('[data-testid="workboard-expanded-conversation"]')).toBeTruthy();
    expect(document.body.textContent).toContain("The pricing floor is 40 percent.");
  });

  it("wears the chat tool's border, and a vendor-neutral workspace a plain one", () => {
    render(<Harness />);
    expect(
      screen.getByTestId("workboard-expanded-conversation").getAttribute("data-chat-border"),
    ).toBe("claude");
    cleanup();
    vendor.visible = false;
    render(<Harness />);
    expect(
      screen.getByTestId("workboard-expanded-conversation").getAttribute("data-chat-border"),
    ).toBe("default");
  });
});

describe("T2c-1 the Comments tab", () => {
  it("lists the chat's comments as the focus reader did, and Reply opens a composer on that thread", () => {
    render(<Harness />);
    expect(screen.getByTestId("lift-notes").textContent).toContain("Worth a second look.");
    fireEvent.click(screen.getByRole("button", { name: "Reply" }));
    expect(screen.getByRole("button", { name: "Post" })).toBeTruthy();
  });

  it("a reader who may not comment sees the comments but no Reply", () => {
    render(<Harness canWrite={false} />);
    expect(screen.getByTestId("lift-notes").textContent).toContain("Worth a second look.");
    expect(screen.queryByRole("button", { name: "Reply" })).toBeNull();
  });

  it("selecting a passage in the conversation offers Highlight and Comment in the tab", () => {
    const onHighlight = vi.fn();
    render(<Harness handlers={{ onHighlight }} />);
    selectInReader();
    fireEvent.click(screen.getByRole("button", { name: "Highlight" }));
    expect(onHighlight).toHaveBeenCalledWith({ turnNo: 2, charStart: 4, charEnd: 17 });
  });

  it("Comment on a selection opens the composer quoting it", () => {
    render(<Harness />);
    selectInReader();
    fireEvent.click(screen.getByRole("button", { name: "Comment" }));
    expect(screen.getByTestId("lift-notes").textContent).toContain("“pricing floor”");
  });

  it("stepping to another chat starts clean: no selection, no open composer", () => {
    function Stepper() {
      const [id, setId] = useState("thread-1");
      return (
        <>
          <button type="button" onClick={() => setId("thread-2")}>
            next
          </button>
          <Harness chatId={id} />
        </>
      );
    }
    render(<Stepper />);
    selectInReader();
    fireEvent.click(screen.getByRole("button", { name: "Comment" }));
    expect(screen.queryByRole("button", { name: "Post" })).toBeTruthy();
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "next" }));
    });
    expect(screen.queryByRole("button", { name: "Post" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Highlight" })).toBeNull();
  });

  it("the tab is named Comments", () => {
    expect(LIFT_NOTES_COPY.tab).toBe("Comments");
  });
});

describe("T2c-1 keys inside the one view", () => {
  function view(onClose = vi.fn(), onStep = vi.fn()) {
    render(
      <LiftedWork
        title="Chat"
        kind="chat"
        origin={null}
        animateOpen={false}
        onClose={onClose}
        onStep={onStep}
      >
        {() => <textarea aria-label="draft" />}
      </LiftedWork>,
    );
    return { onClose, onStep };
  }

  it("Esc in a comment leaves the field and keeps the view; the next Esc closes it", () => {
    const { onClose } = view();
    const box = screen.getByRole("textbox", { name: "draft" });
    box.focus();
    fireEvent.keyDown(box, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
    expect(document.activeElement).not.toBe(box);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(LIFT_COPY.compress).toBeTruthy();
  });

  it("Shift with an arrow grows a selection and never steps to the next piece", () => {
    const { onStep } = view();
    fireEvent.keyDown(window, { key: "ArrowRight", shiftKey: true });
    expect(onStep).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(onStep).toHaveBeenCalledWith(1, null);
  });
});

describe("T2c-1 on the board (wiring pinned in source)", () => {
  const page = readFileSync("src/pages/CanvasLabPage.tsx", "utf8");
  it("a chat lifts as its full conversation with Trail and Comments", () => {
    const lifted = page.slice(
      page.indexOf("<LiftedWork key={liftedNode.id}"),
      page.indexOf("</LiftedWork>", page.indexOf("<LiftedWork key={liftedNode.id}")),
    );
    expect(lifted).toContain('{ id: "comments", label: LIFT_NOTES_COPY.tab');
    expect(lifted).toContain("liftedChatId ? <LiftedChatBody item={liftedItem} notes={liftNotes}");
  });
  it("the comment chip on a chat lifts it with Comments open", () => {
    expect(page).toContain(
      'if (cardItem?.type === "ai_thread") liftCard(node, cardItem, cardRect(node.id), "comments");',
    );
  });
  it("one set of note writers serves both readers, so telemetry and writes stay identical", () => {
    expect(page).toContain("const notesThreadId = liftedChatId ?? focusThreadId;");
    expect(page.match(/\{\.\.\.chatNoteHandlers\(\)\}/g)?.length).toBe(2);
    expect(page).not.toContain("onHighlight={focusThreadId ?");
  });
  it("opening Comments is not counted as opening the trail", () => {
    expect(page).toContain(
      'onPanelOpened={(id) => { if (id === "trail") noteWorkboardWorkTrailOpened(',
    );
  });
});
