// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Trail } from "@/lib/trail-shared";

const trailResult: { value: Trail } = { value: { madeFrom: [], usedIn: [], decisions: [], leadsWith: "made" } };
vi.mock("@/hooks/use-vendor-display", () => ({ useVendorVisible: () => true }));
vi.mock("@/lib/telemetry", () => ({ logEvent: vi.fn() }));
vi.mock("@/lib/trail.functions", () => ({ getTrail: vi.fn() }));
vi.mock("@/lib/lineage.functions", () => ({ getDeliverableEvidence: vi.fn(), draftLineage: vi.fn(), reviewLink: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: () => async () => trailResult.value }));

import { LiftedWork } from "@/components/canvas-lab/LiftedWork";
import { LiftedTrail, TRAIL_COPY } from "@/components/canvas-lab/LiftedTrail";
import { trailDecisions } from "@/lib/trail-shared";

afterEach(() => {
  cleanup();
  trailResult.value = { madeFrom: [], usedIn: [], decisions: [], leadsWith: "made" };
});

function view(props: Partial<Parameters<typeof LiftedWork>[0]> = {}) {
  const onStep = vi.fn();
  render(
    <LiftedWork
      title="Deck"
      kind="deck"
      origin={null}
      onClose={() => undefined}
      onStep={onStep}
      panels={[{ id: "trail", label: TRAIL_COPY.tab, render: () => <input data-testid="field" /> }]}
      menu={[{ label: "Branch", onSelect: () => undefined }]}
      {...props}
    >
      {() => <p>x</p>}
    </LiftedWork>,
  );
  return { onStep };
}

describe("T3 left and right move through the board without closing the view", () => {
  it("right is the next piece, left the one before, and the open panel goes along", () => {
    const { onStep } = view();
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(onStep).toHaveBeenLastCalledWith(1, null);
    fireEvent.click(screen.getByRole("tab", { name: TRAIL_COPY.tab }));
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(onStep).toHaveBeenLastCalledWith(-1, "trail");
  });

  it("arrows inside a field move the caret, never the view", () => {
    const { onStep } = view();
    fireEvent.click(screen.getByRole("tab", { name: TRAIL_COPY.tab }));
    fireEvent.keyDown(screen.getByTestId("field"), { key: "ArrowRight" });
    expect(onStep).not.toHaveBeenCalled();
  });

  it("arrows do nothing while the More menu is open", () => {
    const { onStep } = view();
    fireEvent.click(screen.getByRole("button", { name: "More" }));
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(onStep).not.toHaveBeenCalled();
  });

  it("with no next piece to go to, arrows are left alone", () => {
    render(
      <LiftedWork title="Deck" kind="deck" origin={null} onClose={() => undefined}>
        {() => <p>x</p>}
      </LiftedWork>,
    );
    const event = new KeyboardEvent("keydown", { key: "ArrowRight", cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });
});

describe("T3 decisions that cite the piece", () => {
  it("settled first, unsettled marked, discarded never, blank never", () => {
    expect(
      trailDecisions([
        { id: "a", call_text: "Pilot two sections", status: "draft" },
        { id: "b", call_text: "Price per section", status: "confirmed" },
        { id: "c", call_text: "Drop the lab", status: "discarded" },
        { id: "d", call_text: "  ", status: "confirmed" },
      ]),
    ).toEqual([
      { id: "b", text: "Price per section", settled: true },
      { id: "a", text: "Pilot two sections", settled: false },
    ]);
  });

  it("the trail lists them under their own heading, with no count", async () => {
    trailResult.value = {
      madeFrom: [],
      usedIn: [],
      decisions: [
        { id: "b", text: "Price per section", settled: true },
        { id: "a", text: "Pilot two sections", settled: false },
      ],
      leadsWith: "made",
    };
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <LiftedTrail workItemId="deck" workboardId="board" profileId="me" canOpen={() => true} onOpenItem={() => undefined} />
      </QueryClientProvider>,
    );
    const section = await screen.findByTestId("trail-decisions");
    expect(section.textContent).toContain(TRAIL_COPY.decisions);
    expect(section.textContent).toContain("Price per section");
    expect(section.textContent).toContain(`Pilot two sections${TRAIL_COPY.unsettled}`);
    expect(section.textContent).not.toMatch(/\d/);
  });

  it("no decisions, no section", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <LiftedTrail workItemId="deck" workboardId="board" profileId="me" canOpen={() => true} onOpenItem={() => undefined} />
      </QueryClientProvider>,
    );
    await screen.findByTestId("lift-trail");
    expect(screen.queryByTestId("trail-decisions")).toBeNull();
  });
});

describe("T3 on the board and on the server (pinned in source)", () => {
  const page = readFileSync("src/pages/CanvasLabPage.tsx", "utf8");
  const server = readFileSync("src/lib/trail.functions.ts", "utf8");
  it("both work and pictures step through the board in reading order", () => {
    expect(page).toContain(".sort((a, b) => a.y - b.y || a.x - b.x);");
    expect(page.match(/onStep=\{stepLift\}/g)?.length).toBe(2);
  });
  it("stepping writes nothing to the board", () => {
    const fn = page.slice(page.indexOf("function stepLift"), page.indexOf("function stepLift") + 400);
    expect(fn).not.toMatch(/persistNodePatch|setNodes|record\(/);
  });
  it("decisions are read as the caller, by the piece in their sources, never discarded, never who", () => {
    expect(server).toContain('.contains("srcs", JSON.stringify([{ work_item_id: item.id }]))');
    expect(server).toContain('.neq("status", "discarded")');
    expect(server).toContain('.select("id, call_text, status")');
  });
});
