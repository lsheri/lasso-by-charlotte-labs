import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
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
import { CoachingLinkNotices } from "@/components/coaching/CoachingLinkNotices";
import { ArrivalsStrip } from "@/components/work/ArrivalsStrip";
import { ReadingPanel } from "@/components/overview/ReadingPanel";
import { NotCovered } from "@/components/overview/NotCovered";

import { SuggestLegend } from "@/components/common/Suggested";
import { DimmedDisabled } from "@/components/common/DimmedDisabled";
import { SuggestionChip } from "@/components/work/SuggestionChip";
import { PeekPanel, type PeekEntry } from "@/components/peek/PeekPanel";
import type { PeekAnalysisPreset } from "@/components/peek/PeekActionBar";
import { UploadFilesButton } from "@/components/work/UploadFilesButton";
import { TranscriptsAction } from "@/components/work/TranscriptsAction";
import { WorkDateDialog } from "@/components/work/WorkDateDialog";
import { ClaimToClient } from "@/components/work/ClaimToClient";
import { MapButton } from "@/components/work/MapButton";
import { RowAction, WorkRow } from "@/components/work/WorkRow";
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
import { useClients } from "@/hooks/use-clients";
import { useProfile } from "@/hooks/use-profile";
import { useWorkItems } from "@/hooks/use-work-items";
import { orderByWorkDate } from "@/lib/work-order";
import { useWorkboardCardPreviews } from "@/hooks/use-workboard-card-previews";
import { useWorkboardFilePreviews } from "@/hooks/use-workboard-file-previews";
import { supabase } from "@/integrations/supabase/client";
import type { MappingSuggestion } from "@/lib/mapping-shared";
import { suggestMappings } from "@/lib/mapping.functions";
import { removeWorkItems } from "@/lib/work-bulk.functions";
import { detachEpisodeItems, syncEpisodeForMapping } from "@/lib/episodes.functions";
import { logEvent } from "@/lib/telemetry";
import { logV2 } from "@/lib/telemetry-v2";
import { markOpenStart } from "@/lib/perf-timing";
import {
  groupConversations,
  groupedCount,
  isConversationGroup,
  sourceLabel,
  type ConversationGroup,
  type WorkItemRow,
} from "@/lib/work-types";
import { WorkSubtitle } from "@/components/work/WorkSubtitle";
import { InboxFixedCard } from "@/components/work/InboxFixedCard";
import {
  BoardShell,
  type BoardShellFrame,
  type BoardShellNode,
} from "@/components/board/BoardShell";
import { sourceVendorKey } from "@/components/work/SourceMark";
import {
  BUCKETS,
  bucketKeyForEntry,
  type Bucket,
  type BucketKey,
} from "@/components/work/work-buckets";
import { useSettingsDialog } from "@/lib/settings-dialog-context";
import { readWorkView, writeWorkView, type WorkView } from "@/lib/work-view";
import { inboxFilterDims, inboxFilterMatches, recordInboxFilterChange } from "@/lib/inbox-filter";
import { newLaneFrameId } from "@/lib/board-lane";
import { selectArrivals } from "@/lib/inbox-arrivals";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/** Each type column pages its entries five at a time, replacing not growing. */
const COLUMN_PAGE_SIZE = 5;

type InboxLaneFrame = BoardShellFrame & { bucket: Bucket; entryCount: number };
type InboxLaneNode = BoardShellNode & { entry: WorkItemRow | ConversationGroup };

const INBOX_LANE_COUNT = 4;
const INBOX_LANE_MIN_WIDTH = 220;
const INBOX_LANE_GAP = 36;
/** Matches fitWorkboardViewport's own 32px padding, so a fitted board sits 32px in from each side. */
const INBOX_BOARD_SIDE_MARGIN = 32;
const INBOX_LANE_LEFT = 40;
/**
 * The board's top row (WHERE THIS CAME FROM, Fit and zoom) is 54px tall.
 * The fit centres the lanes vertically, so a lane's visible top is
 * (INBOX_LANE_TOP + INBOX_BOARD_SIDE_MARGIN) / 2 = (76 + 32) / 2 = 54,
 * exactly the bottom of that row, and the visible bottom gap is also 54.
 */
