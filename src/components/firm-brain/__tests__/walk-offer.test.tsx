// @vitest-environment jsdom
// 18 Nov: Firm Brain Build Spec, step 7. The once-only offer in the signed-in item reader: a call the person owns,
// titled like an interview, offers the firm's matching walk-through once. Who sees it, opening it, dismissing it for
// good, a refused save, a double press, and the surfaces it must never appear on.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { JuniorTags } from "@/lib/firm-junior-shared";
import type { FirmWalkthroughResult } from "@/lib/firm-walkthrough-shared";
import { WALK_OFFER_COPY } from "@/lib/walk-offer-shared";

const m = vi.hoisted(() => ({
  tags: vi.fn(),
  save: vi.fn(),
  walk: vi.fn(),
}));

vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/firm-junior.functions", () => ({
  getFirmJuniorTags: (...a: unknown[]) => m.tags(...a),
  getFirmPrepare: vi.fn(),
}));
vi.mock("@/lib/firm-cite.functions", () => ({
  setWalkOffer: (...a: unknown[]) => m.save(...a),
  citeFirmLine: vi.fn(),
  getFirmCitations: vi.fn(),
  removeFirmCitation: vi.fn(),
}));
vi.mock("@/lib/firm-walkthrough.functions", () => ({
  getFirmWalkthrough: (...a: unknown[]) => m.walk(...a),
}));
vi.mock("@/lib/firm-ask.functions", () => ({
  askTheFirm: vi.fn(),
  previewFirmSource: vi.fn(),
  keepOutOfFirmAnswers: vi.fn(),
}));

import { WalkOffer } from "@/components/firm-brain/WalkOffer";

const ME = "p-yilmaz";
const ITEM = "11111111-1111-4111-8111-111111111111";
const analyst = { id: ME, role: "em", has_firm_view: true, org_type: "company" };
const call = (change: Record<string, unknown> = {}) => ({
  id: ITEM,
  type: "call",
  title: "Interview: Chief Medical Officer",
  owner_id: ME,
  meta: {},
  ...change,
});

const TAGS: JuniorTags = {
  situations: [],
  methods: [
    { tag: "stakeholder_interviews", engagements: 21 },
    { tag: "customer_research", engagements: 14 },
  ],
  roles: [],
};
const walk: FirmWalkthroughResult = {
  status: "thin",
  kind: "method",
  tag: "stakeholder_interviews",
  label: "Stakeholder interviews",
  engagements: 2,
  habits: [],
  examples: [],
  sources: {},
  coverage: "Read 26 engagements shared with the firm. Some engagements are not shared.",
};

function wrap(node: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const utils = render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
  return {
    client,
    ...utils,
    again: (next: ReactNode) => utils.rerender(<QueryClientProvider client={client}>{next}</QueryClientProvider>),
  };
}

const offer = () => screen.queryByTestId("walk-offer");
const shown = () => waitFor(() => expect(offer()).toBeTruthy());

beforeEach(() => {
  for (const fn of [m.tags, m.save, m.walk]) fn.mockReset();
  m.tags.mockResolvedValue(TAGS);
  m.save.mockResolvedValue({ ok: true });
  m.walk.mockResolvedValue(walk);
});
afterEach(cleanup);

