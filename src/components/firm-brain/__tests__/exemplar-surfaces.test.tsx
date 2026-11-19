// @vitest-environment jsdom
// 19 Nov, Firm Brain Build Spec step 8: the exemplar mark. A small badge on the work, listed first in what a firm
// answer read, set and removed by admins and leads, and never a word about who marked it or whose work it is.
import { readFileSync } from "node:fs";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { FirmAskResult, FirmAskSource } from "@/lib/firm-ask-shared";
import { EXEMPLAR_COPY } from "@/lib/manager-tools-shared";

const m = vi.hoisted(() => ({
  flag: true,
  preview: vi.fn(),
  keepOut: vi.fn(),
  mark: vi.fn(),
  unmark: vi.fn(),
  rows: vi.fn(),
  selected: [] as string[],
  toast: vi.fn(),
}));

vi.mock("@/hooks/use-feature-flag", () => ({ useFeatureFlag: () => m.flag }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("sonner", () => ({ toast: { error: (...a: unknown[]) => m.toast(...a) } }));
vi.mock("@/lib/firm-ask.functions", () => ({
  previewFirmSource: (...a: unknown[]) => m.preview(...a),
  keepOutOfFirmAnswers: (...a: unknown[]) => m.keepOut(...a),
}));
vi.mock("@/lib/manager-tools.functions", () => ({
  markExemplarFn: (...a: unknown[]) => m.mark(...a),
  unmarkExemplarFn: (...a: unknown[]) => m.unmark(...a),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => ({
      select: (columns: string) => {
        m.selected.push(`${table}:${columns}`);
        return { eq: (...a: unknown[]) => m.rows(...a) };
      },
    }),
  },
}));

import { ExemplarBadge } from "@/components/firm-brain/ExemplarBadge";
import { FirmAnswer } from "@/components/firm-brain/FirmAnswer";
import { FirmSourceCard } from "@/components/firm-brain/FirmSourceCard";
import { FirmSourcePreview } from "@/components/firm-brain/FirmSourcePreview";
import { useExemplars } from "@/hooks/use-exemplars";

function client() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}
function wrap(node: ReactNode) {
  return render(<QueryClientProvider client={client()}>{node}</QueryClientProvider>);
}

const source = (over: Partial<FirmAskSource> = {}): FirmAskSource => ({
  title: "Final readout",
  type: "deck",
  date: "2025-06-20",
  boardId: "b5",
  boardTitle: "Weight management service line",
  shownOn: null,
  ...over,
});

const previewOf = (over: Record<string, unknown> = {}) => ({
  title: "Final readout",
  type: "deck",
  date: "2025-06-20",
  boardTitle: "Weight management service line",
  shownOn: null,
  grade: "full",
  text: "The body of the readout.",
  canKeepOut: false,
  exemplar: false,
  canMarkExemplar: true,
  ...over,
});

beforeEach(() => {
  m.flag = true;
  m.selected.length = 0;
  for (const fn of [m.preview, m.keepOut, m.mark, m.unmark, m.rows, m.toast]) fn.mockReset();
});
afterEach(cleanup);

describe("the badge", () => {
  it("says Exemplar, as a design system Badge, with a title that names nobody", () => {
    render(<ExemplarBadge />);
    const badge = document.querySelector("[data-exemplar]")!;
    expect(badge.textContent).toBe("Exemplar");
    expect(badge.getAttribute("title")).toBe(EXEMPLAR_COPY.badgeTitle);
    const file = readFileSync("src/components/firm-brain/ExemplarBadge.tsx", "utf8");
    expect(file).toContain('from "@/components/ui/badge"');
    expect(file).not.toMatch(/marked_by|markedBy|profile/);
  });

  it("is on a marked source in a firm answer, and absent on an unmarked one", () => {
    const { rerender } = render(<FirmSourceCard source={source({ exemplar: true })} grade="quoted" onOpen={() => {}} />);
    expect(document.querySelector("[data-exemplar]")).toBeTruthy();
    rerender(<FirmSourceCard source={source()} grade="quoted" onOpen={() => {}} />);
    expect(document.querySelector("[data-exemplar]")).toBeNull();
  });
});

describe("a firm answer", () => {
  const result: FirmAskResult = {
    status: "answered",
    summary: "A summary.",
    claims: [
      { text: "First claim.", itemId: "i1", boardId: "b5", quote: "q1", grade: "quoted" },
      { text: "Second claim.", itemId: "i2", boardId: "b5", quote: "q2", grade: "quoted" },
    ],
    facts: [],
    nearest: null,
    read: { full: ["i1", "i2", "i3"], summary: [] },
    sources: {
      i1: source({ title: "Plain one" }),
      i2: source({ title: "Marked two", exemplar: true }),
      i3: source({ title: "Plain three" }),
    },
    coverage: "Read 3 engagements shared with the firm.",
    oneSource: false,
  };

  it("lists exemplars first in what it read, and leaves the claims in the order the answer gave them", () => {
    render(<FirmAnswer result={result} onOpenSource={() => {}} />);
    const text = document.body.textContent ?? "";
    expect(text.indexOf("Marked two (")).toBeGreaterThan(-1);
    expect(text.indexOf("Marked two (")).toBeLessThan(text.indexOf("Plain one ("));
    expect(text.indexOf("Plain one (")).toBeLessThan(text.indexOf("Plain three ("));
    expect([...document.querySelectorAll("[data-firm-claim] > p")].map((node) => node.textContent)).toEqual(["First claim.", "Second claim."]);
    expect(document.querySelectorAll("[data-exemplar]")).toHaveLength(1);
  });
});

