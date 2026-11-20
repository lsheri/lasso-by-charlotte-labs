// @vitest-environment jsdom
// 21 Nov, D-85 PR B: Home's question box under the orb. With the map, Home asks: the orb names each stage, turns to the
// engagements quoted, and the answer is handed to Firm brain with the question (asked once). Without the map the
// question goes straight to Firm brain. The box morphs into the menu row unless motion is reduced, and grows back.
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FIRM_ASK_STARTER_COPY } from "@/lib/firm-ask-shared";
import {
  HOME_ASK_COPY,
  resetHomeHandOff,
  startReturn,
  takeHandedQuestion,
} from "@/lib/home-ask-shared";

const m = vi.hoisted(() => ({
  navigate: vi.fn(),
  reduce: false,
  morphs: [] as { toRow: boolean; text: string }[],
  finish: null as null | (() => void),
  focus: vi.fn(async (_ids: string[]) => {}),
  holdHalfway: false,
  halfway: null as null | (() => void),
}));

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => m.navigate }));
vi.mock("@/hooks/use-motion", () => ({ useReducedMotion: () => m.reduce }));
vi.mock("@/components/home/morph-ghost", () => ({
  rectOf: () => ({ left: 0, top: 0, width: 600, height: 140 }),
  firmBrainRow: () => null,
  topMiddle: () => ({ left: 0, top: 0, width: 160, height: 40 }),
  morph: (options: { toRow: boolean; text: string; onHalfway?: () => void }) => {
    m.morphs.push({ toRow: options.toRow, text: options.text });
    if (m.holdHalfway) m.halfway = options.onHalfway ?? null;
    else options.onHalfway?.();
    return new Promise<void>((resolve) => (m.finish = resolve));
  },
}));

vi.mock("@/components/home/FirmOrb", async () => {
  const { forwardRef, useImperativeHandle } = await import("react");
  return {
    FirmOrb: forwardRef(function FakeOrb(_props: object, ref) {
      useImperativeHandle(ref, () => ({ focus: m.focus, reset: () => {} }));
      return <div data-testid="firm-orb" />;
    }),
  };
});

import { HomeAsk } from "@/components/home/HomeAsk";
import { canvasDataFor, PENDING_STAGES } from "@/lib/firm-canvas-shared";
import { ORB_COPY } from "@/lib/firm-orb-shared";
import type { FirmAskResult } from "@/lib/firm-ask-shared";
import { FIRM_BRAIN_LIMIT_COPY } from "@/lib/firm-brain-limit-shared";
import { corpusOf, demoRows, graphOf } from "@/lib/__tests__/helpers/demo-firm-rows";

const MAP = canvasDataFor(graphOf(demoRows()), corpusOf(demoRows()), false);
const answered = (boards: string[]): FirmAskResult => ({
  status: "answered",
  summary: null,
  claims: boards.map((boardId, i) => ({
    text: `Line ${i}`,
    itemId: `i${i}`,
    boardId,
    quote: "q",
    grade: "from_summary" as const,
  })),
  facts: [],
  nearest: null,
  read: { full: [], summary: [] },
  sources: {},
  coverage: "",
  oneSource: false,
});

const EVENING = new Date("2026-11-20T20:00:00");

beforeEach(() => {
  m.navigate.mockReset();
  m.reduce = false;
  m.morphs = [];
  m.finish = null;
  m.focus.mockClear();
  m.holdHalfway = false;
  m.halfway = null;
  resetHomeHandOff();
});
afterEach(() => cleanup());

const box = () => screen.getByLabelText(HOME_ASK_COPY.label);

