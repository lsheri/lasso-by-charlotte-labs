import { Checkbox } from "@/components/ui/checkbox";
import { ArtifactNote, SourceMark } from "@/components/work/SourceMark";
import { TypeBadge } from "@/components/work/TypeIcon";
import { effectiveWorkDate, formatDate, type WorkItemRow } from "@/lib/work-types";

export type TaskGroup = { taskId: string; name: string; items: WorkItemRow[] };

/** Mapped work, grouped by the workstream it was mapped into. */
export function groupByTask(items: WorkItemRow[], engagementId: string): TaskGroup[] {
  const groups = new Map<string, TaskGroup>();
  for (const item of items) {
    for (const mapping of item.work_item_tasks) {
      if (mapping.tasks?.engagement_id !== engagementId) continue;
      const key = mapping.task_id;
      const group = groups.get(key) ?? {
        taskId: key,
        name: mapping.tasks?.name ?? "Not set",
        items: [],
      };
      if (!group.items.some((i) => i.id === item.id)) group.items.push(item);
      groups.set(key, group);
    }
  }
  return Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * The one list of "which work feeds this" — Reflect's dialog and the Ask dock's
 * Analyses tab both render this, so the grouping, the row shape and the
 * consent story stay identical wherever the question is asked.
 */
export function MappedWorkChecklist({
  items,
  engagementId,
  checked,
  onToggle,
  empty = "Nothing is mapped into this engagement yet.",
}: {
  items: WorkItemRow[];
  engagementId: string;
  checked: Set<string>;
  onToggle: (id: string) => void;
  empty?: string;
}) {
  const groups = groupByTask(items, engagementId);
  if (groups.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <>
      {groups.map((group) => (
        <div key={group.taskId}>
          <p className="micro-label">{group.name}</p>
          <div className="mt-1 space-y-1">
            {group.items.map((item) => (
              <label key={item.id} className="flex items-start gap-3 px-1 py-1.5 text-sm">
                <Checkbox
                  aria-label={item.title}
                  checked={checked.has(item.id)}
                  onCheckedChange={() => onToggle(item.id)}
                />
                <span className="min-w-0 leading-snug">
                  <span className="block break-words">
                    <SourceMark item={item} className="mr-1.5" />
                    {item.title} <ArtifactNote item={item} />
                  </span>
                  <TypeBadge item={item} size="sm" className="mt-1 mr-1.5" />
                  <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                    {formatDate(effectiveWorkDate(item))}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