describe("when the offer appears", () => {
  it("offers the firm's walk-through on a call the person owns that is titled like an interview", async () => {
    wrap(<WalkOffer item={call()} profile={analyst} />);
    await shown();
    expect(offer()!.textContent).toContain("The firm has a walk-through for this. Read it?");
    expect(m.tags).toHaveBeenCalledWith({ data: { profile_id: ME } });
    // Nothing is saved, and no walk-through is written, just by showing the offer.
    expect(m.save).not.toHaveBeenCalled();
    expect(m.walk).not.toHaveBeenCalled();
  });

  it("does not appear when the firm has no shared work on that method, so the line is never untrue", async () => {
    wrap(<WalkOffer item={call({ title: "Expert call: former payer executive" })} profile={analyst} />);
    await waitFor(() => expect(m.tags).toHaveBeenCalled());
    await act(async () => {});
    expect(offer()).toBeNull();
  });

  it.each([
    ["a title that is not an interview", call({ title: "Weekly standup" }), analyst],
    ["a review", call({ title: "Interview guide review" }), analyst],
    ["a document", call({ type: "document" }), analyst],
    ["a call already dismissed", call({ meta: { walk_offer: "dismissed" } }), analyst],
    ["a call already opened", call({ meta: { walk_offer: "opened" } }), analyst],
    ["a colleague's call", call({ owner_id: "p-quinn" }), analyst],
    ["a call with no owner", call({ owner_id: null }), analyst],
    ["a coach", call(), { ...analyst, role: "coach" }],
    ["someone in a personal workspace", call(), { ...analyst, has_firm_view: false, org_type: "solo" }],
    ["no profile", call(), null],
  ])("never appears, and asks the server nothing, for %s", async (_name, item, profile) => {
    wrap(<WalkOffer item={item} profile={profile} />);
    await act(async () => {});
    expect(offer()).toBeNull();
    expect(m.tags).not.toHaveBeenCalled();
  });

  it("never appears when the server refuses or the list fails to load", async () => {
    m.tags.mockRejectedValueOnce(new Response("Forbidden", { status: 403 }));
    wrap(<WalkOffer item={call()} profile={analyst} />);
    await waitFor(() => expect(m.tags).toHaveBeenCalled());
    await act(async () => {});
    expect(offer()).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows a hostile title nowhere: the title only picks a method from the fixed list", async () => {
    wrap(<WalkOffer item={call({ title: "<img src=x onerror=alert(1)> interview $380k Maren Hollis" })} profile={analyst} />);
    await shown();
    expect(document.querySelector("img")).toBeNull();
    expect(document.body.textContent).not.toMatch(/380k|Hollis|onerror/);
    expect(JSON.stringify(m.tags.mock.calls)).not.toMatch(/interview|Hollis/i);
  });
});

