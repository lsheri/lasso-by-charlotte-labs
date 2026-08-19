import { describe, expect, it } from "vitest";

import {
  MIN_ACTIVITY,
  MIN_ACTORS,
  gatedStat,
  median,
  normalizeDeliverableStatus,
  personIdentifyingPaths,
  relativeDayPhrase,
  taskLifecyclePatch,
} from "../firm-dashboard-shared";

describe("thresholds", () => {
  it("shows a number at the floor", () => {
    const stat = gatedStat(MIN_ACTIVITY, MIN_ACTIVITY, "five", "not enough");
    expect(stat.value).toBe(MIN_ACTIVITY);
    expect(stat.sentence).toBe("five");
  });

  it("suppresses below the floor and returns the honest sentence", () => {
    const stat = gatedStat(MIN_ACTIVITY - 1, MIN_ACTIVITY, "four", "not enough");
    expect(stat.value).toBeNull();
    expect(stat.sentence).toBe("not enough");
  });

  it("keeps the small-N floor at three actors", () => {
    expect(MIN_ACTORS).toBe(3);
  });
});

describe("median", () => {
  it("returns null with no samples", () => {
    expect(median([])).toBeNull();
  });
  it("takes the middle of an odd set", () => {
    expect(median([5, 1, 3])).toBe(3);
  });
  it("averages the middle of an even set", () => {
    expect(median([1, 2, 3, 6])).toBe(3);
  });
});

describe("deliverable status", () => {
  it("maps legacy values to open", () => {
    expect(normalizeDeliverableStatus("active")).toBe("open");
    expect(normalizeDeliverableStatus(null)).toBe("open");
    expect(normalizeDeliverableStatus("something_else")).toBe("open");
  });
  it("keeps the lifecycle words", () => {
    expect(normalizeDeliverableStatus("delivered")).toBe("delivered");
    expect(normalizeDeliverableStatus("accepted")).toBe("accepted");
    expect(normalizeDeliverableStatus("set_aside")).toBe("set_aside");
  });
});

describe("taskLifecyclePatch", () => {
  const now = "2026-08-20T00:00:00.000Z";
  const earlier = "2026-08-10T00:00:00.000Z";

  it("stamps delivery and clears acceptance", () => {
    expect(taskLifecyclePatch("delivered", now)).toEqual({
      status: "delivered",
      delivered_at: now,
      accepted_at: null,
    });
  });

  it("keeps the original delivery date when work is accepted later", () => {
    expect(taskLifecyclePatch("accepted", now, earlier)).toEqual({
      status: "accepted",
      delivered_at: earlier,
      accepted_at: now,
    });
  });

  it("clears both timestamps when work reopens", () => {
    expect(taskLifecyclePatch("open", now, earlier)).toEqual({
      status: "open",
      delivered_at: null,
      accepted_at: null,
    });
  });

  it("sets aside without claiming a delivery", () => {
    expect(taskLifecyclePatch("set_aside", now, earlier).delivered_at).toBeNull();
  });
});

describe("payload shape", () => {
  it("flags a person key anywhere in the payload", () => {
    expect(personIdentifyingPaths({ adoption: { owner_id: "x" } })).toContain(
      "$.adoption.owner_id",
    );
    expect(personIdentifyingPaths({ rows: [{ display_name: "Ada" }] })).toContain(
      "$.rows[0].display_name",
    );
  });

  it("flags a uuid or a tenant hash smuggled as a value", () => {
    expect(
      personIdentifyingPaths({ x: "3f6b0d0a-1c2d-4e5f-8a9b-0c1d2e3f4a5b" }).length,
    ).toBeGreaterThan(0);
    expect(personIdentifyingPaths({ x: "a".repeat(64) }).length).toBeGreaterThan(0);
  });

  it("passes a dashboard shaped payload of counts and sentences", () => {
    const payload = {
      window_days: 30,
      adoption: {
        seats: 10,
        seats_used: 4,
        active_members: 4,
        weekly_active: { value: 3, sentence: "3 of 4 members were active." },
        capture_coverage: { numerator: 2, denominator: 4, sentence: "2 of 4 members." },
        time_to_first_capture: { value: null, sentence: "Not enough recent joiners." },
      },
      activity: {
        deliverables: [{ status: "open", label: "Open", count: 2 }],
        analyses_by_preset: [{ label: "Verification", count: 3 }],
      },
      data_health: { connectors_by_vendor: [{ label: "googledrive", count: 1 }] },
    };
    expect(personIdentifyingPaths(payload)).toEqual([]);
  });
});

describe("copy", () => {
  it("says so plainly when nothing has been captured", () => {
    expect(relativeDayPhrase(null)).toBe("No capture recorded yet.");
    expect(relativeDayPhrase(0)).toBe("Last capture today.");
    expect(relativeDayPhrase(1)).toBe("Last capture yesterday.");
    expect(relativeDayPhrase(4)).toBe("Last capture 4 days ago.");
  });
});
