import { Maximize2 } from "lucide-react";

import type { LabFrame as LabFrameModel, LabResizeCorner } from "@/components/canvas-lab/canvas-lab-model";
import { Button } from "@/components/ui/button";

const CORNERS: LabResizeCorner[] = ["nw", "ne", "se", "sw"];

export function LabFrame({ frame, count, selected, editable, onSelect, onResizeStart, onResizeKeyDown, onResizeKeyUp, onFit }: {
  frame: LabFrameModel;
  count: number;
  selected: boolean;
  editable: boolean;
  onSelect: () => void;
  onResizeStart: (corner: LabResizeCorner, event: React.PointerEvent<HTMLButtonElement>) => void;
  onFit: () => void;
  onResizeKeyDown?: ((corner: LabResizeCorner, event: React.KeyboardEvent<HTMLButtonElement>) => void) | undefined;
  onResizeKeyUp?: ((event: React.KeyboardEvent<HTMLButtonElement>) => void) | undefined;
}) {
  return (
    <section
      data-testid={`lab-frame-${frame.id}`}
      data-selected={selected}
      tabIndex={0}
      style={{ left: frame.x, top: frame.y, width: frame.width, height: frame.height }}
      className="canvas-lab-frame absolute outline-none"
      onPointerDown={(event) => { if (event.target === event.currentTarget) onSelect(); }}
    >
      <div className="absolute inset-x-3 top-2 flex items-baseline justify-between gap-2">
        <h2 className="font-hand text-[18px] leading-none text-[var(--nb-mid)]">{frame.name}</h2>
        <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-soft">{count} {frame.local ? "· local" : ""}</span>
      </div>
      {selected && editable ? <Button type="button" size="icon" variant="ghost" className="canvas-lab-frame-fit" aria-label={`Fit ${frame.name} to its cards`} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onFit(); }}><Maximize2 className="h-3 w-3" /></Button> : null}
      {selected && editable ? CORNERS.map((corner) => <button key={corner} type="button" className="canvas-lab-resize-handle" data-corner={corner} aria-label={`Resize ${frame.name} from ${corner}`} onPointerDown={(event) => { event.stopPropagation(); onResizeStart(corner, event); }} onKeyDown={(event) => onResizeKeyDown?.(corner, event)} onKeyUp={onResizeKeyUp} />) : null}
    </section>
  );
}