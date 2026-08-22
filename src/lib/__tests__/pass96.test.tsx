// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveAnalysisTarget } from "@/lib/analysis-scope.server";

afterEach(cleanup);

// ------------------------------------------------------------------- prompts

describe("pass 96 output discipline", () => {
  it("appends the discipline block to every analysis prompt", async () => {
    const { ANALYSIS_PRESETS } = await import("@/lib/analysis-presets");
    for (const preset of ANALYSIS_PRESETS) {
      expect(preset.systemPrompt).toContain("OUTPUT DISCIPLINE");
    }
  });

  it("stops firm checks echoing the coach's check text", async () => {
    const { ANALYSIS_PRESETS } = await import("@/lib/analysis-presets");
    const checks = ANALYSIS_PRESETS.find((p) => p.id === "firm_checks");
    expect(checks?.systemPrompt).not.toContain("quoted exactly as the coach wrote it");
    expect(checks?.systemPrompt).toContain("TITLE only");
  });

  it("gives Reflect and the coach chat an answer contract", async () => {
    const { REFLECT_SYSTEM_PROMPT } = await import("@/lib/reflect-shared");
    const { COACH_CHAT_SYSTEM_PROMPT } = await import("@/lib/coach-chat-shared");
    expect(REFLECT_SYSTEM_PROMPT).toContain("answers the question directly");
    expect(COACH_CHAT_SYSTEM_PROMPT).toContain("answers the question directly");
    // Honesty rules stay untouched.
    expect(REFLECT_SYSTEM_PROMPT).toContain("ABSOLUTE RULE ON UNREAD FILES");
  });
});

// -------------------------------------------------------------- server guard

describe("pass 96 thread guard", () => {
  it("ignores extra item ids for a thread run", async () => {
    const supabase = {
      from: () => {
        const c: Record<string, unknown> = {};
        for (const key of ["select", "eq", "in", "limit", "order"]) c[key] = () => c;
        c["maybeSingle"] = async () => ({
          data: { id: "thread", title: "Transcript", owner_id: "p-1", meta: {} },
          error: null,
        });
        c["then"] = (resolve: (v: unknown) => unknown) =>
          Promise.resolve({ data: [{ id: "extra" }], error: null }).then(resolve);
        return c;
      },
    } as never;
    const target = await resolveAnalysisTarget(supabase, {
      scope: "thread",
      profileId: "p-1",
      workItemId: "thread",
      extraItemIds: ["extra"],
    });
    expect(target.extraIds).toEqual([]);
    expect(target.scope.ids).toEqual(["thread"]);
  });
});

// ------------------------------------------------------------- confirm shape

const ITEMS: Record<string, { id: string; title: string; type: string; meta: unknown }> = {
  deck: { id: "deck", title: "Board deck", type: "deck", meta: {} },
  thread: { id: "thread", title: "Claude transcript", type: "ai_thread", meta: {} },
  doc: { id: "doc", title: "Pricing memo", type: "document", meta: {} },
};

vi.mock("@/integrations/supabase/client", () => {
  const row = (id: string) => ({
    ...ITEMS[id],
    source: "upload",
    source_vendor: null,
    source_meta: null,
    content_ref: null,
  });
  function chain(table: string, filterId: { value: string | null }) {
    const c: Record<string, unknown> = {};
    for (const key of ["select", "in", "limit", "order"]) c[key] = () => c;
    c["eq"] = (_col: string, value: string) => {
      filterId.value = value;
      return c;
    };
    c["maybeSingle"] = async () => ({ data: row(filterId.value as string), error: null });
    c["then"] = (resolve: (v: unknown) => unknown) => {
      const data =
        table === "work_item_tasks"
          ? [{ tasks: { engagement_id: "eng-1" }, work_item_id: "thread" }]
          : table === "tasks"
            ? [{ id: "task-1" }]
            : table === "work_items"
              ? // The doc comes back first; the confirm list must still put the
                // conversation above it.
                [row("doc"), row("thread")]
              : [];
      return Promise.resolve({ data, error: null }).then(resolve);
    };
    return c;
  }
  return { supabase: { from: (table: string) => chain(table, { value: null }) as never } };
});

vi.mock("@/hooks/use-firm-checks", () => ({ useFirmChecks: () => ({ data: [] }) }));
vi.mock("@/hooks/use-briefs", () => ({ useBriefs: () => ({ data: [] }) }));
vi.mock("@/hooks/use-deliverable-kind", () => ({
  setDeliverableKind: async () => undefined,
  useInvalidateWorkItems: () => () => undefined,
}));

const { AnalysisConfirm } = await import("@/components/reflect/AnalysisConfirm");
const { ANALYSIS_PRESETS } = await import("@/lib/analysis-presets");
const presetFor = (id: string) => ANALYSIS_PRESETS.find((p) => p.id === id)!;

function renderConfirm(
  preset: (typeof ANALYSIS_PRESETS)[number],
  target: Parameters<typeof AnalysisConfirm>[0]["request"] extends infer _R
    ? { kind: "item"; id: string; title: string; scope: "thread" | "deliverable" }
    : never,
  onConfirm: (anchor: string | null, extras: string[]) => void = () => undefined,
) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AnalysisConfirm
        request={{ preset, target }}
        orgId="org-1"
        profileId="p-1"
        onCancel={() => undefined}
        onConfirm={onConfirm}
      />
    </QueryClientProvider>,
  );
}

describe("pass 96 confirm shapes", () => {
  it("shows one conversation and no context list for a thread analysis", async () => {
    const calls: Array<[string | null, string[]]> = [];
    renderConfirm(
      presetFor("ai_fluency_4d"),
      { kind: "item", id: "thread", title: "Claude transcript", scope: "thread" },
      (anchor, extras) => calls.push([anchor, extras]),
    );
    expect(await screen.findByText("The conversation")).toBeTruthy();
    expect(screen.queryByTestId("confirm-context-block")).toBeNull();
    expect(screen.queryByTestId("anchor-change")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Run analysis" }));
    await waitFor(() => expect(calls.length).toBe(1));
    expect(calls[0]?.[1]).toEqual([]);
  });

  it("always shows the record behind a deliverable, conversations first", async () => {
    renderConfirm(presetFor("firm_checks"), {
      kind: "item",
      id: "deck",
      title: "Board deck",
      scope: "deliverable",
    });
    expect(await screen.findByText("The record behind it (2)")).toBeTruthy();
    expect(screen.queryByText("Choose what to include")).toBeNull();
    const boxes = await screen.findAllByRole("checkbox");
    expect(boxes.map((box) => box.getAttribute("aria-label"))).toEqual([
      "Claude transcript",
      "Pricing memo",
    ]);
  });

  it("labels the list as candidates for what fed this", async () => {
    renderConfirm(presetFor("what_fed_this"), {
      kind: "item",
      id: "deck",
      title: "Board deck",
      scope: "deliverable",
    });
    expect(await screen.findByText("Candidates it checks for links (2)")).toBeTruthy();
  });
});