const INBOX_LANE_TOP = 76;
const INBOX_CARD_HEIGHT = 220;
const INBOX_LANE_PADDING = 12;
const INBOX_CARD_GAP = 12;
const INBOX_LANE_HEADER_HEIGHT = 40;
const INBOX_LANE_PAGING_HEIGHT = 44;
/** Header 40 + padding 12 * 2 + one card 220 + paging 44 = 328: one card is always visible. */
const INBOX_LANE_MIN_HEIGHT =
  INBOX_LANE_HEADER_HEIGHT + INBOX_LANE_PADDING * 2 + INBOX_CARD_HEIGHT + INBOX_LANE_PAGING_HEIGHT;

/** Shell height minus the top clearance (76) and the bottom fit margin (32), never below one card. */
export function inboxLaneHeight(viewportHeight: number): number {
  return Math.max(INBOX_LANE_MIN_HEIGHT, viewportHeight - INBOX_LANE_TOP - INBOX_BOARD_SIDE_MARGIN);
}

export function inboxLaneWidth(viewportWidth: number): number {
  const dividedWidth =
    (viewportWidth - INBOX_BOARD_SIDE_MARGIN * 2 - INBOX_LANE_GAP * (INBOX_LANE_COUNT - 1)) /
    INBOX_LANE_COUNT;
  return Math.max(INBOX_LANE_MIN_WIDTH, dividedWidth);
}

/** The mark for stepping through a column. Hand drawn, in the pencil idiom
    the nav indent uses: a short stroke that trails off into an arrow head. */
function PageMark({ back = false }: { back?: boolean }) {
  return (
    <svg
      width="26"
      height="14"
      viewBox="0 0 26 14"
      aria-hidden="true"
      focusable="false"
      className="text-pencil transition-colors group-hover:text-ink"
      style={back ? { transform: "scaleX(-1)" } : undefined}
    >
      <path
        d="M1 7.4 C 6 6.8, 12 7.9, 19 7.1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path
        d="M15.2 4.1 C 17 5.3, 18.4 6.4, 19.4 7.1 C 18.2 8.2, 16.6 9.2, 15.4 10.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type BringWorkInRowProps = {
  unmappedCount: number;
  suggesting: boolean;
  onSuggest: () => void;
  isCoach: boolean;
  selectableCount: number;
  selectMode: boolean;
  allChosen: boolean;
  chosenCount: number;
  onToggleSelectAll: () => void;
  onBulkMap: () => void;
  onRemove: () => void;
  onDoneSelect: () => void;
  onEnterSelect: () => void;
};

function BringWorkInRow({
  unmappedCount,
  suggesting,
  onSuggest,
  isCoach,
  selectableCount,
  selectMode,
  allChosen,
  chosenCount,
  onToggleSelectAll,
  onBulkMap,
  onRemove,
  onDoneSelect,
  onEnterSelect,
}: BringWorkInRowProps) {
  const { openSettings } = useSettingsDialog();

  return (
    <div className="mb-6">
      <p className="micro-label">BRING WORK IN</p>
      <div className="mt-2 flex flex-wrap items-center gap-2 lg:max-w-[720px]">
        {unmappedCount > 0 ? (
          <button
            type="button"
            disabled={suggesting}
            onClick={onSuggest}
            className="text-xs font-medium text-accent-deep transition-opacity hover:opacity-70 disabled:opacity-50"
          >
            {suggesting ? "Thinking…" : "✨ Suggest mapping"}
          </button>
        ) : null}
        {!isCoach && selectableCount > 0 ? (
          selectMode ? (
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                <Checkbox
                  checked={allChosen}
                  onCheckedChange={() => onToggleSelectAll()}
                  aria-label="Select all visible unmapped items"
                />
                Select all
              </label>
              <MapButton disabled={chosenCount === 0} onClick={onBulkMap}>
                Map to a workstream{chosenCount ? ` (${chosenCount})` : ""}
              </MapButton>
              <button
                type="button"
                disabled={chosenCount === 0}
                onClick={onRemove}
                className="text-xs font-medium text-destructive transition-opacity hover:opacity-70 disabled:opacity-40"
              >
                Remove{chosenCount ? ` (${chosenCount})` : ""}
              </button>
              <button
                type="button"
                onClick={onDoneSelect}
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Done
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onEnterSelect}
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Select
            </button>
          )
        ) : null}
        <ConnectorBrowseActions />
        <PasteThreadDialog
          trigger={
            <Button type="button" className="hidden md:inline-flex">
              Paste a thread
            </Button>
          }
        />
        <UploadFilesButton />
        <Button type="button" variant="outline" onClick={() => openSettings("connectors", "inbox")}>
          Connected apps
        </Button>
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
  );
}

