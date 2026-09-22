import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChatPreviewWindow, chatBorderTreatment } from "@/components/work/ChatPreviewWindow";
import { sourceVendorKey } from "@/components/work/SourceMark";
import styles from "@/styles.css?raw";

describe("R3 card and sticky visual pass", () => {
  it("uses a graphite 1.5px shared edge and a 220px preview floor", () => {
    expect(styles).toContain("--nb-card-border-width: 1.5px");
    expect(styles).toContain("--nb-card-min-height: 220px");
    expect(styles).toMatch(/\.nb-paper[\s\S]*border:[^;]*var\(--nb-card-border-width\)[^;]*var\(--nb-graphite\)/);
    expect(styles).toMatch(/\.nb-sticky[\s\S]*border:[^;]*var\(--nb-card-border-width\)[^;]*var\(--nb-graphite\)/);
    expect(styles).toMatch(/\.nb-paper[\s\S]*min-height:\s*var\(--nb-card-min-height\)/);
  });

  it("keeps long card content visible instead of clipping it", () => {
    expect(styles).toMatch(/\.nb-paper[\s\S]*height:\s*auto/);
    expect(styles).not.toMatch(/\.nb-paper\s*\{[^}]*overflow:\s*hidden/);
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

  it("renders a fixed, internally scrollable conversation window", () => {
    render(<ChatPreviewWindow vendorKey="claude" turns={[{ role: "user", text: "Question" }, { role: "assistant", text: "Answer" }]} />);
    const window = screen.getByTestId("chat-preview-window");
    expect(window).toHaveAttribute("data-chat-border", "claude");
    expect(window.className).toContain("chat-preview-window");
    expect(styles).toMatch(/\.chat-preview-window__body[\s\S]*height:\s*var\(--nb-chat-preview-height\)/);
    expect(styles).toMatch(/\.chat-preview-window__body[\s\S]*overflow-y:\s*auto/);
  });

  it("reuses sourceVendorKey rather than detecting the vendor again", () => {
    expect(sourceVendorKey({ source: "chatgpt", source_vendor: null, source_meta: {} } as never)).toBe("chatgpt");
  });

  it("keeps every vendor treatment away from Ask Lasso lime", () => {
    const tokenLines = styles.split("\n").filter((line) => line.includes("--nb-chat-border-"));
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
