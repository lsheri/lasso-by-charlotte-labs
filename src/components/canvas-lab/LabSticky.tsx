import { MentionTextEditor } from "@/components/canvas-lab/MentionTextEditor";
import { clampMentions, serializeMentions, type Mention } from "@/lib/mention-shared";
import type { MentionCandidate } from "@/lib/mention-editor";
import { stableMemo } from "@/components/canvas-lab/stable-memo";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";

import type { LabNode, LabResizeCorner } from "@/components/canvas-lab/canvas-lab-model";
import {
  WORKBOARD_STICKY_FILLS,
  WORKBOARD_TEXT_MAX_LENGTH,
  type WorkboardStickyBody,
} from "@/lib/canvas-lab-shared";

import { RichTextView } from "@/components/rich-text/RichTextView";
import { plainToRichHtml } from "@/lib/rich-text";
import { stickyClickTypes, stickyStartsEditing, stickyTriggerEntersEdit } from "@/lib/card-click";
import { Link2, Trash2 } from "lucide-react";

const RichTextEditor = lazy(() => import("@/components/rich-text/RichTextEditor"));

const CORNERS: LabResizeCorner[] = ["nw", "ne", "se", "sw"];

export function stickyBodyOf(node: LabNode): WorkboardStickyBody {
  return { text: node.summary, ...(node.mentions !== undefined ? { mentions: node.mentions } : {}), ...(node.html !== undefined ? { html: node.html } : {}), size: node.textSize ?? "body", weight: node.textWeight ?? "regular", colour: node.textColour ?? "ink", fill: node.stickyFill ?? "yellow" };
}

/** STICKY-2: the four sizes as short labels in the bar. */
const STICKY_SIZE_CHOICES = [["small", "S", "Small"], ["body", "M", "Body"], ["label", "L", "Label"], ["heading", "XL", "Heading"]] as const;

/**
 * A note a person puts on the board. Plain paper, never a source: no brand
 * mark, no engagement edge, no fold. The sticky never grows on its own; the
 * words scroll inside it.
 */
