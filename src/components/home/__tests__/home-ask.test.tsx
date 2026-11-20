// @vitest-environment jsdom
// 21 Nov, D-85 PR B: Home's mini firm brain, the orb at its centre. 20 Nov 2026, chat pill PR 1b (D-97): Home has no
// question box of its own; the chat pill is the one place to ask. Home keeps the greeting, the orb, how many past
// engagements the firm can learn from and a way into Firm brain, and says so plainly when nothing is shared yet.
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}));
vi.mock("@/hooks/use-motion", () => ({ useReducedMotion: () => true }));
vi.mock("@/components/home/FirmOrb", () => ({ FirmOrb: () => <div data-testid="firm-orb" /> }));

import { HomeAsk } from "@/components/home/HomeAsk";
import { canvasDataFor } from "@/lib/firm-canvas-shared";
import { ORB_COPY } from "@/lib/firm-orb-shared";
import { corpusOf, demoRows, graphOf } from "@/lib/__tests__/helpers/demo-firm-rows";

const MAP = canvasDataFor(graphOf(demoRows()), corpusOf(demoRows()), false);
const NOON = new Date("2026-11-20T13:00:00");

afterEach(cleanup);

describe("Home's mini firm brain", () => {
  it("greets the person, turns the orb, says how much the firm can learn from, and opens Firm brain", () => {
    render(<HomeAsk displayName="Harper Quinn" map={MAP} now={NOON} />);
    expect(screen.getByRole("heading", { name: "Afternoon, Harper" })).toBeTruthy();
    expect(screen.getByTestId("firm-orb")).toBeTruthy();
    expect(screen.getByText(ORB_COPY.learnFrom(MAP.threads.length))).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open Firm brain" }).getAttribute("href")).toBe(
      "/firm-brain",
    );
  });

  it("has no question box, starter or Ask button of its own: the chat pill asks", () => {
    render(<HomeAsk displayName="Harper Quinn" map={MAP} now={NOON} />);
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByTestId("ask-the-firm")).toBeNull();
  });

  it("shows a quiet frame while the map loads, and nothing else", () => {
    render(<HomeAsk displayName="Harper Quinn" mapLoading now={NOON} />);
    expect(screen.getByTestId("firm-orb-loading")).toBeTruthy();
    expect(screen.queryByTestId("firm-orb")).toBeNull();
  });

  it("says plainly when nothing is shared with the firm yet, with the one next step", () => {
    render(<HomeAsk displayName="Harper Quinn" map={{ ...MAP, threads: [] }} now={NOON} />);
    expect(screen.getByTestId("firm-orb-empty").textContent).toBe(
      `${ORB_COPY.empty} ${ORB_COPY.emptyNext}`,
    );
    expect(screen.queryByTestId("firm-orb")).toBeNull();
  });

  it("counts one engagement in the singular", () => {
    expect(ORB_COPY.learnFrom(1)).toBe("1 past engagement the firm can learn from");
    expect(ORB_COPY.learnFrom(30)).toBe("30 past engagements the firm can learn from");
  });

  it("says nothing about the firm when the map could not be read", () => {
    render(<HomeAsk displayName="" map={null} now={NOON} />);
    expect(screen.getByRole("heading", { name: "Afternoon" })).toBeTruthy();
    expect(screen.queryByTestId("firm-orb-empty")).toBeNull();
  });
});
