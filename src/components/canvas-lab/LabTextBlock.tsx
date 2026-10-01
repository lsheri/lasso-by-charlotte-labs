import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";

import type { LabNode, LabResizeCorner } from "@/components/canvas-lab/canvas-lab-model";
import { Button } from "@/components/ui/button";
import { WORKBOARD_TEXT_COLOURS, WORKBOARD_TEXT_MAX_LENGTH, WORKBOARD_TEXT_SIZES, WORKBOARD_TEXT_WEIGHTS, type WorkboardTextBody } from "@/lib/canvas-lab-shared";

const CORNERS: LabResizeCorner[] = ["nw", "ne", "se", "sw"];

/**
 * TX1: the body of a text block moves it; editing the words is a deliberate
 * second step (double click, or Enter while selected). A read-only board
 * (layoutEditable false) keeps the old transparent behaviour, so nothing on a
 * shared board can be moved or edited.
 */
export function LabTextBlock({ node, selected, editable, layoutEditable, onSelect, onDragStart, onResizeStart, onResizeKeyDown, onResizeKeyUp, onChange, onCommit, onRemove }: {
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
  const body: WorkboardTextBody = { text: node.summary, size: node.textSize ?? "label", weight: node.textWeight ?? "medium", colour: node.textColour ?? "ink" };
  // A freshly added block (selected, editable, still empty at mount) opens in
  // edit mode so adding text and typing stays one step.
  const [editing, setEditing] = useState(() => selected && editable && body.text.length === 0);
  const sectionRef = useRef<HTMLElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const live = layoutEditable || editable;
  const style = { left: node.x, top: node.y, width: node.width, height: node.height, pointerEvents: live || selected ? "auto" : "none" } satisfies CSSProperties;
  const change = (patch: Partial<WorkboardTextBody>) => onChange({ ...body, ...patch });

  useEffect(() => {
    if (!editing) return;
    textRef.current?.focus();
    const onOutside = (event: PointerEvent) => {
      if (sectionRef.current && event.target instanceof Node && sectionRef.current.contains(event.target)) return;
      setEditing(false);
    };
    document.addEventListener("pointerdown", onOutside, true);
    return () => document.removeEventListener("pointerdown", onOutside, true);
  }, [editing]);

  // Losing the selection always ends editing.
  useEffect(() => { if (!selected && editing) setEditing(false); }, [selected, editing]);

  const enterEdit = () => {
    if (!editable) return;
    onSelect();
    setEditing(true);
  };

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
        if (event.key === "Enter" && selected && !editing && editable) { event.preventDefault(); setEditing(true); }
      }}>
      {(["top", "right", "bottom", "left"] as const).map((edge) => <button key={edge} type="button" tabIndex={-1} aria-label={`Move text block from ${edge} edge`} className="canvas-lab-text-block-edge" data-edge={edge} onPointerDown={(event) => { event.stopPropagation(); onSelect(); onDragStart(event); }} />)}
      <textarea ref={textRef} aria-label="Text block words" maxLength={WORKBOARD_TEXT_MAX_LENGTH} value={body.text} readOnly={!editable || !editing} placeholder="Type something" style={live && !editing ? { pointerEvents: "none" } : undefined}
        onPointerDown={(event) => event.stopPropagation()}
        onChange={(event) => change({ text: event.target.value })}
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          event.preventDefault();
          event.stopPropagation();
          setEditing(false);
          sectionRef.current?.focus();
        }}
        onBlur={() => onCommit(body)} />
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
