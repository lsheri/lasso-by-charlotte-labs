// @vitest-environment jsdom
// 20 Nov, D-85: the Firm brain canvas. One title and quiet counts; the map for everyone, fees for admins and leads
// only; a question builds its answer on the canvas, each line opening its source; a failure says so and can be tried
// again; answers stay while the tab is open; nothing about the question goes to analytics.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { FIRM_ASK_COPY, FIRM_ASK_STARTER_COPY, type FirmAskResult } from "@/lib/firm-ask-shared";
import { FIRM_BRAIN_LIMIT_COPY } from "@/lib/firm-brain-limit-shared";
import {
  canvasDataFor,
  FIRM_CANVAS_COPY,
  PENDING_STAGES,
  type FirmCanvasData,
} from "@/lib/firm-canvas-shared";
import { FIRM_BRAIN_COPY } from "@/lib/role-screens-shared";
import { corpusOf, demoRows, graphOf, itemId } from "@/lib/__tests__/helpers/demo-firm-rows";

const m = vi.hoisted(() => ({
  reduce: true,
  getMap: vi.fn(),
  ask: vi.fn(),
  opened: [] as (string | null)[],
  capture: vi.fn(),
}));

vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/hooks/use-motion", () => ({ useReducedMotion: () => m.reduce }));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));
vi.mock("@/lib/firm-map.functions", () => ({ getFirmMap: (...a: unknown[]) => m.getMap(...a) }));
vi.mock("@/lib/firm-ask.functions", () => ({
  askTheFirm: (...a: unknown[]) => m.ask(...a),
  previewFirmSource: vi.fn(),
  keepOutOfFirmAnswers: vi.fn(),
}));
vi.mock("@/components/firm-brain/JuniorTools", () => ({
  JuniorTools: () => <div data-testid="junior-tools" />,
}));
vi.mock("@/components/firm-brain/CiteThis", () => ({
  CiteThis: () => <span data-testid="cite-this" />,
}));
vi.mock("@/components/firm-brain/FirmSourcePreview", () => ({
  FirmSourcePreview: ({ itemId: id }: { itemId: string | null }) => {
    m.opened.push(id);
    return id ? <div data-testid="source-preview">{id}</div> : null;
  },
}));
vi.mock("posthog-js", () => ({ default: { capture: m.capture, init: vi.fn() } }));

import {
  FirmBrainCanvas,
  pruneAnswers,
  resetFirmCanvasMemory,
} from "@/components/firm-brain/FirmBrainCanvas";

const corpus = corpusOf(demoRows());
const graph = graphOf(demoRows());
const memberData = (): FirmCanvasData => canvasDataFor(graph, corpus, false);
const adminData = (): FirmCanvasData => canvasDataFor(graph, corpus, true);

const person = (role: string) => ({
  id: `p-${role}`,
  role,
  org_type: "company",
  has_firm_view: true,
  is_guest: false,
});

function answer(boards: string[]): FirmAskResult {
  const claims = boards.map((board, index) => ({
    text: `Line ${index + 1} from ${board}.`,
    itemId: itemId(board, "sow"),
    boardId: board,
    quote: "a quote",
    grade: "from_summary" as const,
  }));
  const sources: FirmAskResult["sources"] = {};
  for (const claim of claims) {
    const board = corpus.boards.find((entry) => entry.id === claim.boardId)!;
    sources[claim.itemId] = {
      title: "SOW",
      type: "document",
      date: null,
      boardId: claim.boardId,
      boardTitle: board.title,
      shownOn: null,
    };
  }
  return {
    status: "answered",
    summary: null,
    claims,
    facts: [],
    nearest: null,
    read: { full: claims.map((c) => c.itemId), summary: [] },
    sources,
    coverage: "Read 3 of 26 engagements.",
    oneSource: false,
  };
}

function mount(node: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <main>{node}</main>
    </QueryClientProvider>,
  );
}

async function ready() {
  await waitFor(() => expect(screen.queryByTestId("firm-canvas-counts")).not.toBeNull());
}

function askFor(text: string) {
  const field = screen.getByLabelText(FIRM_CANVAS_COPY.askLabel);
  fireEvent.change(field, { target: { value: text } });
  fireEvent.keyDown(field, { key: "Enter" });
}

