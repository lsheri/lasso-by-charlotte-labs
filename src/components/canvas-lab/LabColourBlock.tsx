import type { CSSProperties, PointerEvent as ReactPointerEvent, KeyboardEvent as ReactKeyboardEvent } from "react";

import type { LabNode, LabResizeCorner } from "@/components/canvas-lab/canvas-lab-model";

const COLOUR_VARS = {
  green: "var(--nb-lasso-green-wash)",
  blue: "var(--paper-5)",
  rose: "var(--paper-6)",
  yellow: "var(--nb-yellow-wash)",
  lavender: "var(--paper-7)",
  grey: "var(--paper-3)",
} as const;

const CORNERS: LabResizeCorner[] = ["nw", "ne", "se", "sw"];

export function LabColourBlock({ node, selected, editable, onSelect, onDragStart, onResizeStart, onResizeKeyDown, onResizeKeyUp, onRemove }: {
  node: LabNode;
  selected: boolean;
  editable: boolean;
  onSelect: () => void;
  onDragStart: (event: ReactPointerEvent<HTMLElement>) => void;
  onResizeStart: (corner: LabResizeCorner, event: ReactPointerEvent<HTMLButtonElement>) => void;
  onResizeKeyDown: (corner: LabResizeCorner, event: ReactKeyboardEvent<HTMLButtonElement>) => void;
  onResizeKeyUp: (event: ReactKeyboardEvent<HTMLButtonElement>) => void;
  onRemove: () => void;
}) {
  const style = {
    left: node.x, top: node.y, width: node.width, height: node.height,
    background: COLOUR_VARS[node.colour ?? "green"],
    pointerEvents: selected ? "auto" : "none",
  } satisfies CSSProperties;
  return (
    <section
      data-testid={`colour-block-${node.id}`}
      data-selected={selected}
      aria-label="Colour block"
      tabIndex={selected ? 0 : -1}
      className="canvas-lab-colour-block absolute"
      style={style}
      onPointerDown={(event) => { if (!selected) return; onDragStart(event); }}
      onFocus={onSelect}
    >
      {(["top", "right", "bottom", "left"] as const).map((edge) => (
        <button key={edge} type="button" tabIndex={-1} aria-label={`Move colour block from ${edge} edge`} className="canvas-lab-colour-block-edge" data-edge={edge} onPointerDown={(event) => { event.stopPropagation(); onSelect(); onDragStart(event); }} />
      ))}
      {selected && editable ? <button type="button" className="canvas-lab-colour-block-remove" onPointerDown={(event) => event.stopPropagation()} onClick={onRemove}>Remove block</button> : null}
      {selected && editable ? CORNERS.map((corner) => <button key={corner} type="button" className="canvas-lab-resize-handle" data-corner={corner} aria-label={`Resize colour block from ${corner}`} onPointerDown={(event) => onResizeStart(corner, event)} onKeyDown={(event) => onResizeKeyDown(corner, event)} onKeyUp={onResizeKeyUp} />) : null}
    </section>
  );
}