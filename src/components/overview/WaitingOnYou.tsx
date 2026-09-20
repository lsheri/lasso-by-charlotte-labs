import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";

import { GraphiteCheck } from "@/components/notebook/marks";
import { Button } from "@/components/ui/button";
import { ThreadViewerById } from "@/components/work/ThreadViewerById";
import { useDecisionActions } from "@/hooks/use-decision-actions";
import { useDecisions, srcsOf, useDecisionSourceItems } from "@/hooks/use-decisions";
import { useDecisionSourceTurns } from "@/hooks/use-decisions";
import type { ThreadFocus } from "@/components/peek/ThreadBody";
import { vendorLabel } from "@/lib/conversation-shared";
import { formatDate } from "@/lib/work-types";
import { useMotion } from "@/hooks/use-motion";
import { useProfile } from "@/hooks/use-profile";

/**
 * PASS B · the calls waiting on a person, as the storyboard draws them: a mono
 * count line, then up to three yellow cards a person can settle where they
 * stand. Confirm and discard are the existing shared actions, stamped with
 * surface "inbox" so the record knows where a call was settled.
 *
 * The settle and the check are chosen by the motion registry, never named here.
 */

export function WaitingOnYou() {
  const { data: profile } = useProfile();
  const { data: decisions } = useDecisions();
  const actions = useDecisionActions("inbox");
  const settle = useMotion("decision.confirmed");
  const [sourceItem, setSourceItem] = useState<string | null>(null);
  const [sourceFocus, setSourceFocus] = useState<ThreadFocus | undefined>();
  const [settled, setSettled] = useState<string[]>([]);

  const drafts = useMemo(
    () => (decisions ?? []).filter((row) => row.status === "draft"),
    [decisions],
  );

  const waiting = drafts.slice(0, 3);

  const sourceIds = useMemo(() => {
    const ids = new Set<string>();
    for (const row of waiting) {
      const first = srcsOf(row)[0];
      if (first?.work_item_id) ids.add(first.work_item_id);
    }
    return Array.from(ids);
  }, [waiting]);
  const { data: sourceInfo } = useDecisionSourceItems(sourceIds);
  const allSources = useMemo(() => waiting.flatMap(srcsOf), [waiting]);
  const { data: sourceTurns } = useDecisionSourceTurns(allSources);

  if (profile?.role === "coach") return null;
  if (waiting.length === 0) return null;

  return (
    <section className="mb-8" data-testid="overview-waiting">
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-soft">
          Decisions waiting on you · {drafts.length}
        </span>
        <Link to="/decisions" className="text-[11.5px] text-accent-deep hover:underline">
          Review all
        </Link>
      </div>

      <div className="flex flex-wrap items-start gap-4">
        {waiting.map((row) => {
          const done = settled.includes(row.id);
          const source = srcsOf(row)[0];
          const firstSrc = source?.work_item_id;
          const info = firstSrc ? sourceInfo?.[firstSrc] : null;
          const turn = source?.turn_id ? sourceTurns?.[source.turn_id] : null;
          const srcLabel = info ? [vendorLabel(info.source_vendor) || info.title, formatDate(info.work_date ?? info.created_at_source ?? info.captured_at), turn ? `turn ${turn.turn_no}` : null].filter(Boolean).join(" · ") : "Source";
          return (
            <article
              key={row.id}
              className={`flex w-[320px] max-w-full flex-col gap-2 rounded-[var(--radius-control)] border border-[var(--nb-yellow-edge)] bg-[var(--nb-yellow-wash)] px-3 py-3 ${
                done && !settle.still ? settle.className : ""
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-hand text-[16px] leading-[18px] text-[var(--nb-yellow-ink)]">
                  your decision
                  {row.date_label ? ` · ${row.date_label}` : ""}
                </span>
                {done ? (
                  <GraphiteCheck
                    seed={row.id}
                    className={`text-green ${settle.still ? "" : "nb-check-draw"}`}
                  />
                ) : null}
              </div>

              <p className="text-[16px] font-medium leading-[21px] text-foreground">
                {row.call_text ?? row.situation ?? "Untitled decision"}
              </p>
              {row.situation ? (
                <p className="text-[13px] leading-[18px] text-muted-foreground">{row.situation}</p>
              ) : null}

              {firstSrc ? (
                <div>
                  <button
                    type="button"
                    onClick={() => { setSourceItem(firstSrc); setSourceFocus(turn ? { turnNo: turn.turn_no, text: turn.content } : undefined); }}
                    className="story-link max-w-full truncate font-mono text-[10px] uppercase tracking-[0.08em] text-accent-deep"
                  >
                    {srcLabel}
                  </button>
                </div>
              ) : null}

              <div className="mt-1 flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  size="sm"
                  disabled={done}
                  onClick={() => {
                    setSettled((prev) => [...prev, row.id]);
                    actions.confirm(row);
                  }}
                >
                  Confirm this decision
                </Button>
                <button
                  type="button"
                  className="font-hand text-[16px] text-soft transition-colors hover:text-foreground"
                  onClick={() => actions.discard(row)}
                >
                  Not a decision
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <p className="mt-3 max-w-[520px] text-[11.5px] leading-[17px] text-muted-foreground">
        Lasso drafted these from your conversations. Nothing goes on the record until you say so.
      </p>

      {actions.error ? <p className="mt-2 text-sm text-destructive">{actions.error}</p> : null}

      <ThreadViewerById workItemId={sourceItem} focus={sourceFocus} onClose={() => { setSourceItem(null); setSourceFocus(undefined); }} />
    </section>
  );
}
