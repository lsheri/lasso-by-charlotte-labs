import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Button } from "@/components/ui/button";
import { ledgerTurnOf, statusWord, type DecisionLine as Line } from "@/hooks/use-decision-lines";

export const COPY = {
  open: "Open", agreed: "Agreed", dropped: "Dropped", addReason: "Add a reason",
  statement: "Decision", reason: "Reason", error: "Could not save. Try again.",
  counter: (n: number, max: number) => `${n}/${max}`, turn: (n: number) => `turn ${n}`,
  actions: "Line actions", up: "Move up", down: "Move down", remove: "Remove", drag: "Drag to reorder",
  point: "Point to a chat turn", clearPointer: "Clear pointer", noChat: "This document did not come from a chat",
};
const statuses = ["draft", "confirmed", "discarded"] as const;
const words = { draft: COPY.open, confirmed: COPY.agreed, discarded: COPY.dropped };

export function DecisionEditor({ value, reason = false, onSave, onCancel }: { value: string; reason?: boolean; onSave: (value: string) => void; onCancel: () => void }) {
  const [text, setText] = useState(value);
  const ref = useRef<HTMLTextAreaElement>(null);
  const finished = useRef(false);
  const max = reason ? 1000 : 400;
  useEffect(() => { ref.current?.focus(); }, []);
  useEffect(() => { if (ref.current) { ref.current.style.height = "auto"; ref.current.style.height = `${ref.current.scrollHeight}px`; } }, [text]);
  function finish(cancel = false) {
    if (finished.current) return;
    finished.current = true;
    const trimmed = text.trim();
    if (cancel || trimmed === value.trim() || (!reason && !trimmed)) onCancel(); else onSave(trimmed);
  }
  return <div className="lasso-decisions-editor"><textarea ref={ref} aria-label={reason ? COPY.reason : COPY.statement} rows={1} maxLength={max} value={text} onChange={(event) => setText(reason ? event.target.value : event.target.value.replace(/[\r\n]/g, ""))} onBlur={() => finish()} onKeyDown={(event) => {
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); finish(true); }
    if (event.key === "Enter" && !event.nativeEvent.isComposing && !(reason && event.shiftKey)) { event.preventDefault(); event.stopPropagation(); finish(); }
  }} />{text.length > 350 ? <span className="lasso-decisions-counter">{COPY.counter(text.length, max)}</span> : null}</div>;
}

