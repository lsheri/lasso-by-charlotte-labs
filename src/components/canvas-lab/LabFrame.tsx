import { Maximize2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { LabFrameMenu } from "@/components/canvas-lab/LabFrameMenu";
import type { LabFrame as LabFrameModel, LabResizeCorner } from "@/components/canvas-lab/canvas-lab-model";
import { Button } from "@/components/ui/button";

const CORNERS: LabResizeCorner[] = ["nw", "ne", "se", "sw"];

export function LabFrame({ frame, count, selected, editable, custom, namedByWorkstream, removable, kind, region = false, fillStyle, onAddContext, onSelect, onDragStart, onResizeStart, onResizeKeyDown, onResizeKeyUp, onFit, onRename, onRemove, onMenuOpened, onMenuOpenChange, onAddWorkstream, onUseAsContext }: {
  frame: LabFrameModel;
  count: number;
  selected: boolean;
  editable: boolean;
  custom: boolean;
  namedByWorkstream: boolean;
  removable: boolean;
  kind: "foundation" | "task" | "decisions" | "outputs" | "custom" | "context";
  /** W3: a drawn region. Unnamed it is paint, named it is a workstream. */
  region?: boolean | undefined;
  fillStyle?: { fill: string; edge: string; name: string } | undefined;
  /** Present on the context region: brings documents into it. */
  onAddContext?: (() => void) | undefined;
  onUseAsContext?: (() => void) | undefined;
  onSelect: () => void;
  onDragStart?: ((event: React.PointerEvent<HTMLElement>) => void) | undefined;
  onResizeStart: (corner: LabResizeCorner, event: React.PointerEvent<HTMLButtonElement>) => void;
  onFit: () => void;
  onRename: (name: string) => void;
  onRemove: () => void;
  onMenuOpened: () => void;
  onMenuOpenChange: (open: boolean) => void;
  onAddWorkstream?: ((name: string) => boolean) | undefined;
  onResizeKeyDown?: ((corner: LabResizeCorner, event: React.KeyboardEvent<HTMLButtonElement>) => void) | undefined;
  onResizeKeyUp?: ((event: React.KeyboardEvent<HTMLButtonElement>) => void) | undefined;
}) {
  const frameRef = useRef<HTMLElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const pendingRenameRef = useRef(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(frame.name);
  const [renameError, setRenameError] = useState(false);

  useEffect(() => {
    if (!renaming) setDraftName(frame.name);
  }, [frame.name, renaming]);

  useEffect(() => {
    if (!renaming) return;
    focusNameInput();
  }, [renaming]);

  function focusNameInput() {
    inputRef.current?.focus({ preventScroll: true });
    inputRef.current?.select();
  }

  function changeMenuOpen(open: boolean) {
    if (open && !menuOpen) { pendingRenameRef.current = false; onMenuOpened(); }
    setMenuOpen(open);
    onMenuOpenChange(open);
  }

  /** After the menu closes, the frame takes focus back unless a rename just started. */
  function restoreFocus() {
    if (pendingRenameRef.current) return;
    frameRef.current?.focus({ preventScroll: true });
  }

  /** Mouse and keyboard both land here; the menu never gets to move focus itself. */
  function renameFromMenu() {
    pendingRenameRef.current = true;
    changeMenuOpen(false);
    beginRename();
    window.requestAnimationFrame(() => focusNameInput());
    window.setTimeout(() => focusNameInput(), 0);
  }


  function openMenu(event: React.MouseEvent | React.KeyboardEvent) {
    if (!editable) return;
    event.preventDefault();
    event.stopPropagation();
    changeMenuOpen(true);
  }

  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [addError, setAddError] = useState(false);
  const guidance = region && !frame.name.trim()
    ? null
    : kind === "context"
    ? (count === 0 ? "Nothing in context yet." : null)
    : !editable
    ? "Nothing here yet."
    : kind === "decisions"
      ? "No decisions recorded on this engagement yet."
      : kind === "outputs"
        ? "No deliverables on this engagement yet."
        : frame.id === "workstreams"
          ? "No workstreams yet."
          : kind === "task" || kind === "custom"
            ? `Nothing here yet. Drag a card in and choose Move to ${frame.name}.`
            : null;

  function submitInlineWorkstream() {
    if (!onAddWorkstream || !onAddWorkstream(newName)) { setAddError(true); return; }
    setNewName("");
    setAddError(false);
    setAdding(false);
  }

  function beginRename() {
    if (!editable || !(custom || region)) return;
    setDraftName(frame.name);
    setRenameError(false);
    setRenaming(true);
  }

  function commitRename() {
    const next = draftName.trim();
    if (!next) {
      // A region may have its name taken off, which turns it back into paint.
      if (region) { setRenameError(false); setRenaming(false); if (frame.name) onRename(""); return; }
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
      style={{ left: frame.x, top: frame.y, width: frame.width, height: frame.height, ...(fillStyle ? { background: fillStyle.fill, borderColor: fillStyle.edge } : {}) }}
      data-region={region ? (frame.name ? "workstream" : "paint") : undefined}
      className="canvas-lab-frame absolute outline-none"
      onPointerDown={(event) => {
        if ((event.target as Element).closest("button,input")) return;
        onSelect();
        onDragStart?.(event);
      }}
      onFocus={(event) => { if (event.target === event.currentTarget) onSelect(); }}
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
              aria-label={region && !frame.name ? "Name this grouping" : "Rename workstream"}
              className="canvas-lab-frame-name-input font-hand text-[18px] leading-none text-[var(--nb-mid)]"
              value={draftName}
              maxLength={60}
              onChange={(event) => { setDraftName(event.target.value); if (event.target.value.trim()) setRenameError(false); }}
              onBlur={() => { if (pendingRenameRef.current) return; commitRename(); }}
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
            style={fillStyle && frame.name ? { color: fillStyle.name } : undefined}
            title={namedByWorkstream ? "Named by the workstream" : undefined}
            onDoubleClick={(custom || region) && editable ? beginRename : undefined}
          >
            {frame.name || (region && editable
              ? <button type="button" className="canvas-lab-region-name" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); beginRename(); }}>Name this grouping</button>
              : null)}
          </h2>
        )}
        <span className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.08em] text-soft">{onAddContext && editable ? <button type="button" className="canvas-lab-add-context" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onAddContext(); }}>+ add docs</button> : null}{count} {frame.local ? "· local" : ""}</span>
      </div>
      <LabFrameMenu open={menuOpen} onOpenChange={changeMenuOpen} restoreFocus={restoreFocus} editable={editable} custom={custom} context={kind === "context"} removable={removable} onFit={onFit} onRename={renameFromMenu} onRemove={onRemove} onUseAsContext={onUseAsContext} />
      {count === 0 && guidance ? <div className="canvas-lab-frame-guidance font-hand text-[16px] text-[var(--nb-mid)]"><p>{guidance}</p>{editable && frame.id === "workstreams" && onAddWorkstream ? (adding ? <div className="canvas-lab-inline-workstream"><input aria-label="Workstream name" maxLength={60} value={newName} onChange={(event) => { setNewName(event.target.value); if (event.target.value.trim()) setAddError(false); }} onKeyDown={(event) => { if (event.key === "Enter") submitInlineWorkstream(); if (event.key === "Escape") { setAdding(false); setAddError(false); } }} /><button type="button" onClick={submitInlineWorkstream}>Add</button>{addError ? <span>a workstream needs a name</span> : null}</div> : <button type="button" className="canvas-lab-add-workstream" onClick={() => setAdding(true)}>+ workstream</button>) : null}</div> : null}
      {selected && editable ? <Button type="button" size="icon" variant="ghost" className="canvas-lab-frame-fit" aria-label={`Fit ${frame.name} to its cards`} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onFit(); }}><Maximize2 className="h-3 w-3" /></Button> : null}
      {selected && editable ? CORNERS.map((corner) => <button key={corner} type="button" className="canvas-lab-resize-handle" data-corner={corner} aria-label={`Resize ${frame.name} from ${corner}`} onPointerDown={(event) => { event.stopPropagation(); onResizeStart(corner, event); }} onKeyDown={(event) => onResizeKeyDown?.(corner, event)} onKeyUp={onResizeKeyUp} />) : null}
    </section>
  );
}