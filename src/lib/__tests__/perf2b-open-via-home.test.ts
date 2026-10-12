import { describe, expect, it } from "vitest";

import { workboardOpenVia } from "@/pages/CanvasLabPage";

describe("PERF-2b: workboard.opened via=home", () => {
  it("reports via=home when the board was opened from Home", () => {
    expect(workboardOpenVia("home")).toBe("home");
  });

  it("keeps an unknown value as direct", () => {
    expect(workboardOpenVia("somewhere_else")).toBe("direct");
    expect(workboardOpenVia(undefined)).toBe("direct");
  });

  it("keeps header, canvas_tab and default unchanged", () => {
    expect(workboardOpenVia("header")).toBe("header");
    expect(workboardOpenVia("canvas_tab")).toBe("canvas_tab");
    expect(workboardOpenVia("default")).toBe("default");
  });
});
