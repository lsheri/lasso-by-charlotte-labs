// @vitest-environment jsdom
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DimmedDisabled } from "@/components/common/DimmedDisabled";
import { InboxFixedCard } from "@/components/work/InboxFixedCard";
import { EVENT_DIM_KEYS } from "@/lib/event-dim-allowlist";
import { inboxFilterDims, inboxFilterMatches, recordInboxFilterChange } from "@/lib/inbox-filter";
import type { WorkItemRow } from "@/lib/work-types";
import type { WorkboardCardPreview } from "@/lib/workboard-card-preview.shared";

let inboxRows: WorkItemRow[] = [];
const recorded: ReturnType<typeof inboxFilterDims>[] = [];
const { filterChangedToken, recordedChatFilters, cardPreviews } = vi.hoisted(() => ({
  filterChangedToken: Symbol("noteFilterChangedFn"),
  recordedChatFilters: [] as unknown[],
  cardPreviews: {} as Record<string, WorkboardCardPreview>,
}));

vi.mock("@tanstack/react-start", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-start")>()),
  useServerFn: (serverFn: unknown) =>
    serverFn === filterChangedToken
      ? vi.fn(async (input: unknown) => {
          recordedChatFilters.push(input);
          return { ok: true };
        })
      : vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/chat-library.functions", () => ({
  noteChatViewChangedFn: Symbol("noteChatViewChangedFn"),
  noteFilterChangedFn: filterChangedToken,
  noteReaderClosedFn: Symbol("noteReaderClosedFn"),
}));
vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  Link: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
  useSearch: () => ({}),
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: {} }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock("@/hooks/use-profile", () => ({
  useProfile: () => ({ data: { id: "profile", org_id: "org", role: "consultant" } }),
}));
vi.mock("@/hooks/use-work-items", () => ({
  useWorkItems: () => ({ data: { items: inboxRows, mappingError: null }, isLoading: false, error: null }),
}));
vi.mock("@/hooks/use-clients", () => ({ useClients: () => ({ data: [] }) }));
vi.mock("@/hooks/use-workboard-card-previews", () => ({ useWorkboardCardPreviews: () => cardPreviews }));
vi.mock("@/hooks/use-workboard-file-previews", () => ({ useWorkboardFilePreviews: () => ({}) }));
vi.mock("@/lib/settings-dialog-context", () => ({ useSettingsDialog: () => ({ openSettings: vi.fn() }) }));
vi.mock("@/lib/telemetry", () => ({
  logEvent: (_name: string, _org: string, dims: ReturnType<typeof inboxFilterDims>) => recorded.push(dims),
}));
vi.mock("@/components/onboarding/checklist/GettingStartedCard", () => ({ GettingStartedCard: () => null }));
vi.mock("@/components/coaching/CoachingLinkNotices", () => ({ CoachingLinkNotices: () => null }));
vi.mock("@/components/motion/SpiderLassoScene", () => ({ SpiderLassoScene: () => null }));
vi.mock("@/components/overview/ChatsToOrganise", () => ({ ChatsToOrganise: () => null }));
vi.mock("@/components/work/ArrivalsStrip", () => ({ ArrivalsStrip: () => null }));
vi.mock("@/components/connectors/WatchSuggestionBanner", () => ({ WatchSuggestionBanner: () => null }));
vi.mock("@/components/work/WorkRow", () => ({
  RowAction: () => null,
  WorkRow: ({ item }: { item: WorkItemRow }) => <article>{item.title}</article>,
}));
vi.mock("@/components/work/ConversationCard", () => ({ ConversationCard: () => null }));
vi.mock("@/components/work/WorkSubtitle", () => ({
  WorkSubtitle: ({ pieces, unmapped }: { pieces: number; unmapped: number }) => (
    <span data-testid="work-subtitle">{pieces} pieces of work · {unmapped} unmapped</span>
  ),
}));
vi.mock("@/components/work/SourceMark", () => ({ sourceVendorKey: () => null }));
vi.mock("@/components/work/MapDialog", () => ({ MapDialog: () => null }));
vi.mock("@/components/peek/PeekPanel", () => ({ PeekPanel: () => null }));
vi.mock("@/components/work/WorkDateDialog", () => ({ WorkDateDialog: () => null }));
vi.mock("@/components/reflect/AnalysisLens", () => ({ AnalysisLens: () => null }));
vi.mock("@/components/verify/ThreadAnalysisLauncher", () => ({
  ThreadAnalysisLauncher: () => null,
  isThreadReaderPreset: () => false,
}));
vi.mock("@/components/reflect/AskedSessions", () => ({
  AskedSessions: () => null,
  useAskedSessions: () => [],
}));
vi.mock("@/components/peek/SlideOver", () => ({ SlideOver: () => null }));
vi.mock("@/pages/ReflectPage", () => ({ ReflectPage: () => null }));
vi.mock("@/components/common/CaptureCoverage", () => ({ CaptureCoverage: () => null }));
vi.mock("@/components/markdown/MarkdownMessage", () => ({ MarkdownMessage: () => null }));
vi.mock("@/components/peek/PeekActionBar", () => ({ PeekActionBar: () => null }));
vi.mock("@/components/peek/RenderedContent", () => ({ RenderedContent: () => null }));
vi.mock("@/components/peek/ThreadBody", () => ({ ThreadBody: () => null }));
vi.mock("@/components/reflect/ChatAnalyses", () => ({
  AnalysisChips: () => null,
  InlineAnalysisBlocks: () => null,
  useChatAnalyses: () => ({ running: false, streamed: "", error: null, results: [], runPreset: vi.fn() }),
}));
vi.mock("@/components/common/Working", () => ({ ThinkingIndicator: () => null }));
vi.mock("@/components/work/ChatUrlLink", () => ({ ChatUrlLink: () => null }));
vi.mock("@/components/work/PasteThreadDialog", () => ({ PasteThreadDialog: () => null }));
vi.mock("@/components/connectors/BrandLogo", () => ({ BrandLogo: () => null }));
vi.mock("@/components/work/SubjectsPanel", () => ({ SubjectsPanel: () => null }));
vi.mock("@/components/work/WorkNote", () => ({
  WorkNote: ({ item, chatPreview }: { item: WorkItemRow; chatPreview?: WorkboardCardPreview }) => (
    <article>
      {item.title}
      {chatPreview?.turns.map((turn) => <p data-testid="conversation-card-turn" key={turn.turnNo}>{turn.role}: {turn.content}</p>)}
    </article>
  ),
}));
vi.mock("@/components/notebook/marks", () => ({ GraphiteSeam: () => null }));
vi.mock("@/components/notebook/ToneCard", () => ({ ToneCard: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("@/hooks/use-chat-search-signal", () => ({
  useChatSearchSignal: () => ({ onSubmitQuery: vi.fn(), onResultOpened: vi.fn() }),
}));
vi.mock("@/hooks/use-motion", () => ({ useMotion: () => ({ className: "" }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { WorkPage } from "@/pages/WorkPage";
import {
  AiRecordPage,
  CONVERSATION_CARD_HEIGHT,
  CONVERSATION_CARD_LABEL_ROW_HEIGHT,
  CONVERSATION_CARD_PADDING_HEIGHT,
  CONVERSATION_CARD_QUOTE_HEIGHT,
  CONVERSATION_CARD_TITLE_HEIGHT,
} from "@/pages/AiRecordPage";

function item(id: string, visibility: WorkItemRow["visibility"], code?: string): WorkItemRow {
  return {
    id,
    title: id,
    type: "document",
    source: "upload",
    visibility,
    captured_at: "2026-09-21T10:00:00Z",
    content_ref: null,
    created_at_source: null,
    work_date: null,
    content_fidelity: "verbatim",
    source_vendor: null,
    orig_conversation_id: null,
    source_meta: null,
    meta: null,
    work_item_tasks: code
      ? [{ task_id: `${id}-task`, tasks: { id: `${id}-task`, name: "Work", engagement_id: `${id}-engagement`, engagements: { id: `${id}-engagement`, code, title: code } } }]
      : [],
  } as WorkItemRow;
}

function itemOfType(id: string, type: WorkItemRow["type"]): WorkItemRow {
  return { ...item(id, "unmapped"), type };
}

function conversation(id: string, vendor: string, engagementCode?: string): WorkItemRow {
  const row = {
    ...item(id, engagementCode ? "mapped" : "unmapped", engagementCode),
    type: "ai_thread",
    source: vendor,
    source_vendor: vendor,
  } as WorkItemRow;
  if (engagementCode && row.work_item_tasks[0]?.tasks?.engagements) {
    row.work_item_tasks[0].tasks.engagement_id = `${engagementCode}-engagement`;
    row.work_item_tasks[0].tasks.engagements.id = `${engagementCode}-engagement`;
  }
  return row;
}

function filesUnder(path: string): string[] {
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const full = join(path, entry.name);
    return entry.isDirectory() ? filesUnder(full) : /\.(tsx?|css)$/.test(entry.name) ? [full] : [];
  });
}

const rows = [item("mapped", "mapped", "ALPHA"), item("waiting", "unmapped"), item("other", "mapped", "BETA")];

afterEach(cleanup);
beforeEach(() => {
  recorded.length = 0;
  recordedChatFilters.length = 0;
  for (const key of Object.keys(cardPreviews)) delete cardPreviews[key];
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
});

describe("CG1 inbox congruency", () => {
  // The Inbox lanes size from the shell's reported box, so every render gets a
  // real desktop shell (1094 x 1376) unless a test installs its own.
  const shellSize: { width?: PropertyDescriptor; height?: PropertyDescriptor } = {};
  beforeEach(() => {
    shellSize.width = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");
    shellSize.height = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight");
    Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get(this: HTMLElement) { return this.dataset["testid"] === "board-shell" ? 1094 : 0; } });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get(this: HTMLElement) { return this.dataset["testid"] === "board-shell" ? 1376 : 0; } });
  });
  afterEach(() => {
    if (shellSize.width) Object.defineProperty(HTMLElement.prototype, "clientWidth", shellSize.width);
    else Reflect.deleteProperty(HTMLElement.prototype, "clientWidth");
    if (shellSize.height) Object.defineProperty(HTMLElement.prototype, "clientHeight", shellSize.height);
    else Reflect.deleteProperty(HTMLElement.prototype, "clientHeight");
  });

  it("keeps the count line visible when the Inbox is empty", () => {
    inboxRows = [];
    render(<WorkPage />);
    expect(screen.getByTestId("work-subtitle").textContent).toBe("0 pieces of work · 0 unmapped");
    expect(screen.queryByTestId("board-shell")).toBeNull();
  });

  it("keeps every Inbox entry dimmed and disabled when the Unmapped filter matches nothing, and teaches about unclaimed work", () => {
    // Every entry is claimed, so the Unmapped placement filter matches zero
    // entries. Nothing may disappear and the teaching line, which is
    // specifically about work that arrived unclaimed, is present.
    inboxRows = [
      item("alpha", "mapped", "ALPHA"),
      item("bravo", "mapped", "ALPHA"),
      item("charlie", "mapped", "BETA"),
      item("delta", "mapped", "BETA"),
    ];
    render(<WorkPage />);
    fireEvent.click(screen.getByRole("button", { name: "Unmapped" }));
    for (const row of inboxRows) expect(screen.getByText(row.title)).toBeTruthy();
    const dimmed = screen.getAllByTestId("dimmed-disabled");
    expect(dimmed).toHaveLength(inboxRows.length);
    for (const wrapper of dimmed) {
      expect(wrapper.getAttribute("aria-disabled")).toBe("true");
      expect(wrapper.hasAttribute("inert")).toBe(true);
    }
    expect(screen.queryByText("Your work lands here.")).toBeNull();
    expect(screen.getByText(/These landed on their own\. Say whose work it is and the rest gets easier\./)).toBeTruthy();
  });

  it("keeps every Inbox entry dimmed and disabled when the Claimed by you filter matches nothing, with no teaching line", () => {
    // Every entry arrived unclaimed, so the Claimed placement filter matches
    // zero entries. The teaching line is about unclaimed work and does not
    // fit this state, so it must be absent while nothing disappears.
    inboxRows = [
      itemOfType("thread", "ai_thread"),
      itemOfType("document", "document"),
      itemOfType("sheet", "sheet"),
      itemOfType("call", "call"),
    ];
    render(<WorkPage />);
    fireEvent.click(screen.getByRole("button", { name: "Claimed by you" }));
    for (const row of inboxRows) expect(screen.getByText(row.title)).toBeTruthy();
    const dimmed = screen.getAllByTestId("dimmed-disabled");
    expect(dimmed).toHaveLength(inboxRows.length);
    for (const wrapper of dimmed) {
      expect(wrapper.getAttribute("aria-disabled")).toBe("true");
      expect(wrapper.hasAttribute("inert")).toBe(true);
    }
    expect(screen.queryByText("Your work lands here.")).toBeNull();
    expect(screen.queryByText("These landed on their own. Say whose work it is and the rest gets easier.")).toBeNull();
  });

  it("uses the shared dim component in Find it and the Inbox without disabling discarded results", () => {
    const inbox = readFileSync("src/pages/WorkPage.tsx", "utf8");
    const findIt = readFileSync("src/components/find-it/FindItResults.tsx", "utf8");
    for (const source of [inbox, findIt]) expect(source).toContain("DimmedDisabled");
    expect(findIt).toMatch(/DimmedDisabled[^>]+disabled=\{false\}/);
    const action = vi.fn();
    render(<DimmedDisabled dimmed disabled={false}><button onClick={action}>Reverse decision</button></DimmedDisabled>);
    fireEvent.click(screen.getByRole("button", { name: "Reverse decision" }));
    expect(action).toHaveBeenCalledOnce();
  });

  it("does not use green or lime to decide an Inbox filter match", () => {
    const offenders = filesUnder("src/components").concat(filesUnder("src/pages")).filter((path) => {
      const source = readFileSync(path, "utf8");
      return /(?:inbox|columnFilter|entryMatchesFilter)[^\n]*(?:green|lime)|(?:green|lime)[^\n]*(?:columnFilter|entryMatchesFilter)/i.test(source);
    });
    expect(offenders).toEqual([]);
  });

  it("keeps Ask Lasso answers visually distinct from transient filter state", () => {
    const styles = readFileSync("src/styles.css", "utf8");
    const answer = styles.match(/\.canvas-lab-answer-card\s*\{[^}]+\}/)?.[0] ?? "";
    const dimmed = readFileSync("src/components/common/DimmedDisabled.tsx", "utf8");
    expect(answer).toContain("--nb-lasso-green");
    expect(dimmed).not.toMatch(/green|lime|lasso/i);
    inboxRows = [item("claimed", "mapped", "ALPHA")];
    render(<WorkPage />);
    fireEvent.click(screen.getByRole("button", { name: "Unmapped" }));
    expect(screen.getByTestId("dimmed-disabled").className).not.toMatch(/green|lime|lasso/i);
  });

  it("marks Inbox cards as fixed and cancels drag", () => {
    const onDragStart = vi.fn();
    render(<InboxFixedCard><span>Card</span></InboxFixedCard>);
    const card = screen.getByTestId("inbox-fixed-card");
    card.addEventListener("dragstart", onDragStart);
    expect(card.getAttribute("draggable")).toBe("false");
    expect(card.querySelector("[data-non-drag-affordance]")).not.toBeNull();
    expect(fireEvent.dragStart(card)).toBe(false);
    expect(onDragStart).toHaveBeenCalledOnce();
    cleanup();
    inboxRows = [itemOfType("page-card", "document")];
    render(<WorkPage />);
    expect(screen.getByText("page-card").closest('[data-testid="inbox-fixed-card"]')).not.toBeNull();
  });

  it("builds one closed event payload per change and preserves zero", () => {
    const selected = ["all", "one"] as const;
    const filters = ["placement", "engagement"] as const;
    for (const filter of filters) {
      for (const state of selected) {
        const dims = inboxFilterDims(filter, state, state === "all" ? rows.length : 0);
        expect(Object.keys(dims).sort()).toEqual(
          [...(EVENT_DIM_KEYS["work.filter_changed"] ?? [])].sort(),
        );
        expect(filters).toContain(dims.filter);
        expect(selected).toContain(dims.selected);
        if (state === "one") expect(dims.result_band).toBe("0");
      }
    }
    const emitted: ReturnType<typeof inboxFilterDims>[] = [];
    const dims = inboxFilterDims("placement", "one", 0);
    recordInboxFilterChange(dims, (value) => emitted.push(value));
    expect(emitted).toEqual([dims]);
    inboxRows = [item("claimed", "mapped", "ALPHA")];
    render(<WorkPage />);
    fireEvent.click(screen.getByRole("button", { name: "Unmapped" }));
    expect(recorded).toEqual([{ filter: "placement", selected: "one", result_band: "0" }]);
  });

  it("keeps four lanes and five-per-page replacement through both wrappers", () => {
    inboxRows = Array.from({ length: 6 }, (_, index) => itemOfType(`document-${index + 1}`, "document"));
    render(<WorkPage />);
    const board = screen.getByTestId("board-shell");
    expect(board.getAttribute("aria-label")).toBe("Inbox work board");
    expect(board).toBeTruthy();
    expect(board.querySelectorAll("[data-board-lane]")).toHaveLength(4);
    for (const label of ["AI conversations", "Documents", "Models & sheets", "Meeting transcripts"]) {
      expect(within(board).getByText(label)).toBeTruthy();
    }
    expect(screen.getByRole("group", { name: "How work is shown" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Everything" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Unmapped" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Claimed by you" })).toBeTruthy();
    expect(within(board).getByText("1–5 OF 6")).toBeTruthy();
    const documentLaneFrame = within(board).getByText("Documents").closest("[data-board-lane]");
    expect(documentLaneFrame?.getAttribute("style")).toContain("height: 1268px");
    expect(board.parentElement?.className).toContain("min-h-0");
    expect(within(board).getByText("Documents").parentElement?.parentElement?.className).toMatch(/top-0/);
    expect(within(board).getByText("1–5 OF 6").parentElement?.className).toMatch(/bottom-0/);
    const documentLaneScroll = board.querySelector('[data-board-lane="lane:inbox-documents"] > [data-testid^="board-lane-scroll-"]');
    expect(documentLaneScroll).not.toBeNull();
    if (!documentLaneScroll) throw new Error("Documents lane scroll box is missing");
    expect(documentLaneScroll.getAttribute("style")).toContain("top: 40px");
    expect(documentLaneScroll.getAttribute("style")).toContain("bottom: 44px");
    expect(screen.getByText(inboxRows[4]?.title ?? "missing")).toBeTruthy();
    for (const card of screen.getAllByTestId("inbox-fixed-card")) {
      expect(card.parentElement?.className).toMatch(/min-w-0/);
      expect(card.className).toMatch(/min-w-0/);
    }
    fireEvent.click(screen.getByRole("button", { name: "More work in this column" }));
    expect(screen.getAllByTestId("inbox-fixed-card")).toHaveLength(1);
    expect(screen.getByText(inboxRows[5]?.title ?? "missing")).toBeTruthy();
  });

  it("uses the fixed Inbox shell and puts the source tally in the board's top row", () => {
    inboxRows = [itemOfType("document-1", "document")];
    const { container } = render(<WorkPage />);
    expect(container.firstElementChild?.className).toContain("h-[calc(100vh-6.5rem)]");
    expect(container.querySelector("header")?.className).toContain("h-16");
    expect(screen.getByRole("button", { name: "Everything" }).parentElement?.className).toContain("h-[46px]");
    expect(container.querySelector('[data-board-frame="inbox-sources"]')).toBeNull();
    expect(within(screen.getByTestId("board-shell-toolbar")).getByText(/^WHERE THIS CAME FROM · /)).toBeTruthy();
  });

  it("recomputes the Inbox span and symmetric gaps after the shell reports a live width change", async () => {
    const width = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");
    const height = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight");
    const reported = { width: 1094, height: 1376 };
    const callbacks = new Set<ResizeObserverCallback>();
    const entry = () => ({
      target: screen.getByTestId("board-shell"),
      contentRect: { width: reported.width, height: reported.height },
    }) as unknown as ResizeObserverEntry;
    class LiveResizeObserver {
      constructor(private readonly callback: ResizeObserverCallback) {}
      observe() { callbacks.add(this.callback); this.callback([entry()], this as unknown as ResizeObserver); }
      disconnect() { callbacks.delete(this.callback); }
      unobserve() { callbacks.delete(this.callback); }
    }
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get(this: HTMLElement) { return this.dataset["testid"] === "board-shell" ? 1094 : 0; },
    });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
      configurable: true,
      get(this: HTMLElement) { return this.dataset["testid"] === "board-shell" ? 1376 : 0; },
    });
    vi.stubGlobal("ResizeObserver", LiveResizeObserver);
    const boardMetrics = () => {
      const lanes = Array.from(screen.getByTestId("board-shell").querySelectorAll<HTMLElement>("[data-board-lane]"));
      const stage = screen.getByTestId("board-shell-stage") as HTMLElement;
      const transform = stage.style.transform.match(/translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)\s*scale\((-?[\d.]+)\)/);
      if (!transform || lanes.length !== 4) throw new Error("Inbox board metrics unavailable");
      const panX = Number(transform[1]);
      const zoom = Number(transform[3]);
      const left = Number.parseFloat(lanes[0]?.style.left ?? "0") * zoom + panX;
      const last = lanes[3];
      const right = last ? (Number.parseFloat(last.style.left) + Number.parseFloat(last.style.width)) * zoom + panX : 0;
      return { span: right - left, left, right: reported.width - right, zoom };
    };
    try {
      inboxRows = Array.from({ length: 5 }, (_, index) => itemOfType(`responsive-document-${index + 1}`, "document"));
      render(<WorkPage />);
      await waitFor(() => expect(boardMetrics()).toEqual({ span: 1030, left: 32, right: 32, zoom: 1 }));
      reported.width = 1286;
      act(() => { for (const callback of callbacks) callback([entry()], {} as ResizeObserver); });
      await waitFor(() => expect(boardMetrics()).toEqual({ span: 1222, left: 32, right: 32, zoom: 1 }));
    } finally {
      vi.unstubAllGlobals();
      if (width) Object.defineProperty(HTMLElement.prototype, "clientWidth", width);
      else Reflect.deleteProperty(HTMLElement.prototype, "clientWidth");
      if (height) Object.defineProperty(HTMLElement.prototype, "clientHeight", height);
      else Reflect.deleteProperty(HTMLElement.prototype, "clientHeight");
    }
  });

  it("recentres the fixed conversation month span from the reported live width", async () => {
    const width = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");
    const height = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight");
    const reported = { width: 1094, height: 1376 };
    const callbacks = new Set<ResizeObserverCallback>();
    const entry = () => ({
      target: screen.getByTestId("board-shell"),
      contentRect: { width: reported.width, height: reported.height },
    }) as unknown as ResizeObserverEntry;
    class LiveResizeObserver {
      constructor(private readonly callback: ResizeObserverCallback) {}
      observe() { callbacks.add(this.callback); this.callback([entry()], this as unknown as ResizeObserver); }
      disconnect() { callbacks.delete(this.callback); }
      unobserve() { callbacks.delete(this.callback); }
    }
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get(this: HTMLElement) { return this.dataset["testid"] === "board-shell" ? 1094 : 0; },
    });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
      configurable: true,
      get(this: HTMLElement) { return this.dataset["testid"] === "board-shell" ? 1376 : 0; },
    });
    vi.stubGlobal("ResizeObserver", LiveResizeObserver);
    const boardMetrics = () => {
      const lanes = Array.from(screen.getByTestId("board-shell").querySelectorAll<HTMLElement>("[data-board-lane]"));
      const stage = screen.getByTestId("board-shell-stage") as HTMLElement;
      const transform = stage.style.transform.match(/translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)\s*scale\((-?[\d.]+)\)/);
      if (!transform || lanes.length !== 4) throw new Error("Conversation board metrics unavailable");
      const panX = Number(transform[1]);
      const zoom = Number(transform[3]);
      const left = Number.parseFloat(lanes[0]?.style.left ?? "0") * zoom + panX;
      const last = lanes[3];
      const right = last ? (Number.parseFloat(last.style.left) + Number.parseFloat(last.style.width)) * zoom + panX : 0;
      return { span: right - left, left, right: reported.width - right, zoom };
    };
    try {
      inboxRows = ["09", "08", "07", "06"].map((month) => ({
        ...conversation(`conversation-${month}`, "claude", "ALPHA"),
        captured_at: `2026-${month}-10T10:00:00Z`,
      }));
      render(<AiRecordPage />);
      await waitFor(() => expect(boardMetrics()).toEqual({ span: 1030, left: 32, right: 32, zoom: 1 }));
      reported.width = 1286;
      act(() => { for (const callback of callbacks) callback([entry()], {} as ResizeObserver); });
      await waitFor(() => expect(boardMetrics()).toEqual({ span: 1030, left: 128, right: 128, zoom: 1 }));
    } finally {
      vi.unstubAllGlobals();
      if (width) Object.defineProperty(HTMLElement.prototype, "clientWidth", width);
      else Reflect.deleteProperty(HTMLElement.prototype, "clientWidth");
      if (height) Object.defineProperty(HTMLElement.prototype, "clientHeight", height);
      else Reflect.deleteProperty(HTMLElement.prototype, "clientHeight");
    }
  });

  it("resizes four lanes to a narrow live-width shell and fits at natural card size", async () => {
    const width = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");
    const height = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight");
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get(this: HTMLElement) { return this.dataset["testid"] === "board-shell" ? 1094 : 0; },
    });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
      configurable: true,
      get(this: HTMLElement) {
        return this.dataset["testid"] === "board-shell" ? 1376 : 0;
      },
    });
    try {
      inboxRows = Array.from({ length: 5 }, (_, index) => itemOfType(`document-${index + 1}`, "document"));
      render(<WorkPage />);
      await waitFor(() => {
        expect(screen.getByTestId("board-shell-stage").style.transform).toMatch(/scale\(1\)$/);
      });
      const lanes = screen.getByTestId("board-shell").querySelectorAll<HTMLElement>("[data-board-lane]");
      expect(lanes).toHaveLength(4);
      for (const lane of lanes) expect(lane.style.width).toBe("230.5px");
      const cardPlacement = screen.getByText("document-1").closest<HTMLElement>("[data-lane-content]");
      expect(cardPlacement?.style.width).toBe("206.5px");
    } finally {
      if (width) Object.defineProperty(HTMLElement.prototype, "clientWidth", width);
      else Reflect.deleteProperty(HTMLElement.prototype, "clientWidth");
      if (height) Object.defineProperty(HTMLElement.prototype, "clientHeight", height);
      else Reflect.deleteProperty(HTMLElement.prototype, "clientHeight");
    }
  });

  it("keeps filter decisions out of Inbox component styling helpers", () => {
    const offenders = filesUnder("src/components").filter((path) => {
      const source = readFileSync(path, "utf8");
      return /inbox[^\n]*(?:filter|match)[^\n]*(?:green|lime)|(?:green|lime)[^\n]*(?:filter|match)/i.test(source);
    });
    expect(offenders).toEqual([]);
    inboxRows = [item("claimed", "mapped", "ALPHA")];
    render(<WorkPage />);
    fireEvent.click(screen.getByRole("button", { name: "Unmapped" }));
    expect(screen.getByTestId("dimmed-disabled").className).not.toMatch(/green|lime/);
  });
});

