import { Maximize2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { LabFrameMenu } from "@/components/canvas-lab/LabFrameMenu";
import type { LabFrame as LabFrameModel, LabResizeCorner } from "@/components/canvas-lab/canvas-lab-model";
import { Button } from "@/components/ui/button";

const CORNERS: LabResizeCorner[] = ["nw", "ne", "se", "sw"];

export function LabFrame({ frame, count, selected, editable, custom, namedByWorkstream, removable, onSelect, onResizeStart, onResizeKeyDown, onResizeKeyUp, onFit, onRename, onRemove, onMenuOpened, onMenuOpenChange }: {
  frame: LabFrameModel;
  count: number;
  selected: boolean;
  editable: boolean;
  custom: boolean;
  namedByWorkstream: boolean;
  removable: boolean;
  onSelect: () => void;
  onResizeStart: (corner: LabResizeCorner, event: React.PointerEvent<HTMLButtonElement>) => void;
  onFit: () => void;
  onRename: (name: string) => void;
  onRemove: () => void;
  onMenuOpened: () => void;
  onMenuOpenChange: (open: boolean) => void;
  onResizeKeyDown?: ((corner: LabResizeCorner, event: React.KeyboardEvent<HTMLButtonElement>) => void) | undefined;
  onResizeKeyUp?: ((event: React.KeyboardEvent<HTMLButtonElement>) => void) | undefined;
}) {
  const frameRef = useRef<HTMLElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(frame.name);
  const [renameError, setRenameError] = useState(false);

  useEffect(() => {
    if (!renaming) setDraftName(frame.name);
  }, [frame.name, renaming]);

  useEffect(() => {
    if (renaming) inputRef.current?.select();
  }, [renaming]);

  function changeMenuOpen(open: boolean) {
    if (open && !menuOpen) onMenuOpened();
    setMenuOpen(open);
    onMenuOpenChange(open);
  }

  function openMenu(event: React.MouseEvent | React.KeyboardEvent) {
    event.preventDefault();
    event.stopPropagation();
    changeMenuOpen(true);
  }

  function beginRename() {
    if (!editable || !custom) return;
    setDraftName(frame.name);
    setRenameError(false);
    setRenaming(true);
  }

  function commitRename() {
    const next = draftName.trim();
    if (!next) {
      setRenameError(true);
      return;
    }
    setRenameError(false);
    setRenaming(false);
    if (next !== frame.name) onRename(next);
  }

  return (
    <section
      ref={frameRef}
      data-testid={`lab-frame-${frame.id}`}
      data-selected={selected}
      tabIndex={0}
      style={{ left: frame.x, top: frame.y, width: frame.width, height: frame.height }}
      className="canvas-lab-frame absolute outline-none"
      onPointerDown={(event) => { if (event.target === event.currentTarget) onSelect(); }}
      onContextMenu={openMenu}
      onKeyDown={(event) => {
        if ((event.shiftKey && event.key === "F10") || event.key === "ContextMenu") openMenu(event);
      }}
    >
      <div className="absolute inset-x-3 top-2 flex items-baseline justify-between gap-2">
        {renaming ? (
          <div>
            <input
              ref={inputRef}
              aria-label="Rename workstream"
              className="canvas-lab-frame-name-input font-hand text-[18px] leading-none text-[var(--nb-mid)]"
              value={draftName}
              maxLength={60}
              onChange={(event) => { setDraftName(event.target.value); if (event.target.value.trim()) setRenameError(false); }}
              onBlur={commitRename}
              onPointerDown={(event) => event.stopPropagation()}
              onKeyDown={(event) => {
                event.stopPropagation();
                if (event.key === "Enter") { event.preventDefault(); commitRename(); }
                if (event.key === "Escape") { event.preventDefault(); setDraftName(frame.name); setRenameError(false); setRenaming(false); }
              }}
            />
            {renameError ? <span className="canvas-lab-frame-name-error font-hand">a workstream needs a name</span> : null}
          </div>
        ) : (
          <h2
            className="font-hand text-[18px] leading-none text-[var(--nb-mid)]"
            title={namedByWorkstream ? "Named by the workstream" : undefined}
            onDoubleClick={custom && editable ? beginRename : undefined}
          >
            {frame.name}
          </h2>
        )}
        <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-soft">{count} {frame.local ? "· local" : ""}</span>
      </div>
      <LabFrameMenu open={menuOpen} onOpenChange={changeMenuOpen} frameRef={frameRef} editable={editable} custom={custom} removable={removable} onFit={onFit} onRename={beginRename} onRemove={onRemove} />
      {selected && editable ? <Button type="button" size="icon" variant="ghost" className="canvas-lab-frame-fit" aria-label={`Fit ${frame.name} to its cards`} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onFit(); }}><Maximize2 className="h-3 w-3" /></Button> : null}
      {selected && editable ? CORNERS.map((corner) => <button key={corner} type="button" className="canvas-lab-resize-handle" data-corner={corner} aria-label={`Resize ${frame.name} from ${corner}`} onPointerDown={(event) => { event.stopPropagation(); onResizeStart(corner, event); }} onKeyDown={(event) => onResizeKeyDown?.(corner, event)} onKeyUp={onResizeKeyUp} />) : null}
    </section>
  );
}