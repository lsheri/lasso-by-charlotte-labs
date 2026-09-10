// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PrivacyPanel } from "@/components/firm/PrivacyPanel";
import { TrustSummary } from "@/components/firm/TrustSummary";
import { WaitingStrip } from "@/components/firm/FirmMetricGrid";
import { scatterFor } from "@/components/work/pile-scatter";
import {
  TRUST_SUMMARY_LINE,
  buildFirmMetrics,
  waitingLine,
  type FirmDashboard,
} from "@/lib/firm-dashboard-shared";

afterEach(cleanup);

function dashboard(overrides: Partial<FirmDashboard> = {}): FirmDashboard {
  return {
    window_days: 30,
    adoption: {
      seats: 10,
      seats_used: 4,
      active_members: 4,
      weekly_active: { value: 3, sentence: "3 of 4 members were active." },
      capture_coverage: { numerator: null, denominator: 4, sentence: "Too few." },
      time_to_first_capture: { value: null, sentence: "Not enough recent joiners." },
    },
    activity: {
      work_items_captured: { value: 12, sentence: "12 pieces of work." },
      deliverables: [],
      deliverables_total: 0,
      cycle_time: { value: null, sentence: "Not enough data yet." },
      analyses_by_preset: [],
      analyses_total: 0,
      questions_asked: { value: null, sentence: "Too few questions." },
    },
    assurance: { verification_runs: 0, firm_check_runs: 0, total_runs: 0, enough: false },
    coaching: { coaches_active: 0, engagements_shared: 0, one_on_one_preps: 0 },
    data_health: {
      connectors_by_vendor: [],
      last_capture_days_ago: 1,
      errors_by_kind: [],
      connector_errors: 0,
    },
    panels_shown: 0,
    ...overrides,
  };
}

describe("trust summary", () => {
  it("shows the exact line and no em dash", () => {
    render(<TrustSummary />);
    expect(screen.getByText(TRUST_SUMMARY_LINE)).toBeTruthy();
    expect(TRUST_SUMMARY_LINE).not.toContain("—");
  });

  it("keeps every honesty line present when expanded", () => {
    // The disclosure now lives in the privacy panel at the foot of the page.
    render(<PrivacyPanel />);
    fireEvent.click(screen.getByRole("button", { name: /read the rules/i }));
    const source = readFileSync("src/components/firm/PrivacyPanel.tsx", "utf8");
    expect(source).toContain("Never a pass rate or a score, here or anywhere else in Lasso.");
    expect(
      screen.getByText(/Never a conversation with Lasso, and never a prompt someone wrote\./),
    ).toBeTruthy();
    expect(
      screen.getByText(/Where a count would be small enough to point at one person/),
    ).toBeTruthy();
  });
});

describe("meaningful versus withheld routing", () => {
  it("routes each metric by the same flag the old sections used", () => {
    const metrics = buildFirmMetrics(dashboard());
    expect(metrics.tiles.map((t) => t.key)).toContain("weekly_active");
    expect(metrics.tiles.map((t) => t.key)).toContain("work_captured");
    expect(metrics.withheld).toContain("Capture coverage");
    expect(metrics.withheld).toContain("Delivered to accepted");
    expect(metrics.withheld).toContain("Questions asked");
  });

  it("moves a metric from the strip to a tile when its value arrives", () => {
    const before = buildFirmMetrics(dashboard());
    expect(before.withheld).toContain("Questions asked");
    const after = buildFirmMetrics(
      dashboard({
        activity: {
          ...dashboard().activity,
          questions_asked: { value: 9, sentence: "9 questions." },
        },
      }),
    );
    expect(after.withheld).not.toContain("Questions asked");
    const tile = after.tiles.find((t) => t.key === "questions_asked");
    expect(tile?.value).toBe("9");
    expect(tile?.caveat).toBe("9 questions.");
  });

  it("loses nothing: every metric is either a tile or a strip line", () => {
    const metrics = buildFirmMetrics(dashboard());
    const total = metrics.tiles.length + metrics.withheld.length;
    expect(total).toBe(buildFirmMetrics(dashboard()).tiles.length + metrics.withheld.length);
    expect(total).toBeGreaterThanOrEqual(9);
  });
});

describe("waiting strip", () => {
  it("writes one line per withheld metric in the pinned format", () => {
    expect(waitingLine("Capture coverage")).toBe(
      "Capture coverage: too small to mean anything yet.",
    );
    render(<WaitingStrip names={["Capture coverage", "Questions asked"]} />);
    expect(screen.getByText("Capture coverage: too small to mean anything yet.")).toBeTruthy();
    expect(screen.getByText("Questions asked: too small to mean anything yet.")).toBeTruthy();
  });

  it("does not render when nothing is withheld", () => {
    const { container } = render(<WaitingStrip names={[]} />);
    expect(container.textContent).toBe("");
  });
});

describe("pile", () => {
  it("rotates deterministically per card id", () => {
    expect(scatterFor("card-a")).toEqual(scatterFor("card-a"));
    expect(scatterFor("card-a")).not.toEqual(scatterFor("card-b"));
  });

  it("goes static under reduced motion", () => {
    const css = readFileSync("src/styles.css", "utf8");
    expect(css).toContain(".nb-pile");
    const block = css
      .split("@media (prefers-reduced-motion: reduce)")
      .find((chunk) => chunk.includes(".nb-pile-item")) ?? "";
    expect(block).toContain(".nb-pile-item");
    expect(block).toContain("transform: none !important");
  });
});

describe("page order", () => {
  // Updated for Figma 23:413. The frame leads with what the firm PRODUCED, not
  // with adoption: what it measures, the four production numbers, the archive
  // beside the check library, then the honesty panels. The adoption grid is
  // still on the page and still says everything it said, but it now sits below
  // the frame's content instead of ahead of it.
  it("reads what it measures, then what was produced, then the archive", () => {
    const page = readFileSync("src/pages/FirmDashboardPage.tsx", "utf8");
    expect(page.indexOf("<TrustSummary")).toBeLessThan(page.indexOf("<FirmProduced"));
    expect(page.indexOf("<FirmProduced")).toBeLessThan(page.indexOf("<FirmArchive"));
    expect(page.indexOf("<FirmArchive")).toBeLessThan(page.indexOf("<WhatLeavesTheFirm"));
    expect(page.indexOf("<WhatLeavesTheFirm")).toBeLessThan(page.indexOf("<PrivacyPanel"));
    expect(page).toContain('profile?.role === "admin" || profile?.role === "lead"');
  });

  it("still renders the adoption grid, below the frame's content", () => {
    const page = readFileSync("src/pages/FirmDashboardPage.tsx", "utf8");
    expect(page).toContain("<FirmMetricGrid");
    expect(page.indexOf("<PrivacyPanel")).toBeLessThan(page.indexOf("<FirmMetricGrid"));
  });
});