describe("the source preview", () => {
  const open = () => wrap(<FirmSourcePreview itemId="i1" profileId="p1" onClose={() => {}} />);
  const toggle = () => document.querySelector("[data-exemplar-toggle]") as HTMLButtonElement | null;

  it("shows the badge on marked work and no control to someone who may not mark", async () => {
    m.preview.mockResolvedValue(previewOf({ exemplar: true, canMarkExemplar: false }));
    open();
    await waitFor(() => expect(document.querySelector("[data-exemplar]")).toBeTruthy());
    expect(toggle()).toBeNull();
  });

  it("marks, then reads the preview again", async () => {
    m.preview.mockResolvedValueOnce(previewOf()).mockResolvedValue(previewOf({ exemplar: true }));
    m.mark.mockResolvedValue({ ok: true, exemplar: true });
    open();
    await waitFor(() => expect(toggle()?.textContent).toBe(EXEMPLAR_COPY.mark));
    fireEvent.click(toggle()!);
    await waitFor(() => expect(toggle()?.textContent).toBe(EXEMPLAR_COPY.unmark));
    expect(m.mark).toHaveBeenCalledWith({ data: { item_id: "i1", profile_id: "p1" } });
    expect(document.querySelector("[data-exemplar]")).toBeTruthy();
  });

  it("removes the mark", async () => {
    m.preview.mockResolvedValueOnce(previewOf({ exemplar: true })).mockResolvedValue(previewOf());
    m.unmark.mockResolvedValue({ ok: true, exemplar: false });
    open();
    await waitFor(() => expect(toggle()?.textContent).toBe(EXEMPLAR_COPY.unmark));
    fireEvent.click(toggle()!);
    await waitFor(() => expect(toggle()?.textContent).toBe(EXEMPLAR_COPY.mark));
    expect(m.mark).not.toHaveBeenCalled();
  });

  it("shows the server's plain line when the write is refused, and stays as it was", async () => {
    m.preview.mockResolvedValue(previewOf());
    m.mark.mockResolvedValue({ ok: false, refusal: EXEMPLAR_COPY.refusedNotShared });
    open();
    await waitFor(() => expect(toggle()).toBeTruthy());
    fireEvent.click(toggle()!);
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe(EXEMPLAR_COPY.refusedNotShared));
    expect(toggle()!.textContent).toBe(EXEMPLAR_COPY.mark);
    expect(toggle()!.disabled).toBe(false);
  });

  it("says it did not save when the request fails, without the error's own words", async () => {
    m.preview.mockResolvedValue(previewOf());
    m.mark.mockRejectedValue(new Error("fetch failed 10.0.0.4"));
    open();
    await waitFor(() => expect(toggle()).toBeTruthy());
    fireEvent.click(toggle()!);
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe(EXEMPLAR_COPY.failed));
    expect(document.body.textContent).not.toContain("fetch failed");
  });

  it("sends one request for a double click", async () => {
    let resolve!: (value: { ok: true; exemplar: boolean }) => void;
    m.preview.mockResolvedValue(previewOf());
    m.mark.mockReturnValue(new Promise((yes) => (resolve = yes)));
    open();
    await waitFor(() => expect(toggle()).toBeTruthy());
    fireEvent.click(toggle()!);
    fireEvent.click(toggle()!);
    await waitFor(() => expect(m.mark).toHaveBeenCalledTimes(1));
    resolve({ ok: true, exemplar: true });
    await waitFor(() => expect(toggle()!.disabled).toBe(false));
    expect(m.mark).toHaveBeenCalledTimes(1);
  });

  it("says nothing when a refusal returns after the preview was closed", async () => {
    let resolve!: (value: { ok: false; refusal: string }) => void;
    m.preview.mockResolvedValue(previewOf());
    m.mark.mockReturnValue(new Promise((yes) => (resolve = yes)));
    const queries = client();
    const view = render(<QueryClientProvider client={queries}><FirmSourcePreview itemId="i1" profileId="p1" onClose={() => {}} /></QueryClientProvider>);
    await waitFor(() => expect(toggle()).toBeTruthy());
    fireEvent.click(toggle()!);
    await waitFor(() => expect(m.mark).toHaveBeenCalledTimes(1));
    view.rerender(<QueryClientProvider client={queries}><FirmSourcePreview itemId={null} profileId="p1" onClose={() => {}} /></QueryClientProvider>);
    await act(async () => {
      resolve({ ok: false, refusal: "A late refusal" });
      await Promise.resolve();
    });
    view.rerender(<QueryClientProvider client={queries}><FirmSourcePreview itemId="i2" profileId="p1" onClose={() => {}} /></QueryClientProvider>);
    await waitFor(() => expect(toggle()).toBeTruthy());
    expect(screen.queryByText("A late refusal")).toBeNull();
  });
});

