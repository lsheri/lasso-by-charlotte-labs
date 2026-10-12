import { stableMemo } from "@/components/canvas-lab/stable-memo";
import { lazy, Suspense, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";

import type { LabNode, LabResizeCorner } from "@/components/canvas-lab/canvas-lab-model";
import { Button } from "@/components/ui/button";
import {
  WORKBOARD_STICKY_FILLS,
  WORKBOARD_TEXT_MAX_LENGTH,
  WORKBOARD_TEXT_SIZES,
  WORKBOARD_TEXT_WEIGHTS,
  type WorkboardStickyBody,
} from "@/lib/canvas-lab-shared";

import { RichTextView } from "@/components/rich-text/RichTextView";
import { plainToRichHtml } from "@/lib/rich-text";

const RichTextEditor = lazy(() => import("@/components/rich-text/RichTextEditor"));

const CORNERS: LabResizeCorner[] = ["nw", "ne", "se", "sw"];

export function stickyBodyOf(node: LabNode): WorkboardStickyBody {
  return { text: node.summary, ...(node.html !== undefined ? { html: node.html } : {}), size: node.textSize ?? "body", weight: node.textWeight ?? "regular", colour: node.textColour ?? "ink", fill: node.stickyFill ?? "yellow" };
}

/**
 * A note a person puts on the board. Plain paper, never a source: no brand
 * mark, no engagement edge, no fold. The sticky never grows on its own; the
 * words scroll inside it.
 */
function LabStickyInner({ node, selected, editable, layoutEditable, onSelect, onDragStart, onResizeStart, onResizeKeyDown, onResizeKeyUp, onChange, onCommit, onRemove }: {
  node: LabNode;
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
  const draft = useRef<{ html: string; text: string } | null>(null);
  const [fallbackText, setFallbackText] = useState<string | null>(null);
  const [editing, setEditing] = useState(() => selected && editable && body.text.length === 0);
  const editingRef = useRef(editing);
  const baseline = useRef({ text: body.text, html: body.html ?? plainToRichHtml(body.text) });
  const sectionRef = useRef<HTMLElement>(null);
  const enterEdit = () => {
    if (!editable || editingRef.current) return;
    baseline.current = { text: body.text, html: body.html ?? plainToRichHtml(body.text) };
    draft.current = null;
    setFallbackText(null);
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
    if (!value || (value.text === baseline.current.text && value.html === baseline.current.html)) return;
    const next = { ...body, text: value.text, html: value.html };
    onChange(next);
    onCommit(next, "text");
  };
  const style = { left: node.x, top: node.y, width: node.width, height: node.height } satisfies CSSProperties;
  const choose = (patch: Partial<WorkboardStickyBody>, field: "style" | "fill") => { const next = { ...body, ...patch }; onChange(next); onCommit(next, field); };
  return (
    <section ref={sectionRef} data-editing={editing} data-testid={`sticky-${node.id}`} data-selected={selected} data-colour={body.colour} data-fill={body.fill} data-size={body.size} data-weight={body.weight} aria-label="Sticky" tabIndex={0} className="canvas-lab-sticky absolute" style={style} onFocus={onSelect} onDoubleClick={enterEdit} onPointerDown={(event) => { if (editing) return; if (!selected) { onSelect(); return; } onDragStart(event); }}>
      {(["top", "right", "bottom", "left"] as const).map((edge) => <span key={edge} aria-hidden="true" className="canvas-lab-text-block-edge" data-edge={edge} onPointerDown={(event) => { event.stopPropagation(); onSelect(); onDragStart(event); }} />)}
      <style>{`
        .canvas-lab-sticky .node-rich { height: 100%; }
        .canvas-lab-sticky .node-rich > .relative { height: 100%; }
        .canvas-lab-sticky .node-rich .tiptap { height: 100%; min-height: 0; overflow-y: auto; }
        .canvas-lab-sticky .node-rich > .rich-text { height: 100%; overflow-y: auto; }
        .canvas-lab-sticky .node-rich .rich-text { color: var(--nb-ink); font-family: var(--font-ui); line-height: 1.35; }
        .canvas-lab-sticky[data-editing="true"] { z-index: 40; }
        .canvas-lab-sticky[data-editing="true"] > .canvas-lab-text-block-controls { top: calc(100% + 8px); bottom: auto; }
        .canvas-lab-sticky[data-size="small"] .node-rich .rich-text { font-size: 11.5px; }.canvas-lab-sticky[data-size="body"] .node-rich .rich-text { font-size: 13px; }.canvas-lab-sticky[data-size="label"] .node-rich .rich-text { font-size: 16px; }.canvas-lab-sticky[data-size="heading"] .node-rich .rich-text { font-size: 26px; }
        .canvas-lab-sticky[data-weight="regular"] .node-rich .rich-text { font-weight: 400; }.canvas-lab-sticky[data-weight="medium"] .node-rich .rich-text { font-weight: 500; }.canvas-lab-sticky[data-weight="bold"] .node-rich .rich-text { font-weight: 700; }
        .canvas-lab-sticky[data-colour="ink"] .node-rich .rich-text { color: var(--nb-ink); }.canvas-lab-sticky[data-colour="graphite"] .node-rich .rich-text { color: var(--nb-graphite); }.canvas-lab-sticky[data-colour="mid"] .node-rich .rich-text { color: var(--nb-mid); }.canvas-lab-sticky[data-colour="green"] .node-rich .rich-text { color: var(--nb-green); }.canvas-lab-sticky[data-colour="blue"] .node-rich .rich-text { color: var(--nb-blue); }
      `}</style>
      {editing ? <div className="node-rich" onPointerDown={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
        <Suspense fallback={<textarea aria-label="Sticky words" autoFocus maxLength={WORKBOARD_TEXT_MAX_LENGTH} value={fallbackText ?? body.text} placeholder="Write here"
          onChange={(event) => { const text = event.target.value; draft.current = { text, html: plainToRichHtml(text) }; setFallbackText(text); }}
          onBlur={finish} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); finish(); } }} />}>
          <RichTextEditor initialHtml={draft.current?.html ?? body.html ?? plainToRichHtml(body.text)} autoFocus maxChars={WORKBOARD_TEXT_MAX_LENGTH}
            onChange={(html, text) => { draft.current = { html, text }; }} onDone={finish} />
        </Suspense>
      </div> : body.html !== undefined ? <div className="node-rich" onClick={() => { if (!body.text) enterEdit(); }}><RichTextView html={body.html} /></div>
        : <textarea aria-label="Sticky words" maxLength={WORKBOARD_TEXT_MAX_LENGTH} value={body.text} readOnly placeholder="Write here" onPointerDown={(event) => { event.stopPropagation(); onSelect(); }} onClick={() => { if (!body.text) enterEdit(); }} />}
      {selected && layoutEditable ? <div className="canvas-lab-text-block-controls" onPointerDown={(event) => event.stopPropagation()}>
        {editable ? <>
          <div className="canvas-lab-sticky-swatches" role="group" aria-label="Sticky colour">
            {WORKBOARD_STICKY_FILLS.map((fill) => <button key={fill} type="button" className="canvas-lab-sticky-swatch" data-fill={fill} aria-label={fill} aria-pressed={body.fill === fill} onPointerDown={(event) => event.preventDefault()} onClick={() => choose({ fill }, "fill")} />)}
          </div>
          <select aria-label="Text size" value={body.size} onChange={(event) => choose({ size: event.target.value as WorkboardStickyBody["size"] }, "style")}>{WORKBOARD_TEXT_SIZES.map((value) => <option key={value} value={value}>{value}</option>)}</select>
          <select aria-label="Text weight" value={body.weight} onChange={(event) => choose({ weight: event.target.value as WorkboardStickyBody["weight"] }, "style")}>{WORKBOARD_TEXT_WEIGHTS.map((value) => <option key={value} value={value}>{value}</option>)}</select>
        </> : null}
        <Button type="button" size="sm" variant="ghost" onClick={onRemove}>Remove sticky</Button>
      </div> : null}
      {selected && layoutEditable ? CORNERS.map((corner) => <button key={corner} type="button" className="canvas-lab-resize-handle" data-corner={corner} aria-label={`Resize sticky from ${corner}`} onPointerDown={(event) => onResizeStart(corner, event)} onKeyDown={(event) => onResizeKeyDown(corner, event)} onKeyUp={onResizeKeyUp} />) : null}
    </section>
  );
}

/** BB-3: memoized so typing in one card never re-renders its siblings. */
export const LabSticky = stableMemo(LabStickyInner);
