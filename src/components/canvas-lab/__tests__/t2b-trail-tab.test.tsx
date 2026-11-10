// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Trail, TrailEntry } from "@/lib/trail-shared";

const vendor = { visible: true };
const trailResult: { value: Trail } = { value: { madeFrom: [], usedIn: [], decisions: [], leadsWith: "made" } };
vi.mock("@/hooks/use-vendor-display", () => ({ useVendorVisible: () => vendor.visible }));
vi.mock("@/lib/telemetry", () => ({ logEvent: vi.fn() }));
vi.mock("@/lib/trail.functions", () => ({ getTrail: vi.fn() }));
vi.mock("@/lib/lineage.functions", () => ({ getDeliverableEvidence: vi.fn(), draftLineage: vi.fn(), reviewLink: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: () => async () => trailResult.value }));
vi.mock("@/lib/workboard-file-sign", () => ({ signWorkboardFileUrl: vi.fn(() => new Promise(() => undefined)) }));

import { LIFT_SIDE, LiftedWork } from "@/components/canvas-lab/LiftedWork";
import { LiftedTrail, TRAIL_COPY, trailHowLine } from "@/components/canvas-lab/LiftedTrail";
import { LiftedImageBody } from "@/components/canvas-lab/LiftedImageBody";

afterEach(() => {
  cleanup();
  vendor.visible = true;
  trailResult.value = { madeFrom: [], usedIn: [], decisions: [], leadsWith: "made" };
});

const entry = (id: string, how: TrailEntry["how"], over: Partial<TrailEntry> = {}): TrailEntry => ({
  item: { id, title: `Piece ${id}`, type: "document", source_vendor: "claude", date: "2026-10-01" },
  how,
  relation: null,
  note: null,
  ...over,
});

function withQuery(node: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{node}</QueryClientProvider>;
}

async function trail(props: Partial<Parameters<typeof LiftedTrail>[0]> = {}) {
  const onOpenItem = vi.fn();
  render(
    withQuery(
      <LiftedTrail workItemId="deck" workboardId="board" profileId="me" canOpen={() => true} onOpenItem={onOpenItem} {...props} />,
    ),
  );
  await screen.findByTestId("lift-trail");
  return { onOpenItem };
}

describe("T2b the Trail tab in the one view", () => {
  it("the view has a Trail tab, closed until asked for, that gives the panel its own width", () => {
    render(
      <LiftedWork title="Deck" kind="deck" origin={null} onClose={() => undefined} panels={[{ id: "trail", label: TRAIL_COPY.tab, render: () => <p data-testid="panel-inside">trail</p> }]}>
        {(width) => <p data-testid="work-width">{width}</p>}
      </LiftedWork>,
    );
    const closed = Number(screen.getByTestId("work-width").textContent);
    expect(screen.queryByTestId("lift-side")).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: TRAIL_COPY.tab }));
    expect(screen.getByTestId("panel-inside")).toBeTruthy();
    expect(Number(screen.getByTestId("work-width").textContent)).toBe(closed - LIFT_SIDE.panel);
    fireEvent.click(screen.getByRole("tab", { name: TRAIL_COPY.tab }));
    expect(screen.queryByTestId("lift-side")).toBeNull();
  });

  it("opening the tab is counted once per opening; closing is not", () => {
    const onPanelOpened = vi.fn();
    render(
      <LiftedWork title="Deck" kind="deck" origin={null} onClose={() => undefined} onPanelOpened={onPanelOpened} panels={[{ id: "trail", label: TRAIL_COPY.tab, render: () => null }]}>
        {() => null}
      </LiftedWork>,
    );
    const tab = screen.getByRole("tab", { name: TRAIL_COPY.tab });
    fireEvent.click(tab);
    fireEvent.click(tab);
    expect(onPanelOpened).toHaveBeenCalledTimes(1);
    expect(onPanelOpened).toHaveBeenCalledWith("trail");
  });

  it("a piece reached from another trail opens with the trail already open", () => {
    render(
      <LiftedWork title="Sheet" kind="sheet" origin={null} onClose={() => undefined} initialPanel="trail" panels={[{ id: "trail", label: TRAIL_COPY.tab, render: () => <p data-testid="panel-inside">trail</p> }]}>
        {() => null}
      </LiftedWork>,
    );
    expect(screen.getByTestId("panel-inside")).toBeTruthy();
  });

  it("no panels, no rail", () => {
    render(
      <LiftedWork title="Deck" kind="deck" origin={null} onClose={() => undefined}>
        {() => null}
      </LiftedWork>,
    );
    expect(screen.queryByRole("tablist")).toBeNull();
  });
});

