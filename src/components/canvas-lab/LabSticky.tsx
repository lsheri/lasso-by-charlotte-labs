import { useRef } from "react";
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

const CORNERS: LabResizeCorner[] = ["nw", "ne", "se", "sw"];

export function stickyBodyOf(node: LabNode): WorkboardStickyBody {
  return { text: node.summary, size: node.textSize ?? "body", weight: node.textWeight ?? "regular", colour: node.textColour ?? "ink", fill: node.stickyFill ?? "yellow" };
}

/**
 * A note a person puts on the board. Plain paper, never a source: no brand
 * mark, no engagement edge, no fold. The sticky never grows on its own; the
 * words scroll inside it.
 */
export function LabSticky({ node, selected, editable, layoutEditable, onSelect, onDragStart, onResizeStart, onResizeKeyDown, onResizeKeyUp, onChange, onCommit, onRemove }: {
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
  const body = stickyBodyOf(node);
  // Only a real change to the words is saved on blur, so a click that merely
  // leaves the sticky never races the next save.
  const committedText = useRef(body.text);
  const style = { left: node.x, top: node.y, width: node.width, height: node.height } satisfies CSSProperties;
  const choose = (patch: Partial<WorkboardStickyBody>, field: "style" | "fill") => { const next = { ...body, ...patch }; onChange(next); onCommit(next, field); };
  return (
    <section data-testid={`sticky-${node.id}`} data-selected={selected} data-fill={body.fill} data-size={body.size} data-weight={body.weight} aria-label="Sticky" tabIndex={0} className="canvas-lab-sticky absolute" style={style} onFocus={onSelect} onPointerDown={(event) => { if (!selected) { onSelect(); return; } onDragStart(event); }}>
      {(["top", "right", "bottom", "left"] as const).map((edge) => <span key={edge} aria-hidden="true" className="canvas-lab-text-block-edge" data-edge={edge} onPointerDown={(event) => { event.stopPropagation(); onSelect(); onDragStart(event); }} />)}
      <textarea aria-label="Sticky words" maxLength={WORKBOARD_TEXT_MAX_LENGTH} value={body.text} readOnly={!editable} placeholder="Write here" onPointerDown={(event) => { event.stopPropagation(); onSelect(); }} onChange={(event) => onChange({ ...body, text: event.target.value })} onBlur={() => { if (body.text === committedText.current) return; committedText.current = body.text; onCommit(body, "text"); }} />
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