describe("Home's question box", () => {
  it("greets the person and offers starters made from their latest board", () => {
    render(
      <HomeAsk
        profileId="p-elif"
        displayName="Elif Yilmaz"
        role="em"
        recentBoard="Weight management service line"
        now={EVENING}
      />,
    );
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Evening, Elif");
    expect(
      screen.getByText(`${FIRM_ASK_STARTER_COPY.similar.stem}Weight management service line?`),
    ).toBeTruthy();
    expect(screen.queryByText(new RegExp(FIRM_ASK_STARTER_COPY.charged.stem))).toBeNull();
    expect(screen.getByText(HOME_ASK_COPY.scope)).toBeTruthy();
  });

  it("hands the question over and morphs into the menu row while Firm brain opens", () => {
    render(
      <HomeAsk profileId="p-elif" displayName="Elif" role="em" recentBoard={null} now={EVENING} />,
    );
    fireEvent.change(box(), { target: { value: "  What held up patient recruiting?  " } });
    fireEvent.keyDown(box(), { key: "Enter" });
    expect(takeHandedQuestion("p-elif")).toEqual({
      question: "What held up patient recruiting?",
      result: null,
    });
    expect(m.morphs).toEqual([{ toRow: true, text: "What held up patient recruiting?" }]);
    expect(m.navigate).toHaveBeenCalledWith({ to: "/firm-brain" });
  });

  it("asks a starter in one press", () => {
    render(
      <HomeAsk
        profileId="p-elif"
        displayName="Harper"
        role="em"
        recentBoard="Claims product operating model"
        now={EVENING}
      />,
    );
    fireEvent.click(
      screen.getByText(`${FIRM_ASK_STARTER_COPY.went_wrong.stem}Claims product operating model?`),
    );
    expect(takeHandedQuestion("p-elif")?.question).toBe(
      `${FIRM_ASK_STARTER_COPY.went_wrong.stem}Claims product operating model?`,
    );
    expect(m.navigate).toHaveBeenCalledTimes(1);
  });

  it("keeps Shift+Enter as a new line, ignores a question under three characters, and asks only once", () => {
    render(
      <HomeAsk profileId="p-elif" displayName="Elif" role="em" recentBoard={null} now={EVENING} />,
    );
    fireEvent.change(box(), { target: { value: "hi" } });
    fireEvent.keyDown(box(), { key: "Enter" });
    fireEvent.keyDown(box(), { key: "Enter", shiftKey: true });
    expect(m.navigate).not.toHaveBeenCalled();
    fireEvent.change(box(), { target: { value: "A real question" } });
    fireEvent.keyDown(box(), { key: "Enter" });
    fireEvent.keyDown(box(), { key: "Enter" });
    expect(m.navigate).toHaveBeenCalledTimes(1);
  });

  it("opens Firm brain straight away under reduced motion, with nothing moving", () => {
    m.reduce = true;
    render(
      <HomeAsk profileId="p-elif" displayName="Elif" role="em" recentBoard={null} now={EVENING} />,
    );
    fireEvent.change(box(), { target: { value: "A real question" } });
    fireEvent.keyDown(box(), { key: "Enter" });
    expect(m.morphs).toEqual([]);
    expect(m.navigate).toHaveBeenCalledWith({ to: "/firm-brain" });
  });

  it("grows back out of the menu row when the person comes back from Firm brain", async () => {
    startReturn({ left: 20, top: 200, width: 220, height: 40 });
    render(
      <HomeAsk profileId="p-elif" displayName="Elif" role="em" recentBoard={null} now={EVENING} />,
    );
    expect(m.morphs).toEqual([{ toRow: false, text: HOME_ASK_COPY.placeholder }]);
    expect(box().closest("form")!.className).toContain("invisible");
    await act(async () => m.finish?.());
    expect(box().closest("form")!.className).not.toContain("invisible");
  });

  it("keeps the question out of analytics", () => {
    render(
      <HomeAsk profileId="p-elif" displayName="Elif" role="em" recentBoard="Board" now={EVENING} />,
    );
    expect(box().closest("form")!.className).toContain("ph-no-autocapture");
  });
});