describe("T2b what the trail says", () => {
  it("a deliverable opens on Made from, then Used in", async () => {
    trailResult.value = { madeFrom: [entry("chat", "born")], usedIn: [entry("call", "drawn")], decisions: [], leadsWith: "made" };
    await trail();
    const sections = [...screen.getByTestId("lift-trail").querySelectorAll("section")].map((s) => s.getAttribute("data-testid"));
    expect(sections).toEqual(["trail-made-from", "trail-used-in"]);
  });

  it("a chat or a source opens on Used in, then Made from", async () => {
    trailResult.value = { madeFrom: [], usedIn: [entry("deck", "confirmed")], decisions: [], leadsWith: "used" };
    await trail({ workItemId: "chat" });
    const sections = [...screen.getByTestId("lift-trail").querySelectorAll("section")].map((s) => s.getAttribute("data-testid"));
    expect(sections).toEqual(["trail-used-in", "trail-made-from"]);
  });

  it("each line says how it got there, never who", () => {
    expect(trailHowLine(entry("a", "born"))).toBe(TRAIL_COPY.born);
    expect(trailHowLine(entry("a", "confirmed", { note: "The 212 row is quoted on slide 2." }))).toBe("The 212 row is quoted on slide 2.");
    expect(trailHowLine(entry("a", "confirmed"))).toBe(TRAIL_COPY.confirmed);
    expect(trailHowLine(entry("a", "drawn", { relation: "cited" }))).toBe(`${TRAIL_COPY.drawn} · cited`);
    expect(trailHowLine(entry("a", "drawn", { relation: "context" }))).toBe(TRAIL_COPY.drawn);
  });

  it("empty directions say so plainly, with no count anywhere", async () => {
    await trail();
    expect(screen.getByText(TRAIL_COPY.nothingMade)).toBeTruthy();
    expect(screen.getByText(TRAIL_COPY.nothingUsed)).toBeTruthy();
    expect(screen.getByTestId("lift-trail").textContent).not.toMatch(/\d+\s*(items?|links?|%)/);
  });

  it("a piece on this board opens in the view; one that is not stays a line and says so", async () => {
    trailResult.value = { madeFrom: [entry("sheet", "drawn"), entry("far", "born")], usedIn: [], decisions: [], leadsWith: "made" };
    const { onOpenItem } = await trail({ canOpen: (id) => id === "sheet" });
    fireEvent.click(screen.getByRole("button", { name: /Piece sheet/ }));
    expect(onOpenItem).toHaveBeenCalledWith("sheet");
    expect(screen.queryByRole("button", { name: /Piece far/ })).toBeNull();
    expect(screen.getByText(`${TRAIL_COPY.born} · ${TRAIL_COPY.offBoard}`)).toBeTruthy();
  });

  it("a vendor-neutral workspace sees no tool marks on the trail", async () => {
    vendor.visible = false;
    trailResult.value = { madeFrom: [entry("chat", "born")], usedIn: [], decisions: [], leadsWith: "made" };
    await trail();
    expect(screen.getByTestId("lift-trail").querySelector("svg title, img")).toBeNull();
    expect(screen.getByTestId("lift-trail").querySelector(".lift-trail-dot")).toBeTruthy();
  });

  it("states the rule it follows", async () => {
    await trail();
    expect(screen.getByText(TRAIL_COPY.rule)).toBeTruthy();
  });
});

describe("T2b images open with the link the board already has", () => {
  it("shows the board's own link at once while its own is signed", () => {
    render(<LiftedImageBody node={{ kind: "image", imagePath: "org/board/pic.png" }} initialSrc="https://signed.example/board.png" />);
    expect(screen.getByTestId("lift-image").querySelector("img")?.getAttribute("src")).toBe("https://signed.example/board.png");
  });
});

describe("T2b on the board (wiring pinned in source)", () => {
  const page = readFileSync("src/pages/CanvasLabPage.tsx", "utf8");
  it("every lifted work card gets the Trail tab, read for this board and this person", () => {
    expect(page).toContain('panels={!liftedItem ? [] : [{ id: "trail", label: TRAIL_COPY.tab, render: () => <LiftedTrail workItemId={liftedItem.id} workboardId={lab.board?.id ?? null} profileId={profile?.id ?? null}');
    // T2c-1: the Comments tab sits beside it, so only the trail panel counts as opening the trail.
    expect(page).toContain('onPanelOpened={(id) => { if (id === "trail" && liftedItem) noteWorkboardWorkTrailOpened(orgId, liftKindOf(liftedItem.type)); }}');
  });
  it("opening from the trail keeps the trail open and writes nothing to the board", () => {
    const fn = page.slice(page.indexOf("function openFromTrail"), page.indexOf("function openFromTrail") + 300);
    expect(fn).toContain('setLifted({ id: node.id, origin: cardRect(node.id), swapped: true, panel: "trail" });');
    expect(fn).not.toMatch(/persistNodePatch|setNodes|record\(/);
  });
  it("the trail never reads the rest of the engagement on the client either", () => {
    const panel = readFileSync("src/components/canvas-lab/LiftedTrail.tsx", "utf8");
    expect(panel).toContain("getTrail");
    expect(panel).not.toMatch(/getSpanAudit|loadUpstreamItems|upstream/);
  });
});
