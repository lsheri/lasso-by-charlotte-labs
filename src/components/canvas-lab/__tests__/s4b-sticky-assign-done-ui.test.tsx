// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/telemetry", () => ({ logEvent: vi.fn() }));

import { logEvent } from "@/lib/telemetry";
import {
  STICKY_UI_COPY,
  StickiesPanel,
  StickyLayer,
  type StickyDraft,
  type StickyPerson,
} from "@/components/canvas-lab/LiftedStickies";
import * as helpers from "@/components/canvas-lab/canvas-lab-telemetry";
import type { StickyDto } from "@/lib/stickies-shared";
import { guardWorkboardEvent } from "@/lib/workboard-event-allowlist";

afterEach(() => {
  cleanup();
  vi.mocked(logEvent).mockClear();
});

const people: StickyPerson[] = [
  { profileId: "ben", displayName: "Ben Stanton" },
  { profileId: "kim", displayName: "Kim Ito" },
];

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

function Harness({
  stickies,
  draft: initialDraft = null,
  open = null,
  canWrite = true,
  onCreate = vi.fn(async () => true),
  onEdit = vi.fn(async () => true),
  onSetDone = vi.fn(async () => true),
}: {
  stickies: StickyDto[];
  draft?: StickyDraft | null;
  open?: string | null;
  canWrite?: boolean;
  onCreate?: ReturnType<typeof vi.fn>;
  onEdit?: ReturnType<typeof vi.fn>;
  onSetDone?: ReturnType<typeof vi.fn>;
}) {
  const [body, setBody] = useState<HTMLElement | null>(null);
  const [draft, setDraft] = useState<StickyDraft | null>(initialDraft);
  const [openId, setOpenId] = useState<string | null>(open);
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
        canWrite={canWrite}
        draft={draft}
        openId={openId}
        onOpen={setOpenId}
        onCancelDraft={() => setDraft(null)}
        onCreate={onCreate as never}
        onEdit={onEdit as never}
        onRemove={vi.fn(async () => true)}
        people={people}
        onSetDone={onSetDone as never}
      />
    </div>
  );
}

const ask = () => screen.getByRole("combobox", { name: STICKY_UI_COPY.ask }) as HTMLSelectElement;

describe("S4b asking someone", () => {
  it("a new sticky can ask someone on the board", async () => {
    const onCreate = vi.fn(async () => true);
    render(<Harness stickies={[]} draft={{ anchor: { kind: "page", pageNo: 2 }, posX: 0.5, posY: 0.5 }} onCreate={onCreate} />);
    await screen.findByTestId("sticky-card");
    expect([...ask().options].map((o) => o.textContent)).toEqual([STICKY_UI_COPY.noOne, "Ben Stanton", "Kim Ito"]);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Source the 24" } });
    fireEvent.change(ask(), { target: { value: "ben" } });
    fireEvent.click(screen.getByRole("button", { name: STICKY_UI_COPY.save }));
    await act(async () => undefined);
    expect(onCreate).toHaveBeenCalledWith(expect.anything(), "Source the 24", "yellow", "engagement", "ben");
  });
  it("a just-me sticky cannot ask anyone, and saving it drops the choice", async () => {
    const onCreate = vi.fn(async () => true);
    render(<Harness stickies={[]} draft={{ anchor: { kind: "page", pageNo: 2 }, posX: 0.5, posY: 0.5 }} onCreate={onCreate} />);
    await screen.findByTestId("sticky-card");
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Mine" } });
    fireEvent.change(ask(), { target: { value: "ben" } });
    fireEvent.click(screen.getByLabelText(STICKY_UI_COPY.justMe));
    expect(ask().disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: STICKY_UI_COPY.save }));
    await act(async () => undefined);
    expect(onCreate).toHaveBeenCalledWith(expect.anything(), "Mine", "yellow", "just_me", null);
  });
  it("editing sends the assignee only when it changed", async () => {
    const onEdit = vi.fn(async (_sticky: unknown, _patch: unknown) => true);
    render(<Harness stickies={[sticky({ assigneeId: "ben", assigneeName: "Ben Stanton" })]} open="s1" onEdit={onEdit} />);
    fireEvent.click(await screen.findByRole("button", { name: STICKY_UI_COPY.edit }));
    fireEvent.click(screen.getByRole("button", { name: STICKY_UI_COPY.save }));
    await act(async () => undefined);
    expect(onEdit.mock.calls[0]?.[1]).not.toHaveProperty("assigneeProfileId");
    fireEvent.click(await screen.findByRole("button", { name: STICKY_UI_COPY.edit }));
    fireEvent.change(ask(), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: STICKY_UI_COPY.save }));
    await act(async () => undefined);
    expect(onEdit.mock.calls[1]?.[1]).toMatchObject({ assigneeProfileId: null });
  });
  it("the sticky says who it asks", async () => {
    render(<Harness stickies={[sticky({ assigneeId: "ben", assigneeName: "Ben Stanton" })]} open="s1" />);
    expect((await screen.findByTestId("sticky-card")).textContent).toContain("For Ben Stanton");
  });
});

