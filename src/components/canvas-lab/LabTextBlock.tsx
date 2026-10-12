import { stableMemo } from "@/components/canvas-lab/stable-memo";
import { lazy, Suspense, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";

import type { LabNode, LabResizeCorner } from "@/components/canvas-lab/canvas-lab-model";
import { Button } from "@/components/ui/button";
import { WORKBOARD_TEXT_COLOURS, WORKBOARD_TEXT_MAX_LENGTH, WORKBOARD_TEXT_SIZES, WORKBOARD_TEXT_WEIGHTS, type WorkboardTextBody } from "@/lib/canvas-lab-shared";

import { RichTextView } from "@/components/rich-text/RichTextView";
import { plainToRichHtml } from "@/lib/rich-text";

const RichTextEditor = lazy(() => import("@/components/rich-text/RichTextEditor"));

const CORNERS: LabResizeCorner[] = ["nw", "ne", "se", "sw"];

/**
 * TX1: the body of a text block moves it; editing the words is a deliberate
 * second step (double click, or Enter while selected). A read-only board
 * (layoutEditable false) keeps the old transparent behaviour, so nothing on a
 * shared board can be moved or edited.
 */
function LabTextBlockInner({ node, selected, editable, layoutEditable, onSelect, onDragStart, onResizeStart, onResizeKeyDown, onResizeKeyUp, onChange, onCommit, onRemove }: {
  node: LabNode;
  selected: boolean;
  editable: boolean;
  layoutEditable: boolean;
  onSelect: () => void;
  onDragStart: (event: ReactPointerEvent<HTMLElement>) => void;
  onResizeStart: (corner: LabResizeCorner, event: ReactPointerEvent<HTMLButtonElement>) => void;
  onResizeKeyDown: (corner: LabResizeCorner, event: ReactKeyboardEvent<HTMLButtonElement>) => void;
  onResizeKeyUp: (event: ReactKeyboardEvent<HTMLButtonElement>) => void;
  onChange: (body: WorkboardTextBody) => void;
  onCommit: (body: WorkboardTextBody) => void;
  onRemove: () => void;
}) {
  const body: WorkboardTextBody = { text: node.summary, ...(node.html !== undefined ? { html: node.html } : {}), size: node.textSize ?? "label", weight: node.textWeight ?? "medium", colour: node.textColour ?? "ink" };
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
    onCommit(next);
  };
  const style = { left: node.x, top: node.y, width: node.width, height: node.height, pointerEvents: layoutEditable || editable || selected ? "auto" : "none" } satisfies CSSProperties;
  return (
    <section ref={sectionRef} data-testid={`text-block-${node.id}`} data-selected={selected} data-editing={editing} data-empty={body.text.length === 0} data-size={body.size} data-weight={body.weight} data-colour={body.colour} aria-label="Text block" tabIndex={selected ? 0 : -1} className="canvas-lab-text-block absolute" style={style} onFocus={onSelect}
      onPointerDown={(event) => {
        if (editing || !layoutEditable) return;
        onSelect();
        onDragStart(event);
      }}
      onDoubleClick={enterEdit}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" && selected && !editing && editable) { event.preventDefault(); enterEdit(); }
      }}>
      {(["top", "right", "bottom", "left"] as const).map((edge) => <button key={edge} type="button" tabIndex={-1} aria-label={`Move text block from ${edge} edge`} className="canvas-lab-text-block-edge" data-edge={edge} onPointerDown={(event) => { event.stopPropagation(); onSelect(); onDragStart(event); }} />)}
      <style>{`
        .canvas-lab-text-block .node-rich { height: 100%; }
        .canvas-lab-text-block .node-rich > .relative { height: 100%; }
        .canvas-lab-text-block .node-rich .tiptap { height: 100%; min-height: 0; overflow-y: auto; }
        .canvas-lab-text-block .node-rich > .rich-text { height: 100%; overflow-y: auto; }
        .canvas-lab-text-block .node-rich .rich-text { color: var(--nb-ink); font-family: var(--font-ui); line-height: 1.25; }
        .canvas-lab-text-block[data-editing="true"] { z-index: 40; }
        .canvas-lab-text-block[data-editing="true"] > .canvas-lab-text-block-controls { top: calc(100% + 8px); bottom: auto; }
        .canvas-lab-text-block[data-size="small"] .node-rich .rich-text { font-size: 11.5px; }.canvas-lab-text-block[data-size="body"] .node-rich .rich-text { font-size: 13px; }.canvas-lab-text-block[data-size="label"] .node-rich .rich-text { font-size: 16px; }.canvas-lab-text-block[data-size="heading"] .node-rich .rich-text { font-size: 26px; }
        .canvas-lab-text-block[data-weight="regular"] .node-rich .rich-text { font-weight: 400; }.canvas-lab-text-block[data-weight="medium"] .node-rich .rich-text { font-weight: 500; }.canvas-lab-text-block[data-weight="bold"] .node-rich .rich-text { font-weight: 700; }
        .canvas-lab-text-block[data-colour="ink"] .node-rich .rich-text { color: var(--nb-ink); }.canvas-lab-text-block[data-colour="graphite"] .node-rich .rich-text { color: var(--nb-graphite); }.canvas-lab-text-block[data-colour="mid"] .node-rich .rich-text { color: var(--nb-mid); }.canvas-lab-text-block[data-colour="green"] .node-rich .rich-text { color: var(--nb-green); }.canvas-lab-text-block[data-colour="blue"] .node-rich .rich-text { color: var(--nb-blue); }
      `}</style>
      {editing ? <div className="node-rich" onPointerDown={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
        <Suspense fallback={<textarea aria-label="Text block words" autoFocus maxLength={WORKBOARD_TEXT_MAX_LENGTH} value={fallbackText ?? body.text} placeholder="Type something"
          onChange={(event) => { const text = event.target.value; draft.current = { text, html: plainToRichHtml(text) }; setFallbackText(text); }}
          onBlur={finish} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); finish(); } }} />}>
          <RichTextEditor initialHtml={draft.current?.html ?? body.html ?? plainToRichHtml(body.text)} autoFocus maxChars={WORKBOARD_TEXT_MAX_LENGTH}
            onChange={(html, text) => { draft.current = { html, text }; }} onDone={finish} />
        </Suspense>
      </div> : body.html !== undefined ? <div className="node-rich" onClick={() => { if (!body.text) enterEdit(); }}><RichTextView html={body.html} /></div>
        : <textarea aria-label="Text block words" maxLength={WORKBOARD_TEXT_MAX_LENGTH} value={body.text} readOnly placeholder="Type something" onPointerDown={(event) => { event.stopPropagation(); onSelect(); }} onClick={() => { if (!body.text) enterEdit(); }} />}
      {selected && layoutEditable ? <div className="canvas-lab-text-block-controls" onPointerDown={(event) => event.stopPropagation()}>
        {editable ? <><select aria-label="Text size" value={body.size} onChange={(event) => { const next = { ...body, size: event.target.value as WorkboardTextBody["size"] }; onChange(next); onCommit(next); }}>{WORKBOARD_TEXT_SIZES.map((value) => <option key={value} value={value}>{value}</option>)}</select>
        <select aria-label="Text weight" value={body.weight} onChange={(event) => { const next = { ...body, weight: event.target.value as WorkboardTextBody["weight"] }; onChange(next); onCommit(next); }}>{WORKBOARD_TEXT_WEIGHTS.map((value) => <option key={value} value={value}>{value}</option>)}</select>
        <select aria-label="Text colour" value={body.colour} onChange={(event) => { const next = { ...body, colour: event.target.value as WorkboardTextBody["colour"] }; onChange(next); onCommit(next); }}>{WORKBOARD_TEXT_COLOURS.map((value) => <option key={value} value={value}>{value}</option>)}</select></> : null}
        <Button type="button" size="sm" variant="ghost" onClick={onRemove}>Remove text block</Button>
      </div> : null}
      {selected && layoutEditable ? CORNERS.map((corner) => <button key={corner} type="button" className="canvas-lab-resize-handle" data-corner={corner} aria-label={`Resize text block from ${corner}`} onPointerDown={(event) => onResizeStart(corner, event)} onKeyDown={(event) => onResizeKeyDown(corner, event)} onKeyUp={onResizeKeyUp} />) : null}
    </section>
  );
}

/** BB-3: memoized so typing in one card never re-renders its siblings. */
export const LabTextBlock = stableMemo(LabTextBlockInner);
