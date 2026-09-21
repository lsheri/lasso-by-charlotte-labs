import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";

import type { LabNode, LabResizeCorner } from "@/components/canvas-lab/canvas-lab-model";
import { Button } from "@/components/ui/button";
import { WORKBOARD_TEXT_COLOURS, WORKBOARD_TEXT_MAX_LENGTH, WORKBOARD_TEXT_SIZES, WORKBOARD_TEXT_WEIGHTS, type WorkboardTextBody } from "@/lib/canvas-lab-shared";

const CORNERS: LabResizeCorner[] = ["nw", "ne", "se", "sw"];

export function LabTextBlock({ node, selected, editable, onSelect, onDragStart, onResizeStart, onResizeKeyDown, onResizeKeyUp, onChange, onCommit, onRemove }: {
  node: LabNode;
  selected: boolean;
  editable: boolean;
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
  const style = { left: node.x, top: node.y, width: node.width, height: node.height, pointerEvents: selected ? "auto" : "none" } satisfies CSSProperties;
  const change = (patch: Partial<WorkboardTextBody>) => onChange({ ...body, ...patch });
  return (
    <section data-testid={`text-block-${node.id}`} data-selected={selected} data-empty={body.text.length === 0} data-size={body.size} data-weight={body.weight} data-colour={body.colour} aria-label="Text block" tabIndex={selected ? 0 : -1} className="canvas-lab-text-block absolute" style={style} onFocus={onSelect} onPointerDown={(event) => { if (selected) onDragStart(event); }}>
      {(["top", "right", "bottom", "left"] as const).map((edge) => <button key={edge} type="button" tabIndex={-1} aria-label={`Move text block from ${edge} edge`} className="canvas-lab-text-block-edge" data-edge={edge} onPointerDown={(event) => { event.stopPropagation(); onSelect(); onDragStart(event); }} />)}
      <textarea aria-label="Text block words" maxLength={WORKBOARD_TEXT_MAX_LENGTH} value={body.text} readOnly={!editable} placeholder="Type something" onPointerDown={(event) => event.stopPropagation()} onChange={(event) => change({ text: event.target.value })} onBlur={() => onCommit(body)} />
      {selected && editable ? <div className="canvas-lab-text-block-controls" onPointerDown={(event) => event.stopPropagation()}>
        <select aria-label="Text size" value={body.size} onChange={(event) => { const next = { ...body, size: event.target.value as WorkboardTextBody["size"] }; onChange(next); onCommit(next); }}>{WORKBOARD_TEXT_SIZES.map((value) => <option key={value} value={value}>{value}</option>)}</select>
        <select aria-label="Text weight" value={body.weight} onChange={(event) => { const next = { ...body, weight: event.target.value as WorkboardTextBody["weight"] }; onChange(next); onCommit(next); }}>{WORKBOARD_TEXT_WEIGHTS.map((value) => <option key={value} value={value}>{value}</option>)}</select>
        <select aria-label="Text colour" value={body.colour} onChange={(event) => { const next = { ...body, colour: event.target.value as WorkboardTextBody["colour"] }; onChange(next); onCommit(next); }}>{WORKBOARD_TEXT_COLOURS.map((value) => <option key={value} value={value}>{value}</option>)}</select>
        <Button type="button" size="sm" variant="ghost" onClick={onRemove}>Remove text block</Button>
      </div> : null}
      {selected && editable ? CORNERS.map((corner) => <button key={corner} type="button" className="canvas-lab-resize-handle" data-corner={corner} aria-label={`Resize text block from ${corner}`} onPointerDown={(event) => onResizeStart(corner, event)} onKeyDown={(event) => onResizeKeyDown(corner, event)} onKeyUp={onResizeKeyUp} />) : null}
    </section>
  );
}