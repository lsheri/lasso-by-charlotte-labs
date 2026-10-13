// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { sanitizeRichHtml, richToPlainText } from "@/lib/rich-text";
import { STARTER_KIT_OPTIONS, toolbarControls } from "@/components/rich-text/RichTextEditor";

let editor: Editor | null = null;
afterEach(() => { editor?.destroy(); editor = null; });

function make(html = "<p></p>") {
  editor = new Editor({ extensions: [StarterKit.configure(STARTER_KIT_OPTIONS), Underline], content: html });
  return editor;
}
/** Type text the way a keyboard does, so input rules run. */
function type(e: Editor, text: string) {
  for (const char of text) {
    const { from, to } = e.state.selection;
    const handled = e.view.someProp("handleTextInput", (fn) => fn(e.view, from, to, char, () => e.state.tr.insertText(char, from, to)));
    if (!handled) e.view.dispatch(e.state.tr.insertText(char, from, to));
  }
}
/** Save then reload: sanitise the editor's HTML and load it into a fresh editor. */
function roundTrip(html: string) {
  const saved = sanitizeRichHtml(html);
  const reloaded = make(saved).getHTML();
  return { saved, reloaded: sanitizeRichHtml(reloaded) };
}

describe("BI-3 typing rules", () => {
  it.each([
    ["## Title", "heading", { level: 2 }],
    ["- item", "bulletList", {}],
    ["* item", "bulletList", {}],
    ["1. item", "orderedList", {}],
    ["> said", "blockquote", {}],
  ] as const)("%s starts the right block", (input, node, attrs) => {
    const e = make();
    e.commands.focus("end");
    type(e, input);
    expect(e.isActive(node, attrs)).toBe(true);
  });

  it("binds bold, italic and underline shortcuts", () => {
    const e = make("<p>x</p>");
    const keys = e.extensionManager.extensions.flatMap((ext) => Object.keys(((ext.config.addKeyboardShortcuts as unknown as ((this: unknown) => object) | undefined)?.call({ editor: e, options: ext.options, storage: {}, name: ext.name, type: undefined, parent: undefined } as never) ?? {}) as object));
    expect(keys).toEqual(expect.arrayContaining(["Mod-b", "Mod-i", "Mod-u"]));
  });
});

describe("BI-3 save and reload", () => {
  it.each([
    ["<h2>Plan</h2>", /<h2>Plan<\/h2>/],
    ["<h3>Older heading</h3>", /<h3>Older heading<\/h3>/],
    ["<ul><li><p>a</p></li><li><p>b</p></li></ul>", /<ul><li><p>a<\/p><\/li><li><p>b<\/p><\/li><\/ul>/],
    ["<ol><li><p>one</p></li></ol>", /<ol><li><p>one<\/p><\/li><\/ol>/],
    ['<ol start="3"><li><p>three</p></li></ol>', /<ol start="3">/],
    ["<blockquote><p>q</p></blockquote>", /<blockquote><p>q<\/p><\/blockquote>/],
  ])("%s survives", (html, kept) => {
    const { saved, reloaded } = roundTrip(html);
    expect(saved).toMatch(kept);
    expect(reloaded).toMatch(kept);
  });

  it("reads a heading 2 as its own line in plain text", () => {
    expect(richToPlainText("<h2>Plan</h2><p>Next</p>")).toBe("Plan\nNext");
  });

  it("still strips scripts, handlers, links, images and unknown attributes", () => {
    const html = sanitizeRichHtml('<script>alert(1)</script><h2 onclick="x()" class="c" id="i">T</h2><ol start="2" onmouseover="y()"><li>a</li></ol><img src=x onerror="z()"><a href="https://e.com">l</a><h1>big</h1>');
    expect(html).not.toMatch(/script|onclick|onmouseover|onerror|class=|id=|<img|<a\b|<h1/);
    expect(html).toContain("<h2>T</h2>");
    expect(html).toContain('<ol start="2">');
  });
});

describe("BI-3 toolbar sets", () => {
  it("the compact set is a subset of the full set and keeps every control", () => {
    const full = toolbarControls("full");
    const compact = toolbarControls("compact");
    expect(compact.every((control) => full.includes(control))).toBe(true);
    expect(compact).toEqual(full);
  });
});