beforeAll(() => {
  // jsdom lays nothing out: give the stage a laptop-sized box so the camera and culling have something to work with.
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get: () => 1440,
  });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", {
    configurable: true,
    get: () => 900,
  });
});

beforeEach(() => {
  m.reduce = true;
  m.getMap.mockReset();
  m.ask.mockReset();
  m.capture.mockReset();
  m.opened = [];
  resetFirmCanvasMemory();
});

afterEach(() => cleanup());

describe("the canvas at rest", () => {
  it("has one title and the counts as quiet numbers, and no card or side panel around the map", async () => {
    m.getMap.mockResolvedValue(memberData());
    mount(<FirmBrainCanvas profile={person("em")} />);
    await ready();
    expect(screen.getAllByRole("heading", { level: 1 }).map((h) => h.textContent)).toEqual([
      FIRM_BRAIN_COPY.title,
    ]);
    const counts = screen.getByTestId("firm-canvas-counts").textContent!;
    expect(counts).toContain(`${graph.threads.length} engagements`);
    expect(counts).toMatch(/situations.*methods.*lessons/);
    expect(screen.queryByText(FIRM_ASK_COPY.title)).toBeNull();
  });

  it("shows a manager or analyst the map with no fee chip and no money anywhere", async () => {
    m.getMap.mockResolvedValue(memberData());
    const { container } = mount(<FirmBrainCanvas profile={person("em")} />);
    await ready();
    expect(container.querySelectorAll("[data-canvas-node]").length).toBeGreaterThan(5);
    expect(screen.queryByTestId("firm-canvas-fees")).toBeNull();
    expect(container.textContent).not.toMatch(/\$\d/);
    // No "What we charged" starter for someone who does not see fees.
    expect(screen.queryByText(FIRM_ASK_STARTER_COPY.charged.label)).toBeNull();
  });

  it("gives an admin the fee chip, and fees appear on the engagements only when it is pressed", async () => {
    m.getMap.mockResolvedValue(adminData());
    const { container } = mount(<FirmBrainCanvas profile={person("admin")} />);
    await ready();
    const chip = screen.getByTestId("firm-canvas-fees");
    expect(chip.getAttribute("aria-pressed")).toBe("false");
    expect(container.querySelector("[data-canvas-node]")!.parentElement!.textContent).not.toMatch(
      /\$\d/,
    );
    fireEvent.click(chip);
    expect(chip.getAttribute("aria-pressed")).toBe("true");
    expect(
      [...container.querySelectorAll("[data-canvas-node]")].some((node) =>
        /\$\d/.test(node.textContent ?? ""),
      ),
    ).toBe(true);
  });

  it("draws a skeleton frame while the map loads, never a spinner", async () => {
    let finish!: (data: FirmCanvasData) => void;
    m.getMap.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    mount(<FirmBrainCanvas profile={person("em")} />);
    expect(screen.getByTestId("firm-canvas-skeleton")).toBeTruthy();
    expect(screen.getByLabelText(FIRM_CANVAS_COPY.askLabel)).toHaveProperty("disabled", true);
    await act(async () => finish(memberData()));
    await ready();
    expect(screen.queryByTestId("firm-canvas-skeleton")).toBeNull();
  });

  it("says plainly when the map could not load, and tries again", async () => {
    // One quiet retry first (a blip should not show an error), then the plain line.
    m.getMap
      .mockRejectedValueOnce(new Error("down"))
      .mockRejectedValueOnce(new Error("down"))
      .mockResolvedValueOnce(memberData());
    mount(<FirmBrainCanvas profile={person("em")} />);
    const alert = await screen.findByRole("alert", undefined, { timeout: 4000 });
    expect(alert.textContent).toContain(FIRM_CANVAS_COPY.mapLoadFailed);
    fireEvent.click(within(alert).getByRole("button", { name: FIRM_CANVAS_COPY.retry }));
    await ready();
  });

  it("says so when nothing is shared with the firm yet", async () => {
    m.getMap.mockResolvedValue({ situations: [], methods: [], threads: [], fees: null });
    mount(<FirmBrainCanvas profile={person("em")} />);
    expect(await screen.findByText(FIRM_CANVAS_COPY.empty)).toBeTruthy();
  });
});

