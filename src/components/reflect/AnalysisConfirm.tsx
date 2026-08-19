import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { DeliverableKindSelect } from "@/components/work/DeliverableKindSelect";
import { SourceMark } from "@/components/work/SourceMark";
import { TypeBadge } from "@/components/work/TypeIcon";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useFirmChecks } from "@/hooks/use-firm-checks";
import { useBriefs } from "@/hooks/use-briefs";
import { setDeliverableKind, useInvalidateWorkItems } from "@/hooks/use-deliverable-kind";
import { supabase } from "@/integrations/supabase/client";
import type { AnalysisPreset } from "@/lib/analysis-presets";
import {
  deliverableKindLabel,
  deliverableKindOf,
  suggestDeliverableKind,
  type DeliverableKind,
} from "@/lib/deliverable-kinds";
import type { WorkItemRow } from "@/lib/work-types";
import { contentsUnread } from "@/lib/text-status";

/** What a confirm step is pointed at, taken from the run request itself. */
export type ConfirmTarget =
  | { kind: "item"; id: string; title: string; scope: "thread" | "deliverable" }
  | { kind: "engagement"; id: string; title: string; itemCount: number };

export type AnalysisConfirmRequest = {
  preset: AnalysisPreset;
  target: ConfirmTarget;
  /** Called when the person adjusts the selection instead of running. */
  onAdjust?: (() => void) | undefined;
};

type ItemRow = {
  id: string;
  title: string;
  type: WorkItemRow["type"];
  source: WorkItemRow["source"];
  source_vendor: WorkItemRow["source_vendor"];
  source_meta: WorkItemRow["source_meta"];
  meta: WorkItemRow["meta"];
  content_ref?: string | null;
};

/**
 * Step one of running an analysis: what Lasso is about to read, built from the
 * same selection state the run request will send. The Context Audit after the
 * run remains the proof of what was read.
 */
