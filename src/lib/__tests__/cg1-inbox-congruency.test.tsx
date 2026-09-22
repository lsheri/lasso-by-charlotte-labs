// @vitest-environment jsdom
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DimmedDisabled } from "@/components/common/DimmedDisabled";
import { InboxFixedCard } from "@/components/work/InboxFixedCard";
import { EVENT_DIM_KEYS } from "@/lib/event-dim-allowlist";
import { inboxFilterDims, inboxFilterMatches, recordInboxFilterChange } from "@/lib/inbox-filter";
import type { WorkItemRow } from "@/lib/work-types";

let inboxRows: WorkItemRow[] = [];
const recorded: ReturnType<typeof inboxFilterDims>[] = [];

vi.mock("@tanstack/react-start", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-start")>()),
  useServerFn: () => vi.fn(async () => ({ ok: true })),
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
vi.mock("@/hooks/use-workboard-card-previews", () => ({ useWorkboardCardPreviews: () => ({}) }));
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
  WorkNote: ({ item }: { item: WorkItemRow }) => <article>{item.title}</article>,
}));
vi.mock("@/components/notebook/marks", () => ({ GraphiteSeam: () => null }));
vi.mock("@/components/notebook/ToneCard", () => ({ ToneCard: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("@/hooks/use-chat-search-signal", () => ({
  useChatSearchSignal: () => ({ onSubmitQuery: vi.fn(), onResultOpened: vi.fn() }),
}));
vi.mock("@/hooks/use-motion", () => ({ useMotion: () => ({ className: "" }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { WorkPage } from "@/pages/WorkPage";
import { AiRecordPage } from "@/pages/AiRecordPage";

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
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
});

describe("CG1 inbox congruency", () => {
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
    expect(screen.getByText("These landed on their own. Say whose work it is and the rest gets easier.")).toBeTruthy();
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
    const toolbar = within(board).getByTestId("board-shell-toolbar");
    expect(within(toolbar).getByRole("group", { name: "How work is shown" })).toBeTruthy();
    expect(within(toolbar).getByRole("button", { name: "Everything" })).toBeTruthy();
    expect(within(toolbar).getByRole("button", { name: "Unmapped" })).toBeTruthy();
    expect(within(toolbar).getByRole("button", { name: "Claimed by you" })).toBeTruthy();
    expect(within(board).getByText("1–5 OF 6")).toBeTruthy();
    const documentLaneFrame = within(board).getByText("Documents").closest("[data-board-lane]");
    expect(documentLaneFrame?.getAttribute("style")).toContain("height: 1256px");
    expect(board.parentElement?.getAttribute("style")).toContain("height: 1376px");
    expect(within(board).getByText("Documents").parentElement?.parentElement?.className).toMatch(/top-0/);
    expect(within(board).getByText("1–5 OF 6").parentElement?.className).toMatch(/bottom-0/);
    const documentLaneScroll = board.querySelector('[data-board-lane="lane:inbox-document"] > [data-testid^="board-lane-scroll-"]');
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

  it("fits the full Inbox board at natural card size", () => {
    const width = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");
    const height = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight");
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get(this: HTMLElement) { return this.dataset["testid"] === "board-shell" ? 1600 : 0; },
    });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
      configurable: true,
      get(this: HTMLElement) { return this.dataset["testid"] === "board-shell" ? 1376 : 0; },
    });
    try {
      inboxRows = Array.from({ length: 5 }, (_, index) => itemOfType(`document-${index + 1}`, "document"));
      render(<WorkPage />);
      expect(screen.getByTestId("board-shell-stage").style.transform).toMatch(/scale\(1\)$/);
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
