import { Fragment, useEffect, useRef, useState, type PointerEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useDecisionLines, useDecisionLineMutations } from "@/hooks/use-decision-lines";
import { DecisionEditor, DecisionsLine } from "./DecisionsLine";
import { supabase } from "@/integrations/supabase/client";
import { displayName } from "@/lib/work-item-name";
import { formatDate, type WorkItemRow } from "@/lib/work-types";
import type { LedgerRemoveEntry } from "./canvas-lab-undo";
import { DecisionTurnPicker } from "./DecisionTurnPicker";
import { DecisionsMemo } from "./DecisionsMemo";
import { DecisionsVersions } from "./DecisionsVersions";
import { DecisionsSharePanel } from "./DecisionsSharePanel";
import { MemoComments, useDocumentLinkComments } from "./MemoComments";
import { noteWorkboardLedgerOpened } from "./canvas-lab-telemetry";

export const COPY = { back: "Back to the workboard", empty: "No decisions yet", loading: "Reading decisions…", error: "Decisions could not be opened.", version: (n: number, date: string) => `Version ${n} · ${date}`, turn: (n: number) => `turn ${n}`, add: "Add a decision", saveVersion: "Save a version", saving: "Saving", saved: "Saved", saveError: "Could not save. Try again.", removed: "Decision removed", versions: "Versions", ledger: "Ledger", memo: "Memo", share: "Share" };