export function AnalysisConfirm({
  request,
  orgId,
  profileId,
  onCancel,
  onConfirm,
}: {
  request: AnalysisConfirmRequest | null;
  orgId?: string | undefined;
  profileId?: string | undefined;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const target = request?.target ?? null;
  const preset = request?.preset ?? null;

  const { data: item } = useQuery({
    queryKey: ["confirm-item", target?.kind === "item" ? target.id : null],
    enabled: target?.kind === "item",
    queryFn: async (): Promise<ItemRow | null> => {
      const { data } = await supabase
        .from("work_items")
        .select("id, title, type, source, source_vendor, source_meta, meta, content_ref")
        .eq("id", (target as { id: string }).id)
        .maybeSingle();
      return (data ?? null) as ItemRow | null;
    },
  });

  // The task line lives on the episode this piece of work belongs to. It is
  // shown here so the person sees the intent Lasso will read alongside the work.
  const { data: taskLine } = useQuery({
    queryKey: ["confirm-task-line", target?.kind === "item" ? target.id : null],
    enabled: target?.kind === "item",
    queryFn: async (): Promise<string | null> => {
      const { data } = await supabase
        .from("episode_items")
        .select("work_episodes(objective)")
        .eq("work_item_id", (target as { id: string }).id)
        .limit(1);
      const row = (data ?? [])[0] as { work_episodes: { objective: string | null } | null } | undefined;
      return row?.work_episodes?.objective ?? null;
    },
  });

  const { data: checks } = useFirmChecks({
    orgId,
    engagementId: target?.kind === "engagement" ? target.id : null,
    subjectProfileId: profileId ?? null,
  });

  // Never promise to read what could not be read: the same field the work list
  // marks is what adjusts this count.
  const { data: unreadCount } = useQuery({
    queryKey: ["confirm-unread", target?.kind === "engagement" ? target.id : null],
    enabled: target?.kind === "engagement",
    queryFn: async (): Promise<number> => {
      const { data: mapped } = await supabase
        .from("work_item_tasks")
        .select("work_item_id, tasks!inner(engagement_id)")
        .eq("tasks.engagement_id", (target as { id: string }).id);
      const ids = Array.from(
        new Set((mapped ?? []).map((row) => (row as { work_item_id: string }).work_item_id)),
      );
      if (ids.length === 0) return 0;
      const { data: rows } = await supabase.from("work_items").select("id, meta").in("id", ids);
      return (rows ?? []).filter((row) => contentsUnread(row.meta as never)).length;
    },
  });

  const { data: briefs } = useBriefs(profileId);
  const invalidateWork = useInvalidateWorkItems();
  const isDeliverableRun = target?.kind === "item" && target.scope === "deliverable";
  const savedKind = deliverableKindOf(item?.meta);
  const [kind, setKind] = useState<DeliverableKind | null>(null);
  const [suggested, setSuggested] = useState(false);
  const [editingKind, setEditingKind] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isDeliverableRun || !item) return;
    if (savedKind) {
      setKind(savedKind);
      setSuggested(false);
      setEditingKind(false);
      return;
    }
    const guess = suggestDeliverableKind({
      title: item.title,
      type: item.type,
      fileHint: item.content_ref ?? null,
      briefText: (briefs ?? []).map((b) => b.title).join(" "),
    });
    setKind(guess);
    setSuggested(Boolean(guess));
    setEditingKind(true);
  }, [isDeliverableRun, item, savedKind, briefs]);

  if (!request || !preset || !target) return null;

  const isFirmChecks = preset.id === "firm_checks";
  const includesBrief = preset.scope !== "thread";
  const itemUnread = target.kind === "item" && contentsUnread(item?.meta as never);
  const engagementUnread = target.kind === "engagement" ? (unreadCount ?? 0) : 0;
  const readableCount =
    target.kind === "engagement" ? Math.max(target.itemCount - engagementUnread, 0) : 0;

  return (
    <Dialog open onOpenChange={(next) => (next ? undefined : onCancel())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="page-title text-[19px]">{preset.label}</DialogTitle>
          <DialogDescription>{preset.description}</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (isDeliverableRun && item && kind && kind !== savedKind) {
              setSaving(true);
              void setDeliverableKind(item.id, kind)
                .then(() => invalidateWork())
                .catch((error: unknown) => toast.error((error as Error).message))
                .finally(() => {
                  setSaving(false);
                  onConfirm();
                });
              return;
            }
            onConfirm();
          }}
          className="space-y-4"
        >
          <div>
            <p className="micro-label mb-2">This will read:</p>
            <ul className="space-y-2">
              {target.kind === "item" ? (
                <li className="flex flex-wrap items-center gap-2 rounded-[var(--radius)] border border-border px-3 py-2">
                  {item ? <SourceMark item={item} /> : null}
                  <span className="min-w-0 break-words text-sm text-foreground">
                    {item?.title ?? target.title}
                  </span>
                  {item ? <TypeBadge item={item} size="sm" /> : null}
                  {itemUnread ? (
                    <span className="w-full text-xs text-muted-foreground">
                      Title only, contents could not be read.
                    </span>
                  ) : null}
                </li>
              ) : (
                <li className="rounded-[var(--radius)] border border-border px-3 py-2 text-sm text-foreground">
                  {target.title}
                  <span className="ml-1 text-muted-foreground">
                    {readableCount === 1
                      ? "(1 piece of work mapped into this engagement)"
                      : `(${readableCount} pieces of work mapped into this engagement)`}
                  </span>
                  {engagementUnread > 0 ? (
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {engagementUnread === 1
                        ? "1 more is title only, its contents could not be read."
                        : `${engagementUnread} more are title only, their contents could not be read.`}
                    </span>
                  ) : null}
                </li>
              )}
              {taskLine ? (
                <li className="rounded-[var(--radius)] border border-border px-3 py-2">
                  <p className="micro-label">Task line</p>
                  <p className="mt-0.5 text-sm text-foreground">{taskLine}</p>
                </li>
              ) : null}
              {includesBrief ? (
                <li className="rounded-[var(--radius)] border border-border px-3 py-2 text-sm text-muted-foreground">
                  The engagement brief, when one is written.
                </li>
              ) : null}
              {isFirmChecks ? (
                <li className="rounded-[var(--radius)] border border-border px-3 py-2">
                  <p className="micro-label">Checks that apply</p>
                  <ul className="mt-1 space-y-0.5">
                    {(checks ?? []).map((check) => (
                      <li key={check.id} className="text-sm text-foreground">
                        {check.title}
                      </li>
                    ))}
                    {(checks ?? []).length === 0 ? (
                      <li className="text-sm text-muted-foreground">
                        No checks apply to this work yet.
                      </li>
                    ) : null}
                  </ul>
                </li>
              ) : null}
            </ul>
          </div>

          {isDeliverableRun ? (
            <div data-testid="deliverable-kind-block">
              {savedKind && !editingKind ? (
                <p className="text-xs text-muted-foreground">
                  Kind: {deliverableKindLabel(savedKind)}{" "}
                  <button
                    type="button"
                    onClick={() => setEditingKind(true)}
                    className="text-accent-deep underline underline-offset-2"
                  >
                    Change
                  </button>
                </p>
              ) : (
                <DeliverableKindSelect
                  value={kind}
                  onChange={(next) => {
                    setKind(next);
                    setSuggested(false);
                  }}
                  suggested={suggested}
                />
              )}
            </div>
          ) : null}

          {preset.handoffSchema ? (
            <p className="text-xs text-muted-foreground">
              This will also draft items you can confirm afterwards.
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" autoFocus disabled={saving}>
              {saving ? "Saving…" : "Run analysis"}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            {request.onAdjust ? (
              <button
                type="button"
                onClick={request.onAdjust}
                className="text-xs text-accent-deep underline underline-offset-2"
              >
                Adjust what Lasso reads
              </button>
            ) : null}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