export function DecisionsLine({ line, canEdit, error, onStatus, onEdit, onMove, onRemove, canMoveUp = false, canMoveDown = false, onDragStart, onDragMove, onDragEnd, insertion, parentId, onPoint, onClearPointer, onFollowPointer }: { line: Line; canEdit: boolean; error?: boolean; onStatus: (status: Line["status"]) => void; onEdit: (patch: { call_text?: string; why?: string }) => void; onMove?: (direction: -1 | 1) => void; onRemove?: () => void; canMoveUp?: boolean; canMoveDown?: boolean; onDragStart?: (event: PointerEvent<HTMLButtonElement>) => void; onDragMove?: (event: PointerEvent<HTMLButtonElement>) => void; onDragEnd?: (cancel: boolean) => void; insertion?: "before" | "after" | undefined; parentId?: string | null | undefined; onPoint?: () => void; onClearPointer?: () => void; onFollowPointer?: ((parentId: string, turn: number) => void) | undefined }) {
  const [menu, setMenu] = useState(false);
  const [actions, setActions] = useState(false);
  const [editing, setEditing] = useState<"call_text" | "why" | null>(null);
  const row = useRef<HTMLLIElement>(null);
  const pill = useRef<HTMLButtonElement>(null);
  const actionButton = useRef<HTMLButtonElement>(null);
  const turn = ledgerTurnOf(line);
  useEffect(() => { if (menu) row.current?.querySelector<HTMLButtonElement>('[role="menuitemradio"][aria-checked="true"]')?.focus(); }, [menu]);
  useEffect(() => { if (actions) row.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')?.focus(); }, [actions]);
  function closeMenu() { setMenu(false); pill.current?.focus(); }
  function keys(event: KeyboardEvent<HTMLLIElement>) {
    if (event.target instanceof HTMLTextAreaElement) return;
    if (actions) {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setActions(false); actionButton.current?.focus(); }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault(); event.stopPropagation();
        const entries = Array.from(row.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? []);
        const i = entries.indexOf(document.activeElement as HTMLButtonElement);
        entries[(i + (event.key === "ArrowDown" ? 1 : entries.length - 1)) % entries.length]?.focus();
      }
      return;
    }
    if (menu) {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closeMenu(); }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault(); event.stopPropagation();
        const entries = Array.from(row.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? []);
        const i = entries.indexOf(document.activeElement as HTMLButtonElement);
        entries[(i + (event.key === "ArrowDown" ? 1 : entries.length - 1)) % entries.length]?.focus();
      }
      return;
    }
    if (event.target === row.current && canEdit && event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
      event.preventDefault(); event.stopPropagation();
      if (event.key === "ArrowUp" ? canMoveUp : canMoveDown) onMove?.(event.key === "ArrowUp" ? -1 : 1);
      return;
    }
    if (event.target === row.current && canEdit && (event.key === "Delete" || event.key === "Backspace")) { event.preventDefault(); event.stopPropagation(); onRemove?.(); return; }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const rows = Array.from(row.current?.parentElement?.querySelectorAll<HTMLLIElement>('li[tabindex="0"]') ?? []);
      const i = row.current ? rows.indexOf(row.current) : -1;
      rows[i + (event.key === "ArrowDown" ? 1 : -1)]?.focus();
    }
    if (event.target !== row.current || !canEdit) return;
    if (event.key.toLowerCase() === "s") { event.preventDefault(); setMenu(true); }
    if (event.key === "Enter") { event.preventDefault(); setEditing("call_text"); }
  }
  return <li ref={row} tabIndex={0} className="lasso-decisions-line" data-line-id={line.id} data-editable={canEdit || undefined} data-insertion={insertion} data-status={line.status} onKeyDown={keys}>
    {canEdit ? <Button variant="ghost" className="lasso-decisions-drag" aria-label={COPY.drag} onPointerDown={onDragStart} onPointerMove={onDragMove} onPointerUp={() => onDragEnd?.(false)} onPointerCancel={() => onDragEnd?.(true)}>⠿</Button> : null}
    <div className="lasso-decisions-status-anchor" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setMenu(false); }}>
      {canEdit ? <Button ref={pill} variant="ghost" className="lasso-decisions-status" data-status={line.status} aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu(!menu)}>{words[line.status]}</Button> : <span className="lasso-decisions-status" data-status={line.status}>{statusWord(line.status)}</span>}
      {canEdit && menu ? <div role="menu" className="lasso-decisions-status-menu">{statuses.map((status) => <Button key={status} variant="ghost" role="menuitemradio" aria-checked={status === line.status} onClick={() => { closeMenu(); if (status !== line.status) onStatus(status); }}>{words[status]}{status === line.status ? <span aria-hidden="true">✓</span> : null}</Button>)}</div> : null}
    </div>
    <div>{editing === "call_text" ? <DecisionEditor value={line.call_text} onCancel={() => { setEditing(null); row.current?.focus(); }} onSave={(call_text) => { setEditing(null); onEdit({ call_text }); }} /> : <p className="lasso-decisions-line-statement">{canEdit ? <Button variant="ghost" className="lasso-decisions-text-control" onClick={() => setEditing("call_text")}>{line.call_text}</Button> : line.call_text}</p>}
      {editing === "why" ? <DecisionEditor reason value={line.why} onCancel={() => { setEditing(null); row.current?.focus(); }} onSave={(why) => { setEditing(null); onEdit({ why }); }} /> : canEdit ? <p className="lasso-decisions-reason"><Button variant="ghost" className="lasso-decisions-text-control" onClick={() => setEditing("why")}>{line.why.trim() || COPY.addReason}</Button></p> : line.why.trim() ? <p className="lasso-decisions-reason">{line.why}</p> : null}
      {turn ? <Button variant="ghost" className="lasso-decisions-turn" disabled={!parentId || !onFollowPointer} onClick={() => { if (parentId) onFollowPointer?.(parentId, turn); }}>{COPY.turn(turn)}</Button> : null}
      {error ? <p className="lasso-decisions-save-error" role="status">{COPY.error}</p> : null}
    </div>
    {canEdit ? <div className="lasso-decisions-actions" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setActions(false); }}>
      <Button ref={actionButton} variant="ghost" className="lasso-decisions-actions-trigger" aria-label={COPY.actions} aria-haspopup="menu" aria-expanded={actions} onClick={() => { setMenu(false); setActions(!actions); }}>…</Button>
      {actions ? <div role="menu" className="lasso-decisions-actions-menu"><Button variant="ghost" role="menuitem" disabled={!canMoveUp} onClick={() => { setActions(false); row.current?.focus(); onMove?.(-1); }}>{COPY.up}</Button><Button variant="ghost" role="menuitem" disabled={!canMoveDown} onClick={() => { setActions(false); row.current?.focus(); onMove?.(1); }}>{COPY.down}</Button><Button variant="ghost" role="menuitem" disabled={!parentId} title={!parentId ? COPY.noChat : undefined} onClick={() => { setActions(false); onPoint?.(); }}>{COPY.point}</Button>{turn ? <Button variant="ghost" role="menuitem" onClick={() => { setActions(false); onClearPointer?.(); }}>{COPY.clearPointer}</Button> : null}<Button variant="ghost" role="menuitem" onClick={() => { setActions(false); onRemove?.(); }}>{COPY.remove}</Button></div> : null}
    </div> : null}
  </li>;
}