export function DecisionsLedger({ nodeId, item, onClose, canEdit = false, profileId, onUndoableRemove, onFollowPointer }: { nodeId: string; item: WorkItemRow; onClose: () => void; canEdit?: boolean; profileId?: string | undefined; onUndoableRemove?: (entry: LedgerRemoveEntry) => void; onFollowPointer?: ((parentId: string, turn: number) => void) | undefined }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const closing = useRef(false);
  const [adding, setAdding] = useState(false);
  const [mode, setMode] = useState<"ledger" | "memo">("ledger");
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const comments = useDocumentLinkComments(item.id);
  const memoVisit = useRef(false);
  const eventOrg = useQuery({ queryKey: ["ledger-event-org", profileId], enabled: Boolean(profileId), queryFn: async () => {
    const { data: row, error } = await supabase.from("profiles").select("org_id").eq("id", profileId ?? "").maybeSingle();
    if (error) throw error;
    return row?.org_id;
  } });
  useEffect(() => {
    if (mode === "ledger") { memoVisit.current = false; return; }
    if (!memoVisit.current && eventOrg.data) { noteWorkboardLedgerOpened(eventOrg.data, "memo_preview"); memoVisit.current = true; }
  }, [mode, eventOrg.data]);
  const [pointingId, setPointingId] = useState<string | null>(null);
  const [insertion, setInsertion] = useState<{ id: string; side: "before" | "after" } | null>(null);
  const drag = useRef<{ id: string; target: string; side: "before" | "after" } | null>(null);
  const mutations = useDecisionLineMutations(item.id, profileId);
  const closeAction = useRef<() => void>(() => undefined);
  closeAction.current = () => {
    if (closing.current) return;
    if (!canEdit || (!mutations.dirty && !mutations.pending)) { onClose(); return; }
    closing.current = true;
    void mutations.saveVersion().catch(() => undefined).finally(() => { closing.current = false; onClose(); });
  };
  const { data = [], isLoading, isError } = useDecisionLines(item.id);
  // Board rows deliberately stay lean. Resolve the source locally without changing their contracts.
  const parent = useQuery({ queryKey: ["decision-parent", item.id], queryFn: async () => {
    const { data: row, error } = await supabase.from("work_items").select("parent_work_item_id").eq("id", item.id).maybeSingle();
    if (error) throw error;
    return row?.parent_work_item_id ?? null;
  } });
  const versions = useQuery({
    queryKey: ["document-versions", item.id],
    queryFn: async () => {
      const { data: rows, error } = await supabase.from("document_versions")
        .select("id, version_no, created_at, source_event").eq("work_item_id", item.id).order("version_no", { ascending: false });
      if (error) throw new Error(error.message);
      return rows ?? [];
    },
  });
  useEffect(() => {
    const previous = document.activeElement;
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented && !document.querySelector(".focus-paper-backdrop, [data-slot='dialog-content'], .lasso-decisions-source-back, .lasso-decisions-share-panel")) { event.preventDefault(); event.stopImmediatePropagation(); closeAction.current(); }
    };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); if (previous instanceof HTMLElement) previous.focus({ preventScroll: true }); };
  }, []);
  const latest = versions.data?.[0];
  const lines = [...data].sort((a, b) => Number(a.status === "discarded") - Number(b.status === "discarded") || (a.ord ?? 0) - (b.ord ?? 0));
  function move(id: string, direction: -1 | 1) {
    if (!canEdit || mutations.pending) return;
    const index = lines.findIndex((line) => line.id === id);
    const current = lines[index], target = lines[index + direction];
    if (!current || !target || (current.status === "discarded") !== (target.status === "discarded")) return;
    const order = lines.map((line) => line.id);
    order[index] = target.id; order[index + direction] = current.id;
    void mutations.reorderLines(order, id).catch(() => undefined);
  }
  function dragStart(id: string, event: PointerEvent<HTMLButtonElement>) {
    if (event.pointerType === "touch" || event.button !== 0 || mutations.pending) return;
    event.preventDefault(); event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { id, target: id, side: "before" };
  }
  function dragMove(event: PointerEvent<HTMLButtonElement>) {
    const active = drag.current;
    if (!active) return;
    const element = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("li[data-line-id]");
    const target = lines.find((line) => line.id === element?.dataset["lineId"]);
    const source = lines.find((line) => line.id === active.id);
    if (!element || !target || !source || (source.status === "discarded") !== (target.status === "discarded")) return;
    const bounds = element.getBoundingClientRect();
    const side = event.clientY < bounds.top + bounds.height / 2 ? "before" : "after";
    drag.current = { ...active, target: target.id, side };
    setInsertion({ id: target.id, side });
  }
  function dragEnd(cancel: boolean) {
    const active = drag.current; drag.current = null; setInsertion(null);
    if (cancel || !active || active.id === active.target || mutations.pending) return;
    const order = lines.filter((line) => line.id !== active.id).map((line) => line.id);
    const index = order.indexOf(active.target);
    if (index < 0) return;
    order.splice(index + (active.side === "after" ? 1 : 0), 0, active.id);
    if (order.every((id, i) => id === lines[i]?.id)) return;
    void mutations.reorderLines(order, active.id).catch(() => undefined);
  }
  return <div role="dialog" aria-modal="true" aria-labelledby={`ledger-title-${nodeId}`} data-testid="decisions-ledger" className="lasso-decisions-ledger">
    <header className="lasso-decisions-header"><h1 id={`ledger-title-${nodeId}`}>{displayName(item)}</h1><div className="lasso-decisions-header-tools"><div className="lasso-decisions-mode" role="group" aria-label={COPY.ledger}><Button variant="ghost" aria-pressed={mode === "ledger"} onClick={() => setMode("ledger")}>{COPY.ledger}</Button><Button variant="ghost" aria-pressed={mode === "memo"} onClick={() => { setPointingId(null); setMode("memo"); }}>{COPY.memo}</Button></div>{canEdit ? <Button variant="ghost" onClick={() => setShareOpen(true)}>{COPY.share}</Button> : null}<Button variant="ghost" onClick={() => setVersionsOpen(true)}>{COPY.versions}</Button><Button ref={closeRef} type="button" variant="ghost" onClick={() => closeAction.current()}>{COPY.back}</Button></div></header>
    <main className="lasso-decisions-content">
      {mode === "memo" ? isLoading ? <p>{COPY.loading}</p> : isError ? <p role="alert">{COPY.error}</p> : <DecisionsMemo title={displayName(item)} date={latest?.created_at} lines={lines} comments={{ rows: comments.rows, error: comments.error }} /> : <>
      {canEdit ? <div className="lasso-decisions-version-tools">{latest ? <p className="lasso-decisions-version">{COPY.version(latest.version_no, formatDate(latest.created_at))}</p> : null}<span className="lasso-decisions-save-mark" role="status">{mutations.pending ? COPY.saving : mutations.saved ? COPY.saved : ""}</span><Button variant="ghost" disabled={!mutations.dirty || mutations.pending} onClick={() => void mutations.saveVersion().catch(() => undefined)}>{COPY.saveVersion}</Button>{mutations.errors["version"] ? <span className="lasso-decisions-save-error">{COPY.saveError}</span> : null}</div> : latest ? <p className="lasso-decisions-version">{COPY.version(latest.version_no, formatDate(latest.created_at))}</p> : null}
      {isLoading ? <p>{COPY.loading}</p> : isError ? <p role="alert">{COPY.error}</p> : lines.length === 0 ? <p>{COPY.empty}</p> : <ol className="lasso-decisions-lines">{lines.map((line, index) => <Fragment key={line.id}><DecisionsLine line={line} canEdit={canEdit} error={Boolean(canEdit && mutations.errors[line.id])} onStatus={(status) => void mutations.setStatus(line.id, status).catch(() => undefined)} onEdit={(patch) => void mutations.editLine(line.id, patch).catch(() => undefined)} canMoveUp={!mutations.pending && index > 0 && (lines[index - 1]?.status === "discarded") === (line.status === "discarded")} canMoveDown={!mutations.pending && index < lines.length - 1 && (lines[index + 1]?.status === "discarded") === (line.status === "discarded")} onMove={(direction) => move(line.id, direction)} onRemove={() => { if (!mutations.pending) void mutations.removeLine(line.id).then((entry) => onUndoableRemove?.(entry)).catch(() => undefined); }} onDragStart={(event) => dragStart(line.id, event)} onDragMove={dragMove} onDragEnd={dragEnd} insertion={insertion?.id === line.id ? insertion.side : undefined} parentId={parent.data} onPoint={() => setPointingId(line.id)} onClearPointer={() => void mutations.setPointer(line.id, null).catch(() => undefined)} onFollowPointer={onFollowPointer} />{comments.rows.some((comment) => comment.decision_id === line.id) ? <li className="lasso-decisions-link-comments"><MemoComments decisionId={line.id} ledger model={{ rows: comments.rows, ...(canEdit ? { onRemove: comments.remove } : {}) }} /></li> : null}</Fragment>)}</ol>}
      {canEdit && !isLoading && !isError ? <div className="lasso-decisions-add">{adding ? <DecisionEditor value="" onCancel={() => setAdding(false)} onSave={(text) => { void mutations.addLine(text).then(() => setAdding(false)).catch(() => setAdding(false)); }} /> : <Button variant="ghost" onClick={() => setAdding(true)}>{COPY.add}</Button>}{mutations.errors["add"] ? <p className="lasso-decisions-save-error" role="status">{COPY.saveError}</p> : null}</div> : null}
      </>}
    </main>
    {comments.error && mode === "ledger" ? <p role="alert" className="lasso-decisions-save-error">{COPY.error}</p> : null}
    {shareOpen && canEdit ? <DecisionsSharePanel documentId={item.id} onClose={() => setShareOpen(false)} /> : null}
    {versionsOpen ? <DecisionsVersions versions={versions.data ?? []} onClose={() => setVersionsOpen(false)} /> : null}
    {canEdit && pointingId && parent.data ? <DecisionTurnPicker parentId={parent.data} onClose={() => setPointingId(null)} onSelect={(turn) => { const id = pointingId; setPointingId(null); void mutations.setPointer(id, turn).catch(() => undefined); }} /> : null}
  </div>;
}