import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
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
import { fetchEngagementCompanions, type CompanionRow } from "@/lib/analysis-companions";
import { isDeliverableType } from "@/lib/lineage-shared";
import {
  deliverableKindLabel,
  deliverableKindOf,
  suggestDeliverableKind,
  type DeliverableKind,
} from "@/lib/deliverable-kinds";
import type { WorkItemRow } from "@/lib/work-types";
import { TITLE_ONLY_LINE, contentsUnread, readCounts } from "@/lib/text-status";

/** What a confirm step is pointed at, taken from the run request itself. */
export type ConfirmTarget =
  | { kind: "item"; id: string; title: string; scope: "thread" | "deliverable" }
  | { kind: "engagement"; id: string; title: string; itemCount: number };

export type AnalysisConfirmRequest = {
  preset: AnalysisPreset;
  target: ConfirmTarget;
  /** One named firm check, when the run is for that check alone. */
  check?: { id: string; title: string } | undefined;
  /** Called when the person adjusts the selection instead of running. */
  onAdjust?: (() => void) | undefined;
  /**
   * The deliverables a run may anchor on, when the launching surface already
   * knows them (the picker selection). Absent means the eligible anchors are
   * the deliverables among this engagement's companions.
   */
  anchorOptions?: CompanionRow[] | undefined;
  /**
   * The work the launching surface already had selected. Absent means every
   * companion starts ticked; present means exactly these do.
   */
  preselectedIds?: string[] | undefined;
};

