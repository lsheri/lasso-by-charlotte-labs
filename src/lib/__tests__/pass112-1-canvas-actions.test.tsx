// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { WorkItemRow } from "@/lib/work-types";

const journeyOpened = vi.fn();
const shipDialogs: unknown[] = [];

vi.mock("@/lib/journey-state", () => ({
  openJourney: (request: unknown) => journeyOpened(request),
}));

vi.mock("@/components/work/ShipToFirmDialog", () => ({
  ShipToFirmDialog: (props: { workItemId: string; open: boolean }) => {
    shipDialogs.push(props);
    return <div data-testid="ship-dialog" data-open={String(props.open)} />;
  },
}));

const { CanvasDeliverableActions, JOURNEY_EMPTY_HINT, SHIP_EMPTY_HINT } = await import(
  "@/components/engagements/CanvasDeliverableActions"
);
const { latestDeliverable } = await import("@/components/engagements/WhatFedThisButton");
const { SHIP_ACTION_LABEL } = await import("@/lib/shipped-work-shared");

function item(id: string, type: string, date: string, owner: string): WorkItemRow {
  return {
    id,
    title: `${type} ${id}`,
    type,
    owner_id: owner,
    source: "upload",
    visibility: "mapped",
    captured_at: date,
    work_date: date,
    work_item_tasks: [],
  } as unknown as WorkItemRow;
}

const deliverable = item("d1", "deck", "2026-02-01", "me");
const thread = item("t1", "thread", "2026-04-01", "me");

function renderActions(items: WorkItemRow[], profile: { id: string; role: string } | null) {
  return render(
    <CanvasDeliverableActions items={items} engagementId="eng" profile={profile} />,
  );
}

afterEach(() => {
  cleanup();
  journeyOpened.mockClear();
  shipDialogs.length = 0;
});

describe("pass 112.1 · journey and ship on the canvas", () => {
  it("shares the one latestDeliverable helper with what fed this", () => {
    const source = readFileSync("src/components/engagements/CanvasDeliverableActions.tsx", "utf8");
    expect(source).toContain(
      'import { latestDeliverable } from "@/components/engagements/WhatFedThisButton"',
    );
    expect(source).not.toContain("isDeliverableType");
    expect(latestDeliverable([thread, deliverable])?.id).toBe("d1");
  });

  it("opens the journey on that anchor for an owner", () => {
    renderActions([thread, deliverable], { id: "me", role: "member" });
    const journey = screen.getByRole("button", { name: "Work Artifact" });
    expect((journey as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(journey);
    expect(journeyOpened).toHaveBeenCalledWith({
      anchorId: "d1",
      anchorTitle: deliverable.title,
      engagementId: "eng",
    });
  });

  it("shows the journey to a coach but never the ship button", () => {
    renderActions([deliverable], { id: "coach", role: "coach" });
    expect(screen.getByRole("button", { name: "Work Artifact" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: SHIP_ACTION_LABEL })).toBeNull();
  });

  it("hides ship from a member who does not own the latest deliverable", () => {
    renderActions([deliverable], { id: "other", role: "member" });
    expect(screen.queryByRole("button", { name: SHIP_ACTION_LABEL })).toBeNull();
  });

  it("ships through the existing dialog only", () => {
    renderActions([deliverable], { id: "me", role: "member" });
    fireEvent.click(screen.getByRole("button", { name: SHIP_ACTION_LABEL }));
    const last = shipDialogs.at(-1) as { workItemId: string; open: boolean };
    expect(last.workItemId).toBe("d1");
    expect(last.open).toBe(true);
  });

  it("states the exact hints with no deliverable", () => {
    renderActions([thread], { id: "me", role: "member" });
    const journey = screen.getByRole("button", { name: "Work Artifact" });
    const ship = screen.getByRole("button", { name: SHIP_ACTION_LABEL });
    expect((journey as HTMLButtonElement).disabled).toBe(true);
    expect((ship as HTMLButtonElement).disabled).toBe(true);
    expect(journey.getAttribute("title")).toBe("Add a finished deliverable to see how it grew.");
    expect(ship.getAttribute("title")).toBe("Add a finished deliverable to ship it.");
    expect(JOURNEY_EMPTY_HINT + SHIP_EMPTY_HINT).not.toContain("—");
    expect(screen.queryByTestId("ship-dialog")).toBeNull();
  });

  it("stays a quiet sibling of the what fed this hero", () => {
    const source = readFileSync("src/components/engagements/CanvasDeliverableActions.tsx", "utf8");
    expect(source).not.toContain("nb-web-cta");
    const page = readFileSync("src/pages/EngagementPage.tsx", "utf8");
    expect(page).toContain("<CanvasDeliverableActions");
    expect(page).toContain("flex flex-wrap items-center gap-2");
  });
});
