// @vitest-environment jsdom
// 18 Nov: Firm Brain Build Spec, step 7. "Cite this": the button under a quote, the dialog that picks one of the
// person's own items, and the cited lines under an item in the reader. The happy path, every refusal, a failed load,
// a double press, a dialog closed before the reply, and a source that stops being shared.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CITE_COPY, type CitedLine } from "@/lib/firm-cite-shared";
import type { FirmAskResult } from "@/lib/firm-ask-shared";
import type { FirmWalkthroughResult } from "@/lib/firm-walkthrough-shared";

const m = vi.hoisted(() => ({
  flag: true,
  cite: vi.fn(),
  citations: vi.fn(),
  remove: vi.fn(),
  preview: vi.fn(),
  walk: vi.fn(),
  work: { data: { items: [] as unknown[] }, isLoading: false, isError: false } as {
    data: { items: unknown[] } | undefined;
    isLoading: boolean;
    isError: boolean;
  },
  workCalls: 0,
}));

vi.mock("@/hooks/use-feature-flag", () => ({ useFeatureFlag: () => m.flag }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/firm-cite.functions", () => ({
  citeFirmLine: (...a: unknown[]) => m.cite(...a),
  getFirmCitations: (...a: unknown[]) => m.citations(...a),
  removeFirmCitation: (...a: unknown[]) => m.remove(...a),
}));
vi.mock("@/lib/firm-ask.functions", () => ({
  askTheFirm: vi.fn(),
  previewFirmSource: (...a: unknown[]) => m.preview(...a),
  keepOutOfFirmAnswers: vi.fn(),
}));
vi.mock("@/lib/firm-walkthrough.functions", () => ({
  getFirmWalkthrough: (...a: unknown[]) => m.walk(...a),
}));
vi.mock("@/hooks/use-work-items", () => ({
  useWorkItems: () => {
    m.workCalls += 1;
    return m.work;
  },
}));

import { CiteThis } from "@/components/firm-brain/CiteThis";
import { CiteThisDialog } from "@/components/firm-brain/CiteThisDialog";
import { FirmAnswer } from "@/components/firm-brain/FirmAnswer";
import { FirmWalkthrough } from "@/components/firm-brain/FirmWalkthrough";
import { ItemCitations } from "@/components/firm-brain/ItemCitations";

const ME = "p-yilmaz";
const analyst = { id: ME, role: "em", has_firm_view: true, org_type: "company" };
const QUOTE = "Where does obesity care break down today?";
const SOURCE = "22222222-2222-4222-8222-222222222222";
const MINE = "11111111-1111-4111-8111-111111111111";

const ITEMS = [
  { id: MINE, owner_id: ME, title: "raw-title.md", display_title: "My interview prep", type: "document" },
  { id: "33333333-3333-4333-8333-333333333333", owner_id: ME, title: "Second note", type: "document" },
  { id: "44444444-4444-4444-8444-444444444444", owner_id: "p-quinn", title: "Harper's deck", type: "deck" },
  { id: "55555555-5555-4555-8555-555555555555", owner_id: null, title: "No owner", type: "document" },
];
const TARGETS = [
  { id: MINE, title: "My interview prep" },
  { id: "33333333-3333-4333-8333-333333333333", title: "Second note" },
];

function wrap(node: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return { client, ...render(<QueryClientProvider client={client}>{node}</QueryClientProvider>) };
}

const pickTarget = (id: string) =>
  fireEvent.change(screen.getByTestId("cite-this-target"), { target: { value: id } });
const add = () => fireEvent.click(screen.getByTestId("cite-this-submit"));
const alertText = () => screen.getByRole("alert").textContent;

beforeEach(() => {
  m.flag = true;
  for (const fn of [m.cite, m.citations, m.remove, m.preview, m.walk]) fn.mockReset();
  m.work = { data: { items: ITEMS }, isLoading: false, isError: false };
  m.workCalls = 0;
});
afterEach(cleanup);

