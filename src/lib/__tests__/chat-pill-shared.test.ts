// 20 Nov 2026, chat pill PR 1a (D-97): the pill's pure rules, with the prototype's numbers.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  behindAt,
  corners,
  dragPull,
  geometryAt,
  PILL_COPY,
  pillAccess,
  pillGeometry,
  pillPlace,
  pillQuestion,
  progressForHeight,
  settleMode,
  type Viewport,
} from "@/lib/chat-pill-shared";
import {
  clearHandOff,
  handOffQuestion,
  subscribeHandOff,
  takeHandedQuestion,
  cameFromHome,
} from "@/lib/home-ask-shared";

const LAPTOP: Viewport = {
  width: 1440,
  height: 900,
  phone: false,
  railWidth: 258,
  shutWidth: 150,
  bottomClear: 0,
};
const PHONE: Viewport = {
  width: 390,
  height: 844,
  phone: true,
  railWidth: 0,
  shutWidth: 150,
  bottomClear: 64,
};

describe("where the pill sits, mode by mode", () => {
  it("on a laptop: a pill 24px in from the bottom right, a 420 by 700 panel, and a full screen chat beside the menu", () => {
    expect(pillGeometry("shut", LAPTOP)).toEqual({
      left: 1440 - 150 - 24,
      top: 900 - 44 - 24,
      width: 150,
      height: 44,
      radius: "22px",
    });
    expect(pillGeometry("open", LAPTOP)).toEqual({
      left: 1440 - 420 - 24,
      top: 900 - 700 - 24,
      width: 420,
      height: 700,
      radius: "18px",
    });
    expect(pillGeometry("full", LAPTOP)).toEqual({
      left: 258 + 16,
      top: 16,
      width: 1440 - 258 - 32,
      height: 900 - 32,
      radius: "18px",
    });
  });

  it("on a phone: centred above the tab bar, a bottom sheet of 86 percent, and the full screen edge to edge", () => {
    expect(pillGeometry("shut", PHONE)).toEqual({
      left: Math.round((390 - 150) / 2),
      top: 844 - 44 - 16 - 64,
      width: 150,
      height: 44,
      radius: "22px",
    });
    expect(pillGeometry("open", PHONE)).toEqual({
      left: 0,
      top: 844 - Math.round(844 * 0.86),
      width: 390,
      height: Math.round(844 * 0.86),
      radius: "20px 20px 0 0",
    });
    expect(pillGeometry("full", PHONE)).toEqual({
      left: 0,
      top: 0,
      width: 390,
      height: 844,
      radius: "0px",
    });
  });

  it("never goes narrower than 120px, and fits a small laptop window", () => {
    expect(pillGeometry("shut", { ...LAPTOP, shutWidth: 40 }).width).toBe(120);
    const small = { ...LAPTOP, width: 400, height: 500 };
    expect(pillGeometry("open", small)).toMatchObject({ width: 352, height: 452 });
  });
});

describe("a drag scrubs one shape through every point", () => {
  it("lands exactly on each mode at 0, 1 and 2", () => {
    for (const [p, mode] of [
      [0, "shut"],
      [1, "open"],
      [2, "full"],
    ] as const) {
      const at = geometryAt(p, LAPTOP);
      const want = pillGeometry(mode, LAPTOP);
      expect(at.left).toBeCloseTo(want.left);
      expect(at.top).toBeCloseTo(want.top);
      expect(at.width).toBeCloseTo(want.width);
      expect(at.height).toBeCloseTo(want.height);
    }
  });

  it("is half way between two modes at the half, corners included", () => {
    const half = geometryAt(0.5, LAPTOP);
    expect(half.width).toBeCloseTo((150 + 420) / 2);
    expect(half.radius).toBe("20.0px 20.0px 20.0px 20.0px");
    const phoneHalf = geometryAt(1.5, PHONE);
    expect(phoneHalf.radius).toBe("10.0px 10.0px 0.0px 0.0px");
  });

  it("reads a height back as the same progress, so the shape follows the finger", () => {
    for (const p of [0, 0.25, 0.5, 1, 1.4, 2])
      expect(progressForHeight(geometryAt(p, LAPTOP).height, LAPTOP)).toBeCloseTo(p);
    expect(progressForHeight(-500, LAPTOP)).toBe(0);
    expect(progressForHeight(99_999, LAPTOP)).toBe(2);
  });

  it("grows with a pull up, or out to the left on a laptop, and only up on a phone", () => {
    expect(dragPull(0, -100, false)).toBe(100);
    expect(dragPull(-100, -10, false)).toBeCloseTo(130);
    expect(dragPull(-100, -10, true)).toBe(10);
    expect(dragPull(100, 0, false)).toBe(-0);
  });

  it("settles on the nearest mode, and a flick carries it on", () => {
    expect(settleMode(0.4, 0)).toBe("shut");
    expect(settleMode(0.6, 0)).toBe("open");
    expect(settleMode(1.3, 0)).toBe("open");
    expect(settleMode(1.3, 0.003)).toBe("full");
    expect(settleMode(0.8, -0.004)).toBe("shut");
    expect(settleMode(5, 1)).toBe("full");
  });

  it("softens the page behind as the chat goes full screen", () => {
    expect(behindAt(0)).toEqual({ blurPx: 0, opacity: 1, scale: 1 });
    expect(behindAt(1)).toEqual({ blurPx: 3, opacity: 0.5, scale: 0.985 });
    expect(behindAt(7)).toEqual(behindAt(1));
  });

  it("reads one to four corner lengths", () => {
    expect(corners("22px")).toEqual([22, 22, 22, 22]);
    expect(corners("20px 20px 0 0")).toEqual([20, 20, 0, 0]);
    expect(corners("nonsense")).toEqual([0, 0, 0, 0]);
  });
});

