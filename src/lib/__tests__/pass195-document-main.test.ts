import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const contextCardSource = readFileSync(
  new URL("../../components/engagements/ContextCard.tsx", import.meta.url),
  "utf8",
);
const engagementPageSource = readFileSync(
  new URL("../../pages/EngagementPage.tsx", import.meta.url),
  "utf8",
);

describe("pass 195 document main view", () => {
  it("renders the larger, firmer paperclip without changing its path", () => {
    expect(contextCardSource).toContain('width="24"');
    expect(contextCardSource).toContain('strokeWidth="2"');
    expect(contextCardSource).toContain("var(--nb-mid)");
    expect(contextCardSource).toContain(
      'd="M13 40 C 8.4 40, 6.2 36.6, 6.2 32.6 L 6.2 11.5 C 6.2 7.6, 8.9 5.2, 12.6 5.2 C 16.3 5.2, 18.8 7.7, 18.8 11.4 L 18.8 31.5 C 18.8 34, 17.2 35.6, 15 35.6 C 12.8 35.6, 11.2 34.1, 11.2 31.6 L 11.2 13"',
    );
  });

  it("keeps Ask visible beside an open document", () => {
    expect(engagementPageSource).not.toContain(
      "hidden={Boolean(lensItem) || Boolean(peekItem)}",
    );
  });

  it("keeps document panel reporting reachable", () => {
    expect(engagementPageSource).toContain("content: panelContent");
    expect(engagementPageSource).toMatch(/peekItem[\s\S]*?\?\s*isDeliverableType\(peekItem\.type\)[\s\S]*?\?\s*"document"/);
  });

  it("renders the document in the main column before the aside", () => {
    const mainIndex = engagementPageSource.indexOf('className="nb-bench-main"');
    const peekIndex = engagementPageSource.indexOf("<PeekBody", mainIndex);
    const asideIndex = engagementPageSource.indexOf('className="nb-bench-aside"');

    expect(mainIndex).toBeGreaterThan(-1);
    expect(peekIndex).toBeGreaterThan(mainIndex);
    expect(peekIndex).toBeLessThan(asideIndex);
  });
});