describe("the Cite this button", () => {
  it("loads nothing until it is pressed, then lists only the person's own items by the name they chose", async () => {
    wrap(<CiteThis quote={QUOTE} sourceItemId={SOURCE} profileId={ME} />);
    expect(m.workCalls).toBe(0);
    fireEvent.click(screen.getByRole("button", { name: CITE_COPY.action }));
    await screen.findByTestId("cite-this-target");
    expect(m.workCalls).toBeGreaterThan(0);
    const options = [...screen.getByTestId("cite-this-target").querySelectorAll("option")];
    expect(options.map((option) => option.value)).toEqual(["", MINE, "33333333-3333-4333-8333-333333333333"]);
    expect(options[1]!.textContent).toBe("My interview prep");
    expect(screen.getByTestId("cite-this-dialog").textContent).toContain(QUOTE);
    expect(screen.getByTestId("cite-this-dialog").textContent).not.toContain("Harper's deck");
  });

  it("renders nothing without a profile", () => {
    wrap(<CiteThis quote={QUOTE} sourceItemId={SOURCE} profileId={null} />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("sits under a walk-through quote and cites that quote from that source", async () => {
    const walk: FirmWalkthroughResult = {
      status: "habits",
      kind: "method",
      tag: "workshop",
      label: "Co-design workshop",
      engagements: 4,
      habits: [{ text: "Send the pre-read two days ahead.", quotes: [{ itemId: SOURCE, boardId: "b3", quote: "The pre-read went out two days before the session", grade: "quoted" }] }],
      examples: [],
      sources: { [SOURCE]: { title: "Workshop notes", type: "document", date: "2025-04-02", boardId: "b3", boardTitle: "Advising redesign", shownOn: null } },
      coverage: "Read 26 engagements shared with the firm. Some engagements are not shared.",
    };
    m.walk.mockResolvedValue(walk);
    m.cite.mockResolvedValue({ id: "c1", added: true });
    wrap(<FirmWalkthrough tag={{ kind: "method", tag: "workshop" }} profileId={ME} autoOpen />);
    await waitFor(() => expect(document.querySelector("[data-cite-this]")).toBeTruthy());
    fireEvent.click(document.querySelector("[data-cite-this]")!);
    await screen.findByTestId("cite-this-target");
    pickTarget(MINE);
    add();
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe(CITE_COPY.done));
    expect(m.cite).toHaveBeenCalledWith({
      data: { target_item_id: MINE, source_item_id: SOURCE, quote: "The pre-read went out two days before the session", profile_id: ME },
    });
  });

  it("sits under an Ask the firm citation of an item, and never under a close-out lesson", () => {
    const result: FirmAskResult = {
      status: "answered",
      summary: null,
      claims: [
        { text: "Surgery got a vote early.", itemId: SOURCE, boardId: "b5", quote: "Getting surgery a vote in governance early unlocked the design", grade: "quoted" },
        { text: "The lesson was to start sooner.", itemId: "outcome-b5", boardId: "b5", quote: "Start the governance conversation sooner", grade: "from_summary" },
      ],
      facts: [],
      nearest: null,
      read: { full: [], summary: [] },
      sources: {
        [SOURCE]: { title: "Final readout", type: "deck", date: "2025-06-20", boardId: "b5", boardTitle: "Weight management", shownOn: null },
        "outcome-b5": { title: "Close-out lesson", type: "outcome", date: null, boardId: "b5", boardTitle: "Weight management", shownOn: null },
      },
      coverage: "Read 26 engagements shared with the firm. Some engagements are not shared.",
      oneSource: false,
    };
    wrap(<FirmAnswer result={result} onOpenSource={() => {}} profileId={ME} />);
    const claims = document.querySelectorAll("[data-firm-claim]");
    expect(claims[0]!.querySelector("[data-cite-this]")).toBeTruthy();
    expect(claims[1]!.querySelector("[data-cite-this]")).toBeNull();
    cleanup();
    // Without a profile (as older callers render it) there is no button at all.
    wrap(<FirmAnswer result={result} onOpenSource={() => {}} />);
    expect(document.querySelector("[data-cite-this]")).toBeNull();
  });
});

describe("the Cite this dialog", () => {
  const view = (props: Partial<Parameters<typeof CiteThisDialog>[0]> = {}) => {
    const onOpenChange = vi.fn();
    const utils = wrap(
      <CiteThisDialog
        open
        onOpenChange={onOpenChange}
        quote={QUOTE}
        sourceItemId={SOURCE}
        profileId={ME}
        targets={TARGETS}
        targetsLoading={false}
        targetsFailed={false}
        {...props}
      />,
    );
    return { onOpenChange, ...utils };
  };

  it("adds the line to the picked item and says so, sending ids and the line and nothing else", async () => {
    m.cite.mockResolvedValue({ id: "c1", added: true });
    const { client } = view();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    pickTarget(MINE);
    add();
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe(CITE_COPY.done));
    expect(m.cite).toHaveBeenCalledTimes(1);
    expect(m.cite).toHaveBeenCalledWith({
      data: { target_item_id: MINE, source_item_id: SOURCE, quote: QUOTE, profile_id: ME },
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["firm-citations", MINE] });
    expect(screen.queryByTestId("cite-this-submit")).toBeNull();
    expect(screen.getByRole("button", { name: CITE_COPY.close })).toBeTruthy();
  });

  it("cannot be sent without an item picked", () => {
    view();
    expect((screen.getByTestId("cite-this-submit") as HTMLButtonElement).disabled).toBe(true);
    add();
    expect(m.cite).not.toHaveBeenCalled();
  });

  it.each([
    [403, CITE_COPY.refused],
    [404, CITE_COPY.gone],
    [422, CITE_COPY.notFound],
    [409, CITE_COPY.full],
  ])("stays open with a plain line when the server answers %i", async (status, line) => {
    m.cite.mockRejectedValue(new Response("no", { status }));
    const { onOpenChange } = view();
    pickTarget(MINE);
    add();
    await waitFor(() => expect(alertText()).toBe(line));
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByTestId("cite-this-dialog")).toBeTruthy();
  });

  it("stays open with a plain line on a network error, and works on the next try", async () => {
    m.cite.mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce({ id: "c1", added: true });
    view();
    pickTarget(MINE);
    add();
    await waitFor(() => expect(alertText()).toBe(CITE_COPY.error));
    add();
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe(CITE_COPY.done));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("adds once when Add is pressed twice", async () => {
    let finish: (value: unknown) => void = () => {};
    m.cite.mockImplementation(() => new Promise((resolve) => (finish = resolve)));
    view();
    pickTarget(MINE);
    add();
    add();
    expect(m.cite).toHaveBeenCalledTimes(1);
    expect((screen.getByTestId("cite-this-target") as HTMLSelectElement).disabled).toBe(true);
    await act(async () => finish({ id: "c1", added: true }));
    expect(screen.getByRole("status").textContent).toBe(CITE_COPY.done);
  });

  it("shows nothing from a reply that arrives after the dialog was closed", async () => {
    let fail: (reason: unknown) => void = () => {};
    m.cite.mockImplementation(() => new Promise((_resolve, reject) => (fail = reject)));
    const { onOpenChange } = view();
    pickTarget(MINE);
    add();
    fireEvent.click(screen.getByRole("button", { name: CITE_COPY.cancel }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    await act(async () => fail(new Response("no", { status: 403 })));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("does nothing with a reply that arrives after the whole thing has gone", async () => {
    let finish: (value: unknown) => void = () => {};
    m.cite.mockImplementation(() => new Promise((resolve) => (finish = resolve)));
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const { unmount } = view();
    pickTarget(MINE);
    add();
    unmount();
    await act(async () => finish({ id: "c1", added: true }));
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });

  it("keeps the choice locked until the person's items have arrived", () => {
    view({ targets: [], targetsLoading: true });
    expect((screen.getByTestId("cite-this-target") as HTMLSelectElement).disabled).toBe(true);
    expect((screen.getByTestId("cite-this-submit") as HTMLButtonElement).disabled).toBe(true);
  });

  it("says so when the person's items could not be loaded, or when they have none", () => {
    view({ targets: [], targetsFailed: true });
    expect(alertText()).toBe(CITE_COPY.targetsError);
    expect(screen.queryByTestId("cite-this-target")).toBeNull();
    cleanup();
    view({ targets: [] });
    expect(screen.getByText(CITE_COPY.noTargets)).toBeTruthy();
    expect((screen.getByTestId("cite-this-submit") as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows a hostile item title and a hostile quote as text", () => {
    view({ quote: "<img src=x onerror=alert(1)> twelve chars", targets: [{ id: MINE, title: "<script>alert(1)</script>" }] });
    const dialog = screen.getByTestId("cite-this-dialog");
    expect(dialog.querySelector("img")).toBeNull();
    expect(dialog.querySelector("script")).toBeNull();
    expect(dialog.textContent).toContain("<script>alert(1)</script>");
  });
});

describe("cited lines under an item", () => {
  const stored = (count = 1) => ({
    citations: Array.from({ length: count }, (_, i) => ({ id: `c${i + 1}`, quote: `STORED WORDS ${i + 1} that must not be shown from here`, source_item_id: SOURCE, source_board_id: "b5", cited_at: "t" })),
  });
  const live: CitedLine = { id: "c1", state: "live", quote: QUOTE, sourceItemId: SOURCE, engagement: "St. Brigid Health", date: "2025-03-18", type: "call" };
  const gone: CitedLine = { id: "c2", state: "gone" };
  const item = (meta: unknown = stored(), owner: string | null = ME) => ({ id: MINE, owner_id: owner, meta });

  it("shows a live line with its words, its engagement and date, and a link that opens the source preview", async () => {
    m.citations.mockResolvedValue([live]);
    m.preview.mockResolvedValue({ itemId: SOURCE, title: "Interview", boardTitle: "Weight management", type: "call", date: "2025-03-18", grade: "full", text: QUOTE, shownOn: null, canKeepOut: false });
    wrap(<ItemCitations item={item()} profile={analyst} />);
    await waitFor(() => expect(document.querySelector("[data-cited-line='live']")).toBeTruthy());
    expect(m.citations).toHaveBeenCalledWith({ data: { item_id: MINE, profile_id: ME } });
    const line = document.querySelector<HTMLElement>("[data-cited-line='live']")!;
    expect(line.querySelector("blockquote")!.textContent).toBe(QUOTE);
    expect(line.textContent).toContain("St. Brigid Health · Call notes · 18 Mar 2025");
    expect(screen.getByText(CITE_COPY.ownerOnly)).toBeTruthy();
    // The link is resolved when it is pressed, by the same preview as an Ask the firm citation.
    expect(m.preview).not.toHaveBeenCalled();
    fireEvent.click(line.querySelector("[data-cited-open]")!);
    await waitFor(() => expect(document.querySelector("[data-firm-preview-text]")).toBeTruthy());
    expect(m.preview).toHaveBeenCalledWith({ data: { item_id: SOURCE, profile_id: ME } });
  });

  it("shows only that the source is no longer shared when it is gone: no words, no link", async () => {
    m.citations.mockResolvedValue([gone]);
    wrap(<ItemCitations item={item(stored(2))} profile={analyst} />);
    await waitFor(() => expect(document.querySelector("[data-cited-line='gone']")).toBeTruthy());
    const section = screen.getByTestId("item-citations");
    expect(section.textContent).toContain(CITE_COPY.unshared);
    expect(section.querySelector("blockquote")).toBeNull();
    expect(section.querySelector("[data-cited-open]")).toBeNull();
    // The words held in the item's own meta are never rendered from there.
    expect(section.textContent).not.toContain("STORED WORDS");
    expect(section.querySelector("[data-cited-remove='c2']")).toBeTruthy();
  });

  it("never renders the stored words while the check is loading or after it failed", async () => {
    let fail: (reason: unknown) => void = () => {};
    m.citations.mockImplementation(() => new Promise((_resolve, reject) => (fail = reject)));
    wrap(<ItemCitations item={item()} profile={analyst} />);
    expect(document.body.textContent).not.toContain("STORED WORDS");
    await act(async () => fail(new Error("network")));
    await waitFor(() => expect(alertText()).toBe(CITE_COPY.loadError));
    expect(document.body.textContent).not.toContain("STORED WORDS");
  });

  it("asks for nothing and shows nothing on an item with no cited lines", () => {
    wrap(<ItemCitations item={item({})} profile={analyst} />);
    wrap(<ItemCitations item={item(null)} profile={analyst} />);
    wrap(<ItemCitations item={item({ citations: ["junk"] })} profile={analyst} />);
    expect(m.citations).not.toHaveBeenCalled();
    expect(screen.queryByTestId("item-citations")).toBeNull();
  });

  it.each([
    ["a colleague reading the item", { ...analyst, id: "p-quinn" }, ME],
    ["a coach", { ...analyst, role: "coach" }, ME],
    ["someone in a personal workspace", { ...analyst, has_firm_view: false, org_type: "solo" }, ME],
    ["no profile", null, ME],
    ["an item with no owner", analyst, null],
  ])("asks for nothing and shows nothing to %s", (_name, profile, owner) => {
    wrap(<ItemCitations item={item(stored(), owner)} profile={profile} />);
    expect(m.citations).not.toHaveBeenCalled();
    expect(screen.queryByTestId("item-citations")).toBeNull();
    expect(document.body.textContent).not.toContain("STORED WORDS");
  });

  it("asks for nothing and shows nothing with the flag off", () => {
    m.flag = false;
    wrap(<ItemCitations item={item()} profile={analyst} />);
    expect(m.citations).not.toHaveBeenCalled();
    expect(screen.queryByTestId("item-citations")).toBeNull();
  });

  it("goes away when the server refuses or returns no lines", async () => {
    m.citations.mockRejectedValueOnce(new Response("Forbidden", { status: 403 }));
    wrap(<ItemCitations item={item()} profile={analyst} />);
    await waitFor(() => expect(screen.queryByTestId("item-citations")).toBeNull());
    cleanup();
    m.citations.mockResolvedValueOnce([]);
    wrap(<ItemCitations item={item()} profile={analyst} />);
    await waitFor(() => expect(m.citations).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByTestId("item-citations")).toBeNull());
  });

  it("removes a line, once, and reads the list again", async () => {
    m.citations.mockResolvedValueOnce([live, gone]).mockResolvedValueOnce([gone]);
    let finish: (value: unknown) => void = () => {};
    m.remove.mockImplementation(() => new Promise((resolve) => (finish = resolve)));
    wrap(<ItemCitations item={item(stored(2))} profile={analyst} />);
    await waitFor(() => expect(document.querySelectorAll("[data-cited-line]")).toHaveLength(2));
    const button = document.querySelector<HTMLElement>("[data-cited-remove='c1']")!;
    fireEvent.click(button);
    fireEvent.click(button);
    expect(m.remove).toHaveBeenCalledTimes(1);
    expect(m.remove).toHaveBeenCalledWith({ data: { item_id: MINE, citation_id: "c1", profile_id: ME } });
    await act(async () => finish({ removed: true }));
    await waitFor(() => expect(document.querySelectorAll("[data-cited-line]")).toHaveLength(1));
    expect(document.querySelector("[data-cited-line='live']")).toBeNull();
  });

  it("says so plainly when a line could not be removed, and keeps it", async () => {
    m.citations.mockResolvedValue([live]);
    m.remove.mockRejectedValue(new Response("Forbidden", { status: 403 }));
    wrap(<ItemCitations item={item()} profile={analyst} />);
    await waitFor(() => expect(document.querySelector("[data-cited-remove='c1']")).toBeTruthy());
    fireEvent.click(document.querySelector("[data-cited-remove='c1']")!);
    await waitFor(() => expect(alertText()).toBe(CITE_COPY.removeError));
    expect(document.querySelector("[data-cited-line='live']")).toBeTruthy();
  });

  it("checks sharing again every time the reader opens: nothing is kept between openings", async () => {
    m.citations.mockResolvedValueOnce([live]).mockResolvedValueOnce([{ id: "c1", state: "gone" }]);
    const first = wrap(<ItemCitations item={item()} profile={analyst} />);
    await waitFor(() => expect(document.querySelector("[data-cited-line='live']")).toBeTruthy());
    first.unmount();
    // Same query client would be the worst case; a fresh mount must still ask again.
    render(
      <QueryClientProvider client={first.client}>
        <ItemCitations item={item()} profile={analyst} />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(document.querySelector("[data-cited-line='gone']")).toBeTruthy());
    expect(m.citations).toHaveBeenCalledTimes(2);
    expect(document.body.textContent).not.toContain(QUOTE);
  });
});
