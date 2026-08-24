// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

import { safeChatUrl, chatUrlLabel } from "@/lib/chat-url";
import { WORK_VIEW_KEY, readWorkView, writeWorkView } from "@/lib/work-view";
import { connectStreamKey, defaultStream, rememberStream } from "@/lib/connect-to-work";
import { ChatUrlLink } from "@/components/work/ChatUrlLink";
import { WorkPile } from "@/components/work/WorkPile";
import { ConnectToWorkSheet } from "@/components/engagements/ConnectToWorkSheet";
import { remapItems } from "@/lib/workflow-order";
import type { WorkItemRow } from "@/lib/work-types";

let mockWorkItems: WorkItemRow[] = [];

vi.mock("@/hooks/use-work-items", () => ({
  useWorkItems: () => ({ data: { items: mockWorkItems }, isLoading: false, error: null }),
}));

vi.mock("@/lib/workflow-order", () => ({
  remapItems: vi.fn(async () => ({ error: null })),
}));

vi.mock("@tanstack/react-start", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-start")>("@tanstack/react-start");
  return {
    ...actual,
    useServerFn: (fn: unknown) => fn,
  };
});

vi.mock("@/components/connectors/ConnectorBrowseActions", () => ({
  ConnectorBrowseActions: () => <div data-testid="browse-actions" />,
}));
vi.mock("@/components/work/PasteThreadDialog", () => ({
  PasteThreadDialog: () => <div data-testid="paste-dialog" />,
}));
vi.mock("@/components/work/UploadFilesButton", () => ({
  UploadFilesButton: () => <div data-testid="upload-button" />,
}));
vi.mock("@/components/work/TranscriptsAction", () => ({
  TranscriptsAction: () => <div data-testid="transcripts-action" />,
}));

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  mockWorkItems = [];
  vi.clearAllMocks();
});

function item(overrides: Partial<WorkItemRow> = {}): WorkItemRow {
  return {
    id: "w1",
    title: "A conversation",
    type: "ai_thread",
    source: "mcp:claude",
    visibility: "unmapped",
    captured_at: "2026-01-01T00:00:00Z",
    content_ref: null,
    created_at_source: null,
    work_date: null,
    content_fidelity: "transcribed",
    source_vendor: "claude",
    orig_conversation_id: null,
    source_meta: null,
    meta: null,
    work_item_tasks: [],
    ...overrides,
  } as WorkItemRow;
}

function withQuery(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{ui}</QueryClientProvider>;
}

describe("pass 97 — work view persistence", () => {
  it("defaults to pile and persists the choice under lasso.work.view", () => {
    expect(WORK_VIEW_KEY).toBe("lasso.work.view");
    expect(readWorkView()).toBe("pile");
    writeWorkView("matrix");
    expect(window.localStorage.getItem(WORK_VIEW_KEY)).toBe("matrix");
    expect(readWorkView()).toBe("matrix");
    writeWorkView("pile");
    expect(readWorkView()).toBe("pile");
  });

  it("restores the stored view and never switches view on a paper click", () => {
    const onOpenEntry = vi.fn();
    render(
      withQuery(<WorkPile
        entries={[item()]}
        renderEntry={() => <div data-testid="matrix-row" />}
        onOpenEntry={onOpenEntry}
      />),
    );
    // First visit lands on pile: the scatter field is present, no matrix rows.
    expect(document.querySelector("[data-scatter]")).not.toBeNull();
    expect(screen.queryByTestId("matrix-row")).toBeNull();

    fireEvent.click(screen.getByText("A conversation"));
    expect(onOpenEntry).toHaveBeenCalledTimes(1);
    expect(document.querySelector("[data-scatter]")).not.toBeNull();
    expect(screen.queryByTestId("matrix-row")).toBeNull();
  });

  it("writes the view when the toggle is used", () => {
    render(withQuery(<WorkPile entries={[item()]} renderEntry={() => <div />} />));
    fireEvent.click(screen.getByText("Matrix"));
    expect(window.localStorage.getItem(WORK_VIEW_KEY)).toBe("matrix");
  });
});

