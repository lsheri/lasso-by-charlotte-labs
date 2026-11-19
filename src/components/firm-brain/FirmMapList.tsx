import { firmDate } from "@/lib/firm-ask-shared";
import {
  FIRM_MAP_COPY,
  listBySituation,
  threadNodeId,
  type FirmMapLayout,
} from "@/lib/firm-map-shared";
import { cn } from "@/lib/utils";

/**
 * The firm map as a plain list: every engagement on the map, grouped by situation, with its methods in order. Shown
 * in place of the map when the browser has no WebGL or before the map has loaded, and kept under the map as the
 * keyboard and screen reader view of the same data. Picking a row pulls its thread and opens it in the reading panel.
 */
export function FirmMapList({
  layout,
  lit,
  selected,
  onPick,
}: {
  layout: FirmMapLayout;
  lit: Set<string> | null;
  selected: string | null;
  onPick: (nodeId: string | null) => void;
}) {
  const groups = listBySituation(layout);
  return (
    <div data-testid="firm-map-list" className="flex flex-col gap-4">
      {groups.map((group) => (
        <section key={group.label} className="flex flex-col gap-1">
          <h4 className="text-(length:--type-small) font-semibold text-foreground">
            {group.label}
          </h4>
          <ul className="flex flex-col">
            {group.threads.map((thread) => {
              const id = threadNodeId(thread.id);
              return (
                <li key={thread.id}>
                  <button
                    type="button"
                    data-list-thread={thread.id}
                    data-lit={lit?.has(thread.id) ? "true" : undefined}
                    aria-pressed={selected === id}
                    onClick={() => onPick(id)}
                    className={cn(
                      "flex w-full flex-col items-start gap-0.5 rounded-[var(--radius-control)] px-2 py-1.5 text-left hover:bg-accent-soft",
                      lit && !lit.has(thread.id) ? "opacity-50" : null,
                      selected === id ? "bg-accent-soft" : null,
                    )}
                  >
                    <span className="text-(length:--type-body) text-foreground">
                      {thread.name}
                      <span className="text-muted-foreground">{` · ${thread.title} · ${firmDate(thread.startedOn)}`}</span>
                    </span>
                    {thread.methodLabels.length ? (
                      <span className="text-(length:--type-small) text-muted-foreground">
                        {thread.methodLabels.join(", ")}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <p className="text-(length:--type-small) text-muted-foreground">{FIRM_MAP_COPY.privacy}</p>
    </div>
  );
}