describe("useExemplars, the board's one read", () => {
  const admin = { id: "p1", role: "admin", has_firm_view: true, org_type: "company", is_guest: false };
  const hook = (profile: typeof admin | null) => {
    const queries = client();
    return renderHook(() => useExemplars({ engagementId: "board-1", profile }), {
      wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={queries}>{children}</QueryClientProvider>,
    });
  };

  it("reads the item column alone, once for the board", async () => {
    m.rows.mockResolvedValue({ data: [{ work_item_id: "i1" }], error: null });
    const { result } = hook(admin);
    await waitFor(() => expect(result.current.has("i1")).toBe(true));
    expect(result.current.has("i2")).toBe(false);
    expect(m.selected).toEqual(["firm_exemplars:work_item_id"]);
    expect(m.rows).toHaveBeenCalledWith("engagement_id", "board-1");
  });

  it("is off, and reads nothing, without the flag, for a coach, a guest, or a personal workspace", () => {
    m.flag = false;
    expect(hook(admin).result.current.enabled).toBe(false);
    m.flag = true;
    expect(hook({ ...admin, role: "coach" }).result.current.enabled).toBe(false);
    expect(hook({ ...admin, is_guest: true }).result.current.enabled).toBe(false);
    expect(hook({ ...admin, has_firm_view: false, org_type: "personal" }).result.current.enabled).toBe(false);
    expect(hook(null).result.current.enabled).toBe(false);
    expect(m.rows).not.toHaveBeenCalled();
  });

  it("lets admins and leads mark, and an em only see", async () => {
    m.rows.mockResolvedValue({ data: [], error: null });
    expect(hook(admin).result.current.canMark).toBe(true);
    expect(hook({ ...admin, role: "lead" }).result.current.canMark).toBe(true);
    const em = hook({ ...admin, role: "em" }).result.current;
    expect(em.enabled).toBe(true);
    expect(em.canMark).toBe(false);
  });

  it("shows no marks when the read fails", async () => {
    m.rows.mockResolvedValue({ data: null, error: { message: "permission denied" } });
    const { result } = hook(admin);
    await waitFor(() => expect(m.rows).toHaveBeenCalled());
    expect(result.current.has("i1")).toBe(false);
  });

  it("marks unmarked work, removes the mark from marked work, and reads again", async () => {
    m.rows.mockResolvedValueOnce({ data: [], error: null }).mockResolvedValue({ data: [{ work_item_id: "i1" }], error: null });
    m.mark.mockResolvedValue({ ok: true, exemplar: true });
    m.unmark.mockResolvedValue({ ok: true, exemplar: false });
    const { result } = hook(admin);
    await waitFor(() => expect(m.rows).toHaveBeenCalledTimes(1));
    await act(() => result.current.toggle("i1"));
    expect(m.mark).toHaveBeenCalledWith({ data: { item_id: "i1", engagement_id: "board-1", profile_id: "p1" } });
    await waitFor(() => expect(result.current.has("i1")).toBe(true));
    await act(() => result.current.toggle("i1"));
    expect(m.unmark).toHaveBeenCalledTimes(1);
    expect(m.toast).not.toHaveBeenCalled();
  });

  it("shows one plain line for a refusal and for a failure", async () => {
    m.rows.mockResolvedValue({ data: [], error: null });
    m.mark.mockResolvedValueOnce({ ok: false, refusal: EXEMPLAR_COPY.refusedNotShared }).mockRejectedValueOnce(new Error("boom 10.0.0.4"));
    const { result } = hook(admin);
    await waitFor(() => expect(m.rows).toHaveBeenCalled());
    await act(() => result.current.toggle("i1"));
    await act(() => result.current.toggle("i1"));
    expect(m.toast.mock.calls).toEqual([[EXEMPLAR_COPY.refusedNotShared], [EXEMPLAR_COPY.failed]]);
  });

  it("sends one request for a double click", async () => {
    let resolve!: (value: { ok: true; exemplar: boolean }) => void;
    m.rows.mockResolvedValue({ data: [], error: null });
    m.mark.mockReturnValue(new Promise((yes) => (resolve = yes)));
    const { result } = hook(admin);
    await waitFor(() => expect(m.rows).toHaveBeenCalled());
    let first!: Promise<void>;
    act(() => {
      first = result.current.toggle("i1");
      void result.current.toggle("i1");
    });
    expect(m.mark).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolve({ ok: true, exemplar: true });
      await first;
    });
  });
});
