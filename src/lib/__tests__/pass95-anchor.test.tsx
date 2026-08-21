// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { validateAnalysisInput } from "@/lib/analysis.functions";
import { analysisIdempotencyKey } from "@/lib/analysis-key";
import {
  COMPANION_COLUMNS,
  COMPANION_ORDER_COLUMN,
  fetchEngagementCompanions,
} from "@/lib/analysis-companions";

afterEach(cleanup);

// ---------------------------------------------------------------- companions

describe("pass 95 companions query", () => {
  it("orders by a column work_items actually has", async () => {
    expect(COMPANION_ORDER_COLUMN).toBe("captured_at");
    expect(COMPANION_COLUMNS).not.toContain("created_at");
  });

  it("selects and orders on real columns", async () => {
    const seen: { select: string[]; order: string[] } = { select: [], order: [] };
    function chain(data: unknown) {
      const c: Record<string, unknown> = {};
      c["select"] = (cols: string) => {
        seen.select.push(cols);
        return c;
      };
      c["eq"] = () => c;
      c["in"] = () => c;
      c["limit"] = () => c;
      c["order"] = (col: string) => {
        seen.order.push(col);
        return c;
      };
      c["then"] = (resolve: (v: unknown) => unknown) =>
        Promise.resolve({ data, error: null }).then(resolve);
      return c;
    }
    const supabase = {
      from: (table: string) => {
        if (table === "work_item_tasks") {
          return chain([{ tasks: { engagement_id: "eng-1" }, work_item_id: "other-1" }]);
        }
        if (table === "tasks") return chain([{ id: "task-1" }]);
        return chain([{ id: "other-1", title: "Transcript", type: "ai_thread" }]);
      },
    } as never;
    const rows = await fetchEngagementCompanions(supabase, "item-1");
    expect(rows.map((r) => r.id)).toEqual(["other-1"]);
    expect(seen.order).toEqual(["captured_at"]);
    expect(seen.select.some((cols) => cols.includes("created_at"))).toBe(false);
  });
});

// ------------------------------------------------------------------ the key

describe("pass 95 idempotency key", () => {
  const base = { presetId: "firm_checks", scopeType: "deliverable" as const, profileId: "p-1" };

  it("changes with the anchor", () => {
    expect(analysisIdempotencyKey({ ...base, scopeId: "a" })).not.toBe(
      analysisIdempotencyKey({ ...base, scopeId: "b" }),
    );
  });

  it("changes with the extras and ignores their order", () => {
    const one = analysisIdempotencyKey({ ...base, scopeId: "a", extraIds: ["x", "y"] });
    const two = analysisIdempotencyKey({ ...base, scopeId: "a", extraIds: ["y", "x"] });
    expect(one).toBe(two);
    expect(one).not.toBe(analysisIdempotencyKey({ ...base, scopeId: "a" }));
    expect(one).toContain(":with:x,y");
  });

  it("drops extras for engagement runs", () => {
    expect(
      analysisIdempotencyKey({
        ...base,
        scopeType: "engagement",
        scopeId: "eng-1",
        extraIds: ["x"],
      }),
    ).not.toContain(":with:");
  });
});

// ------------------------------------------------------------- the validator

describe("pass 95 validator", () => {
  it("caps extra work at sixty ids", () => {
    const ids = Array.from({ length: 61 }, (_, i) => `id-${i}`);
    expect(() =>
      validateAnalysisInput({ preset_id: "firm_checks", work_item_id: "a", extra_item_ids: ids }),
    ).toThrow(/too much work/);
    expect(
      validateAnalysisInput({
        preset_id: "firm_checks",
        work_item_id: "a",
        extra_item_ids: ids.slice(0, 60),
      }).extra_item_ids,
    ).toHaveLength(60);
  });
});

// ----------------------------------------------------------- the confirm step

const ITEMS: Record<string, { id: string; title: string; type: string; meta: unknown }> = {
  deck: { id: "deck", title: "Board deck", type: "deck", meta: {} },
  deck2: { id: "deck2", title: "Pricing deck", type: "deck", meta: {} },
  thread: { id: "thread", title: "Claude transcript", type: "ai_thread", meta: {} },
};

vi.mock("@/integrations/supabase/client", () => {
  const row = (id: string) => ({ ...ITEMS[id], source: "upload", source_vendor: null, source_meta: null, content_ref: null });
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
              ? [row("thread"), row("deck2")]
              : [];
      return Promise.resolve({ data, error: null }).then(resolve);
    };
    return c;
  }
  return {
    supabase: { from: (table: string) => chain(table, { value: null }) as never },
  };
});

vi.mock("@/hooks/use-firm-checks", () => ({ useFirmChecks: () => ({ data: [] }) }));
vi.mock("@/hooks/use-briefs", () => ({ useBriefs: () => ({ data: [] }) }));
vi.mock("@/hooks/use-deliverable-kind", () => ({
  setDeliverableKind: async () => undefined,
  useInvalidateWorkItems: () => () => undefined,
}));

const { AnalysisConfirm } = await import("@/components/reflect/AnalysisConfirm");
const { ANALYSIS_PRESETS } = await import("@/lib/analysis-presets");
const preset = ANALYSIS_PRESETS.find((p) => p.id === "firm_checks") ?? ANALYSIS_PRESETS[0]!;

function renderConfirm(
  extra: Partial<Parameters<typeof AnalysisConfirm>[0]["request"] & object>,
  onConfirm: (anchor: string | null, extras: string[]) => void,
) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AnalysisConfirm
        request={{
          preset,
          target: { kind: "item", id: "deck", title: "Board deck", scope: "deliverable" },
          ...extra,
        }}
        orgId="org-1"
        profileId="p-1"
        onCancel={() => undefined}
        onConfirm={onConfirm}
      />
    </QueryClientProvider>,
  );
}

describe("pass 95 anchor chooser", () => {
  it("swaps the anchor the run is sent for", async () => {
    const calls: Array<[string | null, string[]]> = [];
    renderConfirm(
      {
        anchorOptions: [
          { id: "deck", title: "Board deck", type: "deck" },
          { id: "deck2", title: "Pricing deck", type: "deck" },
        ] as never,
      },
      (anchor, extras) => calls.push([anchor, extras]),
    );
    fireEvent.click(await screen.findByTestId("anchor-change"));
    fireEvent.click(await screen.findByText("Pricing deck"));
    fireEvent.click(screen.getByRole("button", { name: "Run analysis" }));
    await waitFor(() => expect(calls.length).toBe(1));
    expect(calls[0]?.[0]).toBe("deck2");
    expect(calls[0]?.[1]).toContain("deck");
  });

  it("ticks only the picker's selection when one is given", async () => {
    const calls: Array<[string | null, string[]]> = [];
    renderConfirm({ preselectedIds: ["deck", "thread"] }, (anchor, extras) =>
      calls.push([anchor, extras]),
    );
    await screen.findByTestId("confirm-context-block");
    fireEvent.click(screen.getByRole("button", { name: "Run analysis" }));
    await waitFor(() => expect(calls.length).toBe(1));
    expect(calls[0]?.[1].sort()).toEqual(["thread"]);
  });

  it("ticks every companion when no selection is given", async () => {
    const calls: Array<[string | null, string[]]> = [];
    renderConfirm({}, (anchor, extras) => calls.push([anchor, extras]));
    await screen.findByTestId("confirm-context-block");
    fireEvent.click(screen.getByRole("button", { name: "Run analysis" }));
    await waitFor(() => expect(calls.length).toBe(1));
    expect(calls[0]?.[1].sort()).toEqual(["deck2", "thread"]);
  });
});
