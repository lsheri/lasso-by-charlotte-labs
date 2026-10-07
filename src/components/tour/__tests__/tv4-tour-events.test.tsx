// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { execSync } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ logEvent: vi.fn() }));
vi.mock("@/lib/telemetry", () => ({ logEvent: mocks.logEvent }));

import { OnboardingTour } from "@/components/onboarding/OnboardingTour";
import { EVENT_DIM_KEYS } from "@/lib/event-dim-allowlist";

beforeEach(() => {
  mocks.logEvent.mockReset();
  window.matchMedia = vi.fn((query: string) => ({
    matches: query.includes("reduced-motion"),
    media: query, onchange: null,
    addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const TOUR_EVENTS = ["tour.started", "tour.step_done", "tour.step_continued", "tour.skipped", "tour.finished"];
const calls = (name: string) => mocks.logEvent.mock.calls.filter((c) => c[0] === name);
const pushBoth = () => { for (const push of screen.getAllByRole("button", { name: "Push to Lasso" })) fireEvent.click(push); };

describe("TV4 tour events fire from the real surface", () => {
  it("tour.started fires once on mount with the register", () => {
    const onDone = vi.fn();
    const r = render(<OnboardingTour register="edu" orgId="org-1" onDone={onDone} />);
    r.rerender(<OnboardingTour register="edu" orgId="org-1" onDone={onDone} />);
    expect(calls("tour.started")).toEqual([["tour.started", "org-1", { register: "edu", surface: "onboarding" }]]);
  });

  it("tour.step_done fires when act one's action completes and its callout appears", () => {
    const { container } = render(<OnboardingTour register="company" orgId="org-1" onDone={vi.fn()} />);
    expect(calls("tour.step_done")).toEqual([]);
    pushBoth();
    expect(container.querySelector(".tour-teaching-callout")).toBeTruthy();
    expect(calls("tour.step_done")).toEqual([["tour.step_done", "org-1", { step: 1, register: "company", surface: "onboarding" }]]);
    expect(calls("tour.step_continued")).toEqual([]);
  });

  it("tour.step_continued fires when the callout's control advances the tour", () => {
    render(<OnboardingTour register="personal" orgId="org-1" onDone={vi.fn()} />);
    pushBoth();
    fireEvent.click(screen.getByRole("button", { name: "Got it" }));
    expect(calls("tour.step_continued")).toEqual([["tour.step_continued", "org-1", { step: 1, register: "personal", surface: "onboarding" }]]);
    expect(document.querySelector('[data-tour-target="2"]')).toBeTruthy();
  });

  it("tour.skipped fires from Skip the tour with the act they were on, then calls onDone", () => {
    const onDone = vi.fn();
    render(<OnboardingTour register="partner" orgId="org-1" onDone={onDone} />);
    pushBoth();
    fireEvent.click(screen.getByRole("button", { name: "Got it" }));
    fireEvent.click(screen.getByRole("button", { name: "Skip the tour" }));
    expect(calls("tour.skipped")).toEqual([["tour.skipped", "org-1", { step: 2, register: "partner", surface: "onboarding" }]]);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("tour.finished fires from the closing act's finish control, then calls onDone", () => {
    const onDone = vi.fn();
    render(<OnboardingTour register="company" orgId="org-1" onDone={onDone} startAct={8} />);
    fireEvent.click(screen.getByRole("button", { name: "Start with my own work" }));
    expect(calls("tour.finished")).toEqual([["tour.finished", "org-1", { register: "company", surface: "onboarding" }]]);
    expect(calls("tour.skipped")).toEqual([]);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("no tour event carries a dim outside step and register, at runtime or in the allowlist", () => {
    render(<OnboardingTour register="company" orgId="org-1" onDone={vi.fn()} />);
    pushBoth();
    fireEvent.click(screen.getByRole("button", { name: "Got it" }));
    fireEvent.click(screen.getByRole("button", { name: "Skip the tour" }));
    for (const [name, , dims] of mocks.logEvent.mock.calls) {
      expect(TOUR_EVENTS).toContain(name);
      for (const key of Object.keys(dims as object)) expect(["step", "register", "surface"]).toContain(key);
      if ("step" in (dims as object)) expect(typeof (dims as { step: unknown }).step).toBe("number");
    }
    expect(EVENT_DIM_KEYS["tour.started"]).toEqual(["register", "surface"]);
    expect(EVENT_DIM_KEYS["tour.step_done"]).toEqual(["step", "register", "surface"]);
    expect(EVENT_DIM_KEYS["tour.step_continued"]).toEqual(["step", "register", "surface"]);
    expect(EVENT_DIM_KEYS["tour.skipped"]).toEqual(["step", "register", "surface"]);
    expect(EVENT_DIM_KEYS["tour.finished"]).toEqual(["register", "surface"]);
    const family = Object.keys(EVENT_DIM_KEYS).filter((k) => k.startsWith("tour."));
    expect(family.sort()).toEqual([...TOUR_EVENTS].sort());
  });

  it("the four welcome.* events exist nowhere in the source", () => {
    const out = execSync(
      `grep -rnE "welcome\\.(viewed|card_opened|ask_used|dismissed)" src tests --exclude=tv4-tour-events.test.tsx || true`,
      { encoding: "utf8" },
    );
    expect(out.trim()).toBe("");
  });
});
