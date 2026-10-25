import { MoreHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { LabFrame, LabResizeCorner } from "@/components/canvas-lab/canvas-lab-model";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SECTION_TITLE_PLACEHOLDER, sectionTitle } from "@/lib/board-section";

const CORNERS: LabResizeCorner[] = ["nw", "ne", "se", "sw"];

export function LabSection({ frame, title, selected, editable, onSelect, onDragStart, onResizeStart, onResizeKeyDown, onResizeKeyUp, onRename, onRemove, onMenuOpened }: {
  frame: LabFrame; title: string | null; selected: boolean; editable: boolean;
  onSelect: () => void;
  onDragStart?: ((event: React.PointerEvent<HTMLElement>) => void) | undefined;
  onResizeStart: (corner: LabResizeCorner, event: React.PointerEvent<HTMLButtonElement>) => void;
  onResizeKeyDown?: ((corner: LabResizeCorner, event: React.KeyboardEvent<HTMLButtonElement>) => void) | undefined;
  onResizeKeyUp?: ((event: React.KeyboardEvent<HTMLButtonElement>) => void) | undefined;
  onRename: (title: string | null) => void; onRemove: () => void; onMenuOpened: () => void;
}) {
  const rootRef = useRef<HTMLElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const editingRef = useRef(false);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(title ?? "");
  const [menuOpen, setMenuOpen] = useState(false);
  function beginRename() {
    if (!editable) return;
    editingRef.current = true;
    setDraft(title ?? "");
    setRenaming(true);
  }
  useEffect(() => { if (selected && editable && title === null) beginRename(); }, [selected, editable]);
  useEffect(() => { if (renaming) { inputRef.current?.focus({ preventScroll: true }); inputRef.current?.select(); } }, [renaming]);
  function commit() {
    if (!editingRef.current) return;
    editingRef.current = false;
    setRenaming(false);
    onRename(sectionTitle(draft));
  }
  function press(event: React.PointerEvent<HTMLElement>) {
    if (event.button !== 0) return;
    onSelect();
    rootRef.current?.focus({ preventScroll: true });
    if (editable) onDragStart?.(event);
  }
  function changeMenu(open: boolean) {
    if (open && !menuOpen) onMenuOpened();
    setMenuOpen(open);
  }
  function openMenu(event: React.MouseEvent) {
    if (!editable) return;
    event.preventDefault(); event.stopPropagation(); onSelect(); changeMenu(true);
  }
  return <section ref={rootRef} tabIndex={0} data-testid={`lab-section-${frame.id}`} data-selected={selected}
    className="canvas-lab-section" style={{ left: frame.x, top: frame.y, width: frame.width, height: frame.height }}
    onKeyDown={(event) => {
      if (!editable || (event.target as Element).closest("input,button")) return;
      if (event.key === "Delete" || event.key === "Backspace") { event.preventDefault(); event.stopPropagation(); onRemove(); }
      if (event.key === "F2" || event.key === "Enter") { event.preventDefault(); event.stopPropagation(); beginRename(); }
    }}>
    {(["top", "right", "bottom", "left"] as const).map((edge) => <span key={edge} className="canvas-lab-section-edge" data-section-edge={edge} onPointerDown={press} onContextMenu={openMenu} />)}
    <div className="canvas-lab-section-title" onPointerDown={(event) => { if (!(event.target as Element).closest("input,button")) press(event); }} onContextMenu={openMenu}>
      {renaming && editable ? <input ref={inputRef} className="canvas-lab-frame-name-input" aria-label="Section title" value={draft} maxLength={60}
        onChange={(event) => setDraft(event.target.value)} onBlur={commit} onPointerDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => { event.stopPropagation(); if (event.key === "Enter") { event.preventDefault(); commit(); } if (event.key === "Escape") { event.preventDefault(); editingRef.current = false; setRenaming(false); setDraft(title ?? ""); } }} />
        : title ? <h2 onDoubleClick={beginRename}>{title}</h2>
        : editable ? <Button variant="ghost" className="canvas-lab-section-placeholder" onPointerDown={press} onClick={beginRename}>{SECTION_TITLE_PLACEHOLDER}</Button>
        : <span>{SECTION_TITLE_PLACEHOLDER}</span>}
      {editable ? <DropdownMenu open={menuOpen} onOpenChange={changeMenu}><DropdownMenuTrigger asChild>
        <Button size="icon" variant="ghost" aria-label="Section menu" className="canvas-lab-section-menu" data-visible={selected} onPointerDown={(event) => event.stopPropagation()}><MoreHorizontal /></Button>
      </DropdownMenuTrigger><DropdownMenuContent onCloseAutoFocus={(event) => { event.preventDefault(); if (!editingRef.current) rootRef.current?.focus({ preventScroll: true }); }}>
        <DropdownMenuItem onSelect={beginRename}>Rename</DropdownMenuItem><DropdownMenuItem onSelect={onRemove}>Remove section</DropdownMenuItem>
      </DropdownMenuContent></DropdownMenu> : null}
    </div>
    {selected && editable ? CORNERS.map((corner) => <Button key={corner} type="button" size="icon" variant="ghost" className="canvas-lab-resize-handle" data-corner={corner} aria-label={`Resize section from ${corner}`} onPointerDown={(event) => { event.stopPropagation(); onResizeStart(corner, event); }} onKeyDown={(event) => onResizeKeyDown?.(corner, event)} onKeyUp={onResizeKeyUp} />) : null}
  </section>;
}