function LabStickyInner({ node, selected, editable, layoutEditable, onSelect, onDragStart, onResizeStart, onResizeKeyDown, onResizeKeyUp, onChange, onCommit, onRemove, mentionCandidates }: {
  node: LabNode;
  mentionCandidates?: readonly MentionCandidate[] | undefined;
  selected: boolean;
  editable: boolean;
  layoutEditable: boolean;
  onSelect: () => void;
  onDragStart: (event: ReactPointerEvent<HTMLElement>) => void;
  onResizeStart: (corner: LabResizeCorner, event: ReactPointerEvent<HTMLButtonElement>) => void;
  onResizeKeyDown: (corner: LabResizeCorner, event: ReactKeyboardEvent<HTMLButtonElement>) => void;
  onResizeKeyUp: (event: ReactKeyboardEvent<HTMLButtonElement>) => void;
  onChange: (body: WorkboardStickyBody) => void;
  onCommit: (body: WorkboardStickyBody, field: "text" | "style" | "fill") => void;
  onRemove: () => void;
}) {
  const body: WorkboardStickyBody = stickyBodyOf(node);
  // Drafts stay inside this node until the existing commit callback runs.
  const draft = useRef<{ html?: string; text: string; mentions?: Mention[] } | null>(null);
  const touched = useRef(false);
  const [fallbackText, setFallbackText] = useState<string | null>(null);
  const [plainDraft, setPlainDraft] = useState({ text: body.text, mentions: body.mentions ?? [] });
  const [editing, setEditing] = useState(() => stickyStartsEditing({ selected, editable, textLength: body.text.length }));
  // Editing mode is fixed when editing begins, so candidates arriving mid-edit never swap the editor under a draft.
  const plainEditingRef = useRef(mentionCandidates !== undefined);
  const plainEditing = plainEditingRef.current;
  const [formattingOpen, setFormattingOpen] = useState(false);
  useEffect(() => { if (!selected) setFormattingOpen(false); }, [selected]);
  const editingRef = useRef(editing);
  const baseline = useRef({ text: body.text, html: body.html ?? plainToRichHtml(body.text), mentions: serializeMentions(body.mentions ?? []) });
  const sectionRef = useRef<HTMLElement>(null);
  // STICKY-1: where a press on an already-selected sticky began; a click there (no drag) starts typing.
  const typePressRef = useRef<{ x: number; y: number } | null>(null);
  const enterEdit = () => {
    if (!editable || editingRef.current) return;
    setFormattingOpen(false);
    baseline.current = { text: body.text, html: body.html ?? plainToRichHtml(body.text), mentions: serializeMentions(body.mentions ?? []) };
    draft.current = null;
    touched.current = false;
    setFallbackText(null);
    setPlainDraft({ text: body.text, mentions: body.mentions ?? [] });
    plainEditingRef.current = mentionCandidates !== undefined;
    editingRef.current = true;
    onSelect();
    setEditing(true);
  };
  const finish = () => {
    if (!editingRef.current) return;
    editingRef.current = false;
    setEditing(false);
    const value = draft.current;
    draft.current = null;
    setFallbackText(null);
    if (!value || (value.text === baseline.current.text && (plainEditingRef.current || value.html === baseline.current.html) && JSON.stringify(serializeMentions(value.mentions ?? body.mentions ?? [])) === JSON.stringify(baseline.current.mentions))) return;
    const { html: previousHtml, ...plainBody } = body;
    const next = { ...plainBody, text: value.text, ...(value.html !== undefined ? { html: value.html } : {}), ...(value.mentions !== undefined ? { mentions: clampMentions(value.mentions, value.text.length) } : {}) };
    onChange(next);
    onCommit(next, "text");
  };
  const style = { left: node.x, top: node.y, width: node.width, height: node.height } satisfies CSSProperties;
  const choose = (patch: Partial<WorkboardStickyBody>, field: "style" | "fill") => { const next = { ...body, ...patch, ...(body.mentions !== undefined ? { mentions: clampMentions(body.mentions, body.text.length) } : {}) }; onChange(next); onCommit(next, field); };
  return (
    <section ref={sectionRef} data-editing={editing} data-movable={layoutEditable} data-testid={`sticky-${node.id}`} data-selected={selected} data-colour={body.colour} data-fill={body.fill} data-size={body.size} data-weight={body.weight} aria-label="Sticky" tabIndex={0} className="canvas-lab-sticky absolute" style={style} onFocus={onSelect} onDoubleClick={() => { if (stickyTriggerEntersEdit("doubleClick", editable)) enterEdit(); }} onPointerDown={(event) => { if (editing) return; typePressRef.current = selected && editable && event.button === 0 ? { x: event.clientX, y: event.clientY } : null; if (!selected) onSelect(); if (layoutEditable) onDragStart(event); }} onPointerUp={(event) => { const start = typePressRef.current; typePressRef.current = null; if (!start || editing || !stickyClickTypes(start, { x: event.clientX, y: event.clientY })) return; enterEdit(); }}>
      {layoutEditable ? (["top", "right", "bottom", "left"] as const).map((edge) => <span key={edge} aria-hidden="true" className="canvas-lab-text-block-edge" data-edge={edge} onPointerDown={(event) => { event.stopPropagation(); onSelect(); onDragStart(event); }} />) : null}
      <style>{`
        .canvas-lab-sticky .node-rich { height: 100%; }
        .canvas-lab-sticky .node-rich > .relative { height: 100%; }
        .canvas-lab-sticky .node-rich .tiptap { height: 100%; min-height: 0; overflow-y: auto; }
        .canvas-lab-sticky .node-rich > .rich-text { height: 100%; overflow-y: auto; }
        .canvas-lab-sticky .node-rich .rich-text { color: var(--nb-ink); font-family: var(--font-ui); line-height: 1.35; }
        .canvas-lab-sticky[data-editing="true"] { z-index: 40; }
        .canvas-lab-sticky > .canvas-lab-text-block-controls { max-width: calc(100vw - 3rem); flex-wrap: wrap; }
        .canvas-lab-sticky[data-editing="true"] > .canvas-lab-text-block-controls { top: calc(100% + 8px); bottom: auto; }
        .canvas-lab-sticky[data-size="small"] .node-rich .rich-text { font-size: 11.5px; }.canvas-lab-sticky[data-size="body"] .node-rich .rich-text { font-size: 13px; }.canvas-lab-sticky[data-size="label"] .node-rich .rich-text { font-size: 16px; }.canvas-lab-sticky[data-size="heading"] .node-rich .rich-text { font-size: 26px; }
        .canvas-lab-sticky[data-weight="regular"] .node-rich .rich-text { font-weight: 400; }.canvas-lab-sticky[data-weight="medium"] .node-rich .rich-text { font-weight: 500; }.canvas-lab-sticky[data-weight="bold"] .node-rich .rich-text { font-weight: 700; }
        .canvas-lab-sticky[data-colour="ink"] .node-rich .rich-text { color: var(--nb-ink); }.canvas-lab-sticky[data-colour="graphite"] .node-rich .rich-text { color: var(--nb-graphite); }.canvas-lab-sticky[data-colour="mid"] .node-rich .rich-text { color: var(--nb-mid); }.canvas-lab-sticky[data-colour="green"] .node-rich .rich-text { color: var(--nb-green); }.canvas-lab-sticky[data-colour="blue"] .node-rich .rich-text { color: var(--nb-blue); }
      `}</style>
      {editing && plainEditing ? <MentionTextEditor text={plainDraft.text} mentions={plainDraft.mentions} candidates={mentionCandidates ?? []} label="Sticky words" placeholder="Write here" maxLength={WORKBOARD_TEXT_MAX_LENGTH} className="h-full resize-none text-base" onChange={(text, mentions) => { draft.current = { text, mentions }; setPlainDraft({ text, mentions }); }} onDone={finish} /> : editing ? <div className="node-rich" onInputCapture={() => { touched.current = true; }} onClickCapture={() => { touched.current = true; }} onKeyDownCapture={(event) => { if (event.key !== "Escape") touched.current = true; }} onPointerDown={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
        <Suspense fallback={<textarea aria-label="Sticky words" autoFocus maxLength={WORKBOARD_TEXT_MAX_LENGTH} value={fallbackText ?? body.text} placeholder="Write here"
          onChange={(event) => { const text = event.target.value; draft.current = { text, html: plainToRichHtml(text) }; setFallbackText(text); }}
          onBlur={finish} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); finish(); } }} />}>
          <RichTextEditor variant="compact" toolbarVisible={selected && formattingOpen} initialHtml={draft.current?.html ?? body.html ?? plainToRichHtml(body.text)} autoFocus maxChars={WORKBOARD_TEXT_MAX_LENGTH}
            onChange={(html, text) => { if (touched.current) draft.current = { html, text }; }} onDone={finish} />
        </Suspense>
      </div> : body.html !== undefined ? <div className="node-rich"><RichTextView html={body.html} /></div>
        : <textarea aria-label="Sticky words" maxLength={WORKBOARD_TEXT_MAX_LENGTH} value={body.text} readOnly placeholder="Write here" />}
      {selected && layoutEditable ? <div className="canvas-lab-text-block-controls canvas-lab-sticky-bar" role="group" aria-label="Sticky formatting" onPointerDown={(event) => event.stopPropagation()} onDoubleClick={(event) => event.stopPropagation()}>
        {/* STICKY-2 (F1): one slim bar above the note. Colour, size, bold and delete always there; link and list join while typing. */}
        {editable ? <>
          <div className="canvas-lab-sticky-swatches" role="group" aria-label="Sticky colour">
            {WORKBOARD_STICKY_FILLS.map((fill) => <button key={fill} type="button" className="canvas-lab-sticky-swatch" data-fill={fill} aria-label={fill} aria-pressed={body.fill === fill} onPointerDown={(event) => event.preventDefault()} onClick={() => choose({ fill }, "fill")} />)}
          </div>
          <span className="canvas-lab-sticky-bar-sep" aria-hidden="true" />
          <div className="canvas-lab-sticky-sizes" role="group" aria-label="Text size">
            {STICKY_SIZE_CHOICES.map(([value, short, name]) => <button key={value} type="button" aria-label={`${name} text`} aria-pressed={body.size === value} onPointerDown={(event) => event.preventDefault()} onClick={() => choose({ size: value }, "style")}>{short}</button>)}
          </div>
          <span className="canvas-lab-sticky-bar-sep" aria-hidden="true" />
          <button type="button" className="canvas-lab-sticky-bold" aria-label="Bold" aria-pressed={body.weight === "bold"} onPointerDown={(event) => event.preventDefault()} onClick={() => choose({ weight: body.weight === "bold" ? "regular" : "bold" }, "style")}>B</button>
          {editing ? <button type="button" aria-label="Link and list" title="Link and list" aria-pressed={formattingOpen} onPointerDown={(event) => event.preventDefault()} onClick={() => setFormattingOpen((open) => !open)}><Link2 size={14} aria-hidden="true" /></button> : null}
          <span className="canvas-lab-sticky-bar-sep" aria-hidden="true" />
        </> : null}
        <button type="button" aria-label="Remove sticky" title="Remove sticky" onClick={onRemove}><Trash2 size={14} aria-hidden="true" /></button>
      </div> : null}
      {selected && layoutEditable ? CORNERS.map((corner) => <button key={corner} type="button" className="canvas-lab-resize-handle" data-corner={corner} aria-label={`Resize sticky from ${corner}`} onPointerDown={(event) => onResizeStart(corner, event)} onKeyDown={(event) => onResizeKeyDown(corner, event)} onKeyUp={onResizeKeyUp} />) : null}
    </section>
  );
}

/** BB-3: memoized so typing in one card never re-renders its siblings. */
export const LabSticky = stableMemo(LabStickyInner);
