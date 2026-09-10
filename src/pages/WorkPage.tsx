import { CheckCircle2, CircleDashed } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { GettingStartedCard } from "@/components/onboarding/checklist/GettingStartedCard";
import { MapDialog } from "@/components/work/MapDialog";
import { RowMenu } from "@/components/work/RowMenu";
import { AnalysisLens } from "@/components/reflect/AnalysisLens";
import {
  ThreadAnalysisLauncher,
  isThreadReaderPreset,
  type ThreadReaderPreset,
} from "@/components/verify/ThreadAnalysisLauncher";
import { isDeliverableType } from "@/lib/lineage-shared";
import { ImportFlowDialog } from "@/components/work/import/ImportFlowDialog";
import { PasteThreadDialog } from "@/components/work/PasteThreadDialog";
import { OpenFileAction } from "@/components/work/OpenFileAction";
import { ConnectorBrowseActions } from "@/components/connectors/ConnectorBrowseActions";
import { WatchSuggestionBanner } from "@/components/connectors/WatchSuggestionBanner";
import { SuggestDot, SuggestLegend, Suggested } from "@/components/common/Suggested";
import { SuggestionChip } from "@/components/work/SuggestionChip";
import { PeekPanel, type PeekEntry } from "@/components/peek/PeekPanel";
import type { PeekAnalysisPreset } from "@/components/peek/PeekActionBar";
import { UploadFilesButton } from "@/components/work/UploadFilesButton";
import { TranscriptsAction } from "@/components/work/TranscriptsAction";
import { WorkDateDialog } from "@/components/work/WorkDateDialog";
import { MapButton } from "@/components/work/MapButton";
import { RowAction, WorkRow } from "@/components/work/WorkRow";
import { EngagementFold, WorkSection } from "@/components/work/WorkSection";
import { WorkPile } from "@/components/work/WorkPile";
import { ConversationChips } from "@/components/work/ConversationChips";
import { ConversationCard } from "@/components/work/ConversationCard";
import { FlaggedMarker, isFlaggedRestatement } from "@/components/work/FlaggedMarker";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useMakePrivate } from "@/hooks/use-make-private";
import { useProfile } from "@/hooks/use-profile";
import { useWorkItems } from "@/hooks/use-work-items";
import { supabase } from "@/integrations/supabase/client";
import type { MappingSuggestion } from "@/lib/mapping-shared";
import { suggestMappings } from "@/lib/mapping.functions";
import { removeWorkItems } from "@/lib/work-bulk.functions";
import { detachEpisodeItems, syncEpisodeForMapping } from "@/lib/episodes.functions";
import { logEvent } from "@/lib/telemetry";
import { logV2 } from "@/lib/telemetry-v2";
import { engagementHue } from "@/lib/work-identity";
import { engagementLabel } from "@/lib/clients";
import { markOpenStart } from "@/lib/perf-timing";
import {
  effectiveWorkDate,
  formatDate,
  groupConversations,
  isConversationGroup,
  sourceLabel,
  type ConversationGroup,
  type WorkItemRow,
} from "@/lib/work-types";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionHeader } from "@/components/notebook/SectionHeader";
import { ToneCard } from "@/components/notebook/ToneCard";
import { SourceMark, sourceVendorKey } from "@/components/work/SourceMark";
import { BUCKETS, bucketFor } from "@/components/work/work-buckets";

