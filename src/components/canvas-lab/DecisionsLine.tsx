import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { ledgerTurnOf, statusWord, type DecisionLine as Line } from "@/hooks/use-decision-lines";

export const COPY = {
  open: "Open", agreed: "Agreed", dropped: "Dropped", addReason: "Add a reason",
  statement: "Decision", reason: "Reason", error: "Could not save. Try again.",
  counter: (n: number, max: number) => `${n}/${max}`, turn: (n: number) => `turn ${n}`,
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

export function DecisionsLine({ line, canEdit, error, onStatus, onEdit }: { line: Line; canEdit: boolean; error?: boolean; onStatus: (status: Line["status"]) => void; onEdit: (patch: { call_text?: string; why?: string }) => void }) {
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState<"call_text" | "why" | null>(null);
  const row = useRef<HTMLLIElement>(null);
  const pill = useRef<HTMLButtonElement>(null);
  const turn = ledgerTurnOf(line);
  useEffect(() => { if (menu) row.current?.querySelector<HTMLButtonElement>('[role="menuitemradio"][aria-checked="true"]')?.focus(); }, [menu]);
  function closeMenu() { setMenu(false); pill.current?.focus(); }
  function keys(event: KeyboardEvent<HTMLLIElement>) {
    if (event.target instanceof HTMLTextAreaElement) return;
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
  return <li ref={row} tabIndex={0} className="lasso-decisions-line" data-status={line.status} onKeyDown={keys}>
    <div className="lasso-decisions-status-anchor" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setMenu(false); }}>
      {canEdit ? <Button ref={pill} variant="ghost" className="lasso-decisions-status" data-status={line.status} aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu(!menu)}>{words[line.status]}</Button> : <span className="lasso-decisions-status" data-status={line.status}>{statusWord(line.status)}</span>}
      {canEdit && menu ? <div role="menu" className="lasso-decisions-status-menu">{statuses.map((status) => <Button key={status} variant="ghost" role="menuitemradio" aria-checked={status === line.status} onClick={() => { closeMenu(); if (status !== line.status) onStatus(status); }}>{words[status]}{status === line.status ? <span aria-hidden="true">✓</span> : null}</Button>)}</div> : null}
    </div>
    <div>{editing === "call_text" ? <DecisionEditor value={line.call_text} onCancel={() => { setEditing(null); row.current?.focus(); }} onSave={(call_text) => { setEditing(null); onEdit({ call_text }); }} /> : <p className="lasso-decisions-line-statement">{canEdit ? <Button variant="ghost" className="lasso-decisions-text-control" onClick={() => setEditing("call_text")}>{line.call_text}</Button> : line.call_text}</p>}
      {editing === "why" ? <DecisionEditor reason value={line.why} onCancel={() => { setEditing(null); row.current?.focus(); }} onSave={(why) => { setEditing(null); onEdit({ why }); }} /> : canEdit ? <p className="lasso-decisions-reason"><Button variant="ghost" className="lasso-decisions-text-control" onClick={() => setEditing("why")}>{line.why.trim() || COPY.addReason}</Button></p> : line.why.trim() ? <p className="lasso-decisions-reason">{line.why}</p> : null}
      {turn ? <span className="lasso-decisions-turn">{COPY.turn(turn)}</span> : null}
      {error ? <p className="lasso-decisions-save-error" role="status">{COPY.error}</p> : null}
    </div>
  </li>;
}