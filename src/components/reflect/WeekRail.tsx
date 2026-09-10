import { ToneCard } from "@/components/notebook/ToneCard";
import { workIdentityLabel } from "@/lib/work-identity";
import type { WorkItemRow } from "@/lib/work-types";
import { effectiveWorkDate, formatDate } from "@/lib/work-types";

/**
 * Figma 30:1012, "YOUR WEEK, PULLED FOR YOU".
 *
 * The frame ticks each piece off in green rather than bulleting it with a grey
 * dot. The tick is the point: this is what Lasso already has on you, and the
 * list is a receipt, not a to-do.
 *
 * Deliberate deviation, recorded rather than faked: the frame's second line per
 * row says things like "14 turns · checked at source" and "used 9 times since".
 * Those are provenance and reuse counts that no read on this page carries. The
 * line says what a `WorkItemRow` actually knows — what kind of thing it is, when
 * it landed, and whether it has been claimed into an engagement.
 */
function stateWord(item: WorkItemRow): string {
  if (item.visibility === "private") return "private";
  const code = item.work_item_tasks[0]?.tasks?.engagements?.code;
  if (code) return code;
  return item.visibility === "mapped" ? "claimed" : "unmapped";
}

export function WeekRail({ items }: { items: WorkItemRow[] }) {
  return (
    <ToneCard tone="paper" label="YOUR WEEK, PULLED FOR YOU">
      <div className="mt-1 border-t border-border">
        {items.map((item) => (
          <div
            key={item.id}
            className="grid grid-cols-[auto_minmax(0,1fr)] gap-2.5 border-b border-border py-3 last:border-b-0"
          >
            <span aria-hidden className="mt-[1px] shrink-0 text-[13px] leading-[17px] text-green">
              ✓
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-medium leading-[17px] text-foreground">
                {item.title}
              </p>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                {workIdentityLabel(item)} · {formatDate(effectiveWorkDate(item))} ·{" "}
                {stateWord(item)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </ToneCard>
  );
}