export function WorkPage() {
  const { data: profile } = useProfile();
  const { data, isLoading, error } = useWorkItems();
  const queryClient = useQueryClient();
  const runSuggest = useServerFn(suggestMappings);
  const runRemove = useServerFn(removeWorkItems);
  const syncEpisode = useServerFn(syncEpisodeForMapping);
  const detachEpisode = useServerFn(detachEpisodeItems);
  const [mapItem, setMapItem] = useState<WorkItemRow | null>(null);
  const [mapGroup, setMapGroup] = useState<WorkItemRow[] | null>(null);
  const [mapBulk, setMapBulk] = useState(false);
  const [peek, setPeek] = useState<{ entry: PeekEntry; focusId: string } | null>(null);
  const [dateItem, setDateItem] = useState<WorkItemRow | null>(null);
  const [lensItem, setLensItem] = useState<WorkItemRow | null>(null);
  const [lensPreset, setLensPreset] = useState<PeekAnalysisPreset | undefined>(undefined);
  // A thread analysis launched from the peek: confirm, then the reader itself.
  const [launch, setLaunch] = useState<{ item: WorkItemRow; preset: ThreadReaderPreset } | null>(
    null,
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<MappingSuggestion[] | null>(null);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  const [acceptPending, setAcceptPending] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removingFlagged, setRemovingFlagged] = useState(false);
  // Private stopped being a section: it is a per-row chip and this filter.
  const [showPrivate, setShowPrivate] = useState(true);
  // Presentation-only filter for the type columns. Local state, no query.
  const [columnFilter, setColumnFilter] = useState<string>("all");

  const all = data?.items ?? [];
  const mappingError = data?.mappingError ?? null;
  const mapped = all.filter((i) => i.visibility === "mapped");
  const unmapped = all.filter((i) => i.visibility === "unmapped");
  const priv = all.filter((i) => i.visibility === "private");
  const flagged = all.filter((i) => i.visibility === "unmapped" && isFlaggedRestatement(i));

  async function removeAllFlagged() {
    setRemovingFlagged(true);
    setActionError(null);
    try {
      const result = await runRemove({
        data: { profile_id: profile?.id, ids: flagged.map((i) => i.id) },
      });
      toast.success(
        result.removed > 0
          ? `${result.removed} item${result.removed === 1 ? "" : "s"} removed from Lasso`
          : "Nothing was removed",
      );
      await queryClient.invalidateQueries({ queryKey: ["work-items"] });
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setRemovingFlagged(false);
    }
  }

  const active = (suggestions ?? []).filter(
    (s) => !dismissed.includes(s.work_item_id) && unmapped.some((i) => i.id === s.work_item_id),
  );

  const { data: taskLabels } = useQuery({
    queryKey: [
      "suggestion-task-labels",
      active
        .map((s) => s.task_id)
        .sort()
        .join(","),
    ],
    enabled: active.length > 0,
    queryFn: async (): Promise<Record<string, string>> => {
      const ids = Array.from(new Set(active.map((s) => s.task_id)));
      const { data: rows, error: taskError } = await supabase
        .from("tasks")
        .select("id, name, engagements(code)")
        .in("id", ids);
      if (taskError) throw taskError;
      const out: Record<string, string> = {};
      for (const row of (rows ?? []) as unknown as {
        id: string;
        name: string;
        engagements: { code: string } | null;
      }[]) {
        out[row.id] = `${row.engagements?.code ?? "Not set"} · ${row.name}`;
      }
      return out;
    },
  });

  const runMakePrivate = useMakePrivate();

  async function makePrivate(item: WorkItemRow) {
    setActionError(null);
    const message = await runMakePrivate(item);
    if (message) setActionError(message);
  }

  async function unmark(item: WorkItemRow) {
    setActionError(null);
    const upd = await supabase
      .from("work_items")
      .update({ visibility: "unmapped" })
      .eq("id", item.id);
    if (upd.error) return setActionError(upd.error.message);
    if (profile) {
      logV2(
        "work_item.unmapped",
        { item_type: item.type },
        {
          profileId: profile.id,
          workItemId: item.id,
        },
      );
    }
    await queryClient.invalidateQueries({ queryKey: ["work-items"] });
  }

  function openItem(item: WorkItemRow, entry?: PeekEntry): () => void {
    return () => {
      markOpenStart("peek.open");
      setPeek({ entry: entry ?? item, focusId: item.id });
    };
  }

  function openMap(item: WorkItemRow, group?: WorkItemRow[]) {
    setMapGroup(group ?? null);
    setMapItem(item);
  }

  /** One conversation: one card, every pushed piece legible inside it. */
  function renderGroup(group: ConversationGroup, variant: "mapped" | "unmapped" | "private") {
    const head = group.transcript ?? group.items[0]!;
    return (
      <ConversationCard
        key={group.key}
        group={group}
        variant={variant}
        onOpen={(item: WorkItemRow) => {
          markOpenStart("peek.open");
          setPeek({ entry: group, focusId: item.id });
        }}
        actions={rowActions(head, variant, group.items)}
        footerFor={(piece: WorkItemRow) =>
          isFlaggedRestatement(piece) ? <FlaggedMarker item={piece} /> : undefined
        }
      />
    );
  }

  function rowActions(
    item: WorkItemRow,
    variant: "mapped" | "unmapped" | "private",
    group?: WorkItemRow[],
  ) {
    // A private row keeps its own action set wherever it renders, now that the
    // pile holds private and unmapped work side by side.
    if (item.visibility === "private") {
      return (
        <>
          {item.content_ref ? <OpenFileAction workItemId={item.id} /> : null}
          <RowAction onClick={() => setDateItem(item)}>Work date</RowAction>
          <RowAction onClick={() => void unmark(item)}>Unmark</RowAction>
          <RowMenu
            item={item}
            onFluency={(next) => {
              setLensPreset(undefined);
              setLensItem(next);
            }}
          />
        </>
      );
    }
    const groupLabel = group && group.length > 1;
    return (
      <>
        {item.content_ref ? <OpenFileAction workItemId={item.id} /> : null}
        <MapButton onClick={() => openMap(item, group)} stopPropagation>
          {variant === "mapped"
            ? groupLabel
              ? "Remap conversation"
              : "Remap"
            : groupLabel
              ? "Map conversation"
              : "Map to a workstream"}
        </MapButton>
        {group && group.length > 1 ? (
          <RowAction onClick={() => openMap(item)}>Map just this</RowAction>
        ) : null}
        <RowAction onClick={() => setDateItem(item)}>Work date</RowAction>
        <RowAction onClick={() => void makePrivate(item)}>Make private</RowAction>
        <RowMenu
          item={item}
          onFluency={(next) => {
            setLensPreset(undefined);
            setLensItem(next);
          }}
        />
      </>
    );
  }

  async function handleSuggest() {
    setSuggesting(true);
    setActionError(null);
    try {
      const result = await runSuggest({ data: { profile_id: profile?.id } });
      setSuggestions(result.suggestions);
      setDismissed([]);
      toast.success(
        result.suggestions.length > 0
          ? `${result.suggestions.length} suggestion${result.suggestions.length === 1 ? "" : "s"}`
          : "No confident matches yet",
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSuggesting(false);
    }
  }

  async function acceptSuggestion(suggestion: MappingSuggestion) {
    const item = unmapped.find((i) => i.id === suggestion.work_item_id);
    if (!item || !profile) return;
    setAcceptPending(true);
    setActionError(null);
    try {
      const cleanup = await supabase.from("work_item_tasks").delete().eq("work_item_id", item.id);
      if (cleanup.error) throw new Error(cleanup.error.message);
      const link = await supabase
        .from("work_item_tasks")
        .insert({ work_item_id: item.id, task_id: suggestion.task_id });
      if (link.error) throw new Error(link.error.message);
      const upd = await supabase
        .from("work_items")
        .update({ visibility: "mapped" })
        .eq("id", item.id);
      if (upd.error) throw new Error(upd.error.message);

      await detachEpisode({ data: { work_item_ids: [item.id] } });
      await syncEpisode({
        data: {
          task_id: suggestion.task_id,
          work_item_ids: [item.id],
          profile_id: profile.id,
        },
      });

      logEvent("workitem.mapped", profile.org_id, {
        type: item.type,
        source: item.source,
        suggested: true,
      });
      setDismissed((prev) => [...prev, item.id]);
      await queryClient.invalidateQueries({ queryKey: ["work-items"] });
      await queryClient.invalidateQueries({ queryKey: ["engagement"] });
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setAcceptPending(false);
    }
  }

  const highConfidence = active.filter((s) => s.confidence === "high");

  function suggestionFor(item: WorkItemRow) {
    const suggestion = active.find((s) => s.work_item_id === item.id);
    const flag = isFlaggedRestatement(item) ? <FlaggedMarker item={item} /> : null;
    if (!suggestion) return flag;
    return (
      <div className="space-y-2">
        <SuggestionChip
          label={taskLabels?.[suggestion.task_id] ?? "task"}
          reason={suggestion.reason}
          pending={acceptPending}
          onAccept={() => void acceptSuggestion(suggestion)}
          onDismiss={() => setDismissed((prev) => [...prev, suggestion.work_item_id])}
        />
        {flag}
      </div>
    );
  }

  const isCoach = profile?.role === "coach";
  // The pile IS the unmapped set. Private items are unmapped work you withheld,
  // so they join it behind a filter rather than getting a section of their own.
  const pileItems = showPrivate ? [...unmapped, ...priv] : unmapped;
  const unmappedEntries = groupConversations(pileItems);
  // Only standalone items are bulk-selectable; a conversation stays whole, and
  // a private item has no mapping path at all.
  const selectable = unmappedEntries
    .filter((entry): entry is WorkItemRow => !isConversationGroup(entry))
    .filter((i) => i.visibility === "unmapped")
    .map((i) => i.id);
  const allChosen = selectable.length > 0 && selectable.every((id) => chosen.has(id));

  /** Mapped work, folded one engagement at a time. */
  const mappedByEngagement = (() => {
    const buckets = new Map<string, { id: string | null; label: string; items: WorkItemRow[] }>();
    for (const item of mapped) {
      const engagement = item.work_item_tasks[0]?.tasks?.engagements ?? null;
      const key = engagement?.id ?? "unfiled";
      const bucket = buckets.get(key) ?? {
        id: engagement?.id ?? null,
        label: engagement ? engagementLabel(engagement) : "Mapped elsewhere",
        items: [],
      };
      bucket.items.push(item);
      buckets.set(key, bucket);
    }
    return Array.from(buckets.values()).sort((a, b) => a.label.localeCompare(b.label));
  })();

  function toggleChosen(id: string) {
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function leaveSelectMode() {
    setSelectMode(false);
    setChosen(new Set());
  }

  async function handleRemove() {
    setRemoving(true);
    setActionError(null);
    try {
      const result = await runRemove({
        data: { profile_id: profile?.id, ids: Array.from(chosen) },
      });
      toast.success(
        result.removed > 0
          ? `${result.removed} item${result.removed === 1 ? "" : "s"} removed from Lasso`
          : "Nothing was removed",
      );
      setConfirmRemove(false);
      leaveSelectMode();
      await queryClient.invalidateQueries({ queryKey: ["work-items"] });
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setRemoving(false);
    }
  }

  const subtitle = `${all.length} piece${all.length === 1 ? "" : "s"} of work · ${
    unmapped.length
  } unmapped`;

  const engagementCodes = Array.from(
    new Set(
      mapped
        .map((item) => item.work_item_tasks[0]?.tasks?.engagements?.code)
        .filter((code): code is string => Boolean(code)),
    ),
  ).sort((a, b) => a.localeCompare(b));

  const filtered =
    columnFilter === "all"
      ? all
      : columnFilter === "unmapped"
        ? all.filter((item) => item.visibility === "unmapped")
        : all.filter(
            (item) => item.work_item_tasks[0]?.tasks?.engagements?.code === columnFilter,
          );

  const chipBase = "rounded-full px-3 py-1 text-[11.5px] transition-colors";
  const chipOn = `${chipBase} border border-graphite bg-nb-white font-medium text-foreground`;
  const chipOff = `${chipBase} border border-[var(--nb-pencil)] text-muted-foreground hover:border-foreground`;

  /** Where the work came from, counted client-side off the loaded items. */
  const sourceCounts = (() => {
    const counts = new Map<string, { label: string; count: number }>();
    for (const item of all) {
      const key = sourceVendorKey(item) ?? item.source ?? "other";
      const row = counts.get(key) ?? { label: sourceLabel(item.source), count: 0 };
      row.count += 1;
      counts.set(key, row);
    }
    return Array.from(counts.values()).sort((a, b) => b.count - a.count);
  })();
  const sourceMax = sourceCounts.reduce((max, row) => Math.max(max, row.count), 0);

  function cardMeta(item: WorkItemRow): string {
    const code = item.work_item_tasks[0]?.tasks?.engagements?.code;
    if (code) return code;
    return item.visibility === "private" ? "PRIVATE" : "UNMAPPED";
  }

  return (
    <div>
      <GettingStartedCard />
      <PageHeader title="All" italicWord="work" subtitle={subtitle} />
      <div className="mb-6 flex flex-wrap items-center gap-2">
          {unmapped.length > 0 ? (
            <button
              type="button"
              disabled={suggesting}
              onClick={() => void handleSuggest()}
              className="text-xs font-medium text-accent-deep transition-opacity hover:opacity-70 disabled:opacity-50"
            >
              {suggesting ? "Thinking…" : "✨ Suggest mapping"}
            </button>
          ) : null}
          {!isCoach && selectable.length > 0 ? (
            selectMode ? (
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                  <Checkbox
                    checked={allChosen}
                    onCheckedChange={() => setChosen(allChosen ? new Set() : new Set(selectable))}
                    aria-label="Select all visible unmapped items"
                  />
                  Select all
                </label>
                <MapButton
                  disabled={chosen.size === 0}
                  onClick={() => {
                    const picked = all.filter((i) => chosen.has(i.id));
                    const head = picked[0];
                    if (!head) return;
                    setMapBulk(true);
                    setMapGroup(picked);
                    setMapItem(head);
                  }}
                >
                  Map to a workstream{chosen.size ? ` (${chosen.size})` : ""}
                </MapButton>
                <button
                  type="button"
                  disabled={chosen.size === 0}
                  onClick={() => setConfirmRemove(true)}
                  className="text-xs font-medium text-destructive transition-opacity hover:opacity-70 disabled:opacity-40"
                >
                  Remove{chosen.size ? ` (${chosen.size})` : ""}
                </button>
                <button
                  type="button"
                  onClick={leaveSelectMode}
                  className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  Done
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setSelectMode(true)}
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Select
              </button>
            )
          ) : null}
          <ConnectorBrowseActions />
          {/* On phones the one green primary anchors the bottom of the screen. */}
          <PasteThreadDialog
            trigger={
              <Button type="button" className="hidden md:inline-flex">
                Paste a thread
              </Button>
            }
          />
          <UploadFilesButton />
          <TranscriptsAction />
          <ImportFlowDialog
            trigger={
              <Button type="button" variant="outline">
                Import AI history
              </Button>
            }
          />
      </div>

      {all.length > 0 ? (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setColumnFilter("all")}
            className={columnFilter === "all" ? chipOn : chipOff}
          >
            Everything
          </button>
          <button
            type="button"
            onClick={() => setColumnFilter("unmapped")}
            className={columnFilter === "unmapped" ? chipOn : chipOff}
          >
            Unmapped
          </button>
          {engagementCodes.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => setColumnFilter(code)}
              className={columnFilter === code ? chipOn : chipOff}
            >
              {code}
            </button>
          ))}
        </div>
      ) : null}


      {error ? <p className="mb-6 text-sm text-destructive">{(error as Error).message}</p> : null}
      {actionError ? <p className="mb-6 text-sm text-destructive">{actionError}</p> : null}
      {mappingError ? (
        <p className="mb-6 text-sm text-destructive">
          Mapping details couldn't load: {mappingError}
        </p>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading your work…</p>
      ) : all.length === 0 ? (
        <div className="mx-auto max-w-lg rounded-[var(--radius)] border border-border bg-card px-8 py-12 text-center shadow-card">
          <p className="text-sm text-foreground">Your work lands here.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <ConnectorBrowseActions />
            <PasteThreadDialog trigger={<Button type="button">Paste a thread</Button>} />
            <UploadFilesButton />
            <TranscriptsAction />
            <ImportFlowDialog
              trigger={
                <Button type="button" variant="outline">
                  Import AI history
                </Button>
              }
            />
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          <div>
            <div className="grid gap-6 lg:grid-cols-4">
              {BUCKETS.map((bucket) => {
                const items = filtered.filter((item) => bucketFor(item.type).key === bucket.key);
                return (
                  <div key={bucket.key}>
                    <SectionHeader
                      title={bucket.label}
                      action={
                        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-soft">
                          {items.length}
                        </span>
                      }
                    />
                    <div className="space-y-2">
                      {items.length === 0 ? (
                        <p className="text-[11.5px] text-soft">Nothing here yet.</p>
                      ) : (
                        items.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={openItem(item)}
                            className="block w-full text-left"
                          >
                            <ToneCard
                              tone={item.visibility === "unmapped" ? "attention" : "paper"}
                              label={[sourceLabel(item.source), formatDate(effectiveWorkDate(item))]
                                .filter(Boolean)
                                .join(" · ")}
                              mark={<SourceMark item={item} size={14} />}
                              title={item.title}
                              meta={cardMeta(item)}
                            />
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="font-hand mt-4 text-[16px] text-green">
              the pile is how it arrives, the columns are what it means
            </p>
          </div>

          <WatchSuggestionBanner />
          {!isCoach && flagged.length > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius)] border border-dashed border-border bg-secondary/50 px-4 py-3">
              <p className="min-w-0 text-sm text-foreground">
                {flagged.length} item{flagged.length === 1 ? "" : "s"} look like part of a
                conversation rather than separate artifacts. You decide whether they stay.
              </p>
              <button
                type="button"
                disabled={removingFlagged}
                onClick={() => void removeAllFlagged()}
                className="text-xs font-medium text-destructive transition-opacity hover:opacity-70 disabled:opacity-40"
              >
                {removingFlagged ? "Removing…" : `Remove all ${flagged.length}`}
              </button>
            </div>
          ) : null}
          <WorkSection
            label="Unmapped"
            hint="Private by default until you map it, nothing is shared with your coach yet."
            count={unmappedEntries.length}
            tone="amber"
            icon={CircleDashed}
            defaultOpen
            accessory={
              priv.length > 0 ? (
                <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                  <Checkbox
                    checked={showPrivate}
                    onCheckedChange={(next) => setShowPrivate(next === true)}
                    aria-label="Show private work"
                  />
                  Show private ({priv.length})
                </label>
              ) : undefined
            }
          >
            {pileItems.length === 0 ? (
              <p className="rounded-[var(--radius)] border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                Nothing waiting. Every piece of work here has a home.
              </p>
            ) : (
              <div className={suggesting ? "animate-pulse space-y-2" : "space-y-2"}>
                {active.length === 0 ? (
                  <Suggested className="flex flex-wrap items-center justify-between gap-3">
                    <p className="flex min-w-0 items-center gap-2 text-sm text-foreground">
                      <SuggestDot />
                      Let Lasso suggest where these go
                    </p>
                    <button
                      type="button"
                      disabled={suggesting}
                      onClick={() => void handleSuggest()}
                      className="text-xs font-medium text-accent-deep transition-opacity hover:opacity-70 disabled:opacity-50"
                    >
                      {suggesting ? "Thinking…" : "Suggest mapping"}
                    </button>
                  </Suggested>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <SuggestLegend />
                    {highConfidence.length >= 3 ? (
                      <button
                        type="button"
                        disabled={acceptPending}
                        onClick={() => {
                          void (async () => {
                            for (const suggestion of highConfidence) {
                              await acceptSuggestion(suggestion);
                            }
                          })();
                        }}
                        className="text-xs font-medium text-accent-deep transition-opacity hover:opacity-70 disabled:opacity-50"
                      >
                        Accept all high-confidence ({highConfidence.length})
                      </button>
                    ) : null}
                  </div>
                )}

                <WorkPile
                  entries={unmappedEntries}
                  onOpenEntry={(entry) => {
                    const head = isConversationGroup(entry)
                      ? (entry.transcript ?? entry.items[0]!)
                      : entry;
                    openItem(head, isConversationGroup(entry) ? entry : head)();
                  }}
                  forceMatrix={selectMode || active.length > 0}

                  renderEntry={(entry) =>
                    isConversationGroup(entry) ? (
                      renderGroup(entry, "unmapped")
                    ) : (
                      <WorkRow
                        key={entry.id}
                        item={entry}
                        lead={
                          selectMode && !isCoach && entry.visibility === "unmapped" ? (
                            <Checkbox
                              checked={chosen.has(entry.id)}
                              onCheckedChange={() => toggleChosen(entry.id)}
                              aria-label={`Select ${entry.title}`}
                            />
                          ) : undefined
                        }
                        onOpen={openItem(entry)}
                        chips={<ConversationChips item={entry} />}
                        actions={rowActions(entry, "unmapped")}
                        footer={suggestionFor(entry)}
                      />
                    )
                  }
                />
              </div>
            )}
          </WorkSection>

          <WorkSection
            label="Mapped"
            hint="Visible to your coach through the workstreams you mapped it to."
            count={mapped.length}
            tone="teal"
            icon={CheckCircle2}
          >
            {mapped.length === 0 ? (
              <p className="rounded-[var(--radius)] border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                Nothing mapped yet. Map a piece of work to a workstream and it shows up here.
              </p>
            ) : (
              mappedByEngagement.map((bucket) => (
                <EngagementFold
                  key={bucket.id ?? "unfiled"}
                  label={bucket.label}
                  hue={engagementHue(bucket.id)}
                  count={bucket.items.length}
                >
                  {groupConversations(bucket.items).map((entry) =>
                    isConversationGroup(entry) ? (
                      renderGroup(entry, "mapped")
                    ) : (
                      <WorkRow
                        key={entry.id}
                        item={entry}
                        onOpen={openItem(entry)}
                        chips={<ConversationChips item={entry} />}
                        actions={rowActions(entry, "mapped")}
                      />
                    ),
                  )}
                </EngagementFold>
              ))
            )}
          </WorkSection>

          <div className="grid gap-4 lg:grid-cols-2">
            {unmapped.length > 0 ? (
              <ToneCard
                tone="attention"
                label={`${unmapped.length} UNMAPPED`}
                title="Unmapped work is private and appears in no receipt."
              >
                <p>
                  Nobody else can see it and it counts towards nothing until you map it to a
                  workstream. Mapping is the moment you decide it belongs to a piece of work.
                </p>
                {unmapped.length > 0 ? (
                  <div className="mt-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={suggesting}
                      onClick={() => void handleSuggest()}
                    >
                      {suggesting ? "Thinking…" : "Suggest where these go"}
                    </Button>
                  </div>
                ) : null}
              </ToneCard>
            ) : null}

            <ToneCard tone="paper" label="WHERE THIS CAME FROM" title="Every piece has an origin.">
              <ul className="mt-1 space-y-2">
                {sourceCounts.map((row) => (
                  <li key={row.label}>
                    <div className="flex items-center justify-between gap-3">
                      <span>{row.label}</span>
                      <span className="font-mono text-[10px] text-soft">{row.count}</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-[var(--nb-pencil)]">
                      <span
                        className="block h-1.5 rounded-full bg-foreground"
                        style={{
                          width: `${sourceMax > 0 ? Math.round((row.count / sourceMax) * 100) : 0}%`,
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </ToneCard>
          </div>
        </div>
      )}

      {!isCoach && all.length > 0 ? <div aria-hidden className="h-16 md:hidden" /> : null}

      {!isCoach && all.length > 0 ? (
        <div className="fixed inset-x-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 md:hidden print:hidden">
          <PasteThreadDialog
            trigger={
              <Button type="button" className="w-full shadow-card">
                Paste a thread
              </Button>
            }
          />
        </div>
      ) : null}

      <MapDialog
        item={mapItem}
        groupItems={mapGroup ?? undefined}
        groupLabel={mapBulk ? "selected work" : undefined}
        open={mapItem !== null}
        onOpenChange={(next) => {
          if (!next) {
            setMapItem(null);
            setMapGroup(null);
            if (mapBulk) {
              setMapBulk(false);
              leaveSelectMode();
            }
          }
        }}
      />
      <PeekPanel
        entry={peek?.entry ?? null}
        focusId={peek?.focusId}
        open={peek !== null}
        canEdit={!isCoach}
        viewerProfileId={profile?.id ?? null}
        onMap={(item, group) => {
          setPeek(null);
          openMap(item, group);
        }}
        onWorkDate={(item) => {
          setPeek(null);
          setDateItem(item);
        }}
        onMakePrivate={(item) => {
          setPeek(null);
          void makePrivate(item);
        }}
        onAnalyse={(item, preset) => {
          setPeek(null);
          // A thread analysis opens its own reader: no lens in between.
          if (isThreadReaderPreset(preset)) {
            setLaunch({ item, preset });
            return;
          }
          setLensPreset(preset);
          setLensItem(item);
        }}
        onOpenChange={(next) => {
          if (!next) setPeek(null);
        }}
      />
      <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remove {chosen.size} item{chosen.size === 1 ? "" : "s"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This deletes them from Lasso only. The originals in Drive and your AI apps are
              untouched.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>Keep them</AlertDialogCancel>
            <AlertDialogAction
              disabled={removing}
              onClick={(e) => {
                e.preventDefault();
                void handleRemove();
              }}
            >
              {removing ? "Removing…" : "Remove from Lasso"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <WorkDateDialog
        item={dateItem}
        open={dateItem !== null}
        onOpenChange={(next) => {
          if (!next) setDateItem(null);
        }}
      />

      {profile && launch ? (
        <ThreadAnalysisLauncher
          key={`${launch.item.id}:${launch.preset}`}
          itemId={launch.item.id}
          itemTitle={launch.item.title}
          preset={launch.preset}
          profileId={profile.id}
          orgId={profile.org_id}
          onDone={() => setLaunch(null)}
        />
      ) : null}

      {profile && lensItem ? (
        <AnalysisLens
          key={lensItem.id}
          open
          onOpenChange={(next) => {
            if (!next) {
              setLensItem(null);
              setLensPreset(undefined);
            }
          }}
          {...(lensPreset ? { initialPreset: lensPreset } : {})}
          target={{
            kind: "item",
            id: lensItem.id,
            title: lensItem.title,
            scope: isDeliverableType(lensItem.type) ? "deliverable" : "thread",
          }}
          profileId={profile.id}
          orgId={profile.org_id}
        />
      ) : null}
    </div>
  );
}
