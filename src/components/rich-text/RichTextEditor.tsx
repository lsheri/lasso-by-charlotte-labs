import { useEffect, useRef, useState } from "react";
import { EditorContent, Extension, useEditor } from "@tiptap/react";
import { Plugin } from "@tiptap/pm/state";
import StarterKit from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Underline from "@tiptap/extension-underline";
import { Bold, Italic, Underline as UnderlineIcon, Strikethrough, List, ListOrdered, RemoveFormatting } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PALETTE, SIZES, RICH_TEXT_CSS, plainToRichHtml, richToPlainText, sanitizeRichHtml } from "@/lib/rich-text";

export const COPY = {
  bold: "Bold", italic: "Italic", underline: "Underline", strike: "Strikethrough",
  highlight: ["Yellow highlight", "Green highlight", "Blue highlight", "Rose highlight"],
  colour: ["Primary text", "Secondary text", "Green text", "Blue text", "Rose text", "Amber text"],
  size: "Text size", sizes: { small: "Small", body: "Body", large: "Large", heading: "Heading" },
  bullets: "Bullet list", numbered: "Numbered list", clear: "Clear formatting", limit: "Limit reached", editor: "Text",
};

const SizedTextStyle = TextStyle.extend({
  addAttributes() {
    return { ...this.parent?.(), fontSize: {
      default: null,
      parseHTML: (element: HTMLElement) => Object.values(SIZES).find((size) => size === element.style.fontSize) ?? null,
      renderHTML: (attributes: Record<string, unknown>) => Object.values(SIZES).some((size) => size === attributes['fontSize']) ? { style: `font-size: ${attributes['fontSize']}` } : {},
    } };
  },
});
const SafeHighlight = Highlight.extend({
  addKeyboardShortcuts() { return { "Mod-Shift-h": () => this.editor.commands.toggleHighlight({ color: PALETTE.highlight[0] }) }; },
});

export default function RichTextEditor({ initialHtml, onChange, onDone, autoFocus = false, maxChars = 5000 }: {
  initialHtml: string; onChange: (html: string, plain: string) => void; onDone: () => void; autoFocus?: boolean; maxChars?: number;
}) {
  const root = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onChange, onDone });
  callbacks.current = { onChange, onDone };
  const max = useRef(maxChars);
  max.current = Math.max(0, maxChars);
  const [limitReached, setLimitReached] = useState(false);
  const [, refresh] = useState(0);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [3] }, underline: false, link: false, code: false, codeBlock: false, horizontalRule: false }),
      Underline, SafeHighlight.configure({ multicolor: true }), SizedTextStyle, Color,
      Extension.create({ name: "characterLimit", addProseMirrorPlugins() { return [new Plugin({
        filterTransaction(transaction, state) {
          if (!transaction.docChanged) return true;
          const length = transaction.doc.textContent.length;
          const allowed = length <= max.current || length < state.doc.textContent.length;
          setLimitReached(!allowed || length >= max.current);
          return allowed;
        },
      })]; } }),
    ],
    content: (() => { const safe = sanitizeRichHtml(initialHtml); const plain = richToPlainText(safe); return plain.length > max.current ? plainToRichHtml(plain.slice(0, max.current)) : safe; })(),
    autofocus: autoFocus,
    editorProps: {
      attributes: { class: "rich-text outline-none min-h-20", role: "textbox", "aria-label": COPY.editor, "aria-multiline": "true" },
      transformPastedHTML: sanitizeRichHtml,
      handleKeyDown: (_view, event) => { if (event.key !== "Escape") return false; event.preventDefault(); callbacks.current.onDone(); return true; },
    },
    onUpdate: ({ editor: current }) => { const html = sanitizeRichHtml(current.getHTML()); callbacks.current.onChange(html, richToPlainText(html)); },
    onSelectionUpdate: () => refresh((value) => value + 1),
    onTransaction: () => refresh((value) => value + 1),
  });
  useEffect(() => {
    const outside = (event: PointerEvent) => { if (event.target instanceof Node && root.current && !root.current.contains(event.target)) callbacks.current.onDone(); };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);
  const target = "h-7 w-7 min-w-7 p-0 [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11 [@media(pointer:coarse)]:min-w-11";
  const tools = [
    { label: COPY.bold, icon: Bold, active: "bold", run: () => editor?.chain().focus().toggleBold().run() },
    { label: COPY.italic, icon: Italic, active: "italic", run: () => editor?.chain().focus().toggleItalic().run() },
    { label: COPY.underline, icon: UnderlineIcon, active: "underline", run: () => editor?.chain().focus().toggleUnderline().run() },
    { label: COPY.strike, icon: Strikethrough, active: "strike", run: () => editor?.chain().focus().toggleStrike().run() },
    { label: COPY.bullets, icon: List, active: "bulletList", run: () => editor?.chain().focus().toggleBulletList().run() },
    { label: COPY.numbered, icon: ListOrdered, active: "orderedList", run: () => editor?.chain().focus().toggleOrderedList().run() },
    { label: COPY.clear, icon: RemoveFormatting, active: "", run: () => editor?.chain().focus().unsetAllMarks().clearNodes().run() },
  ];
  return <div ref={root} className="relative text-foreground">
    <style>{RICH_TEXT_CSS}</style>
    <div role="toolbar" className="absolute bottom-full left-0 z-50 mb-2 flex max-w-[calc(100vw-2rem)] flex-wrap items-center gap-1 rounded-[var(--radius-control)] border border-border bg-background p-1 shadow-sm" onPointerDown={(event) => { if (!(event.target instanceof HTMLSelectElement)) event.preventDefault(); }}>
      {tools.map(({ label, icon: Icon, active, run }) => <Button key={label} type="button" variant="ghost" className={target} title={label} aria-label={label} aria-pressed={active ? editor?.isActive(active) ?? false : undefined} onClick={run}><Icon /></Button>)}
      {PALETTE.highlight.map((colour, index) => <Button key={colour} type="button" variant="ghost" className={target} title={COPY.highlight[index]} aria-label={COPY.highlight[index]} aria-pressed={editor?.isActive("highlight", { color: colour }) ?? false} onClick={() => editor?.chain().focus().toggleHighlight({ color: colour }).run()}><span className="h-3 w-3 border border-border" style={{ backgroundColor: colour }} /></Button>)}
      {PALETTE.text.map((colour, index) => <Button key={colour} type="button" variant="ghost" className={target} title={COPY.colour[index]} aria-label={COPY.colour[index]} aria-pressed={editor?.isActive("textStyle", { color: colour }) ?? false} onClick={() => editor?.chain().focus().setColor(colour).run()}><span className="h-3 w-3 rounded-full" style={{ backgroundColor: colour }} /></Button>)}
      <select aria-label={COPY.size} className="h-7 border border-border bg-background px-1 text-[13px] [@media(pointer:coarse)]:h-11" value={editor?.getAttributes("textStyle")['fontSize'] ?? SIZES.body} onChange={(event) => { if (Object.values(SIZES).some((size) => size === event.target.value)) editor?.chain().focus().setMark("textStyle", { fontSize: event.target.value }).run(); }}>
        {Object.entries(SIZES).map(([key, value]) => <option key={key} value={value}>{COPY.sizes[key as keyof typeof SIZES]}</option>)}
      </select>
    </div>
    <EditorContent editor={editor} />
    {limitReached ? <p role="status" className="mt-1 text-[13px] text-soft">{COPY.limit}</p> : null}
  </div>;
}