describe("CG2 AI conversations congruency", () => {
  it("derives the compact card height from named content parts and shows only the first user turn", () => {
    inboxRows = [conversation("Question first", "claude", "ALPHA")];
    cardPreviews["Question first"] = {
      workItemId: "Question first",
      turnCount: 3,
      model: "model",
      firstUserTurn: { turnNo: 1, role: "user", content: "How should I frame this?" },
      turns: [
        { turnNo: 2, role: "assistant", content: "Start with the answer." },
        { turnNo: 3, role: "user", content: "Then what?" },
      ],
    };

    render(<AiRecordPage />);

    const parts = [
      CONVERSATION_CARD_LABEL_ROW_HEIGHT,
      CONVERSATION_CARD_TITLE_HEIGHT,
      CONVERSATION_CARD_QUOTE_HEIGHT,
      CONVERSATION_CARD_PADDING_HEIGHT,
    ];
    const card = screen.getByText("Question first").closest<HTMLElement>("[data-lane-content]");
    expect(CONVERSATION_CARD_HEIGHT).toBe(parts.reduce((sum, part) => sum + part, 0));
    expect(card?.style.height).toBe(`${parts.reduce((sum, part) => sum + part, 0)}px`);
    expect(screen.getAllByTestId("conversation-card-turn")).toHaveLength(1);
    expect(screen.getByText("user: How should I frame this?")).toBeTruthy();
    expect(screen.queryByText(/Start with the answer|Then what/)).toBeNull();
  });

  it("keeps the four conversation vendor borders exact", () => {
    const styles = readFileSync("src/styles.css", "utf8");
    expect(styles).toContain("--nb-chat-border-claude: linear-gradient(135deg, #c65d26, #c65d26);");
    expect(styles).toContain("--nb-chat-border-chatgpt: linear-gradient(135deg, #111315, #777b7e);");
    expect(styles).toContain("--nb-chat-border-gemini: linear-gradient(135deg, #2d6ecf, #b8c3cf);");
    expect(styles).toContain("--nb-chat-border-copilot: linear-gradient(135deg, #6d3bb8, #17151b);");
  });

  it("fits a mixed month timeline at zoom one with compact empty spines and honest lane heights", async () => {
    const width = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");
    const height = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight");
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get(this: HTMLElement) { return this.dataset["testid"] === "board-shell" ? 1094 : 0; },
    });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
      configurable: true,
      get(this: HTMLElement) {
        return this.dataset["testid"] === "board-shell" ? 1376 : 0;
      },
    });
    try {
      const inMonth = (month: string, count: number) =>
        Array.from({ length: count }, (_, index) => ({
          ...conversation(`${month} conversation ${index + 1}`, "claude", "ALPHA"),
          captured_at: `2026-${month}-${String(index + 1).padStart(2, "0")}T10:00:00Z`,
        }));
      inboxRows = [
        ...inMonth("09", 5),
        ...inMonth("08", 2),
        ...inMonth("06", 6),
        ...inMonth("05", 1),
        ...inMonth("04", 1),
      ];

      render(<AiRecordPage />);

      const board = screen.getByTestId("board-shell");
      await waitFor(() => {
        expect(screen.getByTestId("board-shell-stage").style.transform).toMatch(/scale\(1\)$/);
      });
      const lanes = board.querySelectorAll<HTMLElement>("[data-board-lane]");
      const spines = board.querySelectorAll<HTMLElement>("[data-board-frame]");
      expect(lanes).toHaveLength(5);
      expect(spines).toHaveLength(1);
      for (const lane of lanes) expect(lane.style.width).toBe("230.5px");
      expect(within(lanes[0] as HTMLElement).getByText("September")).toBeTruthy();
      const july = spines[0] as HTMLElement;
      expect(july.style.width).toBe("112px");
      expect(within(july).getByText("July")).toBeTruthy();
      expect(within(july).getByText("0")).toBeTruthy();
      expect(july.querySelector("[data-testid^='board-lane-scroll-']")).toBeNull();
      expect(within(lanes[4] as HTMLElement).getByText("April")).toBeTruthy();
      expect(Number.parseFloat(lanes[4]?.style.left ?? "0")).toBeGreaterThan(1094);
      expect((lanes[0] as HTMLElement).style.height).toBe("862px");
      expect((lanes[1] as HTMLElement).style.height).toBe("376px");
      expect(1212 - Number.parseFloat((lanes[0] as HTMLElement).style.height)).toBe(5 * (220 - 150));
      expect(Number.parseFloat((lanes[0] as HTMLElement).style.height) - Number.parseFloat((lanes[1] as HTMLElement).style.height)).toBe(3 * 150 + 3 * 12);
      const june = Array.from(lanes).find((lane) => within(lane).queryByText("June"));
      expect(june?.style.height).toBe("906px");
      expect(june?.querySelector("[data-conversation-paging-row]")).not.toBeNull();
      expect((lanes[0] as HTMLElement).querySelector("[data-conversation-paging-row]")).toBeNull();
      const firstCard = within(lanes[0] as HTMLElement).getAllByRole("article")[0]?.closest<HTMLElement>("[data-lane-content]");
      expect(firstCard?.style.width).toBe("206.5px");
      const toolbar = within(board).getByTestId("board-shell-toolbar");
      expect(within(toolbar).getByRole("searchbox", { name: "Search your chats" })).toBeTruthy();
      expect(within(toolbar).getByRole("group", { name: "Filter by tool" })).toBeTruthy();
      expect(within(toolbar).getByRole("group", { name: "Filter by engagement" })).toBeTruthy();
      expect(within(toolbar).getByText("15 conversations.")).toBeTruthy();
    } finally {
      if (width) Object.defineProperty(HTMLElement.prototype, "clientWidth", width);
      else Reflect.deleteProperty(HTMLElement.prototype, "clientWidth");
      if (height) Object.defineProperty(HTMLElement.prototype, "clientHeight", height);
      else Reflect.deleteProperty(HTMLElement.prototype, "clientHeight");
    }
  });

  it("keeps every conversation in place while dimming and disabling chip-filter non-matches", () => {
    inboxRows = [
      conversation("Claude plan", "claude", "ALPHA"),
      conversation("ChatGPT notes", "chatgpt", "BETA"),
      conversation("Claude review", "claude", "ALPHA"),
    ];
    render(<AiRecordPage />);

    fireEvent.click(within(screen.getByRole("group", { name: "Filter by tool" })).getByRole("button", { name: /Claude/i }));

    for (const row of inboxRows) expect(screen.getByText(row.title)).toBeTruthy();
    const dimmed = screen.getAllByTestId("dimmed-disabled");
    expect(dimmed).toHaveLength(inboxRows.filter((row) => row.source_vendor !== "claude").length);
    for (const wrapper of dimmed) {
      expect(wrapper.getAttribute("aria-disabled")).toBe("true");
      expect(wrapper.hasAttribute("inert")).toBe(true);
    }
    for (const title of ["Claude plan", "Claude review"]) {
      expect(screen.getByText(title).closest('[data-testid="dimmed-disabled"]')).toBeNull();
    }
  });

  it("keeps the chip event name path and closed tool and engagement payloads", () => {
    inboxRows = [
      conversation("Claude plan", "claude", "ALPHA"),
      conversation("ChatGPT notes", "chatgpt", "BETA"),
    ];
    render(<AiRecordPage />);

    fireEvent.click(within(screen.getByRole("group", { name: "Filter by tool" })).getByRole("button", { name: /Claude/i }));
    fireEvent.click(within(screen.getByRole("group", { name: "Filter by engagement" })).getByRole("button", { name: /BETA/i }));

    expect(recordedChatFilters).toEqual([
      { data: { filter: "tool", selected: "one", profile_id: "profile" } },
      { data: { filter: "engagement", selected: "one", profile_id: "profile" } },
    ]);
  });

  it("keeps the full conversation list dimmed when chip filters match nothing", () => {
    inboxRows = [
      conversation("Claude plan", "claude", "ALPHA"),
      conversation("ChatGPT notes", "chatgpt", "BETA"),
    ];
    render(<AiRecordPage />);

    fireEvent.click(within(screen.getByRole("group", { name: "Filter by tool" })).getByRole("button", { name: /Claude/i }));
    fireEvent.click(within(screen.getByRole("group", { name: "Filter by engagement" })).getByRole("button", { name: /BETA/i }));

    for (const row of inboxRows) expect(screen.getByText(row.title)).toBeTruthy();
    expect(screen.getAllByTestId("dimmed-disabled")).toHaveLength(inboxRows.length);
    expect(screen.queryByText(/No chats match/i)).toBeNull();
    for (const wrapper of screen.getAllByTestId("dimmed-disabled")) {
      expect(wrapper.getAttribute("aria-disabled")).toBe("true");
      expect(wrapper.hasAttribute("inert")).toBe(true);
    }
  });

  it("keeps search narrowing while chip filters dim all remaining search results", () => {
    inboxRows = [
      conversation("Budget source", "chatgpt", "BETA"),
      conversation("Budget review", "chatgpt", "BETA"),
      conversation("Planning source", "claude", "ALPHA"),
    ];
    render(<AiRecordPage />);

    fireEvent.change(screen.getByRole("searchbox", { name: "Search your chats" }), {
      target: { value: "Budget" },
    });
    fireEvent.click(within(screen.getByRole("group", { name: "Filter by tool" })).getByRole("button", { name: /Claude/i }));

    const searchResults = inboxRows.filter((row) => row.title.includes("Budget"));
    for (const row of searchResults) expect(screen.getByText(row.title)).toBeTruthy();
    expect(screen.queryByText("Planning source")).toBeNull();
    const dimmed = screen.getAllByTestId("dimmed-disabled");
    expect(dimmed).toHaveLength(searchResults.length);
    for (const wrapper of dimmed) {
      expect(wrapper.getAttribute("aria-disabled")).toBe("true");
      expect(wrapper.hasAttribute("inert")).toBe(true);
    }
    expect(screen.queryByText(/No chats match/i)).toBeNull();
  });

  it("keeps the search, chips, and count available when search matches nothing, then restores conversations when cleared", () => {
    inboxRows = [
      conversation("Budget source", "chatgpt", "BETA"),
      conversation("Planning source", "claude", "ALPHA"),
    ];
    render(<AiRecordPage />);

    const search = screen.getByRole("searchbox", { name: "Search your chats" });
    fireEvent.change(search, { target: { value: "nothing here" } });

    expect(screen.getByText("No chats match that search.")).toBeTruthy();
    expect(document.body.contains(search)).toBe(true);
    expect((search as HTMLInputElement).value).toBe("nothing here");
    expect(screen.getByRole("group", { name: "Filter by tool" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Filter by engagement" })).toBeTruthy();
    expect(screen.getByText(`Showing 0 of ${inboxRows.length}. Nothing is deleted here.`)).toBeTruthy();
    expect(screen.getByTestId("board-shell").querySelectorAll("[data-board-lane]")).toHaveLength(0);

    fireEvent.change(search, { target: { value: "" } });

    expect((search as HTMLInputElement).value).toBe("");
    expect(screen.queryByText("No chats match that search.")).toBeNull();
    for (const row of inboxRows) expect(screen.getByText(row.title)).toBeTruthy();
  });

  it("does not use green or lime to decide AI conversation filter-match styling", () => {
    const offenders = filesUnder("src/components").concat(filesUnder("src/pages")).filter((path) => {
      const source = readFileSync(path, "utf8");
      return /(?:chatlib|conversation|tool|engagement)[^\n]*(?:filter|match)[^\n]*(?:green|lime)|(?:green|lime)[^\n]*(?:filter|match)[^\n]*(?:chatlib|conversation|tool|engagement)/i.test(source);
    });
    expect(offenders).toEqual([]);
  });
});

describe("CG3 AI conversation count line", () => {
  it("counts the conversations on screen when search is active", () => {
    inboxRows = [
      conversation("Budget source", "chatgpt", "BETA"),
      conversation("Budget review", "chatgpt", "BETA"),
      conversation("Planning source", "claude", "ALPHA"),
    ];
    render(<AiRecordPage />);

    fireEvent.change(screen.getByRole("searchbox", { name: "Search your chats" }), {
      target: { value: "Budget" },
    });
    fireEvent.click(within(screen.getByRole("group", { name: "Filter by tool" })).getByRole("button", { name: /Claude/i }));

    expect(screen.getByText(`Showing 2 of ${inboxRows.length}. Nothing is deleted here.`)).toBeTruthy();
  });

  it("counts chip matches when there is no search", () => {
    inboxRows = [
      conversation("Claude plan", "claude", "ALPHA"),
      conversation("ChatGPT notes", "chatgpt", "BETA"),
      conversation("Gemini notes", "gemini", "BETA"),
    ];
    render(<AiRecordPage />);

    fireEvent.click(within(screen.getByRole("group", { name: "Filter by tool" })).getByRole("button", { name: /Claude/i }));

    expect(screen.getByText(`1 of ${inboxRows.length} matches what you picked. The rest are still here.`)).toBeTruthy();
  });

  it("states the total when neither chip nor search narrows the page", () => {
    inboxRows = [conversation("Only conversation", "claude", "ALPHA")];
    render(<AiRecordPage />);

    expect(screen.getByText(`${inboxRows.length} conversation.`)).toBeTruthy();
  });
});