type ItemRow = CompanionRow & { type: WorkItemRow["type"] };

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
  /** The anchor the run reads from, plus the extra work kept ticked. */
  onConfirm: (anchorItemId: string | null, extraItemIds: string[]) => void;
}) {
  const target = request?.target ?? null;
  const preset = request?.preset ?? null;
  const baseAnchorId = target?.kind === "item" ? target.id : null;

  // Which deliverable the run anchors on. It starts as the one the surface
  // launched from and the person may swap it for another in context.
  const [anchorId, setAnchorId] = useState<string | null>(baseAnchorId);
  const [pickingAnchor, setPickingAnchor] = useState(false);
  useEffect(() => {
    setAnchorId(baseAnchorId);
    setPickingAnchor(false);
  }, [baseAnchorId]);
  const effectiveAnchor = anchorId ?? baseAnchorId;

  const { data: baseItem } = useQuery({
    queryKey: ["confirm-item", baseAnchorId],
    enabled: Boolean(baseAnchorId),
    queryFn: async (): Promise<ItemRow | null> => {
      const { data } = await supabase
        .from("work_items")
        .select("id, title, type, source, source_vendor, source_meta, meta, content_ref")
        .eq("id", baseAnchorId as string)
        .maybeSingle();
      return (data ?? null) as ItemRow | null;
    },
  });

  // The task line lives on the episode this piece of work belongs to. It is
  // shown here so the person sees the intent Lasso will read alongside the work.
  const { data: taskLine } = useQuery({
    queryKey: ["confirm-task-line", effectiveAnchor],
    enabled: Boolean(effectiveAnchor),
    queryFn: async (): Promise<string | null> => {
      const { data } = await supabase
        .from("episode_items")
        .select("work_episodes(objective)")
        .eq("work_item_id", effectiveAnchor as string)
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

  // Pass 95: an analysis reads the person's whole context by default, not the
  // one item it was launched from. These are the other pieces of work mapped
  // into the same engagement.
  const { data: companions } = useQuery({
    queryKey: ["confirm-companions", baseAnchorId],
    enabled: Boolean(baseAnchorId),
    queryFn: () => fetchEngagementCompanions(supabase, baseAnchorId as string),
  });

  // Everything the confirm step knows about, the launched item included, so
  // swapping the anchor simply moves one row between the two lists.
  const pool = useMemo<ItemRow[]>(() => {
    const rows = new Map<string, ItemRow>();
    if (baseItem) rows.set(baseItem.id, baseItem);
    for (const row of request?.anchorOptions ?? []) rows.set(row.id, row as ItemRow);
    for (const row of companions ?? []) rows.set(row.id, row as ItemRow);
    return Array.from(rows.values());
  }, [baseItem, companions, request?.anchorOptions]);

  const anchorItem = pool.find((row) => row.id === effectiveAnchor) ?? baseItem ?? null;
  // Conversations first, then everything else. Within each group the query
  // order already holds, which is newest captured first.
  const companionList = pool
    .filter((row) => row.id !== effectiveAnchor)
    .sort((a, b) => Number(b.type === "ai_thread") - Number(a.type === "ai_thread"));
  const eligibleAnchors = (
    request?.anchorOptions ?? pool.filter((row) => isDeliverableType(row.type))
  ).filter((row) => row.id !== effectiveAnchor);

  const [included, setIncluded] = useState<Set<string>>(new Set());
  const poolKey = pool.map((row) => row.id).sort().join(",");
  const preselectKey = (request?.preselectedIds ?? []).join(",");
  useEffect(() => {
    const ids = request?.preselectedIds ?? pool.map((row) => row.id);
    const next = new Set(ids);
    if (effectiveAnchor) next.delete(effectiveAnchor);
    setIncluded(next);
    // Defaults follow the launched context, not each anchor swap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poolKey, preselectKey, baseAnchorId]);

  function swapAnchor(nextId: string) {
    const previous = effectiveAnchor;
    setAnchorId(nextId);
    setPickingAnchor(false);
    setIncluded((prev) => {
      const next = new Set(prev);
      next.delete(nextId);
      if (previous) next.add(previous);
      return next;
    });
  }

  const extraIds = companionList.map((row) => row.id).filter((id) => included.has(id));

  const { data: briefs } = useBriefs(profileId);
  const invalidateWork = useInvalidateWorkItems();
  const isDeliverableRun = target?.kind === "item" && target.scope === "deliverable";
  const savedKind = deliverableKindOf(anchorItem?.meta);
  const [kind, setKind] = useState<DeliverableKind | null>(null);
  const [suggested, setSuggested] = useState(false);
  const [editingKind, setEditingKind] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isDeliverableRun || !anchorItem) return;
    if (savedKind) {
      setKind(savedKind);
      setSuggested(false);
      setEditingKind(false);
      return;
    }
    const guess = suggestDeliverableKind({
      title: anchorItem.title,
      type: anchorItem.type,
      fileHint: anchorItem.content_ref ?? null,
      briefText: (briefs ?? []).map((b) => b.title).join(" "),
    });
    setKind(guess);
    setSuggested(Boolean(guess));
    setEditingKind(true);
  }, [isDeliverableRun, anchorItem, savedKind, briefs]);

  if (!request || !preset || !target) return null;

  const isFirmChecks = preset.id === "firm_checks";
  const includesBrief = true;
  /**
   * The confirm sheet's shape follows what the chosen analysis actually reads:
   * one conversation, one deliverable and its record, or a whole engagement.
   */
  const shape: "thread" | "deliverable" | "engagement" =
    target.kind === "engagement" ? "engagement" : preset.scope === "thread" ? "thread" : "deliverable";
  const readingLine =
    shape === "thread"
      ? "Reads this one conversation."
      : shape === "engagement"
        ? "Reads every mapped piece of work in this engagement."
        : "Reads the work and the record behind it.";
  const sentExtraIds = shape === "thread" ? [] : extraIds;
  const contextLabel =
    preset.id === "what_fed_this"
      ? `Candidates it checks for links (${companionList.length})`
      : `The record behind it (${companionList.length})`;
  const itemUnread = target.kind === "item" && contentsUnread(anchorItem?.meta as never);
  const counts =
    target.kind === "engagement"
      ? readCounts(target.itemCount, unreadCount ?? 0)
      : { readable: 0, titleOnly: 0 };
  const engagementUnread = counts.titleOnly;
  const readableCount = counts.readable;

  return (
    <Dialog open onOpenChange={(next) => (next ? undefined : onCancel())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="page-title text-[19px]">{preset.label}</DialogTitle>
          <DialogDescription>{readingLine}</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (isDeliverableRun && anchorItem && kind && kind !== savedKind) {
              setSaving(true);
              void setDeliverableKind(anchorItem.id, kind)
                .then(() => invalidateWork())
                .catch((error: unknown) => toast.error((error as Error).message))
                .finally(() => {
                  setSaving(false);
                  onConfirm(effectiveAnchor, sentExtraIds);
                });
              return;
            }
            onConfirm(effectiveAnchor, sentExtraIds);
          }}
          className="space-y-4"
        >
          <div>
            <p className="micro-label mb-2">
              {shape === "thread" ? "The conversation" : shape === "engagement" ? "The engagement" : "The work"}
            </p>
            <ul className="space-y-2">
              {target.kind === "item" ? (
                <li className="rounded-[var(--radius)] border border-border px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {anchorItem ? <SourceMark item={anchorItem as never} /> : null}
                    <span className="min-w-0 break-words text-sm text-foreground">
                      {anchorItem?.title ?? target.title}
                    </span>
                    {anchorItem ? <TypeBadge item={anchorItem as never} size="sm" /> : null}
                    {shape === "deliverable" && eligibleAnchors.length > 0 ? (
                      <button
                        type="button"
                        data-testid="anchor-change"
                        onClick={() => setPickingAnchor((prev) => !prev)}
                        className="text-xs text-accent-deep underline underline-offset-2"
                      >
                        {pickingAnchor ? "Keep this" : "Change"}
                      </button>
                    ) : null}
                    {itemUnread ? (
                      <span className="w-full text-xs text-muted-foreground">{TITLE_ONLY_LINE}</span>
                    ) : null}
                  </div>
                  {pickingAnchor ? (
                    <div className="mt-2 space-y-1" data-testid="anchor-options">
                      <p className="micro-label">Run this on</p>
                      {eligibleAnchors.map((row) => (
                        <button
                          key={row.id}
                          type="button"
                          onClick={() => swapAnchor(row.id)}
                          className="block w-full break-words text-left text-sm text-accent-deep underline underline-offset-2"
                        >
                          {row.title}
                        </button>
                      ))}
                    </div>
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
                  <p className="micro-label">Goal</p>
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
                  <p className="micro-label">
                    {request?.check ? "The check that runs" : "Checks that apply"}
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {request?.check ? (
                      <li className="text-sm text-foreground">{request.check.title}</li>
                    ) : (
                      (checks ?? []).map((check) => (
                        <li key={check.id} className="text-sm text-foreground">
                          {check.title}
                        </li>
                      ))
                    )}
                    {!request?.check && (checks ?? []).length === 0 ? (
                      <li className="text-sm text-muted-foreground">
                        No checks apply to this work yet.
                      </li>
                    ) : null}
                  </ul>
                </li>
              ) : null}
            </ul>
          </div>

          {shape === "deliverable" && companionList.length > 0 ? (
            <div data-testid="confirm-context-block">
              <p className="micro-label">{contextLabel}</p>
              <div className="mt-2 max-h-52 space-y-1 overflow-y-auto rounded-[var(--radius)] border border-border p-2">
                  <div className="flex gap-3 pb-1">
                    <button
                      type="button"
                      onClick={() => setIncluded(new Set(companionList.map((row) => row.id)))}
                      className="text-xs text-accent-deep underline underline-offset-2"
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      onClick={() => setIncluded(new Set())}
                      className="text-xs text-accent-deep underline underline-offset-2"
                    >
                      Clear
                    </button>
                  </div>
                  {companionList.map((row) => (
                    <label key={row.id} className="flex items-start gap-2 py-1 text-sm">
                      <input
                        type="checkbox"
                        aria-label={row.title}
                        checked={included.has(row.id)}
                        onChange={() =>
                          setIncluded((prev) => {
                            const next = new Set(prev);
                            if (next.has(row.id)) next.delete(row.id);
                            else next.add(row.id);
                            return next;
                          })
                        }
                        className="mt-1"
                      />
                      <span className="min-w-0 break-words leading-snug text-foreground">
                        <SourceMark item={row as never} className="mr-1.5" />
                        {row.title}
                        {contentsUnread(row.meta as never) ? (
                          <span className="ml-1.5 text-xs text-muted-foreground">title only</span>
                        ) : null}
                      </span>
                    </label>
                  ))}
              </div>
            </div>
          ) : null}

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
