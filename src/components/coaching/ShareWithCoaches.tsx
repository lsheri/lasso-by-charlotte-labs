import { useItemExclusions, useMyCoachingLinks, useSetItemShared } from "@/hooks/use-coaching-links";
import { COACHING_COPY } from "@/lib/coaching-access";
import type { WorkItemRow } from "@/lib/work-types";

/**
 * PASS 170 — the person chooses, piece by piece, what a coach sees. Keeping
 * something back is private: nobody else is shown that it happened, and every
 * choice can be undone.
 */
export function ShareWithCoaches({ item, owned }: { item: WorkItemRow; owned: boolean }) {
  const { data: links } = useMyCoachingLinks();
  const { data: heldBack } = useItemExclusions(owned ? item.id : null);
  const save = useSetItemShared();
  const active = (links ?? []).filter((row) => row.state === "active");

  if (!owned || active.length === 0) return null;
  const held = new Set(heldBack ?? []);

  return (
    <div className="mt-3 rounded-[var(--radius)] border border-border bg-muted/30 px-4 py-3">
      <p className="micro-label">Coaching</p>
      <p className="mt-1 text-xs text-muted-foreground">{COACHING_COPY.excludeHelp}</p>
      <div className="mt-2 space-y-1.5">
        {active.map((link) => {
          const out = held.has(link.id);
          return (
            <div key={link.id} className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm text-foreground">{link.coach_name ?? "A colleague"}</span>
              <button
                type="button"
                className="text-xs font-medium text-accent-deep transition-opacity hover:opacity-70"
                disabled={save.isPending}
                onClick={() =>
                  save.mutate({ link, workItemId: item.id, shared: out })
                }
              >
                {out ? COACHING_COPY.restoreLabel : COACHING_COPY.excludeLabel}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
