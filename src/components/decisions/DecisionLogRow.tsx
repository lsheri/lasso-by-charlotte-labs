import type { DecisionRow } from "@/hooks/use-decisions";
import { srcsOf, useDecisionSourceItems } from "@/hooks/use-decisions";

export function DecisionLogRow({
  decision,
  onOpenSource,
  onAddReasoning,
}: {
  decision: DecisionRow;
  onOpenSource: (workItemId: string) => void;
  onAddReasoning: (decision: DecisionRow) => void;
}) {
  const srcs = srcsOf(decision);
  const ids = Array.from(new Set(srcs.map((s) => s.work_item_id).filter(Boolean)));
  const { data: sourceItems } = useDecisionSourceItems(ids);
  const hasWhy = Boolean(decision.why?.trim());

  return (
    <div className="grid gap-4 py-5 sm:grid-cols-[84px_minmax(0,1fr)]">
      <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-soft">
        {decision.date_label ?? ""}
      </div>

      <div className="min-w-0">
        <p className="text-[14px] font-semibold leading-[19px] text-foreground">
          {decision.call_text ?? decision.situation ?? "Untitled call"}
        </p>

        {hasWhy ? (
          <p className="mt-1.5 text-[13px] leading-[18px] text-muted-foreground">
            <span className="text-soft">because </span>
            {decision.why}
          </p>
        ) : (
          <p className="mt-1.5 text-[13px] leading-[18px] text-soft">
            No reasoning attached.{" "}
            <button
              type="button"
              onClick={() => onAddReasoning(decision)}
              className="text-accent-deep hover:underline"
            >
              Add the reasoning
            </button>
          </p>
        )}

        {ids.length > 0 ? (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {ids.map((id) => {
              const info = sourceItems?.[id];
              const label = (info?.title ?? "Source").toUpperCase();
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onOpenSource(id)}
                  className="max-w-[220px] truncate rounded-[var(--radius-sm)] border border-border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-accent-deep transition-colors hover:border-foreground"
                >
                  {label}
                </button>
              );
            })}
          </div>
        ) : null}

        <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.08em] text-soft">
          {decision.author === "human" ? "You decided" : "Lasso drafted"}
        </p>
      </div>
    </div>
  );
}
