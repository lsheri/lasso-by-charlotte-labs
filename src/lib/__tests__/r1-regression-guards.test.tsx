// @vitest-environment jsdom
/**
 * R1: regression guards for what last night's units touched in shared files.
 * Each guard pins behaviour that existed before those units. Render and drive.
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpcRows: [] as unknown[],
  upload: vi.fn(async () => ({ error: null })),
  createSignedUrl: vi.fn(async (path: string, seconds: number) => ({ data: { signedUrl: `https://signed.test/${path}?t=${seconds}` }, error: null })),
  bucket: vi.fn(),
  logEvent: vi.fn(),
  toast: vi.fn(),
  seq: 0,
}));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    rpc: vi.fn(async (name: string) => (name === "mcp_resolve_key" ? { data: mocks.rpcRows, error: null } : { data: null, error: null })),
    from: vi.fn(),
  },
}));
vi.mock("@/lib/telemetry.server", () => ({ recordEvent: vi.fn() }));

function chain(result: unknown): Record<string, unknown> {
  const c: Record<string, unknown> = {};
  for (const m of ["select", "eq", "order", "insert", "update", "in", "limit"]) c[m] = () => c;
  c["maybeSingle"] = async () => ({ data: { id: `w${++mocks.seq}` }, error: null });
  c["then"] = (resolve: (v: unknown) => unknown) => resolve(result);
  return c;
}
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
    storage: { from: (name: string) => { mocks.bucket(name); return { upload: mocks.upload, createSignedUrl: mocks.createSignedUrl, remove: vi.fn(async () => ({ error: null })) }; } },
    from: () => chain({ data: [], error: null }),
  },
}));
vi.mock("sonner", () => ({ toast: Object.assign((m: string) => mocks.toast(m), { error: (m: string) => mocks.toast(m) }) }));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: vi.fn(async () => {}) }) }));
vi.mock("@tanstack/react-start", async (importOriginal) => ({ ...(await importOriginal<object>()), useServerFn: () => vi.fn(async () => ({})) }));
vi.mock("@/hooks/use-profile", () => ({ useProfile: () => ({ data: { id: "p1", org_id: "o1" } }) }));
vi.mock("@/lib/extract.functions", () => ({ ensureExtractsFn: {} }));
vi.mock("@/lib/work-taxonomy.functions", () => ({ noteCaptureFn: {} }));
vi.mock("@/lib/telemetry", () => ({ logEvent: (...a: unknown[]) => mocks.logEvent(...a) }));
vi.mock("@/lib/telemetry-v2", () => ({ logV2: vi.fn() }));
vi.mock("@/lib/client-telemetry", () => ({ emitClientEvent: vi.fn() }));
vi.mock("@/components/work/ThreadViewerById", () => ({ ThreadViewerById: () => null }));
vi.mock("@/components/reflect/LassoThinkingMark", () => ({
  LassoThinkingMark: ({ kind, size }: { kind: string; size: number }) => <span data-lasso-thinking-mark={kind} data-size={size} />,
}));

import { Route as LinkRoute } from "@/routes/api/mcp.$token";
import { handleHeaderMcp } from "@/lib/mcp-header.server";
import { LabCard } from "@/components/canvas-lab/LabCard";
import { LabSticky } from "@/components/canvas-lab/LabSticky";
import { LabTextBlock } from "@/components/canvas-lab/LabTextBlock";
import { applyDurableBoard, type LabNode } from "@/components/canvas-lab/canvas-lab-model";
import { serializeWorkboardStickyBody, serializeWorkboardTextBody, type WorkboardDto, type WorkboardNodeInput } from "@/lib/canvas-lab-shared";
import { validNodeInput } from "@/lib/canvas-lab.server";
import { ThinkingTrail } from "@/components/reflect/ContextTrail";
import { BoardFileDropOverlay, useBoardFileDrop } from "@/components/canvas-lab/board-file-drop";
import { loadWorkboardFilePreview } from "@/hooks/use-workboard-file-previews";
import type { ContextManifest } from "@/lib/context-manifest";
import type { WorkItemRow } from "@/lib/work-types";

const noop = () => undefined;

describe("R1 regression guards", () => {
  beforeEach(() => {
    globalThis.ResizeObserver = class { observe() {} disconnect() {} unobserve() {} } as unknown as typeof ResizeObserver;
    mocks.rpcRows = [];
    mocks.upload.mockClear();
    mocks.createSignedUrl.mockClear();
    mocks.bucket.mockClear();
    mocks.logEvent.mockClear();
    mocks.toast.mockClear();
  });
  afterEach(cleanup);

  it("1. the link route answers a bad key with a plain 401 and no WWW-Authenticate", async () => {
    const handlers = (LinkRoute.options as unknown as { server: { handlers: { POST: (ctx: { request: Request; params: { token: string } }) => Promise<Response> } } }).server.handlers;
    const request = new Request("https://lasso.charlotte-labs.com/api/mcp/not-a-key", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
    });
    const response = await handlers.POST({ request, params: { token: "not-a-key" } });
    expect(response.status).toBe(401);
    expect(response.headers.get("WWW-Authenticate")).toBeNull();
  });

  it("2. the header route passes a good key's response through untouched", async () => {
    const good = new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: { ok: true } }), { status: 200, headers: { "content-type": "application/json", "x-mark": "handler" } });
    const handleMcpRequest = vi.fn(async () => good);
    const response = await handleHeaderMcp(
      new Request("https://x.test/api/mcp", { method: "POST", headers: { authorization: "Bearer good-key" } }),
      async () => ({ CORS_HEADERS: {}, handleMcpRequest }),
    );
    expect(handleMcpRequest).toHaveBeenCalledWith(expect.any(Request), "good-key", "header");
    expect(response).toBe(good);
    expect(response.status).toBe(200);
    expect(response.headers.get("WWW-Authenticate")).toBeNull();
  });

  it("3. a work_item node with a work_item_id still renders its card", () => {
    const virtual: LabNode = { id: "work:wi1", kind: "work_item", workItemId: "wi1", frame: null, title: "Pricing memo", summary: "Draft pricing", typeLabel: "document", ownership: "yours", x: 0, y: 0, width: 232, height: 112 } as LabNode;
    const input: WorkboardNodeInput = { clientKey: "c1", frameKey: null, kind: "work_item", workItemId: "wi1", x: 0, y: 0, w: 232, h: 112 };
    expect(validNodeInput(input)).toBeNull();
    const board = {
      id: "b", engagementId: "e", version: 1, frames: [], links: [], viewerProfileId: "p", canEditStructure: true, archivedContextFrame: null,
      nodes: [{ id: "n1", frameId: null, kind: "work_item", workItemId: "wi1", decisionId: null, authorProfileId: "p", authorName: "Liam", title: "", body: "", judgmentType: null, x: 40, y: 50, w: 240, h: 120, hidden: false, version: 1, referenceReadable: true }],
    } satisfies WorkboardDto;
    const node = applyDurableBoard({ frames: [], nodes: [virtual] }, board).nodes.find((entry) => entry.id === "work:wi1");
    expect(node?.kind).toBe("work_item");
    expect([node?.x, node?.y, node?.durableId]).toEqual([40, 50, "n1"]);
    render(<LabCard node={node!} selected={false} focused={false} connecting={false} connectSourceAnchor={null} canResize onSelect={noop} onOpen={noop} onBranch={noop} onHide={noop} onDelete={noop} onEdit={noop} onEditCommitted={noop} onAnchorPointerDown={noop} onAnchorActivate={noop} onMenuOpened={noop} onMenuOpenChange={noop} onMeasure={noop} onPointerDown={noop} onFocus={noop} onKeyDown={noop} onResizeStart={noop} onResizeKeyDown={noop} onResizeKeyUp={noop} onFit={noop} frameChoices={[]} structured={false} onMoveToFrame={noop} />);
    expect(screen.getAllByText("Pricing memo").length).toBeGreaterThan(0);
  });

  it("4. a sticky and a text node still insert and render", () => {
    const stickyBody = { text: "check the 18%", size: "body", weight: "regular", colour: "ink", fill: "yellow" } as const;
    const textBody = { text: "Open questions", size: "label", weight: "medium", colour: "ink" } as const;
    expect(validNodeInput({ clientKey: "s1", frameKey: null, kind: "sticky", body: serializeWorkboardStickyBody(stickyBody), x: 0, y: 0, w: 200, h: 140 })).toBeNull();
    expect(validNodeInput({ clientKey: "t1", frameKey: null, kind: "text", body: serializeWorkboardTextBody(textBody), x: 0, y: 0, w: 240, h: 60 })).toBeNull();
    const board = {
      id: "b", engagementId: "e", version: 1, frames: [], links: [], viewerProfileId: "p", canEditStructure: true, archivedContextFrame: null,
      nodes: [
        { id: "s1", frameId: null, kind: "sticky", workItemId: null, decisionId: null, authorProfileId: "p", authorName: "Liam", title: "", body: serializeWorkboardStickyBody(stickyBody), judgmentType: null, x: 5, y: 6, w: 200, h: 140, hidden: false, version: 1, referenceReadable: true },
        { id: "t1", frameId: null, kind: "text", workItemId: null, decisionId: null, authorProfileId: "p", authorName: "Liam", title: "", body: serializeWorkboardTextBody(textBody), judgmentType: null, x: 9, y: 9, w: 240, h: 60, hidden: false, version: 1, referenceReadable: true },
      ],
    } satisfies WorkboardDto;
    const nodes = applyDurableBoard({ frames: [], nodes: [] }, board).nodes;
    const sticky = nodes.find((n) => n.kind === "sticky");
    const text = nodes.find((n) => n.kind === "text");
    expect(sticky?.summary).toBe("check the 18%");
    expect(text?.summary).toBe("Open questions");
    const props = { selected: false, editable: true, layoutEditable: true, onSelect: noop, onDragStart: noop, onResizeStart: noop, onResizeKeyDown: noop, onResizeKeyUp: noop, onChange: noop, onCommit: noop, onRemove: noop };
    render(<><LabSticky node={sticky!} {...props} /><LabTextBlock node={text!} {...props} /></>);
    expect(screen.getByDisplayValue("check the 18%")).toBeTruthy();
    expect(screen.getByDisplayValue("Open questions")).toBeTruthy();
  });

  it("5. ThinkingTrail without the ask setting keeps its own header and original foot", () => {
    const manifest: ContextManifest = {
      engagement: { id: "e1", name: "Northstar" },
      brief_included: true,
      firm_checks_applied: 2,
      items: [
        { id: "r1", title: "Interview notes", kind: "note", detail: "420 words" },
        { id: "r2", title: "Working deck", kind: "deck", detail: "8 slides" },
      ],
      excluded: [],
      assembled_at: "2026-09-22T08:00:00.000Z",
    };
    const { container, unmount } = render(<ThinkingTrail items={[]} finalPhase="Writing…" manifest={manifest} />);
    expect(screen.getByText("Read 2 pieces of work, the brief, 2 firm checks")).toBeTruthy();
    expect(screen.getByText("Writing…")).toBeTruthy();
    expect(container.querySelector('[data-lasso-thinking-mark="loop"][data-size="20"]')).not.toBeNull();
    expect(screen.queryByTestId("ask-thinking-foot")).toBeNull();
    unmount();
    render(<ThinkingTrail items={[{ id: "a", title: "A" }]} finalPhase="Writing…" />);
    expect(screen.getByText("Reading your work")).toBeTruthy();
    expect(screen.queryByTestId("ask-thinking-glyph")).toBeNull();
  });

  it("6. a pdf and a docx dropped together each go through capture and fire workitem.captured", async () => {
    const place = vi.fn();
    const placeImage = vi.fn(async () => true);
    function Harness() {
      const drop = useBoardFileDrop({ enabled: true, toBoard: (x, y) => ({ x, y }), place, placeImage });
      return <div data-testid="shell" {...drop.handlers}><BoardFileDropOverlay show={drop.over} pointer={drop.pointer} dropBurst={drop.dropBurst} clearSignal={drop.clearSignal} /></div>;
    }
    render(<Harness />);
    const pdf = new File(["x"], "memo.pdf", { type: "application/pdf" });
    const docx = new File(["x"], "notes.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    fireEvent.drop(screen.getByTestId("shell"), { clientX: 1, clientY: 1, dataTransfer: { types: ["Files"], files: [pdf, docx] } });
    await waitFor(() => expect(place).toHaveBeenCalled());
    const uploaded = mocks.upload.mock.calls.map((call) => (call as unknown[])[1]);
    expect(uploaded).toHaveLength(2);
    expect(uploaded).toContain(pdf);
    expect(uploaded).toContain(docx);
    expect(placeImage).not.toHaveBeenCalled();
    const captured = mocks.logEvent.mock.calls.filter((call) => call[0] === "workitem.captured");
    expect(captured).toHaveLength(2);
    for (const call of captured) expect(call[2]).toEqual(expect.objectContaining({ channel: "drop" }));
  });

  it("7. loadWorkboardFilePreview still resolves a signed pdf url with the same shape", async () => {
    const item: WorkItemRow = { id: "wi9", title: "Report", type: "document", source: "upload", visibility: "mapped", captured_at: "2026-09-20T00:00:00Z", content_ref: "u1/abc-report.pdf", work_item_tasks: [] };
    const preview = await loadWorkboardFilePreview(item, "p1", async () => ({ text: null }));
    expect(mocks.bucket).toHaveBeenCalledWith("work-files");
    expect(mocks.createSignedUrl).toHaveBeenCalledWith("u1/abc-report.pdf", 600);
    expect(preview).toEqual({ workItemId: "wi9", kind: "pdf", url: "https://signed.test/u1/abc-report.pdf?t=600", lines: [], slideTitle: null, versionCount: 0 });
  });
});
