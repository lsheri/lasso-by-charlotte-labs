import { useMemo } from "react";

import { isDeliverableType } from "@/lib/lineage-shared";
import { resolveFileFormat, type FileFormat } from "@/lib/file-format";
import { workIdentityLabel } from "@/lib/work-identity";
import type { WorkItemRow } from "@/lib/work-types";
import type { Profile } from "@/hooks/use-profile";
import type { CanvasTask } from "@/components/engagements/EngagementCanvas";

const FORMAT_LABELS: Record<FileFormat, string> = {
  word: "Word",
  google_docs: "Google Docs",
  google_slides: "Google Slides",
  powerpoint: "PowerPoint",
  google_sheets: "Google Sheets",
  excel: "Excel",
  pdf: "PDF",
  text: "Text",
  other: "",
};

export function WorkLedger({
  task,
  profile,
  onOpen,
  headerAction,
}: {
  task: CanvasTask;
  profile: Profile | null | undefined;
  onOpen: (item: WorkItemRow) => void;
  headerAction?: React.ReactNode;
}) {
  const items = useMemo(() => {
    const map = new Map<string, WorkItemRow>();
    for (const link of task.work_item_tasks ?? []) {
      const item = link.work_items;
      if (!item) continue;
      if (!map.has(item.id)) {
        map.set(item.id, item as unknown as WorkItemRow);
      }
    }
    return Array.from(map.values());
  }, [task]);

  const deliverables = useMemo(
    () => items.filter((item) => isDeliverableType(item.type)),
    [items],
  );
  const sources = useMemo(
    () => items.filter((item) => !isDeliverableType(item.type)),
    [items],
  );

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="micro-label micro-label-section">{task.name}</h2>
        {headerAction}
      </div>

      <div className="mt-3 space-y-6">
        {deliverables.length === 0 ? (
          <div className="rounded-lg border border-graphite bg-card p-5">
            <p className="micro-label">NOTHING SHIPPED FROM THIS YET</p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              When a deliverable is mapped to this piece of work, it lands here.
            </p>
          </div>
        ) : (
          deliverables.map((item) => {
            const format = resolveFileFormat(item);
            const formatLabel = FORMAT_LABELS[format];
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onOpen(item)}
                className="w-full rounded-lg border border-graphite bg-card p-5 text-left transition-colors hover:border-accent/40"
              >
                <h3 className="text-base font-medium leading-snug text-foreground">
                  {item.title}
                </h3>
                <p className="micro-label mt-2">
                  {workIdentityLabel(item)}
                  {format !== "other" && formatLabel ? ` · ${formatLabel.toUpperCase()}` : ""}
                </p>
              </button>
            );
          })
        )}

        <div>
          <p className="micro-label">WHAT FED THIS</p>
          {sources.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Nothing is linked to this piece of work yet.
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {sources.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onOpen(item)}
                    className="flex w-full items-center gap-3 rounded-md border border-rule px-4 py-3 text-left transition-colors hover:border-accent/40"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                      {item.title}
                    </span>
                    <span className="micro-label shrink-0">
                      {workIdentityLabel(item)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="text-[13px] text-muted-foreground">
          This is what is linked. It is not everything that happened.
        </p>
      </div>

      {profile ? null : null}
    </section>
  );
}
