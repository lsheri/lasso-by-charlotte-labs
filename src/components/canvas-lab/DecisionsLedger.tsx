import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ledgerTurnOf, statusWord, useDecisionLines } from "@/hooks/use-decision-lines";
import { supabase } from "@/integrations/supabase/client";
import { displayName } from "@/lib/work-item-name";
import { formatDate, type WorkItemRow } from "@/lib/work-types";

export const COPY = { back: "Back to the workboard", empty: "No decisions yet", loading: "Reading decisions…", error: "Decisions could not be opened.", version: (n: number, date: string) => `Version ${n} · ${date}`, turn: (n: number) => `turn ${n}` };

export function DecisionsLedger({ nodeId, item, onClose }: { nodeId: string; item: WorkItemRow; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
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
      if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); onClose(); }
      if (event.key === "Tab") { event.preventDefault(); closeRef.current?.focus(); }
    };
    window.addEventListener("keydown", onKey, true);
    return () => { window.removeEventListener("keydown", onKey, true); if (previous instanceof HTMLElement) previous.focus({ preventScroll: true }); };
  }, [onClose]);
  const latest = versions.data?.[0];
  const lines = [...data].sort((a, b) => Number(a.status === "discarded") - Number(b.status === "discarded") || (a.ord ?? 0) - (b.ord ?? 0));
  return <div role="dialog" aria-modal="true" aria-labelledby={`ledger-title-${nodeId}`} data-testid="decisions-ledger" className="lasso-decisions-ledger">
    <header className="lasso-decisions-header"><h1 id={`ledger-title-${nodeId}`}>{displayName(item)}</h1><Button ref={closeRef} type="button" variant="ghost" onClick={onClose}>{COPY.back}</Button></header>
    <main className="lasso-decisions-content">
      {latest ? <p className="lasso-decisions-version">{COPY.version(latest.version_no, formatDate(latest.created_at))}</p> : null}
      {isLoading ? <p>{COPY.loading}</p> : isError ? <p role="alert">{COPY.error}</p> : lines.length === 0 ? <p>{COPY.empty}</p> : <ol className="lasso-decisions-lines">{lines.map((line) => {
        const turn = ledgerTurnOf(line);
        return <li key={line.id} className="lasso-decisions-line" data-status={line.status}><span className="lasso-decisions-status" data-status={line.status}>{statusWord(line.status)}</span><div><p className="lasso-decisions-line-statement">{line.call_text}</p>{line.why.trim() ? <p className="lasso-decisions-reason">{line.why}</p> : null}{turn ? <span className="lasso-decisions-turn">{COPY.turn(turn)}</span> : null}</div></li>;
      })}</ol>}
    </main>
  </div>;
}