describe("the orb at the centre of Home", () => {
  it("shows a quiet frame while the map loads, and the orb with what it does once it is here", () => {
    const { rerender } = render(
      <HomeAsk
        profileId="p-elif"
        displayName="Elif"
        role="em"
        recentBoard={null}
        mapLoading
        now={EVENING}
      />,
    );
    expect(screen.getByTestId("firm-orb-loading")).toBeTruthy();
    rerender(
      <HomeAsk
        profileId="p-elif"
        displayName="Elif"
        role="em"
        recentBoard={null}
        map={MAP}
        now={EVENING}
      />,
    );
    expect(screen.getByTestId("firm-orb")).toBeTruthy();
    expect(screen.getByTestId("firm-orb-caption").textContent).toBe(ORB_COPY.hint);
  });

  it("reads the firm here, turns the orb to the engagements quoted, then hands the answer over so it is asked once", async () => {
    let reply!: (result: FirmAskResult) => void;
    const askFirm = vi.fn(() => new Promise<FirmAskResult>((resolve) => (reply = resolve)));
    render(
      <HomeAsk
        profileId="p-elif"
        displayName="Elif"
        role="em"
        recentBoard={null}
        map={MAP}
        askFirm={askFirm}
        now={EVENING}
      />,
    );
    fireEvent.change(box(), { target: { value: "How did we launch health service lines?" } });
    fireEvent.keyDown(box(), { key: "Enter" });
    expect(askFirm).toHaveBeenCalledWith("How did we launch health service lines?");
    expect(screen.getByTestId("firm-orb-caption").textContent).toBe(PENDING_STAGES[0]!.text);
    expect(m.navigate).not.toHaveBeenCalled();
    const result = answered(["b5", "b6", "b5"]);
    await act(async () => reply(result));
    expect(m.focus).toHaveBeenCalledWith(["b5", "b6"]);
    expect(takeHandedQuestion("p-elif")).toEqual({
      question: "How did we launch health service lines?",
      result,
    });
    expect(m.navigate).toHaveBeenCalledWith({ to: "/firm-brain" });
    expect(screen.getByTestId("firm-orb-caption").textContent).toBe(ORB_COPY.opening);
  });

  it("opens Firm brain to show what was read when nothing matches, with nothing to pull", async () => {
    const askFirm = vi.fn(async () => ({ ...answered([]), status: "not_found" as const }));
    render(
      <HomeAsk
        profileId="p-elif"
        displayName="Elif"
        role="em"
        recentBoard={null}
        map={MAP}
        askFirm={askFirm}
        now={EVENING}
      />,
    );
    fireEvent.change(box(), { target: { value: "Have we worked on space mining?" } });
    await act(async () => fireEvent.keyDown(box(), { key: "Enter" }));
    expect(m.focus).toHaveBeenCalledWith([]);
    expect(m.navigate).toHaveBeenCalledWith({ to: "/firm-brain" });
  });

  it("stays on Home with a plain line when the ask fails, and asks again", async () => {
    const askFirm = vi
      .fn()
      .mockRejectedValueOnce(new Error("down"))
      .mockResolvedValueOnce(answered(["b5"]));
    render(
      <HomeAsk
        profileId="p-elif"
        displayName="Elif"
        role="em"
        recentBoard={null}
        map={MAP}
        askFirm={askFirm}
        now={EVENING}
      />,
    );
    fireEvent.change(box(), { target: { value: "A real question" } });
    await act(async () => fireEvent.keyDown(box(), { key: "Enter" }));
    expect(screen.getByRole("alert").textContent).toBe(ORB_COPY.failed);
    expect(m.navigate).not.toHaveBeenCalled();
    await act(async () => fireEvent.keyDown(box(), { key: "Enter" }));
    expect(askFirm).toHaveBeenCalledTimes(2);
    expect(m.navigate).toHaveBeenCalledTimes(1);
  });

  it("says the daily limit was reached", async () => {
    const askFirm = vi.fn().mockRejectedValueOnce(new Response("limit", { status: 429 }));
    render(
      <HomeAsk
        profileId="p-elif"
        displayName="Elif"
        role="em"
        recentBoard={null}
        map={MAP}
        askFirm={askFirm}
        now={EVENING}
      />,
    );
    fireEvent.change(box(), { target: { value: "A real question" } });
    await act(async () => fireEvent.keyDown(box(), { key: "Enter" }));
    expect(screen.getByRole("alert").textContent).toBe(FIRM_BRAIN_LIMIT_COPY.shown);
  });

  it("sends the question straight to Firm brain when the map could not be read", () => {
    const askFirm = vi.fn();
    render(
      <HomeAsk
        profileId="p-elif"
        displayName="Elif"
        role="em"
        recentBoard={null}
        map={null}
        askFirm={askFirm}
        now={EVENING}
      />,
    );
    expect(screen.queryByTestId("firm-orb")).toBeNull();
    fireEvent.change(box(), { target: { value: "A real question" } });
    fireEvent.keyDown(box(), { key: "Enter" });
    expect(askFirm).not.toHaveBeenCalled();
    expect(takeHandedQuestion("p-elif")).toEqual({ question: "A real question", result: null });
  });
});

describe("leaving Home part way (QA H2)", () => {
  it("does not pull the person to Firm brain when they left while the firm was read, and keeps no question", async () => {
    let reply!: (result: FirmAskResult) => void;
    const askFirm = vi.fn(() => new Promise<FirmAskResult>((resolve) => (reply = resolve)));
    const view = render(
      <HomeAsk
        profileId="p-elif"
        displayName="Elif"
        role="em"
        recentBoard={null}
        map={MAP}
        askFirm={askFirm}
        now={EVENING}
      />,
    );
    fireEvent.change(box(), { target: { value: "A real question" } });
    fireEvent.keyDown(box(), { key: "Enter" });
    view.unmount();
    await act(async () => reply(answered(["b5"])));
    expect(m.focus).not.toHaveBeenCalled();
    expect(m.navigate).not.toHaveBeenCalled();
    expect(takeHandedQuestion("p-elif")).toBeNull();
  });

  it("does not open Firm brain halfway through the morph if the person already went elsewhere, and lets the question go", () => {
    m.holdHalfway = true;
    const view = render(
      <HomeAsk profileId="p-elif" displayName="Elif" role="em" recentBoard={null} now={EVENING} />,
    );
    fireEvent.change(box(), { target: { value: "A real question" } });
    fireEvent.keyDown(box(), { key: "Enter" });
    view.unmount();
    m.halfway?.();
    expect(m.navigate).not.toHaveBeenCalled();
    expect(takeHandedQuestion("p-elif")).toBeNull();
  });

  it("keeps the hand-off when it was Home itself that opened Firm brain", () => {
    const view = render(
      <HomeAsk profileId="p-elif" displayName="Elif" role="em" recentBoard={null} now={EVENING} />,
    );
    fireEvent.change(box(), { target: { value: "A real question" } });
    fireEvent.keyDown(box(), { key: "Enter" });
    expect(m.navigate).toHaveBeenCalledTimes(1);
    view.unmount();
    expect(takeHandedQuestion("p-elif")?.question).toBe("A real question");
  });
});

describe("the demo tour (QA H3)", () => {
  it("gives a Lead's Home beats their Ask the firm anchor on the question box", () => {
    render(
      <HomeAsk
        profileId="p-signe"
        displayName="Signe"
        role="lead"
        recentBoard={null}
        now={EVENING}
      />,
    );
    expect(screen.getByTestId("ask-the-firm")).toBe(box().closest("form"));
  });
});