export function WorkPage() {
  const { data: profile } = useProfile();
  const { openSettings } = useSettingsDialog();
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
  const [workView, setWorkView] = useState<WorkView>(() => readWorkView());
  const [inboxViewportWidth, setInboxViewportWidth] = useState(0);
  const [inboxViewportHeight, setInboxViewportHeight] = useState(0);
  // Which page each type column is on. Presentation-only local state, exactly
  // like columnFilter above: no query behind it and nothing to record.
  const [columnPages, setColumnPages] = useState<Record<BucketKey, number>>({
    llm: 0,
    documents: 0,
    sheets: 0,
    calls: 0,
  });

  // A filter or the private toggle changes what every column holds, so every
  // page index returns to its first page rather than paging a set that no
  // longer exists. The render below also clamps a stale index, belt and braces.
  useEffect(() => {
    setColumnPages({ llm: 0, documents: 0, sheets: 0, calls: 0 });
  }, [columnFilter, showPrivate]);
  // Rolled once per mount, never per render: a re-roll mid-animation would
  // restart the gust under the reader.
  const [gust] = useState(() => Math.random() < 0.3);
  const [gusting, setGusting] = useState(gust);
  useEffect(() => {
    if (!gusting) return;
    const t = setTimeout(() => setGusting(false), 950);
    return () => clearTimeout(t);
  }, [gusting]);

  // One ordering rule for the whole page: when the work happened, falling
  // back to when it arrived. Every column, count and filter reads this list.
  const all = orderByWorkDate(data?.items ?? []);
  const mappingError = data?.mappingError ?? null;
  const mapped = all.filter((i) => i.visibility === "mapped");
  const unmapped = all.filter((i) => i.visibility === "unmapped");
  const priv = all.filter((i) => i.visibility === "private");
  const flagged = all.filter((i) => i.visibility === "unmapped" && isFlaggedRestatement(i));
  // PASS A1 — the most recent arrivals from a connected tool. Anything without
  // a vendor came in by hand, so it is not something Lasso went and read.
  const reading = all.filter((item) => Boolean(item.source_vendor)).slice(0, 3);

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

  const { data: clients } = useClients(profile?.org_id);
  const clientName = (id: string | null | undefined) =>
    id ? (clients?.find((c) => c.id === id)?.name ?? null) : null;

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
        dense
        displayMode={workView}
        preview={chatPreviews[head.id]}
        onOpen={(item: WorkItemRow) => {
          markOpenStart("peek.open");
          setPeek({ entry: group, focusId: item.id });
        }}
        actions={rowActions(head, variant, group.items, { inCardMenu: true })}
        primaryAction={claimAction(head, group.items)}
        onFluency={(next) => {
          setLensPreset(undefined);
          setLensItem(next);
        }}
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
    /**
     * Inside a card menu the shared item actions are already part of the menu,
     * and the claim stays on the card face, so both are dropped here.
     */
    opts?: { inCardMenu?: boolean },
  ) {
    const inMenu = opts?.inCardMenu === true;
    const claimIsPrimary = inMenu && !item.client_id;
    // A private row keeps its own action set wherever it renders, now that the
    // pile holds private and unmapped work side by side.
    if (item.visibility === "private") {
      return (
        <>
          <OpenFileAction item={item} onOpenInApp={openItem(item)} />
          <RowAction onClick={() => setDateItem(item)}>Work date</RowAction>
          {claimIsPrimary ? null : <ClaimToClient item={item} surface="work" />}
          <RowAction onClick={() => void unmark(item)}>Unmark</RowAction>
          {inMenu ? null : (
            <RowMenu
              item={item}
              onFluency={(next) => {
                setLensPreset(undefined);
                setLensItem(next);
              }}
            />
          )}
        </>
      );
    }
    const groupLabel = group && group.length > 1;
    return (
      <>
        <OpenFileAction item={item} onOpenInApp={openItem(item)} />
        <MapButton onClick={() => openMap(item, group)} stopPropagation>
          {variant === "mapped"
            ? groupLabel
              ? "Remap conversation"
              : "Remap"
            : groupLabel
              ? "Map conversation"
              : "Map to a workstream"}
        </MapButton>
        {claimIsPrimary ? null : <ClaimToClient item={item} surface="work" />}
        {group && group.length > 1 ? (
          <RowAction onClick={() => openMap(item)}>Map just this</RowAction>
        ) : null}
        <RowAction onClick={() => setDateItem(item)}>Work date</RowAction>
        <RowAction onClick={() => void makePrivate(item)}>Make private</RowAction>
        {inMenu ? null : (
          <RowMenu
            item={item}
            onFluency={(next) => {
              setLensPreset(undefined);
              setLensItem(next);
            }}
          />
        )}
      </>
    );
  }

  /** The one act that stays on the card face: saying whose work this is. */
  /** P1: claiming a pushed conversation claims every piece inside it. */
  function claimAction(item: WorkItemRow, group?: WorkItemRow[]) {
    if (item.client_id) return undefined;
    return (
      <ClaimToClient
        item={item}
        {...(group && group.length > 1 ? { items: group } : {})}
        surface="work"
        emphasis="lead"
        label="Say whose this is"
      />
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

  const engagementCodes = Array.from(
    new Set(
      mapped
        .map((item) => item.work_item_tasks[0]?.tasks?.engagements?.code)
        .filter((code): code is string => Boolean(code)),
    ),
  ).sort((a, b) => a.localeCompare(b));

  // Every item stays in the columns. Filters only decide which cards remain active.
  const visible = all;

  /**
   * P1: the page counts and files GROUPED entries. One pushed conversation is
   * one thing to look at, so it is grouped once here and every column, count
   * and filter reads the same list. Filtering never removes an entry: it only
   * decides which cards stay active.
   */
  const visibleEntries = groupConversations(visible);
  const unmappedCount = groupedCount(unmapped);
  const previewHeads = visibleEntries.map((entry) => isConversationGroup(entry) ? (entry.transcript ?? entry.items[0]!) : entry);
  const chatPreviews = useWorkboardCardPreviews("work", profile?.id, workView === "preview", previewHeads.filter((item) => item.type === "ai_thread").map((item) => item.id));
  const filePreviews = useWorkboardFilePreviews(profile?.id, workView === "preview", previewHeads.filter((item) => item.type !== "ai_thread"));


  const chipBase = "rounded-full px-3 py-1 text-[11.5px] transition-colors";
  const chipOn = `${chipBase} border border-graphite bg-nb-white font-medium text-foreground`;
  const chipOff = `${chipBase} border border-[var(--nb-pencil)] text-muted-foreground hover:border-foreground`;

  function changeColumnFilter(next: string) {
    if (next === columnFilter) return;
    setColumnFilter(next);
    const count = groupedCount(
      visible.filter((item) => inboxFilterMatches(item, next, showPrivate)),
    );
    recordInboxFilterChange(
      inboxFilterDims(
        next === "all" || next === "unmapped" || next === "claimed" ? "placement" : "engagement",
        next === "all" ? "all" : "one",
        count,
      ),
      (dims) => {
        if (profile?.org_id) logEvent("work.filter_changed", profile.org_id, dims);
      },
    );
  }

  function changePrivate(next: boolean) {
    if (next === showPrivate) return;
    setShowPrivate(next);
    const count = groupedCount(
      visible.filter((item) => inboxFilterMatches(item, columnFilter, next)),
    );
    recordInboxFilterChange(
      inboxFilterDims("privacy", next ? "all" : "one", count),
      (dims) => {
        if (profile?.org_id) logEvent("work.filter_changed", profile.org_id, dims);
      },
    );
  }

  function entryMatchesFilter(entry: WorkItemRow | ConversationGroup): boolean {
    return isConversationGroup(entry)
      ? entry.items.some((item) => inboxFilterMatches(item, columnFilter, showPrivate))
      : inboxFilterMatches(entry, columnFilter, showPrivate);
  }
  const matchingEntryCount = visibleEntries.filter(entryMatchesFilter).length;

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

  /** One item as it renders inside a type column: same props the sections passed. */
  function renderColumnItem(entry: WorkItemRow) {
    const variant = entry.visibility === "mapped" ? "mapped" : "unmapped";
    return (
      <WorkRow
        key={entry.id}
        item={entry}
        dense
        displayMode={workView}
        chatPreview={chatPreviews[entry.id]}
        filePreview={filePreviews[entry.id]}
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
        actions={rowActions(entry, variant, undefined, { inCardMenu: true })}
        primaryAction={claimAction(entry)}
        onFluency={(next) => {
          setLensPreset(undefined);
          setLensItem(next);
        }}
        clientLabel={clientName(entry.client_id)}

        {...(entry.visibility === "mapped" ? {} : { footer: suggestionFor(entry) })}
      />
    );
  }

  const lanePages = BUCKETS.map((bucket) => {
    const entries = visibleEntries.filter((entry) => bucketKeyForEntry(entry) === bucket.key);
    const lastPage = Math.max(0, Math.ceil(entries.length / COLUMN_PAGE_SIZE) - 1);
    const page = Math.min(columnPages[bucket.key], lastPage);
    return {
      bucket,
      entries,
      lastPage,
      page,
      pageEntries: entries.slice(
        page * COLUMN_PAGE_SIZE,
        page * COLUMN_PAGE_SIZE + COLUMN_PAGE_SIZE,
      ),
    };
  });

  const currentInboxLaneWidth = inboxLaneWidth(inboxViewportWidth);
  const currentInboxLaneHeight = inboxLaneHeight(inboxViewportHeight);

  const inboxLaneFrames: InboxLaneFrame[] = lanePages.map(({ bucket, entries }, index) => ({
    id: newLaneFrameId(`inbox-${bucket.key}`),
    x: INBOX_LANE_LEFT + index * (currentInboxLaneWidth + INBOX_LANE_GAP),
    y: INBOX_LANE_TOP,
    width: currentInboxLaneWidth,
    height: currentInboxLaneHeight,
    contentInset: { top: INBOX_LANE_HEADER_HEIGHT, bottom: INBOX_LANE_PAGING_HEIGHT },
    bucket,
    entryCount: entries.length,
  }));

  const inboxLaneNodes: InboxLaneNode[] = lanePages.flatMap(({ bucket, pageEntries }) =>
    pageEntries.map((entry) => ({
      id: isConversationGroup(entry) ? entry.key : entry.id,
      x: 0,
      y: 0,
      width: currentInboxLaneWidth,
      height: INBOX_CARD_HEIGHT,
      frame: newLaneFrameId(`inbox-${bucket.key}`),
      entry,
    })),
  );

  const arrivalCount = groupConversations(selectArrivals(all, profile?.id)).length;
  const inboxFrames: InboxLaneFrame[] = inboxLaneFrames;

  function recordPanelOpen(panel: "arrived" | "reading") {
    if (profile?.org_id) logEvent("work.panel_opened", profile.org_id, { panel });
  }

  function bulkMapChosen() {
    const picked = all.filter((item) => chosen.has(item.id));
    const head = picked[0];
    if (!head) return;
    setMapBulk(true);
    setMapGroup(picked);
    setMapItem(head);
  }

  return (
    <div className="flex h-[calc(100vh-6.5rem)] flex-col overflow-hidden">
      <div className="shrink-0">
        <GettingStartedCard />
        <CoachingLinkNotices />
        <WatchSuggestionBanner />
        {!isCoach && flagged.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--nb-rule)] bg-secondary/50 px-5 py-3">
            <p className="min-w-0 text-sm text-foreground">
              {flagged.length} item{flagged.length === 1 ? "" : "s"} look like part of a
              conversation rather than separate artifacts. You decide whether they stay.
            </p>
            <Button type="button" variant="outline" size="sm" disabled={removingFlagged} onClick={() => void removeAllFlagged()}>
              {removingFlagged ? "Removing…" : `Remove all ${flagged.length} flagged`}
            </Button>
          </div>
        ) : null}
        {error ? <p className="px-5 py-2 text-sm text-destructive">{(error as Error).message}</p> : null}
        {actionError ? <p className="px-5 py-2 text-sm text-destructive">{actionError}</p> : null}
        {mappingError ? <p className="px-5 py-2 text-sm text-destructive">Mapping details couldn't load: {mappingError}</p> : null}
      </div>

      <header className="box-border flex h-16 shrink-0 flex-wrap items-center gap-4 border-b border-[var(--nb-rule)] px-5 md:flex-nowrap">
        <div className="mr-auto min-w-0">
          <h1 className="font-serif text-[19px] leading-none">Inbox</h1>
          <p className="mt-1 truncate font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
            <WorkSubtitle pieces={groupedCount(all)} unmapped={groupedCount(unmapped)} />
          </p>
        </div>
        <span role="group" aria-label="How work is shown" className="inline-flex shrink-0 items-center rounded-full border border-[var(--nb-rule)] bg-card p-0.5">
          {(["preview", "sticky"] as const).map((option) => (
            <Button key={option} type="button" size="sm" variant={workView === option ? "secondary" : "ghost"} aria-pressed={workView === option} onClick={() => { setWorkView(option); writeWorkView(option); }}>
              {option === "preview" ? "Preview" : "Sticky"}
            </Button>
          ))}
        </span>
        <DropdownMenu onOpenChange={(open) => { if (open && profile?.org_id) logEvent("work.import_menu_opened", profile.org_id, {}); }}>
          <DropdownMenuTrigger asChild><Button type="button" variant="outline" className="h-9">Bring work in</Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="flex w-64 flex-col items-stretch gap-1 p-2 [&_button]:w-full [&_button]:justify-start">
            <ConnectorBrowseActions />
            <PasteThreadDialog trigger={<Button type="button" variant="outline">Paste a thread</Button>} />
            <UploadFilesButton />
            <Button type="button" variant="outline" onClick={() => openSettings("connectors", "inbox")}>Connected apps</Button>
            <TranscriptsAction />
            <ImportFlowDialog trigger={<Button type="button" variant="outline">Import AI history</Button>} />
          </DropdownMenuContent>
        </DropdownMenu>
        {unmappedCount > 0 ? (
          <Button type="button" variant="ink" className="h-9" disabled={suggesting} onClick={() => void handleSuggest()}>
            {suggesting ? "Thinking…" : "Suggest mapping"}
          </Button>
        ) : null}
        {!isCoach && selectable.length > 0 && !selectMode ? (
          <Button type="button" variant="ghost" className="h-9" onClick={() => setSelectMode(true)}>Select</Button>
        ) : null}
      </header>

      <div className="flex h-[46px] shrink-0 items-center gap-2 overflow-x-auto border-b border-[var(--nb-rule)] px-5 whitespace-nowrap">
        <button type="button" onClick={() => changeColumnFilter("all")} className={columnFilter === "all" ? chipOn : chipOff}>Everything</button>
        <button type="button" title="Unmapped work is private and belongs to no engagement. It is not in any receipt, no coach can see it, and it will not appear in the firm view until you map it." onClick={() => changeColumnFilter("unmapped")} className={columnFilter === "unmapped" ? chipOn : chipOff}>Unmapped</button>
        <button type="button" onClick={() => changeColumnFilter("claimed")} className={columnFilter === "claimed" ? chipOn : chipOff}>Claimed by you</button>
        {engagementCodes.map((code) => <button key={code} type="button" onClick={() => changeColumnFilter(code)} className={columnFilter === code ? chipOn : chipOff}>{code}</button>)}
        {priv.length > 0 ? (
          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <Checkbox checked={showPrivate} onCheckedChange={(next) => changePrivate(next === true)} aria-label="Show private work" />
            Show private ({priv.length})
          </label>
        ) : null}
        {selectMode && !isCoach ? (
          <>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
              <Checkbox checked={allChosen} onCheckedChange={() => setChosen(allChosen ? new Set() : new Set(selectable))} aria-label="Select all visible unmapped items" />
              Select all
            </label>
            <MapButton disabled={chosen.size === 0} onClick={bulkMapChosen}>Map to a workstream{chosen.size ? ` (${chosen.size})` : ""}</MapButton>
            <Button type="button" variant="ghost" disabled={chosen.size === 0} onClick={() => setConfirmRemove(true)}>Remove{chosen.size ? ` (${chosen.size})` : ""}</Button>
            <Button type="button" variant="ghost" onClick={leaveSelectMode}>Done</Button>
          </>
        ) : null}
        {active.length > 0 ? <SuggestLegend /> : null}
        {active.length > 0 && highConfidence.length >= 3 ? (
          <Button type="button" variant="outline" size="sm" disabled={acceptPending} onClick={() => { void (async () => { for (const suggestion of highConfidence) await acceptSuggestion(suggestion); })(); }}>
            Accept all high-confidence ({highConfidence.length})
          </Button>
        ) : null}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {arrivalCount > 0 ? (
            <Popover onOpenChange={(open) => { if (open) recordPanelOpen("arrived"); }}>
              <PopoverTrigger asChild><button type="button" className={chipOff}>Arrived · {arrivalCount}</button></PopoverTrigger>
              <PopoverContent align="end" className="w-[min(720px,calc(100vw-2rem))]"><ArrivalsStrip items={all} /></PopoverContent>
            </Popover>
          ) : null}
          {all.length > 0 ? (
            <Popover onOpenChange={(open) => { if (open) recordPanelOpen("reading"); }}>
              <PopoverTrigger asChild><Button type="button" variant="ghost" className="h-9 text-[13px] text-muted-foreground">{groupedCount(all)} pieces of work. Nothing is hidden.</Button></PopoverTrigger>
              <PopoverContent align="end" className="max-h-[70vh] w-[min(720px,calc(100vw-2rem))] overflow-y-auto"><ReadingPanel items={reading} /><NotCovered /></PopoverContent>
            </Popover>
          ) : null}
        </div>
      </div>

      <div className={suggesting ? "relative min-h-0 flex-1 animate-pulse" : "relative min-h-0 flex-1"}>
        {isLoading ? (
          <p className="p-5 text-sm text-muted-foreground">Loading your work…</p>
        ) : all.length === 0 ? (
          <div className="mx-auto mt-8 max-w-lg rounded-[var(--radius)] border border-border bg-card px-8 py-12 text-center shadow-card">
            <p className="text-sm text-foreground">Your work lands here.</p>
            <div className="mt-6 inline-block text-left">
              <BringWorkInRow unmappedCount={unmappedCount} suggesting={suggesting} onSuggest={() => void handleSuggest()} isCoach={isCoach} selectableCount={selectable.length} selectMode={selectMode} allChosen={allChosen} chosenCount={chosen.size} onToggleSelectAll={() => setChosen(allChosen ? new Set() : new Set(selectable))} onBulkMap={bulkMapChosen} onRemove={() => setConfirmRemove(true)} onDoneSelect={leaveSelectMode} onEnterSelect={() => setSelectMode(true)} />
            </div>
          </div>
        ) : (
          <>
            {columnFilter === "unmapped" && matchingEntryCount === 0 ? (
              <p className="absolute inset-x-5 top-3 z-20 rounded-[var(--radius-md)] border border-dashed border-pencil bg-card px-4 py-3 text-center text-[11.5px] text-soft">
                These landed on their own. Say whose work it is and the rest gets easier. Unmapped work is private and belongs to no engagement. It is not in any receipt, no coach can see it, and it will not appear in the firm view until you map it.
              </p>
            ) : null}
            <BoardShell
              ariaLabel="Inbox work board"
              className={gusting ? "h-full nb-gust" : "h-full"}
              frames={inboxFrames}
              nodes={inboxLaneNodes}
              showViewControls
              toolbar={all.length > 0 ? (
                <p className="min-w-0 flex-1 truncate font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
                  {["WHERE THIS CAME FROM", ...sourceCounts.map((row) => `${row.label} ${row.count}`)].join(" · ")}
                </p>
              ) : undefined}
              fitKey={`${workView}:${visibleEntries.length}:${currentInboxLaneWidth}:${currentInboxLaneHeight}`}
              onViewportSizeChange={({ width, height }) => {
                setInboxViewportWidth((current) => current === width ? current : width);
                setInboxViewportHeight((current) => current === height ? current : height);
              }}
              renderFrame={(frame) => {
                const lanePage = lanePages.find((entry) => entry.bucket.key === frame.bucket.key);
                if (!lanePage) return null;
                const setPage = (next: number) => setColumnPages((prev) => ({ ...prev, [frame.bucket.key]: next }));
                return (
                  <>
                    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-10 border-b border-[var(--nb-rule)] px-3 py-3">
                      <h2 className="flex items-baseline justify-between gap-3 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground"><span className="truncate">{frame.bucket.label}</span><span className="shrink-0 text-soft">{frame.entryCount}</span></h2>
                    </div>
                    {lanePage.pageEntries.length === 0 ? <p className="pointer-events-none absolute left-3 right-3 top-14 z-10 rounded-[var(--radius-md)] border border-dashed border-pencil bg-card px-3 py-4 text-center text-[11.5px] text-soft">Nothing here yet.</p> : null}
                    {lanePage.entries.length > COLUMN_PAGE_SIZE ? (
                      <div className="absolute inset-x-0 bottom-0 z-10 flex h-11 items-center justify-center gap-3 border-t border-[var(--nb-rule)] bg-card">
                        {lanePage.page > 0 ? <button type="button" aria-label="Earlier work in this column" className="group inline-flex min-h-11 min-w-11 items-center justify-center md:min-h-0 md:min-w-0" onClick={() => setPage(lanePage.page - 1)}><PageMark back /></button> : null}
                        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-soft">{lanePage.page * COLUMN_PAGE_SIZE + 1}–{lanePage.page * COLUMN_PAGE_SIZE + lanePage.pageEntries.length} OF {lanePage.entries.length}</span>
                        {lanePage.page < lanePage.lastPage ? <button type="button" aria-label="More work in this column" className="group inline-flex min-h-11 min-w-11 items-center justify-center md:min-h-0 md:min-w-0" onClick={() => setPage(lanePage.page + 1)}><PageMark /></button> : null}
                      </div>
                    ) : null}
                  </>
                );
              }}
              renderNode={(node) => (
                <DimmedDisabled dimmed={!entryMatchesFilter(node.entry)} disabled={!entryMatchesFilter(node.entry)} className="min-w-0 w-full">
                  <InboxFixedCard>{isConversationGroup(node.entry) ? renderGroup(node.entry, (node.entry.transcript ?? node.entry.items[0]!).visibility === "mapped" ? "mapped" : "unmapped") : renderColumnItem(node.entry)}</InboxFixedCard>
                </DimmedDisabled>
              )}
            />
          </>
        )}
      </div>

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
