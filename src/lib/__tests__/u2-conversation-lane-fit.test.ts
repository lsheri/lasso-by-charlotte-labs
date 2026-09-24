import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getSession: vi.fn(), onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })) }, from: vi.fn() } }));

import { fitWorkboardViewport } from "@/components/canvas-lab/canvas-lab-model";
import { conversationLaneHeight, conversationLaneRects } from "@/pages/AiRecordPage";

const TOOLBAR_ROW_BOTTOM = 54;

describe("Unit 2 conversation lanes fit the shell at zoom 1", () => {
  for (const shell of [{ width: 1440, height: 900 }, { width: 1094, height: 658 }]) {
    it(`fits a ${shell.width}x${shell.height} shell without scaling`, () => {
      const lanes = conversationLaneRects(shell);
      const fit = fitWorkboardViewport(shell, lanes, [], new Map(), null);
      expect(fit.zoom).toBe(1);
      for (const lane of lanes) {
        const top = lane.y * fit.zoom + fit.pan.y;
        const bottom = (lane.y + lane.height) * fit.zoom + fit.pan.y;
        const left = lane.x * fit.zoom + fit.pan.x;
        const right = (lane.x + lane.width) * fit.zoom + fit.pan.x;
        expect(top).toBeGreaterThanOrEqual(TOOLBAR_ROW_BOTTOM);
        expect(bottom).toBeLessThanOrEqual(shell.height);
        expect(left).toBeGreaterThanOrEqual(0);
        expect(right).toBeLessThanOrEqual(shell.width);
      }
      expect(lanes[0]?.y * fit.zoom + fit.pan.y).toBe(54);
    });
  }

  it("follows shell height and keeps one conversation card visible", () => {
    expect(conversationLaneHeight(900)).toBe(792);
    expect(conversationLaneHeight(658)).toBe(550);
    expect(conversationLaneHeight(200)).toBe(234);
  });
});