// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TourActSix } from "@/components/tour/TourActs";
import { TOUR_BOARD_LAYOUT } from "@/lib/tour-content";

const TVJ_LAYOUT = [
  ["primary-0", 3, 19, 21, -0.8, 3],
  ["primary-1", 31, 17.5, 22, 0.7, 3],
  ["primary-2", 60, 20.5, 21, 0.5, 3],
  ["primary-3", 5, 44, 18, 0.9, 3],
  ["answer", 33, 82, 23, 0, 7],
  ["chat-0", 32, 42, 21, -0.7, 3],
  ["chat-1", 62, 44.5, 22, 0.8, 3],
  ["artifact", 84.5, 66, 13, 0.4, 3],
  ["whiteboard", 5, 78.5, 18, -0.4, 3],
  ["deck", 72, 84, 20, 0.3, 3],
  ["deliverable", 31.5, 80, 25, -0.3, 7],
] as const;

class ResizeObserverStub { observe() {} unobserve() {} disconnect() {} }
global.ResizeObserver = ResizeObserverStub;

let reducedMotion = false;
beforeEach(() => {
  reducedMotion = false;
  window.matchMedia = vi.fn((query: string) => ({
    matches: query.includes("prefers-reduced-motion") ? reducedMotion : false,
    media: query, onchange: null,
    addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
  }));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("TVj act 8 zoom and preview harness", () => {
  it("keeps every layout value exactly as it was", () => {
    expect(TOUR_BOARD_LAYOUT.map((item) => [item.id, item.x, item.y, item.widthBasis, item.rotation, item.earliestAct])).toEqual(TVJ_LAYOUT);
  });

  it("renders the three source cards, the kept note, the slide and three anchored connectors", () => {
    const { container } = render(<TourActSix register="company" />);
    const ids = Array.from(container.querySelectorAll<HTMLElement>("[data-tour-layout-id]:not([data-tour-reserved])")).map((element) => element.dataset["tourLayoutId"]);
    expect(ids).toEqual(["primary-0", "primary-1", "primary-2", "answer", "deliverable"]);
    expect(Array.from(container.querySelectorAll<HTMLElement>("[data-tour-connector-source]")).map((element) => element.dataset["tourConnectorSource"])).toEqual(["primary-0", "primary-1", "primary-2"]);
    expect(container.querySelector(".tour-persistent-board")?.getAttribute("data-act")).toBe("8");
  });

  it("draws a header, three sourced bullets and an inline svg chart on the slide", () => {
    render(<TourActSix register="company" />);
    const slide = screen.getByTestId("tour-deck-slide");
    expect(slide.querySelector(".tour-deck-page > header")).toBeTruthy();
    expect(slide.querySelectorAll(".tour-deck-page li")).toHaveLength(3);
    expect(slide.querySelectorAll(".tour-deck-page li > span[aria-hidden]:first-child")).toHaveLength(3);
    const chart = within(slide).getByTestId("tour-deck-chart");
    expect(chart.tagName.toLowerCase()).toBe("svg");
    expect(chart.querySelectorAll("rect")).toHaveLength(4);
    expect(chart.querySelector("text")).toBeNull();
  });

  it("scales act 8 by a visual transform without touching layout values", () => {
    const css = readFileSync("src/styles.css", "utf8");
    expect(css).toContain('.tour-persistent-board[data-act="8"] .tour-board-item {');
    expect(css).toContain("scale: var(--tour-zoom);");
    expect(css).toContain('.tour-persistent-board[data-act="8"] .tour-deck-overlay { top: 6% !important; left: 46% !important; width: 51% !important; }');
  });

  it("shows act 8 complete at once under reduced motion", () => {
    reducedMotion = true;
    render(<TourActSix register="company" />);
    const slide = screen.getByTestId("tour-deck-slide");
    expect(slide.hasAttribute("data-reduced")).toBe(true);
    expect(slide.querySelectorAll(".tour-deck-page li")).toHaveLength(3);
    expect(within(slide).getByTestId("tour-deck-chart")).toBeTruthy();
  });

  it("renders no picker above the stage and keeps the preview controls closed on load", async () => {
    const { TourPreviewPage } = await import("@/routes/tour-preview");
    const { container } = render(<TourPreviewPage />);
    const main = container.querySelector("main.tour-preview-page") as HTMLElement;
    const children = Array.from(main.children);
    const stageIndex = children.findIndex((child) => child.classList.contains("tour-shell"));
    const devIndex = children.findIndex((child) => child.matches("details.tour-preview-dev"));
    expect(stageIndex).toBe(0);
    expect(devIndex).toBeGreaterThan(stageIndex);
    const dev = children[devIndex] as HTMLDetailsElement;
    expect(dev.open).toBe(false);
    expect(dev.querySelector("summary")?.textContent).toBe("Preview controls");
    expect(dev.querySelector("select")).toBeTruthy();
    expect(dev.querySelectorAll('[aria-label^="Show act"]')).toHaveLength(8);
    expect(children.slice(0, stageIndex + 1).some((child) => child.querySelector("select, [aria-label^='Show act']"))).toBe(false);
    fireEvent.click(dev.querySelector("summary")!);
  });
});
