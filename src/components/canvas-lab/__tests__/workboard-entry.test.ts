import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/telemetry", () => ({ logEvent: vi.fn() }));

import { logEvent } from "@/lib/telemetry";
import { noteWorkboardOpened } from "@/components/canvas-lab/canvas-lab-telemetry";
import { workboardOpenVia } from "@/pages/CanvasLabPage";

describe("workboard entry attribution", () => {
  it.each([
    ["header", "header"],
    ["canvas_tab", "canvas_tab"],
    [undefined, "direct"],
    ["anything_else", "direct"],
  ])("maps %s to %s", (value, expected) => {
    expect(workboardOpenVia(value)).toBe(expected);
  });

  it.each(["header", "canvas_tab", "direct"] as const)("logs %s without content", (via) => {
    vi.mocked(logEvent).mockClear();
    noteWorkboardOpened("org", via);
    expect(logEvent).toHaveBeenCalledWith("workboard.opened", "org", { via });
  });
});