describe("asking on the canvas", () => {
  it("builds the answer beside the map, each line opening the source it came from", async () => {
    m.getMap.mockResolvedValue(memberData());
    let reply!: (result: FirmAskResult) => void;
    m.ask.mockReturnValue(new Promise((resolve) => (reply = resolve)));
    mount(<FirmBrainCanvas profile={person("em")} />);
    await ready();
    askFor("How did we launch other health service lines?");
    expect(m.ask).toHaveBeenCalledWith({
      data: {
        question: "How did we launch other health service lines?",
        starter: null,
        profile_id: "p-em",
      },
    });
    const card = await screen.findByTestId("canvas-answer");
    expect(card.getAttribute("data-answer-status")).toBe("pending");
    expect(within(card).getByTestId("canvas-answer-caption").textContent).toBe(
      FIRM_ASK_COPY.pending,
    );
    await act(async () => reply(answer(["b5", "b6"])));
    await waitFor(() => expect(card.getAttribute("data-answer-status")).toBe("answered"));
    expect(within(card).getByTestId("canvas-answer-caption").textContent).toBe(
      FIRM_CANVAS_COPY.done(2, 2),
    );
    expect(within(card).getByText(FIRM_ASK_COPY.readTitle)).toBeTruthy();
    const brigid = corpus.boards.find((b) => b.id === "b5")!.title;
    fireEvent.click(
      within(card).getByRole("button", { name: `${FIRM_CANVAS_COPY.source}: ${brigid}` }),
    );
    expect(screen.getByTestId("source-preview").textContent).toBe(itemId("b5", "sow"));
    // The engagements it quoted are lit; the rest of the map is dimmed.
    const lit = screen
      .getAllByRole("button")
      .filter((b) => b.getAttribute("data-canvas-node") === "b5")[0]!;
    expect(lit.className).toContain("fc-node-hot");
  });

  it("names each stage of the wait while the firm is read, with a climbing percentage", async () => {
    m.reduce = false;
    m.getMap.mockResolvedValue(memberData());
    m.ask.mockReturnValue(new Promise(() => {}));
    mount(<FirmBrainCanvas profile={person("em")} />);
    await ready();
    askFor("Where has data arrived late before?");
    const card = await screen.findByTestId("canvas-answer");
    expect(within(card).getByTestId("canvas-answer-caption").textContent).toBe(
      PENDING_STAGES[0]!.text,
    );
    expect(card.textContent).toMatch(/\d+%/);
  });

  it("keeps the failed card open with a plain line, and tries the same question again", async () => {
    m.getMap.mockResolvedValue(memberData());
    m.ask.mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce(answer(["b5"]));
    mount(<FirmBrainCanvas profile={person("em")} />);
    await ready();
    askFor("What went wrong last time?");
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(FIRM_CANVAS_COPY.failed);
    fireEvent.click(within(alert).getByRole("button", { name: FIRM_CANVAS_COPY.tryAgain }));
    await waitFor(() =>
      expect(screen.getByTestId("canvas-answer").getAttribute("data-answer-status")).toBe(
        "answered",
      ),
    );
    expect(m.ask).toHaveBeenCalledTimes(2);
    expect(m.ask.mock.calls[1]![0].data.question).toBe("What went wrong last time?");
    expect(screen.getAllByTestId("canvas-answer")).toHaveLength(1);
  });

  it("says the daily limit was reached, with no Try again", async () => {
    m.getMap.mockResolvedValue(memberData());
    m.ask.mockRejectedValueOnce(new Response("limit", { status: 429 }));
    mount(<FirmBrainCanvas profile={person("em")} />);
    await ready();
    askFor("What went wrong last time?");
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(FIRM_BRAIN_LIMIT_COPY.shown);
    expect(within(alert).queryByRole("button")).toBeNull();
  });

  it("ignores a question under three characters and a second question while one is being read", async () => {
    m.getMap.mockResolvedValue(memberData());
    m.ask.mockReturnValue(new Promise(() => {}));
    mount(<FirmBrainCanvas profile={person("em")} />);
    await ready();
    askFor("hi");
    expect(m.ask).not.toHaveBeenCalled();
    askFor("First question here");
    askFor("Second question here");
    expect(m.ask).toHaveBeenCalledTimes(1);
  });

  it("keeps answers where they landed when the page is left and opened again in the same tab", async () => {
    m.getMap.mockResolvedValue(memberData());
    m.ask.mockResolvedValue(answer(["b5"]));
    const first = mount(<FirmBrainCanvas profile={person("em")} />);
    await ready();
    askFor("How did we launch other health service lines?");
    await waitFor(() =>
      expect(screen.getByTestId("canvas-answer").getAttribute("data-answer-status")).toBe(
        "answered",
      ),
    );
    first.unmount();
    mount(<FirmBrainCanvas profile={person("em")} />);
    await ready();
    expect(screen.getByTestId("canvas-answer").textContent).toContain(
      "How did we launch other health service lines?",
    );
  });

  it("never hands the question or the answer to analytics", async () => {
    m.getMap.mockResolvedValue(memberData());
    m.ask.mockResolvedValue(answer(["b5"]));
    mount(<FirmBrainCanvas profile={person("em")} />);
    await ready();
    askFor("A private question about obesity care");
    const card = await screen.findByTestId("canvas-answer");
    await waitFor(() => expect(card.getAttribute("data-answer-status")).toBe("answered"));
    expect(m.capture).not.toHaveBeenCalled();
    // Belt and braces on top of the app-wide masking: the card and the question box opt out of autocapture.
    expect(card.className).toContain("ph-no-autocapture");
    expect(screen.getByLabelText(FIRM_CANVAS_COPY.askLabel).closest("form")!.className).toContain(
      "ph-no-autocapture",
    );
  });

  it("lands an answer that comes back after the page was left, so it is not stuck waiting on return", async () => {
    m.getMap.mockResolvedValue(memberData());
    let reply!: (result: FirmAskResult) => void;
    m.ask.mockReturnValueOnce(new Promise((resolve) => (reply = resolve)));
    const first = mount(<FirmBrainCanvas profile={person("em")} />);
    await ready();
    askFor("How did we launch other health service lines?");
    await screen.findByTestId("canvas-answer");
    first.unmount();
    await act(async () => reply(answer(["b5"])));
    mount(<FirmBrainCanvas profile={person("em")} />);
    await ready();
    expect(screen.getByTestId("canvas-answer").getAttribute("data-answer-status")).toBe("answered");
  });
});

