// @vitest-environment jsdom
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DimmedDisabled } from "@/components/common/DimmedDisabled";
import { InboxFixedCard } from "@/components/work/InboxFixedCard";
import { EVENT_DIM_KEYS } from "@/lib/event-dim-allowlist";
import { inboxFilterDims, inboxFilterMatches, recordInboxFilterChange } from "@/lib/inbox-filter";
import type { WorkItemRow } from "@/lib/work-types";

let inboxRows: WorkItemRow[] = [];
const recorded: ReturnType<typeof inboxFilterDims>[] = [];

vi.mock("@tanstack/react-start", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-start")>()),
  useServerFn: () => vi.fn(),
}));
vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  Link: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
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
vi.mock("@/components/work/WorkSubtitle", () => ({ WorkSubtitle: () => null }));
vi.mock("@/components/work/SourceMark", () => ({ sourceVendorKey: () => null }));
vi.mock("@/components/work/MapDialog", () => ({ MapDialog: () => null }));
vi.mock("@/components/peek/PeekPanel", () => ({ PeekPanel: () => null }));
vi.mock("@/components/work/WorkDateDialog", () => ({ WorkDateDialog: () => null }));
vi.mock("@/components/reflect/AnalysisLens", () => ({ AnalysisLens: () => null }));
vi.mock("@/components/verify/ThreadAnalysisLauncher", () => ({
  ThreadAnalysisLauncher: () => null,
  isThreadReaderPreset: () => false,
}));

import { WorkPage } from "@/pages/WorkPage";

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

function filesUnder(path: string): string[] {
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const full = join(path, entry.name);
    return entry.isDirectory() ? filesUnder(full) : /\.(tsx?|css)$/.test(entry.name) ? [full] : [];
  });
}

const rows = [item("mapped", "mapped", "ALPHA"), item("waiting", "unmapped"), item("other", "mapped", "BETA")];

afterEach(cleanup);

describe("CG1 inbox congruency", () => {
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
  });

  it("keeps column geometry and five-per-page replacement through both wrappers", () => {
    inboxRows = Array.from({ length: 6 }, (_, index) => itemOfType(`document-${index + 1}`, "document"));
    render(<WorkPage />);
    const columns = document.querySelector(".nb-type-columns");
    expect(columns).not.toBeNull();
    expect(columns?.querySelectorAll(":scope > div")).toHaveLength(4);
    expect(columns?.querySelectorAll(".nb-paper-wall")).toHaveLength(4);
    const firstPage = screen.getAllByTestId("inbox-fixed-card");
    expect(firstPage).toHaveLength(5);
    for (const card of firstPage) {
      expect(card.parentElement?.className).toMatch(/min-w-0/);
      expect(card.className).toMatch(/min-w-0/);
    }
    fireEvent.click(screen.getByRole("button", { name: "More work in this column" }));
    expect(screen.getAllByTestId("inbox-fixed-card")).toHaveLength(1);
    expect(screen.getByText(inboxRows[5]?.title ?? "missing")).toBeTruthy();
  });

  it("keeps filter decisions out of Inbox component styling helpers", () => {
    const offenders = filesUnder("src/components").filter((path) => {
      const source = readFileSync(path, "utf8");
      return /inbox[^\n]*(?:filter|match)[^\n]*(?:green|lime)|(?:green|lime)[^\n]*(?:filter|match)/i.test(source);
    });
    expect(offenders).toEqual([]);
  });
});
