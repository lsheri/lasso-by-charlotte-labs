// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkItemsResult } from "@/hooks/use-work-items";
import type { WorkItemRow } from "@/lib/work-types";
import type { WorkboardCardPreview } from "@/lib/workboard-card-preview.shared";

let mobile = false;
const refetch = vi.fn();
let queryState: { data: WorkItemsResult | undefined; isLoading: boolean; error: Error | null; refetch: typeof refetch };
vi.mock("@tanstack/react-start", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-start")>()),
  useServerFn: () => vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/chat-library.functions", () => ({ noteChatViewChangedFn: Symbol(), noteFilterChangedFn: Symbol(), noteReaderClosedFn: Symbol() }));
vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  Link: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
  useSearch: () => ({}),
  useNavigate: () => vi.fn(),
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: {} }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock("@/hooks/use-profile", () => ({
  useProfile: () => ({ data: { id: "profile", org_id: "org", role: "consultant" } }),
}));
vi.mock("@/hooks/use-work-items", () => ({
  useWorkItems: () => queryState,
}));
vi.mock("@/hooks/use-clients", () => ({ useClients: () => ({ data: [] }) }));
vi.mock("@/hooks/use-workboard-card-previews", () => ({ useWorkboardCardPreviews: () => ({}) }));
vi.mock("@/hooks/use-workboard-file-previews", () => ({ useWorkboardFilePreviews: () => ({}) }));
vi.mock("@/lib/settings-dialog-context", () => ({ useSettingsDialog: () => ({ openSettings: vi.fn() }) }));
vi.mock("@/lib/telemetry", () => ({ logEvent: vi.fn() }));
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
    <span data-testid="work-subtitle">{pieces} pieces of work · {unmapped} with no board</span>
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

vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => mobile }));

import { WorkPage } from "@/pages/WorkPage";
import { AiRecordPage } from "@/pages/AiRecordPage";

const emptyLibrary = "Your chat library is empty. Keep your first conversation here and it stays yours to find and reuse.";
afterEach(cleanup);
beforeEach(() => {
  mobile = false;
  refetch.mockReset();
  queryState = { data: { items: [], mappingError: null }, isLoading: false, error: null, refetch };
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
});

describe("LD1 list query states", () => {
  it("shows a chat fetch failure instead of an empty library and retries the query", () => {
    queryState.data = undefined;
    queryState.error = new Error("Network unavailable");
    render(<AiRecordPage />);
    expect(screen.getByRole("alert").textContent).toBe("Your chats couldn't be loaded.");
    expect(screen.queryByText(emptyLibrary)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("shows loading without declaring an empty chat library when no data is cached", () => {
    queryState.data = undefined;
    queryState.isLoading = true;
    render(<AiRecordPage />);
    expect(screen.getByRole("status").textContent).toBe("Loading your work…");
    expect(screen.queryByText(emptyLibrary)).toBeNull();
  });

  it("shows the existing empty chat library after a successful empty fetch", () => {
    render(<AiRecordPage />);
    expect(screen.getByText(emptyLibrary)).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText("Loading your work…")).toBeNull();
  });

  it.each([false, true])("does not show an empty All work state alongside a fetch error (phone=%s)", (phone) => {
    mobile = phone;
    queryState.data = undefined;
    queryState.error = new Error("Work couldn't load");
    render(<WorkPage />);
    expect(screen.getByText("Work couldn't load")).toBeTruthy();
    expect(screen.queryByText("Your work lands here.")).toBeNull();
    expect(screen.queryByText("Nothing here yet. Bring work in.")).toBeNull();
  });

  it("surfaces placement failure using the existing All work warning", () => {
    queryState.data = { items: [], mappingError: "Placement unavailable" };
    render(<AiRecordPage />);
    expect(screen.getByText("Mapping details couldn't load: Placement unavailable")).toBeTruthy();
  });
});
