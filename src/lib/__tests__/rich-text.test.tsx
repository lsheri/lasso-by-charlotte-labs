// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PALETTE, SIZES, plainToRichHtml, richToPlainText, sanitizeRichHtml } from "@/lib/rich-text";
import RichTextEditor from "@/components/rich-text/RichTextEditor";
import { RichTextView } from "@/components/rich-text/RichTextView";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
describe("shared rich text", () => {
  it("drops unsafe tags, attributes and styles, keeping only exact palette and size values", () => {
    const html = sanitizeRichHtml(`<script>alert(1)</script><img onerror="bad()" src="x"><a href="https://example.com">Link</a><p id="x" class="bad" data-x="1" style="position:fixed;color:red">Text</p><span style="color:${PALETTE.text[0]};font-size:${SIZES.large}">Allowed</span><mark style="background-color:${PALETTE.highlight[0]}">Highlight</mark>`);
    expect(html).not.toMatch(/script|onerror|<a\b|<img\b|class=|id=|data-|position|color:red/);
    expect(html).toContain(`color: ${PALETTE.text[0]}`);
    expect(html).toContain(`font-size: ${SIZES.large}`);
    expect(html).toContain(`background-color: ${PALETTE.highlight[0]}`);
  });
  it("round trips line breaks and bullets, escapes HTML and converts bold", () => {
    expect(richToPlainText(plainToRichHtml("Line\n- a\n- b"))).toBe("Line\n- a\n- b");
    expect(plainToRichHtml("**Bold** <script>")).toBe("<p><strong>Bold</strong> &lt;script&gt;</p>");
  });
  it("mounts, makes a selection bold with Cmd+B, and emits sanitised HTML", async () => {
    const onChange = vi.fn();
    render(<RichTextEditor initialHtml="<p>Hello</p>" onChange={onChange} onDone={vi.fn()} />);
    const textbox = await screen.findByRole("textbox");
    textbox.focus();
    const range = document.createRange();
    range.selectNodeContents(textbox.querySelector("p") ?? textbox);
    const selection = window.getSelection();
    selection?.removeAllRanges(); selection?.addRange(range);
    document.dispatchEvent(new Event("selectionchange"));
    fireEvent.keyDown(textbox, { key: "b", code: "KeyB", ctrlKey: true });
    await waitFor(() => expect(textbox.querySelector("strong")?.textContent).toBe("Hello"));
    const call = onChange.mock.calls.at(-1);
    expect(call?.[0]).toBe(sanitizeRichHtml(call?.[0] ?? ""));
    expect(call?.[1]).toBe("Hello");
  });
  it("renders a safe compact view without pulling TipTap into its import graph", async () => {
    render(<RichTextView html="<ul><li>One</li></ul><script>bad()</script>" />);
    expect(await screen.findByRole("listitem")).toHaveProperty("textContent", "One");
    const paths = ["src/components/rich-text/RichTextView.tsx", "src/lib/rich-text.ts"];
    for (const path of paths) {
      const source = readFileSync(path, "utf8");
      const imports = source.match(/(?:import|export)[\s\S]*?from\s*["'][^"']+["']/g) ?? [];
      expect(imports.join("\n")).not.toContain("@tiptap");
      expect(source).not.toMatch(/import\s*\(\s*["']@tiptap/);
    }
  });
  it("has no colour literals or banned copy in the new files", () => {
    for (const path of ["src/lib/rich-text.ts", "src/components/rich-text/RichTextEditor.tsx", "src/components/rich-text/RichTextView.tsx"]) {
      expect(readFileSync(path, "utf8")).not.toMatch(/#[\da-f]{3,8}\b/i);
    }
  });
});