describe("dismissing it for good", () => {
  it("saves the dismissal on the person's own item and goes away at once", async () => {
    wrap(<WalkOffer item={call()} profile={analyst} />);
    await shown();
    fireEvent.click(screen.getByRole("button", { name: WALK_OFFER_COPY.dismissLabel }));
    await waitFor(() => expect(offer()).toBeNull());
    expect(m.save).toHaveBeenCalledTimes(1);
    expect(m.save).toHaveBeenCalledWith({ data: { item_id: ITEM, state: "dismissed", profile_id: ME } });
    expect(m.walk).not.toHaveBeenCalled();
  });

  it("never returns: the saved item no longer offers it, on this device or another", async () => {
    const view = wrap(<WalkOffer item={call()} profile={analyst} />);
    await shown();
    fireEvent.click(screen.getByRole("button", { name: WALK_OFFER_COPY.dismissLabel }));
    await waitFor(() => expect(offer()).toBeNull());
    // The same reader after the item was read again, then a fresh reader as another device would open it.
    view.again(<WalkOffer item={call({ meta: { walk_offer: "dismissed" } })} profile={analyst} />);
    expect(offer()).toBeNull();
    cleanup();
    m.tags.mockClear();
    wrap(<WalkOffer item={call({ meta: { walk_offer: "dismissed" } })} profile={analyst} />);
    await act(async () => {});
    expect(offer()).toBeNull();
    expect(m.tags).not.toHaveBeenCalled();
  });

  it("saves once when it is pressed twice", async () => {
    let finish: (value: unknown) => void = () => {};
    m.save.mockImplementation(() => new Promise((resolve) => (finish = resolve)));
    wrap(<WalkOffer item={call()} profile={analyst} />);
    await shown();
    const button = screen.getByRole("button", { name: WALK_OFFER_COPY.dismissLabel });
    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.click(screen.getByRole("button", { name: WALK_OFFER_COPY.read }));
    expect(m.save).toHaveBeenCalledTimes(1);
    await act(async () => finish({ ok: true }));
    expect(offer()).toBeNull();
  });

  it("stays with a plain line when the save is refused, so it is never dismissed only on screen", async () => {
    m.save.mockRejectedValue(new Response("Forbidden", { status: 403 }));
    wrap(<WalkOffer item={call()} profile={analyst} />);
    await shown();
    fireEvent.click(screen.getByRole("button", { name: WALK_OFFER_COPY.dismissLabel }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe(WALK_OFFER_COPY.error));
    expect(offer()).toBeTruthy();
  });

  it("does nothing with a reply that arrives after the reader was closed", async () => {
    let finish: (value: unknown) => void = () => {};
    m.save.mockImplementation(() => new Promise((resolve) => (finish = resolve)));
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const view = wrap(<WalkOffer item={call()} profile={analyst} />);
    await shown();
    fireEvent.click(screen.getByRole("button", { name: WALK_OFFER_COPY.dismissLabel }));
    view.unmount();
    await act(async () => finish({ ok: true }));
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });
});

describe("opening it", () => {
  it("opens the matching method's walk-through and counts as seen", async () => {
    wrap(<WalkOffer item={call()} profile={analyst} />);
    await shown();
    fireEvent.click(screen.getByRole("button", { name: WALK_OFFER_COPY.read }));
    await waitFor(() => expect(screen.getByTestId("firm-walkthrough").getAttribute("data-walk")).toBe("thin"));
    expect(m.save).toHaveBeenCalledWith({ data: { item_id: ITEM, state: "opened", profile_id: ME } });
    expect(m.walk).toHaveBeenCalledTimes(1);
    expect(m.walk).toHaveBeenCalledWith({
      data: { kind: "method", tag: "stakeholder_interviews", profile_id: ME },
    });
    expect(screen.getByText(WALK_OFFER_COPY.dialogTitle("Stakeholder interviews"))).toBeTruthy();
    await waitFor(() => expect(offer()).toBeNull());
  });

  it("opens the walk-through that fits the title", async () => {
    wrap(<WalkOffer item={call({ title: "Discovery call: Northwind" })} profile={analyst} />);
    await shown();
    fireEvent.click(screen.getByRole("button", { name: WALK_OFFER_COPY.read }));
    await waitFor(() =>
      expect(m.walk).toHaveBeenCalledWith({ data: { kind: "method", tag: "customer_research", profile_id: ME } }),
    );
  });

  it("keeps the walk-through open when the saved item comes back marked opened, and does not offer again", async () => {
    const view = wrap(<WalkOffer item={call()} profile={analyst} />);
    await shown();
    fireEvent.click(screen.getByRole("button", { name: WALK_OFFER_COPY.read }));
    await waitFor(() => expect(screen.getByTestId("firm-walkthrough")).toBeTruthy());
    view.again(<WalkOffer item={call({ meta: { walk_offer: "opened" } })} profile={analyst} />);
    expect(screen.getByTestId("firm-walkthrough")).toBeTruthy();
    expect(offer()).toBeNull();
    expect(m.walk).toHaveBeenCalledTimes(1);
  });

  it("still opens the walk-through when the save fails, and says the offer may show again", async () => {
    m.save.mockRejectedValue(new Error("network"));
    wrap(<WalkOffer item={call()} profile={analyst} />);
    await shown();
    fireEvent.click(screen.getByRole("button", { name: WALK_OFFER_COPY.read }));
    await waitFor(() => expect(screen.getByTestId("firm-walkthrough")).toBeTruthy());
    await waitFor(() => expect(screen.getByRole("alert", { hidden: true }).textContent).toBe(WALK_OFFER_COPY.error));
  });
});

describe("where it may appear", () => {
  const read = (file: string) => readFileSync(path.resolve(__dirname, "../../..", file), "utf8");

  it("is opted in from the signed-in All work reader only, and only for the item's owner", () => {
    const reader = read("components/peek/PeekPanel.tsx");
    expect(reader).toMatch(/\{firmTools && owned \? <WalkOffer /);
    expect(reader).toMatch(/\{firmTools && owned \? <ItemCitations /);
    const callers = [
      "pages/WorkPage.tsx",
      "pages/ClientPage.tsx",
      "pages/EngagementPage.tsx",
      "pages/AiRecordPage.tsx",
      "pages/PacketPage.tsx",
      "components/engagements/EngagementBriefSection.tsx",
    ].filter((file) => /\bfirmTools\b/.test(read(file)));
    expect(callers).toEqual(["pages/WorkPage.tsx"]);
  });

  it("is on no shared, demo, tour, firm, rollup or board surface", () => {
    const users = (name: string) =>
      [
        "pages/CanvasLabPage.tsx",
        "components/canvas-lab/SharedBoardView.tsx",
        "components/canvas-lab/FocusOverlay.tsx",
        "components/firm-brain/FirmBrainMap.tsx",
        "pages/HomePage.tsx",
      ].filter((file) => read(file).includes(name));
    expect(users("WalkOffer")).toEqual([]);
    expect(users("ItemCitations")).toEqual([]);
  });
});
