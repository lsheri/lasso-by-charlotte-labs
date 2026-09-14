import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { isDeliverableType } from "@/lib/lineage-shared";
import { getDeliverableEvidence, reviewLink } from "@/lib/lineage.functions";
import { resolveFileFormat, type FileFormat } from "@/lib/file-format";
import { workIdentityLabel } from "@/lib/work-identity";
import { WhatFedThisButton } from "@/components/engagements/WhatFedThisButton";
import { WorkNote } from "@/components/work/WorkNote";
import { useProfile } from "@/hooks/use-profile";
import type { WorkItemRow } from "@/lib/work-types";
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
  onOpen,
  headerAction,
  orgId,
  profileId,
  isCoach,
}: {
  task: CanvasTask;
  onOpen: (item: WorkItemRow) => void;
  headerAction?: React.ReactNode;
  orgId?: string | undefined;
  profileId?: string | undefined;
  isCoach?: boolean;
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
              <div
                key={item.id}
                className="rounded-lg border border-graphite bg-card p-5 transition-colors hover:border-accent/40"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => onOpen(item)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <h3 className="text-base font-medium leading-snug text-foreground">
                      {item.title}
                    </h3>
                    <p className="micro-label mt-2">
                      {workIdentityLabel(item)}
                      {format !== "other" && formatLabel ? ` · ${formatLabel.toUpperCase()}` : ""}
                    </p>
                  </button>
                  {!isCoach ? (
                    <WhatFedThisButton items={[item]} orgId={orgId} profileId={profileId} />
                  ) : null}
                </div>
                <PendingSuggestions item={item} />
              </div>
            );
          })
        )}

        <div>
          <p className="micro-label">WHAT THIS CAME FROM</p>
          {sources.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Nothing is linked to this piece of work yet.
            </p>
          ) : (
            <ul className="nb-paper-wall mt-3">
              {sources.map((item) => (
                <li key={item.id}>
                  <WorkNote item={item} onOpen={() => onOpen(item)} />
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="text-[13px] text-muted-foreground">
          This is what is linked. It is not everything that happened.
        </p>
      </div>
    </section>
  );
}

/**
 * Draft links awaiting a person's decision, surfaced where the deliverable
 * already is. Confirmed links join the sources list; discarded ones never
 * reappear. The write path is the same reviewLink the peek panel uses.
 */
function PendingSuggestions({ item }: { item: WorkItemRow }) {
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const load = useServerFn(getDeliverableEvidence);
  const review = useServerFn(reviewLink);

  const evidenceQuery = useQuery({
    queryKey: ["deliverable-evidence", item.id],
    enabled: Boolean(profile),
    queryFn: () => load({ data: { work_item_id: item.id, profile_id: profile?.id } }),
  });

  const drafts = useMemo(
    () => (evidenceQuery.data?.links ?? []).filter((link) => link.status === "draft"),
    [evidenceQuery.data],
  );

  const [pendingId, setPendingId] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: ({ linkId, action }: { linkId: string; action: "confirmed" | "discarded" }) =>
      review({
        data: {
          link_id: linkId,
          action,
          profile_id: profile?.id,
          surface: "ledger",
        },
      }),
    onMutate: ({ linkId }) => setPendingId(linkId),
    onSettled: () => setPendingId(null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deliverable-evidence", item.id] });
    },
  });

  if (drafts.length === 0) return null;

  return (
    <div className="mt-3">
      <p className="micro-label">SUGGESTED, NOT YET CONFIRMED</p>
      <p className="mt-1 text-[13px] text-muted-foreground">
        Lasso thinks these fed this piece of work. Nothing is part of the record until you say so.
      </p>
      <ul className="mt-2 space-y-2">
        {drafts.map((link) => (
          <li
            key={link.id}
            className="flex items-center gap-3 rounded-md border border-rule px-4 py-3"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3">
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                  {link.item.title}
                </span>
                <span className="micro-label shrink-0">
                  {workIdentityLabel({
                    type: link.item.type as WorkItemRow["type"],
                    source_meta: link.item.kind
                      ? ({ kind: link.item.kind } as WorkItemRow["source_meta"])
                      : undefined,
                  })}
                </span>
              </div>
              {link.rationale ? (
                <p className="mt-1 text-[13px] text-muted-foreground">{link.rationale}</p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                disabled={pendingId === link.id}
                onClick={() => mutation.mutate({ linkId: link.id, action: "confirmed" })}
                className="rounded-full border border-graphite px-3 py-1 text-[13px] text-foreground transition-colors hover:bg-card disabled:opacity-50"
              >
                This fed it
              </button>
              <button
                type="button"
                disabled={pendingId === link.id}
                onClick={() => mutation.mutate({ linkId: link.id, action: "discarded" })}
                className="rounded-full border border-rule px-3 py-1 text-[13px] text-muted-foreground transition-colors hover:border-graphite disabled:opacity-50"
              >
                It didn&apos;t
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