describe("S4b done", () => {
  it("the person asked ticks it done from the sticky, even without edit rights", async () => {
    const onSetDone = vi.fn(async () => true);
    render(
      <Harness
        canWrite={false}
        stickies={[sticky({ isMine: false, authorName: "Liam", isAssignedToMe: true, assigneeId: "me", assigneeName: "You" })]}
        open="s1"
        onSetDone={onSetDone}
      />,
    );
    fireEvent.click(await screen.findByRole("checkbox", { name: STICKY_UI_COPY.markDone }));
    await act(async () => undefined);
    expect(onSetDone).toHaveBeenCalledWith(expect.objectContaining({ id: "s1" }), true);
  });
  it("someone it does not ask cannot tick it", async () => {
    render(<Harness stickies={[sticky({ isMine: false, canMarkDone: false })]} open="s1" />);
    await screen.findByTestId("sticky-card");
    expect(screen.queryByRole("checkbox")).toBeNull();
  });
  it("a done sticky says who did it, stays on its spot quieter, and unticking reopens it", async () => {
    const onSetDone = vi.fn(async () => true);
    render(<Harness stickies={[sticky({ doneAt: "2026-11-10T12:00:00Z", doneByName: "Ben Stanton" })]} open="s1" onSetDone={onSetDone} />);
    const pin = await screen.findByTestId("sticky-pin");
    expect(pin.getAttribute("data-done")).toBe("true");
    expect(screen.getByTestId("sticky-card").textContent).toContain("Done · Ben Stanton");
    fireEvent.click(screen.getByRole("checkbox", { name: STICKY_UI_COPY.done }));
    await act(async () => undefined);
    expect(onSetDone).toHaveBeenCalledWith(expect.anything(), false);
  });
  it("a sticky that asks you carries a small mark until it is done", async () => {
    render(<Harness stickies={[sticky({ id: "a", isAssignedToMe: true }), sticky({ id: "b", isAssignedToMe: true, doneAt: "x", anchor: { kind: "page", pageNo: 1 } })]} />);
    await screen.findAllByTestId("sticky-pin");
    const pins = screen.getAllByTestId("sticky-pin");
    expect(pins.map((p) => p.getAttribute("data-for-me"))).toEqual(["true", null]);
  });
  it("the list keeps done stickies apart, last", () => {
    render(
      <StickiesPanel
        body={null}
        workKind="deck"
        stickies={[sticky({ id: "d", body: "Done one", doneAt: "x" }), sticky({ id: "o", body: "Open one", assigneeName: "Kim Ito" })]}
        onGo={vi.fn()}
      />,
    );
    const panel = screen.getByTestId("stickies-panel");
    expect(panel.textContent).toMatch(/Open one.*For Kim Ito.*Done.*Done one/);
    expect(panel.textContent).not.toContain(STICKY_UI_COPY.empty);
  });
});

describe("S4b events: done and reopened, never who or how long", () => {
  it("each carries only its allowed dims", () => {
    helpers.noteWorkboardStickyDone("o", "view");
    helpers.noteWorkboardStickyDone("o", "inbox");
    helpers.noteWorkboardStickyReopened("o");
    const calls = vi.mocked(logEvent).mock.calls as [string, string, Record<string, unknown>][];
    expect(calls.map(([name, , dims]) => [name, dims])).toEqual([
      ["workboard.sticky_done", { via: "view" }],
      ["workboard.sticky_done", { via: "inbox" }],
      ["workboard.sticky_reopened", {}],
    ]);
    for (const [name, , dims] of calls) expect(guardWorkboardEvent(name, dims as never)).toEqual({ keep: true, dims });
  });
  it("the one view records done and reopen, and a created sticky says whether it asks someone", () => {
    const hook = readFileSync("src/components/canvas-lab/useLiftedStickies.tsx", "utf8");
    expect(hook).toContain('noteWorkboardStickyDone(orgId, "view")');
    expect(hook).toContain("noteWorkboardStickyReopened(orgId)");
    expect(hook).toContain('assigned: visibility !== "just_me" && !!assigneeId,');
  });
});