describe("where the person is and what the pill offers", () => {
  it("names the page in plain words", () => {
    expect(pillPlace("/home")).toBe("home");
    expect(pillPlace("/proposals")).toBe("proposals");
    expect(pillPlace("/firm-brain")).toBe("firm");
    expect(pillPlace("/engagements/abc/canvas-lab")).toBe("board");
    expect(pillPlace("/work")).toBe("work");
    expect(pillPlace("/settings")).toBe("other");
    expect(PILL_COPY.where("proposals")).toBe("On Proposals");
    expect(PILL_COPY.where("other")).toBe("");
  });

  it("lets every company member ask the firm, and never a coach, a guest or a workspace that is not a company", () => {
    expect(pillAccess({ role: "admin", has_firm_view: true })).toBe("firm");
    expect(pillAccess({ role: "lead", has_firm_view: true })).toBe("firm");
    expect(pillAccess({ role: "em", has_firm_view: true })).toBe("firm");
    expect(pillAccess({ role: "coach", has_firm_view: true })).toBe("none");
    expect(pillAccess({ role: "em", has_firm_view: true, is_guest: true })).toBe("none");
    expect(pillAccess({ role: "admin", has_firm_view: false })).toBe("none");
    expect(pillAccess(null)).toBe("none");
  });

  it("sends a question only with something to look for, cut at the firm's limit", () => {
    expect(pillQuestion("  hi ", 500)).toBeNull();
    expect(pillQuestion("How did we   run   staffing reviews?", 500)).toBe(
      "How did we run staffing reviews?",
    );
    expect(pillQuestion("x".repeat(900), 500)).toHaveLength(500);
  });

  it("speaks plainly: no long dashes, no sending service, and question words never go to analytics", () => {
    const words =
      JSON.stringify(PILL_COPY) + readFileSync("src/components/pill/ChatPill.tsx", "utf8");
    expect(words).not.toMatch(/[–—]/);
    expect(words).not.toMatch(/bird/i);
    expect(PILL_COPY.footer).toBe("Question words never go to analytics.");
  });

  it("records only which page the pill was opened on, never words", () => {
    const allow = readFileSync("src/lib/event-dim-allowlist.ts", "utf8");
    expect(allow).toContain('"pill.opened": ["page"]');
    expect(allow).toContain('"pill.expanded": ["page"]');
  });
});

describe("the live hand-off to a Firm brain page already open", () => {
  it("tells a listening page at once; it takes the question once, for the same person only", () => {
    clearHandOff();
    const heard: (string | null)[] = [];
    const stop = subscribeHandOff(() => heard.push(takeHandedQuestion("me")?.question ?? null));
    handOffQuestion("What went wrong last time?", null, "me", Date.now(), { fromHome: false });
    expect(heard).toEqual(["What went wrong last time?"]);
    // From the pill, Firm brain offers no way back to Home's box.
    expect(cameFromHome()).toBe(false);
    handOffQuestion("Someone else's", null, "other", Date.now(), { fromHome: false });
    expect(heard).toEqual(["What went wrong last time?", null]);
    stop();
    handOffQuestion("Unheard", null, "me");
    expect(heard).toHaveLength(2);
    // Home's own hand-off still says it came from Home.
    expect(cameFromHome()).toBe(true);
    clearHandOff();
  });
});
