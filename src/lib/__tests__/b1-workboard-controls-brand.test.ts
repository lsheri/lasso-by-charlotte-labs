import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("B1 workboard controls and brand identity", () => {
  it("uses one labelled workstream switch without changing event values", () => {
    const page = read("src/pages/CanvasLabPage.tsx");
    expect(page).toContain(">Show workstreams</Label>");
    expect(page).toContain('checked={structureMode === "structured"}');
    expect(page).toContain('checked ? "structured" : "freeform"');
    expect(page).toContain("noteWorkboardStructureToggled(orgId, next)");
    expect(page).not.toContain(">Structured</Button>");
    expect(page).not.toContain(">Freeform</Button>");
  });

  it("keeps negative coordinates scoped to the Workboard", () => {
    const drag = read("src/lib/canvas-drag.ts");
    const page = read("src/pages/CanvasLabPage.tsx");
    const model = read("src/components/canvas-lab/canvas-lab-model.ts");
    expect(drag).toContain("allowNegative = false");
    expect(page).toContain("dragTo(drag.origin, delta, true)");
    expect(page).toContain("event.shiftKey, true)");
    expect(model).toContain("snapPoint(to, true)");
  });

  it("keeps workstream and card option buttons visible and large enough", () => {
    const frameMenu = read("src/components/canvas-lab/LabFrameMenu.tsx");
    const cardMenu = read("src/components/canvas-lab/LabCardMenu.tsx");
    const styles = read("src/styles.css");
    expect(frameMenu).toContain('aria-label="Workstream options"');
    expect(cardMenu).toContain('aria-label="Card options"');
    expect(styles).toMatch(/\.canvas-lab-frame-menu-trigger \{[^}]*width: 28px;[^}]*height: 28px;[^}]*opacity: 1;/s);
    expect(styles).toMatch(/\.canvas-lab-card-menu-trigger \{[^}]*width: 28px;[^}]*height: 28px;[^}]*opacity: 1;/s);
  });

  it("publishes the same loop mark through site and MCP identity", () => {
    const root = read("src/routes/__root.tsx");
    const home = read("src/routes/index.tsx");
    const personal = read("src/routes/personal.tsx");
    const mcp = read("src/lib/mcp-handler.server.ts");
    expect(root).toContain('href: "/favicon.svg"');
    expect(root).toContain('href: "/favicon-32.png"');
    expect(root).toContain('href: "/apple-touch-icon.png"');
    for (const route of [home, personal]) {
      expect(route).toContain('content: "summary_large_image"');
      expect(route).toContain('content: "https://lasso.charlotte-labs.com/og-image.png"');
    }
    expect(mcp).toContain('name: "Lasso"');
    expect(mcp).toContain('websiteUrl: SITE_URL');
    expect(mcp).toContain('`${SITE_URL}/favicon.svg`');
  });
});