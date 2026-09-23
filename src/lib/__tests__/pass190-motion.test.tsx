// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SpiderLassoScene } from "@/components/motion/SpiderLassoScene";
import { MOTION_SCENES } from "@/lib/motion-scenes";

const read = (path: string) => readFileSync(path, "utf8");

describe("pass 190 motion", () => {
  it("is decorative and has no interactive content", () => {
    const { container } = render(<SpiderLassoScene />);
    expect(container.querySelector("button")).toBeNull();
    expect(container.querySelector("a")).toBeNull();
    expect(container.querySelector("[tabindex]")).toBeNull();
  });

  it("inlines the lasso path so its stroke can be trimmed", () => {
    const source = read("src/components/motion/SpiderLassoScene.tsx");
    expect(source).toContain("<svg");
    expect(source).toContain("<motion.path");
    expect(source).not.toContain('lasso-loop.svg"');
  });

  it("shares one timeline duration", () => {
    const source = read("src/components/motion/SpiderLassoScene.tsx");
    expect(source.match(/4\.2/g)).toHaveLength(1);
  });

  it("allows settings to be opened from the Inbox", () => {
    const context = read("src/lib/settings-dialog-context.tsx");
    const connectors = read("src/components/settings/ConnectorsSection.tsx");
    expect(context).toContain('"inbox"');
    expect(connectors).toMatch(/resolvedFrom[\s\S]*openedFrom/);
  });

  it("pauses every repeated movement on the shared interval", () => {
    const source = read("src/components/motion/SpiderLassoScene.tsx");
    expect(source.match(/repeatDelay:/g)).toHaveLength(source.match(/repeat:/g)?.length ?? 0);
    expect(source.match(/const LOOP_PAUSE = 10;/g)).toHaveLength(1);
  });

  it("can omit its caption when it sits behind a page", () => {
    const { container } = render(<SpiderLassoScene caption={false} />);
    expect(container.textContent).not.toContain("Pull the conversations");
  });

  it("removes the notebook spider from the Inbox", () => {
    expect(read("src/pages/WorkPage.tsx")).not.toContain("NotebookSpider");
  });

  it("registers only real scene files and pauses every paused loop", () => {
    for (const entry of MOTION_SCENES) {
      expect(existsSync(entry.path)).toBe(true);
      if (entry.loop === "loop-with-pause") expect(entry.pauseMs).not.toBeNull();
    }
  });

  it("keeps the scene index out of the event motion registry", () => {
    expect(read("src/lib/motion-registry.ts")).not.toContain("MOTION_SCENES");
  });

  it("keeps the source card while retiring the colour legend and explanatory line", () => {
    const source = read("src/pages/WorkPage.tsx");
    const where = source.indexOf("WHERE THIS CAME FROM");
    const legend = source.indexOf("ONE COLOUR PER");
    const line = source.indexOf("the columns are what it is");
    expect(where).toBeGreaterThan(-1);
    expect(legend).toBe(-1);
    expect(line).toBe(-1);
  });

  it("caps the bring-work-in button row so it clears the background drawing", () => {
    const source = read("src/pages/WorkPage.tsx");
    const match = source.match(/BRING WORK IN[\s\S]*?<div className="([^"]+)"/);
    expect(match?.[1] ?? "").toMatch(/max-w-\[/);
  });
});