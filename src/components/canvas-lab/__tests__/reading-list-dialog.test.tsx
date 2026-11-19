// @vitest-environment jsdom
// 19 Nov, Firm Brain Build Spec step 8: the board's reading list. Up to three shared engagements; admins, leads and
// the board's owner add and remove; everyone else on the board reads. Loading, empty, full, failed load, a refused
// write, a double click, and a dialog closed before its request returns. Never who pinned.
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { READING_LIST_COPY, type ReadingList, type ReadingPin } from "@/lib/manager-tools-shared";

const m = vi.hoisted(() => ({ load: vi.fn(), pin: vi.fn(), unpin: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/manager-tools.functions", () => ({
  readingListFn: (...a: unknown[]) => m.load(...a),
  pinReadingThreadFn: (...a: unknown[]) => m.pin(...a),
  unpinReadingThreadFn: (...a: unknown[]) => m.unpin(...a),
}));
vi.mock("@/components/firm-brain/FirmSourcePreview", () => ({
  FirmSourcePreview: ({ itemId }: { itemId: string | null }) => (itemId ? <div data-testid="source-preview">{itemId}</div> : null),
}));

import { ReadingListDialog } from "@/components/canvas-lab/ReadingListDialog";

const entry = (n: number, over: Partial<ReadingPin> = {}): ReadingPin => ({
  threadId: `t${n}`,
  slot: n as 1 | 2 | 3,
  title: `Thread ${n}`,
  client: `Client ${n}`,
  situation: "Setting the right price",
  sourceItemId: `sow${n}`,
  ...over,
});
const listOf = (pins: ReadingPin[], canPin: boolean, choices = [{ threadId: "t9", title: "Thread nine", client: "Northwind" }]): ReadingList => ({
  pins,
  canPin,
  choices: canPin ? choices : [],
  full: pins.length >= 3,
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

const dialog = (open: boolean, onClose = vi.fn()) => <ReadingListDialog engagementId="board-1" profileId="p1" open={open} onClose={onClose} />;
const pins = () => [...document.querySelectorAll("[data-reading-pin]")].map((node) => node.querySelector("p")?.textContent);
const picker = () => screen.getByLabelText(READING_LIST_COPY.addLabel) as HTMLSelectElement;
const addButton = () => screen.getByRole("button", { name: READING_LIST_COPY.add }) as HTMLButtonElement;

beforeEach(() => {
  m.load.mockReset();
  m.pin.mockReset();
  m.unpin.mockReset();
});
afterEach(cleanup);

describe("ReadingListDialog", () => {
  it("does nothing until it is opened", () => {
    render(dialog(false));
    expect(m.load).not.toHaveBeenCalled();
    expect(screen.queryByTestId("reading-list")).toBeNull();
  });

  it("says it is loading, then lists the pinned engagements in slot order", async () => {
    const pending = deferred<ReadingList>();
    m.load.mockReturnValue(pending.promise);
    render(dialog(true));
    expect(screen.getByRole("status").textContent).toBe(READING_LIST_COPY.loading);
    expect(m.load).toHaveBeenCalledWith({ data: { board_id: "board-1", profile_id: "p1" } });
    pending.resolve(listOf([entry(1), entry(2)], false));
    await waitFor(() => expect(pins()).toEqual(["Thread 1", "Thread 2"]));
    expect(screen.getByText("Client 1 · Setting the right price")).toBeTruthy();
  });

  it("gives a reader no way to add or remove", async () => {
    m.load.mockResolvedValue(listOf([entry(1)], false));
    render(dialog(true));
    await waitFor(() => expect(pins()).toEqual(["Thread 1"]));
    expect(screen.queryByLabelText(READING_LIST_COPY.addLabel)).toBeNull();
    expect(screen.queryByRole("button", { name: /Remove/ })).toBeNull();
  });

  it("opens an engagement in the firm reader's own preview, and offers nothing to open when there is no source", async () => {
    m.load.mockResolvedValue(listOf([entry(1), entry(2, { sourceItemId: null })], false));
    render(dialog(true));
    await waitFor(() => expect(pins()).toHaveLength(2));
    expect(screen.queryByRole("button", { name: "Open Thread 2" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Open Thread 1" }));
    expect(screen.getByTestId("source-preview").textContent).toBe("sow1");
  });

  it("shows an empty list in words that fit the reader", async () => {
    m.load.mockResolvedValue(listOf([], false));
    const first = render(dialog(true));
    await waitFor(() => expect(screen.getByText(READING_LIST_COPY.empty)).toBeTruthy());
    first.unmount();
    m.load.mockResolvedValue(listOf([], true));
    render(dialog(true));
    await waitFor(() => expect(screen.getByText(READING_LIST_COPY.emptyCanPin)).toBeTruthy());
    expect(picker()).toBeTruthy();
  });

  it("says so when nothing else is shared with the firm", async () => {
    m.load.mockResolvedValue(listOf([entry(1)], true, []));
    render(dialog(true));
    await waitFor(() => expect(screen.getByText(READING_LIST_COPY.nothingToAdd)).toBeTruthy());
  });

  it("says the list could not be loaded, and offers no controls", async () => {
    m.load.mockRejectedValue(new Error("network"));
    render(dialog(true));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe(READING_LIST_COPY.loadFailed));
    expect(screen.queryByLabelText(READING_LIST_COPY.addLabel)).toBeNull();
    expect(screen.queryByText("network")).toBeNull();
  });

  it("takes the picker away when three are pinned, and keeps Remove", async () => {
    m.load.mockResolvedValue(listOf([entry(1), entry(2), entry(3)], true));
    render(dialog(true));
    await waitFor(() => expect(screen.getByText(READING_LIST_COPY.full)).toBeTruthy());
    expect(screen.queryByLabelText(READING_LIST_COPY.addLabel)).toBeNull();
    expect(screen.getAllByRole("button", { name: /^Remove Thread/ })).toHaveLength(3);
  });

  it("adds the chosen engagement and shows the list the server sent back", async () => {
    m.load.mockResolvedValue(listOf([entry(1)], true));
    m.pin.mockResolvedValue({ ok: true, list: listOf([entry(1), entry(2, { threadId: "t9", title: "Thread nine" })], true, []) });
    render(dialog(true));
    await waitFor(() => expect(picker()).toBeTruthy());
    expect(addButton().disabled).toBe(true);
    fireEvent.change(picker(), { target: { value: "t9" } });
    fireEvent.click(addButton());
    await waitFor(() => expect(pins()).toEqual(["Thread 1", "Thread nine"]));
    expect(m.pin).toHaveBeenCalledWith({ data: { board_id: "board-1", thread_id: "t9", profile_id: "p1" } });
  });

  it("removes a pin", async () => {
    m.load.mockResolvedValue(listOf([entry(1), entry(2)], true));
    m.unpin.mockResolvedValue({ ok: true, list: listOf([entry(2)], true) });
    render(dialog(true));
    await waitFor(() => expect(pins()).toHaveLength(2));
    fireEvent.click(screen.getByRole("button", { name: "Remove Thread 1 from the reading list" }));
    await waitFor(() => expect(pins()).toEqual(["Thread 2"]));
    expect(m.unpin).toHaveBeenCalledWith({ data: { board_id: "board-1", thread_id: "t1", profile_id: "p1" } });
  });

  it("keeps the dialog open with the server's plain line when a write is refused", async () => {
    const onClose = vi.fn();
    m.load.mockResolvedValue(listOf([entry(1)], true));
    m.pin.mockResolvedValue({ ok: false, refusal: READING_LIST_COPY.refusedNotShared });
    render(dialog(true, onClose));
    await waitFor(() => expect(picker()).toBeTruthy());
    fireEvent.change(picker(), { target: { value: "t9" } });
    fireEvent.click(addButton());
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe(READING_LIST_COPY.refusedNotShared));
    expect(pins()).toEqual(["Thread 1"]);
    expect(onClose).not.toHaveBeenCalled();
    // The choice is kept so the person can see what was refused, and the button works again.
    expect(picker().value).toBe("t9");
    expect(addButton().disabled).toBe(false);
  });

  it("says it did not save when the request itself fails, without the error's own words", async () => {
    m.load.mockResolvedValue(listOf([entry(1)], true));
    m.unpin.mockRejectedValue(new Error("ECONNRESET at 10.0.0.4"));
    render(dialog(true));
    await waitFor(() => expect(pins()).toHaveLength(1));
    fireEvent.click(screen.getByRole("button", { name: /^Remove Thread 1/ }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe(READING_LIST_COPY.failed));
    expect(document.body.textContent).not.toContain("ECONNRESET");
    expect(pins()).toEqual(["Thread 1"]);
  });

  it("sends one request for a double click", async () => {
    const pending = deferred<{ ok: true; list: ReadingList }>();
    m.load.mockResolvedValue(listOf([entry(1)], true));
    m.pin.mockReturnValue(pending.promise);
    render(dialog(true));
    await waitFor(() => expect(picker()).toBeTruthy());
    fireEvent.change(picker(), { target: { value: "t9" } });
    const form = picker().closest("form")!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    fireEvent.click(screen.getByRole("button", { name: /^Remove Thread 1/ }));
    expect(m.pin).toHaveBeenCalledTimes(1);
    expect(m.unpin).not.toHaveBeenCalled();
    pending.resolve({ ok: true, list: listOf([entry(1), entry(2)], true) });
    await waitFor(() => expect(pins()).toHaveLength(2));
  });

  it("drops a load that returns after the dialog was closed, and loads fresh when reopened", async () => {
    const stale = deferred<ReadingList>();
    m.load.mockReturnValueOnce(stale.promise);
    const view = render(dialog(true));
    view.rerender(dialog(false));
    stale.resolve(listOf([entry(1, { title: "Stale thread" })], true));
    await Promise.resolve();
    expect(screen.queryByTestId("reading-list")).toBeNull();

    const fresh = deferred<ReadingList>();
    m.load.mockReturnValueOnce(fresh.promise);
    view.rerender(dialog(true));
    expect(screen.getByRole("status").textContent).toBe(READING_LIST_COPY.loading);
    expect(screen.queryByText("Stale thread")).toBeNull();
    fresh.resolve(listOf([entry(2)], true));
    await waitFor(() => expect(pins()).toEqual(["Thread 2"]));
  });

  it("drops a write that returns after the dialog was closed, and is ready to write again when reopened", async () => {
    const slow = deferred<{ ok: false; refusal: string }>();
    m.load.mockResolvedValue(listOf([entry(1)], true));
    m.pin.mockReturnValueOnce(slow.promise);
    const view = render(dialog(true));
    await waitFor(() => expect(picker()).toBeTruthy());
    fireEvent.change(picker(), { target: { value: "t9" } });
    fireEvent.click(addButton());
    view.rerender(dialog(false));
    view.rerender(dialog(true));
    await waitFor(() => expect(picker()).toBeTruthy());
    slow.resolve({ ok: false, refusal: "A late refusal" });
    await Promise.resolve();
    await Promise.resolve();
    expect(screen.queryByText("A late refusal")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    // Not stuck busy from the abandoned request.
    m.pin.mockResolvedValueOnce({ ok: true, list: listOf([entry(1), entry(2)], true) });
    fireEvent.change(picker(), { target: { value: "t9" } });
    fireEvent.click(addButton());
    await waitFor(() => expect(pins()).toHaveLength(2));
  });

  it("never shows who pinned: there is nowhere for a name to come from", async () => {
    m.load.mockResolvedValue(listOf([entry(1)], true));
    render(dialog(true));
    await waitFor(() => expect(pins()).toHaveLength(1));
    expect(document.body.textContent).not.toMatch(/pinned by|added by|Hollis|Quinn/i);
    const source = readFileSync("src/components/canvas-lab/ReadingListDialog.tsx", "utf8");
    expect(source).not.toMatch(/pinned_by|pinnedBy|display_name|supabase/);
  });
});

describe("where the reading list and the exemplar mark may appear", () => {
  const users = (name: string) =>
    execSync(`grep -rl --include=*.ts --include=*.tsx ${JSON.stringify(name)} src || true`, { encoding: "utf8" })
      .split("\n")
      .filter((file) => file && !file.includes("__tests__"))
      .sort();

  it("only the signed-in board renders the reading list", () => {
    expect(users("ReadingListDialog")).toEqual(["src/components/canvas-lab/ReadingListDialog.tsx", "src/pages/CanvasLabPage.tsx"]);
    const page = readFileSync("src/pages/CanvasLabPage.tsx", "utf8");
    expect(page).toContain("{readingListAllowed ? <DropdownMenuItem onSelect={() => setReadingListOpen(true)}>{READING_LIST_COPY.menu}</DropdownMenuItem> : null}");
    expect(page).toContain('const readingListAllowed = canAskTheFirm(profile) && profile?.is_guest !== true;');
    // The entry sits in the measured toolbar's overflow menu, beside Start a proposal and How it ended.
    const toolbar = page.slice(page.indexOf("<BoardToolbarSurface items={boardToolbarItems}"));
    expect(toolbar.slice(0, toolbar.indexOf("/>"))).toContain("READING_LIST_COPY.menu");
  });

  it("only the signed-in board passes the exemplar mark to a card", () => {
    expect(users("useExemplars")).toEqual(["src/hooks/use-exemplars.ts", "src/pages/CanvasLabPage.tsx"]);
    expect(users("onToggleExemplar")).toEqual(["src/components/canvas-lab/LabCard.tsx", "src/pages/CanvasLabPage.tsx"]);
    expect(users("ExemplarBadge")).toEqual([
      "src/components/canvas-lab/LabCard.tsx",
      "src/components/firm-brain/ExemplarBadge.tsx",
      "src/components/firm-brain/FirmSourceCard.tsx",
      "src/components/firm-brain/FirmSourcePreview.tsx",
      "src/components/firm-brain/ProposalStartPanel.tsx",
    ]);
    for (const surface of ["src/components/canvas-lab/SharedBoardView.tsx", "src/components/firm/FirmLiveBoards.tsx"]) {
      expect(readFileSync(surface, "utf8")).not.toMatch(/exemplar|ReadingList/i);
    }
    // A read-only card (shared, demo, tour) shows no badge and no entry even if a mark were passed.
    const card = readFileSync("src/components/canvas-lab/LabCard.tsx", "utf8");
    expect(card).toContain("{exemplar && !readOnly ? ");
    expect(card).toContain("onExemplar={readOnly ? undefined : onToggleExemplar}");
  });
});
