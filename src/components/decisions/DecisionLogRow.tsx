import { GraphiteCheck } from "@/components/notebook/marks";
import { useMotion } from "@/hooks/use-motion";
import type { DecisionRow } from "@/hooks/use-decisions";
import { srcsOf, useDecisionSourceItems } from "@/hooks/use-decisions";

/**
 * PASS B · one entry on the timeline. The source sits above the rule as a
 * small muted card, the call sits below it in yellow with the three labels
 * the storyboard names.
 *
 * Deliberate deviation, recorded rather than faked: the frame quotes the turn
 * a call came from. Nothing this page reads carries the text of a turn, so the
 * source card shows the chip alone. A quote is never invented.
 */
export function DecisionLogRow({
  decision,
  onOpenSource,
  onAddReasoning,
  onConfirm,
  onDiscard,
}: {
  decision: DecisionRow;
  onOpenSource: (workItemId: string) => void;
  onAddReasoning: (decision: DecisionRow) => void;
  onConfirm?: (decision: DecisionRow) => void;
  onDiscard?: (decision: DecisionRow) => void;
}) {
  const srcs = srcsOf(decision);
  const ids = Array.from(new Set(srcs.map((s) => s.work_item_id).filter(Boolean)));
  const { data: sourceItems } = useDecisionSourceItems(ids);
  const hasWhy = Boolean(decision.why?.trim());
  const confirmed = decision.status === "confirmed";
  const label = useMotion("decision.on_record_shown");

  return (
    <div className="py-6">
      {/* Above the rule: where it came from. */}
      <div className="mb-3 max-w-[560px] rounded-[var(--radius-control)] border border-[var(--nb-pencil)] bg-card px-3 py-2">
        <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-soft">
          {decision.author === "human" ? "You decided" : "Lasso drafted"}
          {decision.date_label ? ` · ${decision.date_label}` : ""}
        </div>
        {ids.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {ids.map((id) => {
              const info = sourceItems?.[id];
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onOpenSource(id)}
                  className="max-w-[220px] truncate rounded-[var(--radius-sm)] border border-border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-accent-deep transition-colors hover:border-foreground"
                >
                  {(info?.title ?? "Source").toUpperCase()}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="mt-1 text-[11.5px] text-soft">No source attached.</p>
        )}
      </div>

      {/* Below the rule: the call itself. */}
      <div className="max-w-[560px] rounded-[var(--radius-control)] border border-[var(--nb-yellow-edge)] bg-[var(--nb-yellow-wash)] px-4 py-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {decision.situation ? (
              <>
                <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-soft">
                  The situation
                </div>
                <p className="mt-1 text-[13px] leading-[18px] text-muted-foreground">
                  {decision.situation}
                </p>
              </>
            ) : null}

            <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.08em] text-soft">
              The call
            </div>
            <p className="mt-1 text-[14px] font-semibold leading-[19px] text-foreground">
              {decision.call_text ?? decision.situation ?? "Untitled call"}
            </p>

            <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.08em] text-soft">
              Why it was the right call
            </div>
            {hasWhy ? (
              <p className="mt-1 text-[13px] leading-[18px] text-muted-foreground">
                {decision.why}{" "}
                <button
                  type="button"
                  onClick={() => onAddReasoning(decision)}
                  className="font-hand text-[16px] text-soft transition-colors hover:text-foreground"
                >
                  edit
                </button>
              </p>
            ) : (
              <p className="mt-1 text-[13px] leading-[18px] text-soft">
                {/* Figma 30:1419 says why the missing reasoning matters, rather than
                    just noting its absence. That sentence is the log's argument. */}
                No reasoning attached. This one is a fact, not a decision anyone can reuse.{" "}
                <button
                  type="button"
                  onClick={() => onAddReasoning(decision)}
                  className="text-accent-deep hover:underline"
                >
                  Add the reasoning →
                </button>
              </p>
            )}
          </div>

          {confirmed ? (
            <div className="flex shrink-0 flex-col items-end gap-1">
              <GraphiteCheck seed={decision.id} className="text-green" />
              <span
                className={`font-mono text-[10px] uppercase tracking-[0.08em] text-green ${
                  label.still ? "" : label.className
                }`}
              >
                On the record
              </span>
            </div>
          ) : null}
        </div>

        {onConfirm || onDiscard ? (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {decision.status === "draft" && onConfirm ? (
              <button
                type="button"
                onClick={() => onConfirm(decision)}
                className="rounded-[var(--radius-control)] border-[1.2px] border-graphite bg-nb-white px-3 py-1 text-[11.5px] font-medium text-foreground transition-colors hover:bg-secondary"
              >
                Confirm this call
              </button>
            ) : null}
            {onDiscard ? (
              <button
                type="button"
                onClick={() => onDiscard(decision)}
                className="font-hand text-[16px] text-soft transition-colors hover:text-foreground"
              >
                discard
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