describe("sharing turned off after an answer landed", () => {
  it("removes that board's lines at the next read of the map, and an answer left with none goes", async () => {
    m.getMap.mockResolvedValue(memberData());
    m.ask.mockResolvedValueOnce(answer(["b5", "b6"])).mockResolvedValueOnce(answer(["b6"]));
    const first = mount(<FirmBrainCanvas profile={person("em")} />);
    await ready();
    askFor("How did we launch other health service lines?");
    await waitFor(() =>
      expect(screen.getByTestId("canvas-answer").getAttribute("data-answer-status")).toBe(
        "answered",
      ),
    );
    askFor("What did Cedarmere teach us?");
    await waitFor(() =>
      expect(
        screen
          .getAllByTestId("canvas-answer")
          .every((c) => c.getAttribute("data-answer-status") === "answered"),
      ).toBe(true),
    );
    first.unmount();
    // Cedarmere (b6) is no longer shared with the firm.
    const without = memberData();
    m.getMap.mockResolvedValue({
      ...without,
      threads: without.threads.filter((t) => t.id !== "b6"),
    });
    mount(<FirmBrainCanvas profile={person("em")} />);
    await ready();
    const cards = screen.getAllByTestId("canvas-answer");
    expect(cards).toHaveLength(1);
    expect(cards[0]!.textContent).toContain("Line 1 from b5.");
    expect(cards[0]!.textContent).not.toContain("from b6");
    expect(cards[0]!.textContent).not.toContain(corpus.boards.find((b) => b.id === "b6")!.title);
  });

  it("leaves waiting and failed answers alone, and returns the same list when nothing changed", () => {
    const list = [
      {
        id: "a",
        question: "q",
        starter: null,
        status: "pending" as const,
        result: null,
        limited: false,
        x: 0,
        y: 0,
        h: 0,
        startedAt: 0,
        built: false,
      },
      {
        id: "b",
        question: "q",
        starter: null,
        status: "answered" as const,
        result: answer(["b5"]),
        limited: false,
        x: 0,
        y: 0,
        h: 0,
        startedAt: 0,
        built: true,
      },
    ];
    expect(pruneAnswers(list, new Set(["b5"]))).toBe(list);
    expect(pruneAnswers(list, new Set<string>()).map((a) => a.id)).toEqual(["a"]);
  });
});
