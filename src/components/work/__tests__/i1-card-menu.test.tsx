// @vitest-environment jsdom
import { readFileSync } from "node:fs";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WorkRow } from "@/components/work/WorkRow";
import type { WorkItemRow } from "@/lib/work-types";

vi.mock("@/hooks/use-note-live", () => ({ useNoteLive: () => ({ current: null }) }));
vi.mock("@/hooks/use-profile", () => ({
  useProfile: () => ({ data: { id: "p1", org_id: "o1", role: "consultant" } }),
}));
vi.mock("@/components/decisions/DraftDecisionsButton", () => ({
  useDraftDecisions: () => ({ busy: false, draft: vi.fn() }),
}));
vi.mock("@/components/work/MarkBriefDialog", () => ({ MarkBriefDialog: () => null }));
vi.mock("@/components/work/DeleteWorkItemDialog", () => ({
  DeleteWorkItemDialog: () => null,
  DELETE_LABEL: "Delete this",
}));
vi.mock("@/components/work/RemoveFromEngagementDialog", () => ({
  RemoveFromEngagementDialog: () => null,
  REMOVE_LABEL: "Take it off",
  REMOVE_HELP: "help",
}));

const ITEM = {
  id: "w1",
  title: "Cure First pricing memo",
  type: "document",
  source: "import:manual",
  source_vendor: null,
  visibility: "unmapped",
  client_id: null,
  content_fidelity: "verbatim",
  content_ref: null,
  work_date: "2026-04-02",
  created_at_source: null,
  captured_at: "2026-04-02T10:00:00Z",
  meta: {},
  work_item_tasks: [],
} as unknown as WorkItemRow;

/** Classes that make an element invisible, and so zero-sized, until hover or focus. */
const HOVER_GATED = ["group-hover", "group-focus-within", "md:hidden", "peer-hover"];

function renderCard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <WorkRow item={ITEM} dense actions={<button type="button">Work date</button>} />
    </QueryClientProvider>,
  );
}

afterEach(cleanup);

describe("I1 the Inbox card menu", () => {
  it("renders the trigger at rest and keeps it measurable while the menu is open", () => {
    renderCard();
    const trigger = screen.getByTestId("card-menu-trigger");
    expect(trigger).toBeTruthy();

    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
    fireEvent.click(trigger);

    // Still in the document, so it still has a box to anchor against.
    expect(screen.getByTestId("card-menu-trigger")).toBe(trigger);
    expect(trigger.isConnected).toBe(true);
    expect(trigger.hasAttribute("hidden")).toBe(false);
  });

  it("renders the trigger outside every hover-gated container", () => {
    renderCard();
    let node: HTMLElement | null = screen.getByTestId("card-menu-trigger");
    while (node) {
      const classes = node.className;
      if (typeof classes === "string") {
        for (const gate of HOVER_GATED) {
          expect(classes.includes(gate)).toBe(false);
        }
      }
      node = node.parentElement;
    }
  });

  it("leaves no hover-revealed action bar in the dense card", () => {
    const source = readFileSync("src/components/work/WorkRow.tsx", "utf8");
    const dense = source.slice(source.indexOf("if (dense)"), source.indexOf("return (\n    <div"));
    for (const gate of HOVER_GATED) expect(dense.includes(gate)).toBe(false);
  });

  it("carries no hover tooltip on the card title", () => {
    const source = readFileSync("src/components/work/WorkNote.tsx", "utf8");
    expect(source).not.toMatch(/<p[^>]*title=\{item\.title\}/);
  });
});
