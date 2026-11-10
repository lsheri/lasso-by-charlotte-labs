// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-vendor-display", () => ({ useVendorVisible: () => true }));
vi.mock("@/lib/telemetry", () => ({ logEvent: vi.fn() }));

import { LiftedWork } from "@/components/canvas-lab/LiftedWork";
import {
  STICKY_UI_COPY,
  StickiesPanel,
  StickyLayer,
  stickyContent,
  stickyScroller,
  type StickyDraft,
} from "@/components/canvas-lab/LiftedStickies";
import type { StickyDto } from "@/lib/stickies-shared";

afterEach(cleanup);

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
  doneAt: null,
  stale: false,
  version: 1,
  createdAt: "2026-11-10T10:00:00Z",
  ...over,
});

function Work({ children }: { children?: React.ReactNode }) {
  return (
    <div data-testid="body">
      <div data-testid="content">
        <div data-anchor-page="1">Slide 1</div>
        <div data-anchor-page="2">Slide 2</div>
        {children}
      </div>
    </div>
  );
}

function Harness({
  stickies,
  draft: initialDraft = null,
  onCreate = vi.fn(async () => true),
  onRemove = vi.fn(async () => true),
}: {
  stickies: StickyDto[];
  draft?: StickyDraft | null;
  onCreate?: ReturnType<typeof vi.fn>;
  onRemove?: ReturnType<typeof vi.fn>;
}) {
  const [body, setBody] = useState<HTMLElement | null>(null);
  const [draft, setDraft] = useState<StickyDraft | null>(initialDraft);
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <div ref={(el) => setBody((el?.firstElementChild as HTMLElement | null) ?? null)}>
      <Work />
      <StickyLayer
        body={body}
        workKind="deck"
        stickies={stickies}
        canWrite
        draft={draft}
        openId={openId}
        onOpen={setOpenId}
        onCancelDraft={() => setDraft(null)}
        onCreate={onCreate as never}
        onEdit={vi.fn(async () => true)}
        onRemove={onRemove as never}
      />
    </div>
  );
}

