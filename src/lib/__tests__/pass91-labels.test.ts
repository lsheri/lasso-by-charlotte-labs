import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync("src/styles.css", "utf8");
const read = (p: string) => readFileSync(p, "utf8");

describe("pass91 label colour hierarchy", () => {
  it("declares the two label utilities on the existing tokens", () => {
    expect(styles).toMatch(/@utility micro-label-section \{\s*color: var\(--nb-blue\);/);
    expect(styles).toMatch(/@utility micro-label-ai \{\s*color: var\(--nb-green\);/);
  });

  it("keeps plain micro-label grey for nested field labels", () => {
    expect(styles).toMatch(/@utility micro-label \{[^}]*color: var\(--nb-mid\);/);
  });

  it("defines the variants after the base utility so they win on order", () => {
    expect(styles.indexOf("@utility micro-label {")).toBeLessThan(
      styles.indexOf("@utility micro-label-section {"),
    );
  });

  it("paints structural section labels blue", () => {
    const eng = read("src/pages/EngagementPage.tsx");
    // Pass 95: those two headings became sticky note titles on the same page.
    expect(eng).toContain('title="Coaching and sharing"');
    const panel = read("src/components/engagements/EngagementBriefPanel.tsx");
    expect(panel).toContain('<p className="micro-label">Brief and details</p>');
    // nested field labels inside the brief panel stay grey
    expect(panel).toContain('<p className="micro-label">Client</p>');
    expect(panel).toContain('<p className="micro-label">Brief</p>');

    expect(read("src/components/firm/FirmPanels.tsx")).toContain(
      '<h2 className="micro-label micro-label-section">{title}</h2>',
    );
    expect(read("src/components/firm/PrivacyPanel.tsx")).toContain("micro-label micro-label-section");
    expect(read("src/components/firm/ChecksLibrary.tsx")).toContain(
      '<h2 className="micro-label micro-label-section">Checks library</h2>',
    );
    expect(read("src/components/engagements/EngagementCanvas.tsx")).toContain(
      '<h2 className="micro-label micro-label-section">Workstreams</h2>',
    );
    expect(read("src/components/engagements/EngagementBriefSection.tsx")).toContain(
      '<h2 className="micro-label micro-label-section">The brief</h2>',
    );
    expect(read("src/components/settings/DataUseCard.tsx")).toContain(
      '<h2 className="micro-label micro-label-section">Data use</h2>',
    );
  });

  it("paints AI-presence labels green and never as a filled surface", () => {
    expect(read("src/components/reflect/AnalysisLens.tsx")).toContain("micro-label micro-label-ai");
    expect(read("src/components/reflect/AskSurface.tsx")).toContain(
      '<p className="micro-label micro-label-ai pr-12">Ask Lasso</p>',
    );
    expect(read("src/components/peek/AiReads.tsx")).toContain("micro-label micro-label-ai");
    expect(styles).not.toMatch(/@utility micro-label-ai \{[^}]*background/);
  });

  it("keeps grey field labels inside firm panels", () => {
    expect(read("src/components/firm/FirmPanels.tsx")).toContain('<p className="micro-label">{label}</p>');
    expect(read("src/pages/FirmDashboardPage.tsx")).toContain('<p className="micro-label">Seats</p>');
  });
});
