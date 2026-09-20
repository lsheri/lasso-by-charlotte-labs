import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/telemetry", () => ({ logEvent: vi.fn() }));

import {
  shouldOpenWorkboard,
  ENGAGEMENT_NARROW_WIDTH,
  DETAILS_SEARCH,
} from "@/lib/engagement-default-view";
import { workboardOpenVia } from "@/pages/CanvasLabPage";

const base = {
  hasTrace: false,
  hasJourney: false,
  isQuickFolder: false,
  isNarrow: false,
};

describe("D1 engagement default view", () => {
  it("opens the workboard on a plain engagement link", () => {
    expect(shouldOpenWorkboard({ ...base })).toBe(true);
  });

  it("stays on the details page for a workstream ledger link", () => {
    expect(shouldOpenWorkboard({ ...base, work: "task-1" })).toBe(false);
  });

  it("stays on the details page for the Details round trip", () => {
    expect(shouldOpenWorkboard({ ...base, view: "details" })).toBe(false);
  });

  it("stays on the details page for shared trace and journey links", () => {
    expect(shouldOpenWorkboard({ ...base, hasTrace: true })).toBe(false);
    expect(shouldOpenWorkboard({ ...base, hasJourney: true })).toBe(false);
  });

  it("keeps quick folders as a list", () => {
    expect(shouldOpenWorkboard({ ...base, isQuickFolder: true })).toBe(false);
  });

  it("keeps phones on the details page", () => {
    expect(ENGAGEMENT_NARROW_WIDTH).toBe(768);
    expect(shouldOpenWorkboard({ ...base, isNarrow: true })).toBe(false);
  });

  it("sends both board-to-details links home with view=details", () => {
    expect(DETAILS_SEARCH).toEqual({ view: "details" });
    expect(shouldOpenWorkboard({ ...base, ...DETAILS_SEARCH })).toBe(false);
  });

  it("does not bounce back after Details, then opens again from a fresh link", () => {
    expect(shouldOpenWorkboard({ ...base, view: "details" })).toBe(false);
    expect(shouldOpenWorkboard({ ...base, view: undefined })).toBe(true);
  });

  it("reads the automatic landing as via default", () => {
    expect(workboardOpenVia("default")).toBe("default");
    expect(workboardOpenVia("header")).toBe("header");
    expect(workboardOpenVia("nonsense")).toBe("direct");
  });
});
