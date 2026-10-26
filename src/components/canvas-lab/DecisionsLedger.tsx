import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useDecisionLines, useDecisionLineMutations } from "@/hooks/use-decision-lines";
import { DecisionEditor, DecisionsLine } from "./DecisionsLine";
import { supabase } from "@/integrations/supabase/client";
import { displayName } from "@/lib/work-item-name";
import { formatDate, type WorkItemRow } from "@/lib/work-types";

export const COPY = { back: "Back to the workboard", empty: "No decisions yet", loading: "Reading decisions…", error: "Decisions could not be opened.", version: (n: number, date: string) => `Version ${n} · ${date}`, turn: (n: number) => `turn ${n}`, add: "Add a decision", saveVersion: "Save a version", saving: "Saving", saved: "Saved", saveError: "Could not save. Try again." };

export function DecisionsLedger({ nodeId, item, onClose, canEdit = false, profileId }: { nodeId: string; item: WorkItemRow; onClose: () => void; canEdit?: boolean; profileId?: string }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const closing = useRef(false);
  const [adding, setAdding] = useState(false);
  const mutations = useDecisionLineMutations(item.id, profileId);
  const closeAction = useRef<() => void>(() => undefined);
  closeAction.current = () => {
    if (closing.current) return;
    if (!canEdit || (!mutations.dirty && !mutations.pending)) { onClose(); return; }
    closing.current = true;
    void mutations.saveVersion().catch(() => undefined).finally(() => { closing.current = false; onClose(); });
  };
  const { data = [], isLoading, isError } = useDecisionLines(item.id);
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
      if (event.key === "Escape" && !event.defaultPrevented) { event.preventDefault(); event.stopImmediatePropagation(); closeAction.current(); }
    };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); if (previous instanceof HTMLElement) previous.focus({ preventScroll: true }); };
  }, []);
  const latest = versions.data?.[0];
  const lines = [...data].sort((a, b) => Number(a.status === "discarded") - Number(b.status === "discarded") || (a.ord ?? 0) - (b.ord ?? 0));
  return <div role="dialog" aria-modal="true" aria-labelledby={`ledger-title-${nodeId}`} data-testid="decisions-ledger" className="lasso-decisions-ledger">
    <header className="lasso-decisions-header"><h1 id={`ledger-title-${nodeId}`}>{displayName(item)}</h1><Button ref={closeRef} type="button" variant="ghost" onClick={() => closeAction.current()}>{COPY.back}</Button></header>
    <main className="lasso-decisions-content">
      {canEdit ? <div className="lasso-decisions-version-tools">{latest ? <p className="lasso-decisions-version">{COPY.version(latest.version_no, formatDate(latest.created_at))}</p> : null}<span className="lasso-decisions-save-mark" role="status">{mutations.pending ? COPY.saving : mutations.saved ? COPY.saved : ""}</span><Button variant="ghost" disabled={!mutations.dirty || mutations.pending} onClick={() => void mutations.saveVersion().catch(() => undefined)}>{COPY.saveVersion}</Button>{mutations.errors["version"] ? <span className="lasso-decisions-save-error">{COPY.saveError}</span> : null}</div> : latest ? <p className="lasso-decisions-version">{COPY.version(latest.version_no, formatDate(latest.created_at))}</p> : null}
      {isLoading ? <p>{COPY.loading}</p> : isError ? <p role="alert">{COPY.error}</p> : lines.length === 0 ? <p>{COPY.empty}</p> : <ol className="lasso-decisions-lines">{lines.map((line) => <DecisionsLine key={line.id} line={line} canEdit={canEdit} error={Boolean(canEdit && mutations.errors[line.id])} onStatus={(status) => void mutations.setStatus(line.id, status).catch(() => undefined)} onEdit={(patch) => void mutations.editLine(line.id, patch).catch(() => undefined)} />)}</ol>}
      {canEdit && !isLoading && !isError ? <div className="lasso-decisions-add">{adding ? <DecisionEditor value="" onCancel={() => setAdding(false)} onSave={(text) => { void mutations.addLine(text).then(() => setAdding(false)).catch(() => setAdding(false)); }} /> : <Button variant="ghost" onClick={() => setAdding(true)}>{COPY.add}</Button>}{mutations.errors["add"] ? <p className="lasso-decisions-save-error" role="status">{COPY.saveError}</p> : null}</div> : null}
    </main>
  </div>;
}