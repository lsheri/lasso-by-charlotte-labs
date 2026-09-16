import { useState } from "react";

import { GraphiteCheck } from "@/components/notebook/marks";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ThreadFocus } from "@/components/peek/ThreadBody";
import { useMotion } from "@/hooks/use-motion";
import type { DecisionRow } from "@/hooks/use-decisions";
import { srcsOf, useDecisionSourceItems, useDecisionSourceTurns } from "@/hooks/use-decisions";
import { vendorLabel } from "@/lib/conversation-shared";
import { isDeliverableType } from "@/lib/lineage-shared";
import { formatDate } from "@/lib/work-types";

type SourceDetail = {
  workItemId: string;
  heading: string;
  quote: string | null;
  focus?: ThreadFocus;
  deliverable: string | null;
};

export function DecisionLogRow({
  decision,
  onOpenSource,
  onSaveReasoning,
  onDiscard,
}: {
  decision: DecisionRow;
  onOpenSource: (workItemId: string, focus?: ThreadFocus) => void;
  onSaveReasoning: (decision: DecisionRow, reasoning: string) => void;
  onDiscard: (decision: DecisionRow) => void;
}) {
  const srcs = srcsOf(decision);
  const ids = Array.from(new Set(srcs.map((source) => source.work_item_id).filter(Boolean)));
  const { data: sourceItems } = useDecisionSourceItems(ids);
  const { data: sourceTurns } = useDecisionSourceTurns(srcs);
  const [reasoning, setReasoning] = useState(decision.why ?? "");
  const [editing, setEditing] = useState(false);
  const confirmed = decision.status === "confirmed";
  const label = useMotion("decision.on_record_shown");

  const sources: SourceDetail[] = ids.map((id) => {
    const info = sourceItems?.[id];
    const source = srcs.find((entry) => entry.work_item_id === id);
    const turn = source?.turn_id ? sourceTurns?.[source.turn_id] : null;
    const vendor = vendorLabel(info?.source_vendor) || info?.title || "Source";
    const date = info ? formatDate(info.work_date ?? info.created_at_source ?? info.captured_at) : null;
    return {
      workItemId: id,
      heading: [vendor, date, turn ? `turn ${turn.turn_no}` : null, "Lasso drafted this"]
        .filter(Boolean)
        .join(" · "),
      quote: turn?.content ?? null,
      focus: turn ? { turnNo: turn.turn_no, text: turn.content } : undefined,
      deliverable: info && isDeliverableType(info.type) ? info.title : null,
    };
  });
  const citedTurn = sources.find((source) => source.quote);
  const deliverable = sources.find((source) => source.deliverable)?.deliverable;

  return (
    <article className="pb-10" data-status={confirmed ? "confirmed" : "awaiting"}>
      {sources.length > 0 ? (
        <div className="mb-3 space-y-2">
          {sources.map((source) => (
            <Button
              key={source.workItemId}
              type="button"
              variant="ghost"
              onClick={() => onOpenSource(source.workItemId, source.focus)}
              className="h-auto w-full max-w-[758px] justify-start whitespace-normal rounded-[var(--radius-md)] border border-border bg-grey-1 px-4 py-3 text-left hover:bg-grey-2"
            >
              <span className="block min-w-0">
                <span className="block font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
                  {source.heading}
                </span>
                {source.quote ? (
                  <span className="mt-2 block font-mono text-[11.5px] font-normal leading-[17px] text-foreground">
                    “{source.quote}”
                  </span>
                ) : null}
              </span>
            </Button>
          ))}
        </div>
      ) : (
        <p className="mb-3 font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
          No source attached
        </p>
      )}

      {confirmed && !editing ? (
        <div className="flex max-w-[758px] items-start justify-between gap-5 border-y border-[var(--nb-yellow-edge)] bg-[var(--nb-yellow-wash)] px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold leading-[18px] text-foreground">
              {decision.call_text || decision.situation || "Untitled call"}
            </p>
            {decision.why?.trim() ? (
              <p className="mt-1 font-hand text-[16px] italic leading-[20px] text-muted-foreground">
                {decision.why}
              </p>
            ) : null}
            {deliverable ? (
              <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
                {deliverable}
              </p>
            ) : null}
            <div className="mt-2 flex items-center gap-3">
              <Button type="button" variant="link" className="h-auto p-0 font-hand text-[16px]" onClick={() => setEditing(true)}>
                Edit reasoning
              </Button>
              <Button type="button" variant="ghost" className="h-auto p-0 font-hand text-[16px] text-muted-foreground" onClick={() => onDiscard(decision)}>
                Discard
              </Button>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 pt-0.5 text-green">
            <GraphiteCheck seed={decision.id} />
            <span className={`font-mono text-[9px] uppercase tracking-[0.08em] ${label.still ? "" : label.className}`}>
              ON THE RECORD
            </span>
          </div>
        </div>
      ) : (
        <div className="max-w-[758px] border border-[var(--nb-yellow-edge)] bg-[var(--nb-yellow-wash)] px-4 py-4">
          {decision.situation ? (
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">The situation</p>
              <p className="mt-1 text-[13px] leading-[18px] text-muted-foreground">{decision.situation}</p>
            </div>
          ) : null}
          <div className="mt-3">
            <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">The call</p>
            <p className="mt-1 text-[13px] font-semibold leading-[18px] text-foreground">
              {decision.call_text || decision.situation || "Untitled call"}
            </p>
          </div>
          <label className="mt-3 block">
            <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">Why it was the right call</span>
            <Textarea
              rows={3}
              value={reasoning}
              onChange={(event) => setReasoning(event.target.value)}
              placeholder="Why was this the right call? A sentence is enough."
              className="mt-1 bg-card"
            />
          </label>
          {citedTurn?.quote ? (
            <div className="mt-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenSource(citedTurn.workItemId, citedTurn.focus)}
                className="h-auto w-full justify-start whitespace-normal rounded-none bg-[var(--nb-ink-yellow)] px-3 py-2 text-left hover:bg-[var(--nb-ink-yellow)]"
              >
                <span className="font-mono text-[10px] font-normal leading-[15px] text-foreground">
                  “{citedTurn.quote}” · {citedTurn.heading.replace(" · Lasso drafted this", "")}
                </span>
              </Button>
              <p className="mt-1 font-hand text-[16px] text-muted-foreground">this is the turn it came from</p>
            </div>
          ) : null}
          <div className="mt-4 flex items-center gap-3">
            <Button type="button" size="sm" disabled={!reasoning.trim()} onClick={() => { onSaveReasoning(decision, reasoning); setEditing(false); }}>
              Save the reasoning
            </Button>
            <Button type="button" variant="ghost" className="h-auto p-0 font-serif text-[13px] italic text-muted-foreground" onClick={() => onDiscard(decision)}>
              Discard
            </Button>
            {editing ? (
              <Button type="button" variant="ghost" className="h-auto p-0 text-xs text-muted-foreground" onClick={() => { setReasoning(decision.why ?? ""); setEditing(false); }}>
                Cancel
              </Button>
            ) : null}
          </div>
        </div>
      )}
    </article>
  );
}