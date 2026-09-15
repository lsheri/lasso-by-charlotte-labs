import { readFileSync } from "node:fs";

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SpiderLassoScene } from "@/components/notebook/SpiderLassoScene";

const read = (path: string) => readFileSync(path, "utf8");

describe("pass 189 lasso scene", () => {
  it("is decorative and has no interactive content", () => {
    const { container } = render(<SpiderLassoScene />);
    expect(container.querySelector("button")).toBeNull();
    expect(container.querySelector("a")).toBeNull();
    expect(container.querySelector("[tabindex]")).toBeNull();
  });

  it("inlines the lasso path so its stroke can be trimmed", () => {
    const source = read("src/components/notebook/SpiderLassoScene.tsx");
    expect(source).toContain("<svg");
    expect(source).toContain("<motion.path");
    expect(source).not.toContain('lasso-loop.svg"');
  });

  it("shares one timeline duration", () => {
    const source = read("src/components/notebook/SpiderLassoScene.tsx");
    expect(source.match(/4\.2/g)).toHaveLength(1);
  });

  it("allows settings to be opened from the Inbox", () => {
    const context = read("src/lib/settings-dialog-context.tsx");
    const connectors = read("src/components/settings/ConnectorsSection.tsx");
    expect(context).toContain('"inbox"');
    expect(connectors).toMatch(/resolvedFrom[\s\S]*openedFrom/);
  });
});