describe("S2b where stickies are drawn", () => {
  it("a chat scrolls inside its frame; anything else scrolls in the body", () => {
    const { container } = render(
      <div data-testid="b">
        <div className="chat-preview-window__body">
          <div id="c" />
        </div>
      </div>,
    );
    const body = container.querySelector("[data-testid=b]") as HTMLElement;
    expect(stickyScroller(body)?.className).toBe("chat-preview-window__body");
    expect(stickyContent(stickyScroller(body))?.id).toBe("c");
    expect(stickyScroller(null)).toBeNull();
  });

  it("a sticky is drawn on its slide, inside the scrolling work, and says where it is", async () => {
    render(<Harness stickies={[sticky()]} />);
    const pin = await screen.findByTestId("sticky-pin");
    expect(pin.getAttribute("aria-label")).toBe("Sticky on Slide 2: Lead with the 41% here.");
    expect(screen.getByTestId("sticky-layer").parentElement?.getAttribute("data-testid")).toBe(
      "body",
    );
    expect(screen.getByTestId("body").classList.contains("has-stickies")).toBe(true);
  });

  it("a sticky whose slide left the work is not drawn anywhere else", async () => {
    render(<Harness stickies={[sticky({ anchor: { kind: "page", pageNo: 9 } })]} />);
    await act(async () => undefined);
    expect(screen.queryByTestId("sticky-pin")).toBeNull();
  });

  it("opening a sticky shows its words and who left it; the author can remove it", async () => {
    const onRemove = vi.fn(async () => true);
    render(<Harness stickies={[sticky({ isMine: true })]} onRemove={onRemove} />);
    fireEvent.click(await screen.findByTestId("sticky-pin"));
    const card = screen.getByTestId("sticky-card");
    expect(card.textContent).toContain("Lead with the 41% here.");
    expect(card.textContent).toContain(STICKY_UI_COPY.you);
    fireEvent.click(screen.getByRole("button", { name: STICKY_UI_COPY.remove }));
    await act(async () => undefined);
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("someone else's sticky can be read, never edited or removed", async () => {
    render(<Harness stickies={[sticky({ isMine: false, authorName: "Dana Ortiz" })]} />);
    fireEvent.click(await screen.findByTestId("sticky-pin"));
    expect(screen.getByTestId("sticky-card").textContent).toContain("Dana Ortiz");
    expect(screen.queryByRole("button", { name: STICKY_UI_COPY.edit })).toBeNull();
    expect(screen.queryByRole("button", { name: STICKY_UI_COPY.remove })).toBeNull();
  });

  it("a dropped sticky opens to be written; it saves with its words, colour and who can see it", async () => {
    const onCreate = vi.fn(async () => true);
    render(
      <Harness
        stickies={[]}
        draft={{ anchor: { kind: "page", pageNo: 1 }, posX: 0.3, posY: 0.4 }}
        onCreate={onCreate}
      />,
    );
    const text = await screen.findByRole("textbox", { name: STICKY_UI_COPY.placeholder });
    fireEvent.change(text, { target: { value: "Source the 24" } });
    fireEvent.click(screen.getByRole("button", { name: "Turquoise" }));
    fireEvent.click(screen.getByRole("radio", { name: STICKY_UI_COPY.justMe }));
    fireEvent.click(screen.getByRole("button", { name: STICKY_UI_COPY.save }));
    await act(async () => undefined);
    expect(onCreate).toHaveBeenCalledWith(
      { anchor: { kind: "page", pageNo: 1 }, posX: 0.3, posY: 0.4 },
      "Source the 24",
      "blue",
      "just_me",
    );
  });

  it("an empty sticky is not saved", async () => {
    const onCreate = vi.fn(async () => true);
    render(
      <Harness
        stickies={[]}
        draft={{ anchor: { kind: "item" }, posX: 0.5, posY: 0.5 }}
        onCreate={onCreate}
      />,
    );
    fireEvent.click(await screen.findByRole("button", { name: STICKY_UI_COPY.save }));
    expect(onCreate).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toBe("Write something first.");
  });

  it("Esc from the view cancels a sticky being written, and only then closes the view", async () => {
    const onClose = vi.fn();
    function InView() {
      const [body, setBody] = useState<HTMLDivElement | null>(null);
      const [draft, setDraft] = useState<StickyDraft | null>({
        anchor: { kind: "page", pageNo: 1 },
        posX: 0.5,
        posY: 0.5,
      });
      return (
        <LiftedWork
          title="Deck"
          kind="deck"
          origin={null}
          animateOpen={false}
          onClose={onClose}
          bodyRef={setBody}
        >
          {() => (
            <>
              <div>
                <div data-anchor-page="1">Slide 1</div>
              </div>
              <StickyLayer
                body={body}
                workKind="deck"
                stickies={[]}
                canWrite
                draft={draft}
                openId={null}
                onOpen={() => undefined}
                onCancelDraft={() => setDraft(null)}
                onCreate={vi.fn(async () => true)}
                onEdit={vi.fn(async () => true)}
                onRemove={vi.fn(async () => true)}
              />
            </>
          )}
        </LiftedWork>
      );
    }
    render(<InView />);
    await screen.findByTestId("sticky-card");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByTestId("sticky-card")).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("S2b the Stickies tab", () => {
  it("lists stickies in the order of the work, with where each sits; a moved spot is listed apart", () => {
    const content = document.createElement("div");
    content.innerHTML = '<div data-anchor-page="1"></div><div data-anchor-page="3"></div>';
    const body = document.createElement("div");
    body.appendChild(content);
    const onGo = vi.fn();
    render(
      <StickiesPanel
        body={body}
        workKind="deck"
        stickies={[
          sticky({ id: "late", anchor: { kind: "page", pageNo: 3 }, body: "Three" }),
          sticky({ id: "early", anchor: { kind: "page", pageNo: 1 }, body: "One" }),
          sticky({ id: "gone", anchor: { kind: "page", pageNo: 7 }, body: "Gone" }),
        ]}
        onGo={onGo}
      />,
    );
    const rows = screen.getAllByRole("button");
    expect(rows.map((row) => row.textContent)).toEqual([
      "OneSlide 1 · You",
      "ThreeSlide 3 · You",
      "GoneSlide 7 · You",
    ]);
    expect(screen.getByText(STICKY_UI_COPY.moved)).toBeTruthy();
    expect((rows[2] as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(rows[0]!);
    expect(onGo).toHaveBeenCalledWith(expect.objectContaining({ id: "early" }));
  });
  it("with none, it says how to leave one", () => {
    render(<StickiesPanel body={null} workKind="deck" stickies={[]} onGo={vi.fn()} />);
    expect(screen.getByText(STICKY_UI_COPY.empty)).toBeTruthy();
  });
});

describe("S2b the one view carries the pad and the layer", () => {
  it("the pad sits at the foot of the rail, even with no panels", () => {
    render(
      <LiftedWork
        title="Deck"
        kind="deck"
        origin={null}
        onClose={vi.fn()}
        railFoot={<span data-testid="pad">pad</span>}
      >
        {() => null}
      </LiftedWork>,
    );
    expect(screen.getByTestId("pad").closest(".lift-rail-foot")).toBeTruthy();
  });
});

describe("S2b on the board (wiring pinned in source)", () => {
  const page = readFileSync("src/pages/CanvasLabPage.tsx", "utf8");
  const hook = readFileSync("src/components/canvas-lab/useLiftedStickies.tsx", "utf8");
  const pad = readFileSync("src/components/canvas-lab/LiftedStickies.tsx", "utf8");
  it("every lifted piece of work has a Stickies tab, the pad and the layer", () => {
    expect(page).toContain(
      '{ id: "stickies", label: liftStickies.label, render: () => liftStickies.panel }',
    );
    expect(page).toContain(
      "bodyRef={setLiftBody} railFoot={liftedItem ? liftStickies.pad : undefined}",
    );
    expect(page).toContain("{liftedItem ? liftStickies.layer : null}");
  });
  it("only someone who can edit the board gets the pad", () => {
    expect(page).toContain("canWrite: canComment");
    expect(hook).toContain("pad: canWrite ?");
  });
  it("a sticky is saved on the piece it was dropped on, and counted without naming anyone", () => {
    expect(hook).toContain("workItemId: pieceId,");
    expect(hook).toContain("noteWorkboardStickyCreated(orgId, {");
    expect(hook).toContain("assigned: false,");
  });
  it("the drag listens in the capture phase, because the view stops presses at its root", () => {
    expect(pad).toContain('window.addEventListener("pointerup", up, true);');
  });
});
