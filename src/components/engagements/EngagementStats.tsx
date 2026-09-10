import { useEngagementDecisions } from "@/hooks/use-decisions";

/**
 * Figma 36:1936. The engagement subtitle is a stat line, not an identifier:
 * "4 workstreams · 11 pieces of work · 6 calls on the record · 2 waiting on you".
 *
 * It owns its own read so the page's hook list and hook order are untouched.
 * `useEngagementDecisions` is a passthrough onto the consolidated engagement
 * payload the page has already loaded, so this costs no extra request.
 */
function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Structural, so any task shape carrying its work links satisfies it. */
type StatTask = { work_item_tasks: { work_items: unknown | null }[] };

export function EngagementStats({
  engagementId,
  tasks,
}: {
  engagementId: string | undefined;
  tasks: StatTask[];
}) {
  const { data: decisions } = useEngagementDecisions(engagementId);

  const rows = decisions ?? [];
  const onRecord = rows.filter((row) => row.status === "confirmed").length;
  const waiting = rows.filter((row) => row.status === "draft").length;

  const pieces = tasks.reduce(
    (total, task) => total + task.work_item_tasks.filter((link) => Boolean(link.work_items)).length,
    0,
  );

  // Only say what is true. A count of zero is left off rather than announced,
  // so the line never reads as an empty scoreboard.
  const parts = [
    plural(tasks.length, "workstream", "workstreams"),
    plural(pieces, "piece of work", "pieces of work"),
    onRecord > 0 ? plural(onRecord, "call on the record", "calls on the record") : "",
    waiting > 0 ? plural(waiting, "waiting on you", "waiting on you") : "",
  ].filter(Boolean);

  return <>{parts.join(" · ")}</>;
}
