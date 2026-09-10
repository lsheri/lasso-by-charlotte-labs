import { ToneCard } from "@/components/notebook/ToneCard";
import type { WorkItemRow } from "@/lib/work-types";
import { effectiveWorkDate, formatDate } from "@/lib/work-types";

export function WeekRail({ items }: { items: WorkItemRow[] }) {
  return (
    <ToneCard tone="paper" label="YOUR WEEK, PULLED FOR YOU">
      <div className="mt-1 border-t border-border">
        {items.map((item) => (
          <div
            key={item.id}
            className="grid grid-cols-[auto_minmax(0,1fr)] gap-2 border-b border-border py-3 last:border-b-0"
          >
            <span
              aria-hidden
              className="mt-1.5 size-1.5 shrink-0 rounded-full bg-graphite"
            />
            <div className="min-w-0">
              <p className="text-[13px] font-medium leading-[17px] text-foreground">
                {item.title}
              </p>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                {formatDate(effectiveWorkDate(item))}
              </p>
            </div>
          </div>
        ))}
      </div>
    </ToneCard>
  );
}