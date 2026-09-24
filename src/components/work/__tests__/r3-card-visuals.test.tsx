// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChatPreviewWindow, chatBorderTreatment } from "@/components/work/ChatPreviewWindow";
import { sourceVendorKey } from "@/components/work/SourceMark";
const styles = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");

describe("R4 paper preview craft pass", () => {
  it("keeps the 2px graphite edge on flat cards and the 220px preview floor", () => {
    expect(styles).toContain("--nb-card-border-width: 2px");
    expect(styles).toContain("--nb-card-min-height: 220px");
    expect(styles).toMatch(/\.nb-card-surface\s*\{[^}]*border:\s*var\(--nb-card-border-width\) solid var\(--nb-graphite\)/);
    expect(styles).toMatch(/\.nb-preview-card\s*\{[^}]*min-height:\s*var\(--nb-card-min-height\)/);
  });

  it("uses the Ledger border and existing lifted shadow without a sticky ring", () => {
    const paperRules = [...styles.matchAll(/\.nb-paper\s*\{([^}]*)\}/g)].map((match) => match[1] ?? "");
    const finalPaper = paperRules.find((rule) => rule.includes("position: relative")) ?? "";
    const sticky = styles.match(/\.nb-sticky\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(finalPaper).toContain("border: 1px solid var(--nb-mid)");
    expect(finalPaper).toContain("border-left-width: 3px");
    expect(finalPaper).toContain("overflow: hidden");
    expect(finalPaper).toContain("var(--nb-paper-shadow-contact)");
    expect(finalPaper).toContain("var(--nb-paper-shadow-ambient)");
    expect(sticky).toContain("border: 0");
    expect(sticky).not.toContain("0 0 0 4px var(--nb-white)");
    expect(sticky).not.toContain("min-height: var(--nb-card-min-height)");
    expect(styles).toContain(".nb-paper::before { content: none; }");
  });

  it.each([
    ["claude", "claude"],
    ["anthropic", "claude"],
    ["chatgpt", "chatgpt"],
    ["openai", "chatgpt"],
    ["gemini", "gemini"],
    ["copilot", "copilot"],
    ["githubcopilot", "copilot"],
    ["perplexity", "default"],
    [null, "default"],
  ] as const)("maps %s to the %s border", (vendor, expected) => {
    expect(chatBorderTreatment(vendor)).toBe(expected);
  });

  it("renders a clipped conversation excerpt without scroll handlers", () => {
    render(<ChatPreviewWindow vendorKey="claude" turns={[{ turnNo: 1, role: "user", content: "Question" }, { turnNo: 2, role: "assistant", content: "Answer" }]} />);
    const window = screen.getByTestId("chat-preview-window");
    expect(window.getAttribute("data-chat-border")).toBe("claude");
    expect(window.className).toContain("chat-preview-window__body");
    expect(window.getAttribute("data-preview-mode")).toBe("excerpt");
    expect(styles).toMatch(/\.chat-preview-window__body\[data-preview-mode="excerpt"\][^{]*\{[^}]*overflow:\s*hidden/);
    expect(styles).not.toMatch(/\.chat-preview-window__body\s*\{[^}]*overflow-y:\s*auto/);
  });

  it("uses one inset and portrait default with a landscape slide exception", () => {
    expect(styles).toContain("--nb-preview-inset: 10px");
    expect(styles).toMatch(/\[data-preview-shape="portrait"\][^{]*\{[^}]*aspect-ratio:\s*3\s*\/\s*4/);
    expect(styles).toMatch(/\[data-preview-shape="slide"\][^{]*\{[^}]*aspect-ratio:\s*16\s*\/\s*9/);
  });

  it("makes only the enlarged conversation reader scrollable", () => {
    expect(styles).toMatch(/\.focus-paper-reader[^{]*\{[^}]*overflow-y:\s*auto/);
    expect(styles).toMatch(/\.focus-paper[^{]*\{[^}]*var\(--nb-paper-shadow-contact\)[^}]*var\(--nb-paper-shadow-ambient\)/);
  });

  it("keeps the card header marks and vendor border in the enlarged view", () => {
    const overlay = readFileSync(resolve(process.cwd(), "src/components/canvas-lab/FocusOverlay.tsx"), "utf8");
    expect(overlay).toContain("<SourceMark item={item}");
    expect(overlay).toContain("<VendorMark item={item}");
    expect(overlay).toContain("formatDate(effectiveWorkDate(item))");
    expect(overlay).toContain('mode="expanded"');
    expect(overlay).toContain("sourceVendorKey(item)");
  });

  it("reuses sourceVendorKey rather than detecting the vendor again", () => {
    expect(sourceVendorKey({ source: "chatgpt", source_vendor: null, source_meta: {} } as never)).toBe("chatgpt");
  });

  it("keeps every vendor treatment away from Ask Lasso lime", () => {
    const tokenLines = styles.split("\n").filter((line) => /^\s*--nb-chat-border-[^:]+:/.test(line));
    expect(tokenLines).toHaveLength(8);
    expect(tokenLines.join("\n")).not.toContain("#04f85b");
    expect(tokenLines.join("\n")).not.toContain("var(--nb-lasso-green)");
  });

  it("leaves the vendor edge inside the dimmed wrapper", () => {
    expect(styles).not.toMatch(/\.chat-preview-window[^}]*opacity:/);
  });

  it("gives document preview bodies the thinner graphite edge", () => {
    expect(styles).toMatch(/\.nb-document-preview-body[\s\S]*border:\s*var\(--nb-document-border-width\) solid var\(--nb-graphite\)/);
  });
});
