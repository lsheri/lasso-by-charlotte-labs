// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AnalysisConfirm } from "@/components/reflect/AnalysisConfirm";
import { ANALYSIS_PRESETS } from "@/lib/analysis-presets";
import { TITLE_ONLY_LINE } from "@/lib/text-status";

const unreadItem = {
  id: "item-1",
  title: "Q3 pricing model.xlsx",
  type: "document",
  source: "upload",
  source_vendor: null,
  source_meta: null,
  meta: { text_status: "unreadable", text_error: "no text layer" },
  content_ref: "files/one.xlsx",
};

vi.mock("@/integrations/supabase/client", () => {
  const result = (data: unknown, single?: unknown) => {
    const chain: Record<string, unknown> = {};
    for (const key of ["select", "eq", "in", "limit", "order"]) {
      chain[key] = () => chain;
    }
    chain["maybeSingle"] = async () => ({ data: single ?? data, error: null });
    chain["then"] = (resolve: (v: unknown) => unknown) => Promise.resolve({ data, error: null }).then(resolve);
    return chain;
  };
  return {
    supabase: {
      from: (table: string) => {
        if (table === "work_items") {
          // Item lookup and the engagement unread scan share this table; both
          // answers describe the same unreadable file.
          return result([unreadItem], unreadItem) as never;
        }
        if (table === "work_item_tasks") return result([{ work_item_id: "item-1" }]) as never;
        return result([]) as never;
      },
    },
  };
});

vi.mock("@/hooks/use-firm-checks", () => ({ useFirmChecks: () => ({ data: [] }) }));
vi.mock("@/hooks/use-briefs", () => ({ useBriefs: () => ({ data: [] }) }));
vi.mock("@/hooks/use-deliverable-kind", () => ({
  setDeliverableKind: async () => undefined,
  useInvalidateWorkItems: () => () => undefined,
}));

function renderConfirm(target: Parameters<typeof AnalysisConfirm>[0]["request"]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AnalysisConfirm
        request={target}
        orgId="org-1"
        profileId="p-1"
        onCancel={() => undefined}
        onConfirm={() => undefined}
      />
    </QueryClientProvider>,
  );
}

const preset = ANALYSIS_PRESETS[0]!;

describe("AnalysisConfirm with an unread item", () => {
  it("marks a single unreadable item as title only", async () => {
    renderConfirm({
      preset,
      target: { kind: "item", id: "item-1", title: unreadItem.title, scope: "thread" },
    });
    expect(await screen.findByText(TITLE_ONLY_LINE)).toBeTruthy();
  });

  it("drops the unreadable item from the engagement count", async () => {
    renderConfirm({
      preset,
      target: { kind: "engagement", id: "eng-1", title: "Pricing review", itemCount: 3 },
    });
    expect(await screen.findByText("(2 pieces of work mapped into this engagement)")).toBeTruthy();
    expect(
      await screen.findByText("1 more is title only, its contents could not be read."),
    ).toBeTruthy();
  });
});
