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

/** The frame shows six. A rail that runs past the page is a list, not a rail. */
const RAIL_CAP = 8;

export function WeekRail({ items }: { items: WorkItemRow[] }) {
  // Newest first, so "your week" is actually the week rather than whatever
  // order the scope happened to load in.
  const ordered = [...items].sort((a, b) =>
    (effectiveWorkDate(b) ?? "").localeCompare(effectiveWorkDate(a) ?? ""),
  );
  const shown = ordered.slice(0, RAIL_CAP);
  const rest = ordered.length - shown.length;

  return (
    <ToneCard tone="paper" label="YOUR WEEK, PULLED FOR YOU">
      <div className="mt-1 border-t border-border">
        {shown.map((item) => (
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
      {rest > 0 ? (
        // Said plainly rather than hidden: the rail is a sample, and the whole
        // scope is one click away on the work page.
        <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.08em] text-soft">
          {rest} more in this scope
        </p>
      ) : null}
    </ToneCard>
  );
}