describe("pass 97 — chat_url allowlist", () => {
  it("accepts the known chat hosts over https", () => {
    expect(safeChatUrl("https://claude.ai/chat/abc")).toBe("https://claude.ai/chat/abc");
    expect(safeChatUrl("https://chatgpt.com/c/1")).toContain("chatgpt.com");
    expect(safeChatUrl("https://gemini.google.com/app/1")).toContain("gemini.google.com");
  });

  it("rejects javascript:, http and unknown hosts", () => {
    expect(safeChatUrl("javascript:alert(1)")).toBeNull();
    expect(safeChatUrl("http://claude.ai/chat/abc")).toBeNull();
    expect(safeChatUrl("https://evil.example.com/claude.ai")).toBeNull();
    expect(safeChatUrl("not a url")).toBeNull();
    expect(safeChatUrl(undefined)).toBeNull();
  });

  it("labels the link by vendor", () => {
    expect(chatUrlLabel("https://claude.ai/x")).toBe("Open in Claude");
    expect(chatUrlLabel("https://chat.openai.com/x")).toBe("Open in ChatGPT");
  });

  it("renders the link only when a url is stored", () => {
    const { container } = render(<ChatUrlLink item={item()} />);
    expect(container.innerHTML).toBe("");
    cleanup();
    render(<ChatUrlLink item={item({ source_meta: { url: "https://claude.ai/chat/1" } })} />);
    const link = screen.getByRole("link", { name: /Open in Claude/ });
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
  });
});

describe("pass 97 — connect to work", () => {
  it("remembers the workstream per engagement", () => {
    expect(connectStreamKey("e1")).toBe("lasso.connect.stream.e1");
    expect(defaultStream("e1", ["a", "b"])).toBe("a");
    rememberStream("e1", "b");
    expect(defaultStream("e1", ["a", "b"])).toBe("b");
    // A remembered stream that no longer exists falls back to the first.
    expect(defaultStream("e1", ["a", "c"])).toBe("a");
  });

  it("maps through workflow-order and is gated to members", () => {
    const sheet = readFileSync("src/components/engagements/ConnectToWorkSheet.tsx", "utf8");
    expect(sheet).toContain('from "@/lib/workflow-order"');
    expect(sheet).toContain("remapItems(");
    expect(sheet).not.toContain("work_item_tasks");

    const page = readFileSync("src/pages/EngagementPage.tsx", "utf8");
    expect(page).toContain("ConnectToWorkSheet");
    expect(page).toContain('profile.role !== "coach" && membership.data?.isMember');
  });

  it("does not auto-map items that arrive via MCP while the sheet is open", async () => {
    const onChanged = vi.fn();
    const sheetElement = (
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <ConnectToWorkSheet
          engagementId="e1"
          streams={[{ id: "s1", name: "Stream 1" }]}
          profile={{ id: "p1", org_id: "o1" }}
          onChanged={onChanged}
        />
      </QueryClientProvider>
    );

    const { rerender } = render(sheetElement);
    // Open the sheet so the watcher initializes the seen set.
    fireEvent.click(screen.getByText("Connect to work"));

    // Simulate an MCP push and a regular upload arriving while the sheet is open.
    // The MCP item was not brought in through the sheet, so mapping it would be
    // non-consensual. The sheet must only map items from its own import actions.
    mockWorkItems = [
      item({ id: "mcp-item", source: "mcp:claude", visibility: "unmapped" }),
      item({ id: "upload-item", source: "upload", visibility: "unmapped" }),
    ];
    rerender(sheetElement);

    await waitFor(() => expect(remapItems).toHaveBeenCalledTimes(1));
    const call = remapItems.mock.calls[0]?.[0];
    expect(call).toBeDefined();
    expect(call!.targets.map((t: { id: string }) => t.id)).toEqual(["upload-item"]);
    expect(call!.targets.some((t: { source: string }) => t.source.startsWith("mcp:"))).toBe(false);
  });
});
