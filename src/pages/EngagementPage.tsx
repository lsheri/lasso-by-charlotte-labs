import { useQueryClient } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { GraphiteRule } from "@/components/notebook/marks";
import { useReducedMotion } from "@/hooks/use-motion";
import { EngagementCanvasView } from "@/components/canvas/EngagementCanvasView";
import { PeekBody } from "@/components/peek/PeekPanel";
import { presetsForScope, type AnalysisPresetId } from "@/lib/analysis-presets";
import { MapDialog } from "@/components/work/MapDialog";
import { WorkDateDialog } from "@/components/work/WorkDateDialog";
import { WorkNote } from "@/components/work/WorkNote";
import { AnalysisLensPanel } from "@/components/reflect/AnalysisLens";
import {
  ThreadAnalysisLauncher,
  isThreadReaderPreset,
  type ThreadReaderPreset,
} from "@/components/verify/ThreadAnalysisLauncher";
import { isDeliverableType } from "@/lib/lineage-shared";
import { useMakePrivate } from "@/hooks/use-make-private";
import { CaptureCoverage } from "@/components/common/CaptureCoverage";
import { EngagementCanvas, type CanvasTask } from "@/components/engagements/EngagementCanvas";
import { WorkLedger } from "@/components/engagements/WorkLedger";

import { CanvasDeliverableActions } from "@/components/engagements/CanvasDeliverableActions";
import { EngagementBriefPanel } from "@/components/engagements/EngagementBriefPanel";
import { EngagementStats } from "@/components/engagements/EngagementStats";
import { EngagementAsk } from "@/components/engagements/InlineEngagementAsk";
import { ContextCard } from "@/components/engagements/ContextCard";
import { usePanelWidth, panelWidthBucket } from "@/components/engagements/use-panel-width";

import { SharedWithSection } from "@/components/engagements/SharedWithSection";
import { Button } from "@/components/ui/button";
import { SubjectCoachingSection } from "@/components/coaching/SubjectCoachingSection";
import { useRegisterAskLasso } from "@/components/reflect/ask-lasso-context";
import { usePerfNavFinish } from "@/hooks/use-perf-timer";
import { useProfile } from "@/hooks/use-profile";
import { useShippedWork } from "@/hooks/use-shipped-work";
import { useTraceParam } from "@/hooks/use-trace-param";
import { useJourneyParam } from "@/hooks/use-journey-param";
import { isBusinessOrg } from "@/hooks/use-profile";
import { useMyEngagementMembership } from "@/hooks/use-engagement-membership";
import { useEngagementPage, useEngagementSlice } from "@/hooks/use-engagement-page";
import { clientDisplayName, engagementDisplayCode, engagementDisplayTitle } from "@/lib/clients";

import { cn } from "@/lib/utils";
import { markOpenStart } from "@/lib/perf-timing";
import { logEvent } from "@/lib/telemetry";
import { supabase } from "@/integrations/supabase/client";
import type { WorkItemRow } from "@/lib/work-types";
import { sourceVendorKey } from "@/components/work/SourceMark";
import { workstreamTasks } from "@/lib/board-default-task";
import { useVendorVisible } from "@/hooks/use-vendor-display";
import { vendorLabel } from "@/lib/conversation-shared";

type TaskWithWork = CanvasTask;
type EngagementView = "brief" | "work" | "verify" | "share";
const engagementRoute = getRouteApi("/_authenticated/engagements/$id");

const TAB_ANALYSIS_PRESETS: Record<EngagementView, AnalysisPresetId> = {
  brief: "still_on_brief",
  work: "what_fed_this",
  verify: "verification",
  share: "firm_checks",
};

const THREAD_PRESET_VARIANTS: Partial<Record<AnalysisPresetId, AnalysisPresetId>> = {
  verification: "verification_thread",
  decision_origin: "decision_origin_thread",
};

export function EngagementPage({ engagementId }: { engagementId: string }) {
  const { work } = engagementRoute.useSearch();
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const [rail, setRail] = useState<"closed" | "open">("closed");
  const askOpen = rail !== "closed";
  const benchPageRef = useRef<HTMLDivElement>(null);
  const benchMainRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();


  const [askHadConversation, setAskHadConversation] = useState(false);
  const [peekItem, setPeekItem] = useState<WorkItemRow | null>(null);
  /**
   * A document opens in the main column, and the page keeps whatever scroll
   * position the canvas had, so it can land below the fold. Bring the top of
   * the column into view, but only when a document first opens: not on every
   * render, and not when one document replaces another.
   */
  const peekWasOpenRef = useRef(false);
  useEffect(() => {
    const open = Boolean(peekItem);
    if (open && !peekWasOpenRef.current) {
      benchMainRef.current?.scrollIntoView({
        block: "start",
        behavior: reduceMotion ? "auto" : "smooth",
      });
    }
    peekWasOpenRef.current = open;
  }, [peekItem, reduceMotion]);
  // PASS 129 — the peek's action bar reads the same on both surfaces, so the
  // same dialogs are mounted here as on the Work pile.
  const [mapItem, setMapItem] = useState<WorkItemRow | null>(null);
  const [dateItem, setDateItem] = useState<WorkItemRow | null>(null);
  const [lensItem, setLensItem] = useState<WorkItemRow | null>(null);
  const [lensPreset, setLensPreset] = useState<AnalysisPresetId | undefined>(undefined);
  // A thread analysis launched from the peek: confirm, then the reader itself.
  const [launch, setLaunch] = useState<{ item: WorkItemRow; preset: ThreadReaderPreset } | null>(
    null,
  );
  const makePrivate = useMakePrivate();
  const [view, setView] = useState<EngagementView>("work");
  const [creatingWrap, setCreatingWrap] = useState(false);
  const previousWorkRef = useRef(work);
  const tabBarRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Partial<Record<EngagementView, HTMLButtonElement>>>({});
  const [tabRule, setTabRule] = useState({ left: 0, width: 0 });

  // The panel's width is a person's own choice, dragged from its inner edge.
  // One event on release, banded: a pointermove stream is not a signal.
  const orgId = profile?.org_id;
  const onPanelResizeEnd = useCallback(
    (nextWidth: number) => {
      if (!orgId) return;
      logEvent("engagement.ask_rail_toggled", orgId, {
        state: "resized",
        width_bucket: panelWidthBucket(nextWidth),
      });
    },
    [orgId],
  );
  const panel = usePanelWidth(benchPageRef, { onResizeEnd: onPanelResizeEnd });



  const measureTabRule = useCallback(() => {
    const selected = tabRefs.current[view];
    if (!selected) return;
    setTabRule({ left: selected.offsetLeft, width: selected.offsetWidth });
  }, [view]);

  useLayoutEffect(() => {
    measureTabRule();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measureTabRule);
    if (tabBarRef.current) observer?.observe(tabBarRef.current);
    for (const tab of Object.values(tabRefs.current)) {
      if (tab) observer?.observe(tab);
    }
    window.addEventListener("resize", measureTabRule);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measureTabRule);
    };
  }, [measureTabRule]);

  const setAskRailOpen = (open: boolean) => {
    if (open === askOpen) return;
    setRail(open ? "open" : "closed");
    if (profile) {
      logEvent("engagement.ask_rail_toggled", profile.org_id, {
        state: open ? "opened" : "collapsed",
        had_conversation: askHadConversation,
      });
    }
  };

  const setEngagementView = (next: EngagementView) => {
    setPeekItem(null);
    if (next === view) return;
    setView(next);
    if (profile) {
      logEvent("engagement.view_changed", profile.org_id, {
        view: next,
        scope: work ? "work_item" : "engagement",
      });
    }
  };

  const openAnalysis = (
    item: WorkItemRow,
    preset: AnalysisPresetId,
    fromNotecard = false,
  ) => {
    if (fromNotecard && profile) {
      logEvent("engagement.tab_analysis_opened", profile.org_id, { view, preset });
    }
    setLensItem(item);
    setLensPreset(preset);
    // An analysis needs reading room, so it opens the panel if it is shut. The
    // width itself is the person's, kept from wherever they last dragged it.
    setRail("open");
  };

  const closeAnalysis = () => {
    setLensItem(null);
    setLensPreset(undefined);
    setRail("open");
  };


  // A document reads beside Ask in the main view. Opening one opens the rail
  // when it is closed; this is not a person choosing a width, so it does not
  // fire engagement.ask_rail_toggled.
  const openPeek = (item: WorkItemRow) => {
    markOpenStart("peek.open");
    setPeekItem(item);
    if (rail === "closed") setRail("open");
  };

  useEffect(() => {
    if (previousWorkRef.current === work) return;
    previousWorkRef.current = work;
    if (profile) {
      logEvent("engagement.scope_changed", profile.org_id, {
        scope: work ? "work_item" : "engagement",
        from: "nav",
      });
    }
  }, [profile, work]);

  // A shared "?trace=" link opens the audit on exactly what was circled.
  useTraceParam(engagementId);
  useJourneyParam(engagementId);

  const membership = useMyEngagementMembership(engagementId, profile?.id);

  // On phones the floating button is the only Ask Lasso entry, and on this page
  // it opens this engagement's dock rather than navigating to Reflect.
  useRegisterAskLasso(() => {
    markOpenStart("ask_dock.open");
    setAskRailOpen(true);
  });

  // One consolidated read for this engagement: the record, its workstreams,
  // the coaches it is shared with, the caller's own membership, the decisions
  // and the sequence order all arrive together.
  const engagementQuery = useEngagementPage(engagementId);
  useLayoutEffect(() => {
    measureTabRule();
  }, [engagementQuery.data?.engagement?.id, measureTabRule]);
  const tasksQuery = useEngagementSlice<TaskWithWork[]>(
    engagementId,
    ["engagement-tasks", engagementId],
    (payload) => payload.tasks as unknown as TaskWithWork[],
  );

  // In-app route transitions only. A hard document load plus hydration is a
  // different measurement and is deliberately not covered in this pass.
  usePerfNavFinish("engagement.load", Boolean(engagementQuery.data?.engagement));

  // Shared cached list, already loaded elsewhere in the app: no new query.
  const shippedWork = useShippedWork();

  const engagement = engagementQuery.data?.engagement ?? null;
  const scopedTask = work ? (tasksQuery.data ?? []).find((task) => task.id === work) : undefined;
  const isQuickFolder = engagement?.clients?.quick_folder === true;

  // Mapped items in this engagement, the only input to whether "What recurs"
  // has enough work to run. No count is ever shown to the person.
  const canvasItems = Array.from(
    new Map(
      (tasksQuery.data ?? [])
        .flatMap((task) => task.work_item_tasks ?? [])
        .map((link) => link.work_items)
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
        .map((item) => [item.id, item as unknown as WorkItemRow] as const),
    ).values(),
  );
  const mappedItemCount = canvasItems.length;
  const isCoach = profile?.role === "coach";
  const vendorVisible = useVendorVisible();
  const hasCalls = canvasItems.some((item) => item.type === "call");

  // PASS 143 — a wrap-up is an ordinary task carrying is_wrap. It never renders
  // as a board column: it reads below the board as the thing the rest fed.
  // B2: the board's default home is a real task row but never a workstream, so
  // it is filtered out before anything renders a column, a count or a ledger.
  const allTasks = workstreamTasks(tasksQuery.data ?? []);
  const wrapTask = allTasks.find((task) => task.is_wrap === true);
  const boardTasks = allTasks.filter((task) => task.is_wrap !== true);
  // B2.1 — work in the board's default home is on the board but in no
  // workstream column, so it reads as a small list under the board.
  const boardDefaultTask = (tasksQuery.data ?? []).find((task) => task.is_board_default === true);
  const boardDefaultItems = Array.from(
    new Map(
      (boardDefaultTask?.work_item_tasks ?? [])
        .map((link) => link.work_items)
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
        .map((item) => [item.id, item as unknown as WorkItemRow] as const),
    ).values(),
  );
  const scopedItems = scopedTask
    ? Array.from(
        new Map(
          (scopedTask.work_item_tasks ?? [])
            .map((link) => link.work_items)
            .filter((item): item is NonNullable<typeof item> => Boolean(item))
            .map((item) => [item.id, item as unknown as WorkItemRow] as const),
        ).values(),
      )
    : canvasItems;
  const selectedItem = peekItem ?? lensItem;
  const contextItems = selectedItem ? [selectedItem] : scopedItems;
  const contextScope = selectedItem
    ? isDeliverableType(selectedItem.type)
      ? "deliverable"
      : "thread"
    : scopedTask
      ? "deliverable"
      : "engagement";
  const contextTarget = selectedItem ?? scopedItems.find((item) => isDeliverableType(item.type));
  const contextFacts = [
    {
      label: `${contextItems.length} ${contextItems.length === 1 ? "PIECE" : "PIECES"}`,
    },
    ...(contextScope !== "thread"
      ? [
          {
            label: `${contextItems.filter((item) => isDeliverableType(item.type)).length} DELIVERABLES`,
            muted: contextItems.every((item) => !isDeliverableType(item.type)),
          },
        ]
      : []),
  ];
  const contextVendors = vendorVisible
    ? Array.from(
        new Set(
          contextItems
            .map((item) => sourceVendorKey(item))
            .filter((key): key is string => Boolean(key)),
        ),
      ).map((key) => ({ key, label: vendorLabel(key), present: true }))
    : [];
  const analysisScope = selectedItem
    ? contextScope
    : contextTarget
      ? isDeliverableType(contextTarget.type)
        ? "deliverable"
        : "thread"
      : contextScope;
  const availableContextPresets = presetsForScope(analysisScope, isCoach);
  const tabPresetId = TAB_ANALYSIS_PRESETS[view];
  const scopedTabPresetId =
    analysisScope === "thread" ? (THREAD_PRESET_VARIANTS[tabPresetId] ?? tabPresetId) : tabPresetId;
  const contextPreset =
    availableContextPresets.find((preset) => preset.id === scopedTabPresetId) ??
    availableContextPresets[0] ??
    null;
  const contextActions = [
    ...(profile?.role !== "coach"
      ? [
          {
            id: "ask",
            label: "ASK ↓",
            onSelect: () => {
              markOpenStart("ask_dock.open");
              setAskRailOpen(true);
            },
          },
        ]
      : []),
    ...(contextTarget && contextPreset
      ? [
          {
            id: contextPreset.id,
            label: contextPreset.label.toUpperCase(),
            onSelect: () => openAnalysis(contextTarget, contextPreset.id, true),
          },
        ]
      : []),
  ];
  // One panel, one content: the document wins, then the analysis, then Ask.
  const panelContent: "ask" | "analysis" | "document" | "thread" = peekItem
    ? isDeliverableType(peekItem.type)
      ? "document"
      : "thread"
    : lensItem
      ? "analysis"
      : "ask";
  const previousPanelContentRef = useRef(panelContent);
  useEffect(() => {
    if (previousPanelContentRef.current === panelContent) return;
    previousPanelContentRef.current = panelContent;
    if (!profile) return;
    logEvent("engagement.panel_content_changed", profile.org_id, {
      content: panelContent,
      scope: contextScope,
    });
  }, [contextScope, panelContent, profile]);

  const panelShowing =
    Boolean(peekItem) ||
    Boolean(lensItem) ||
    Boolean(profile && profile.role !== "coach" && askOpen);
  const wrapItemCount = wrapTask
    ? new Set(
        (wrapTask.work_item_tasks ?? [])
          .map((link) => link.work_items?.id)
          .filter((id): id is string => Boolean(id)),
      ).size
    : 0;

  async function addWrap() {
    if (!profile || wrapTask || creatingWrap) return;
    setCreatingWrap(true);
    const position = allTasks.length + 1;
    const { error } = await supabase.from("tasks").insert({
      engagement_id: engagementId,
      owner_id: profile.id,
      name: "Wrap-up",
      is_wrap: true,
      position,
    });
    setCreatingWrap(false);
    if (error) return;
    logEvent("engagement.wrap_created", profile.org_id, { task_count: boardTasks.length });
    await queryClient.invalidateQueries({ queryKey: ["engagement-tasks", engagementId] });
  }

  const headerAction = profile ? (
    <div className="flex flex-wrap items-center gap-2">
      {profile.role !== "coach" && !wrapTask && membership.data?.isMember ? (
        <button type="button" className="nb-hi" disabled={creatingWrap} onClick={() => void addWrap()}>
          Add a wrap-up
        </button>
      ) : null}
      {profile.role !== "coach" && membership.data?.isMember ? (
        <p className="text-xs text-muted-foreground">
          Bring more work in from{" "}
          <Link to="/work" className="underline-offset-2 hover:underline">
            the Inbox
          </Link>
          .
        </p>
      ) : null}
    </div>
  ) : null;

  // isPending, not isLoading: while the profile loads the query is disabled,
  // isLoading is false, and the page would flash "not available".
  if (engagementQuery.isPending && !engagementQuery.error) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  if (engagementQuery.error) {
    return (
      <p className="text-sm text-muted-foreground">
        We could not load this engagement just now. Try again in a moment.
      </p>
    );
  }

  if (!engagement) {
    return (
      <p className="text-sm text-muted-foreground">
        This engagement is not available to you. It may no longer be shared.
      </p>
    );
  }

  return (
    <div>
      <div
        ref={benchPageRef}
        className="nb-bench-page"
        data-rail={rail}
        data-dragging={panel.dragging ? "true" : undefined}
        style={
          rail === "closed"
            ? undefined
            : { gridTemplateColumns: `minmax(0, 1fr) ${panel.width}px` }
        }
      >
        <div className="nb-bench-main" ref={benchMainRef}>
      <header className="mb-8">
        <div className="nb-sticky-head relative">
          <div className="min-w-0">
            {/* Figma 36:1936 leads with a hand breadcrumb back to the pile, not a
                mono identifier stamp. The code, client and term move onto the
                trail so nothing is lost. */}
            <p className="font-hand mb-1 text-[16px] italic text-muted-foreground">
              <Link to="/work" className="underline-offset-2 hover:underline">
                All work
              </Link>
              {" → "}
              {engagementDisplayCode(engagement) ?? "Quick folder"}
              {clientDisplayName(engagement) ? ` · ${clientDisplayName(engagement)}` : ""}
              {engagement.term_label ? ` · ${engagement.term_label}` : ""}
            </p>
            <h1 className="nb-title-strip page-title">
              {engagementDisplayTitle(engagement)}
              <GraphiteRule />
            </h1>
            {/* Not `page-subtitle`: that utility is mono/700/uppercase, which turns
                Figma's quiet sentence into a shouty label. */}
            <p className="mt-1.5 text-[13px] leading-[19px] text-muted-foreground">
              <EngagementStats engagementId={engagement.id} tasks={tasksQuery.data ?? []} />
            </p>
          </div>
        </div>

      </header>

      <div className="mb-2 flex items-end gap-2 border-b border-[var(--nb-rule)]">
        <div ref={tabBarRef} className="relative flex min-w-0 overflow-x-auto" role="group" aria-label="Engagement views">
          <button
            ref={(node) => {
              if (node) tabRefs.current.brief = node;
              else delete tabRefs.current.brief;
            }}
            type="button"
            aria-pressed={view === "brief"}
            onClick={() => setEngagementView("brief")}
            className={cn(
              "group relative flex flex-col items-start gap-0.5 px-4 pb-2 pt-1 transition-colors",
              view === "brief" ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span className="micro-label">BRIEF & COMMS</span>
            <span className="text-[11px] italic text-muted-foreground">what were we asked for?</span>
            {view !== "brief" ? (
              <span
                className={cn(
                  "absolute bottom-[-1px] left-0 h-[2px] w-full scale-x-0 bg-[var(--nb-pencil)] transition-transform group-hover:scale-x-100",
                )}
              />
            ) : null}
          </button>
          <button
            ref={(node) => {
              if (node) tabRefs.current.work = node;
              else delete tabRefs.current.work;
            }}
            type="button"
            aria-pressed={view === "work"}
            onClick={() => setEngagementView("work")}
            className={cn(
              "group relative flex flex-col items-start gap-0.5 px-4 pb-2 pt-1 transition-colors",
              view === "work" ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span className="micro-label">WORK</span>
            <span className="text-[11px] italic text-muted-foreground">what is here, and in what order?</span>
            {view !== "work" ? (
              <span
                className={cn(
                  "absolute bottom-[-1px] left-0 h-[2px] w-full scale-x-0 bg-[var(--nb-pencil)] transition-transform group-hover:scale-x-100",
                )}
              />
            ) : null}
          </button>
          <button
            ref={(node) => {
              if (node) tabRefs.current.verify = node;
              else delete tabRefs.current.verify;
            }}
            type="button"
            aria-pressed={view === "verify"}
            onClick={() => setEngagementView("verify")}
            className={cn(
              "group relative flex flex-col items-start gap-0.5 px-4 pb-2 pt-1 transition-colors",
              view === "verify" ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {/* The "verify" key is historical; Canvas is the truthful label. */}
            <span className="micro-label">CANVAS</span>
            <span className="text-[11px] italic text-muted-foreground">what fed what?</span>
            {view !== "verify" ? (
              <span
                className={cn(
                  "absolute bottom-[-1px] left-0 h-[2px] w-full scale-x-0 bg-[var(--nb-pencil)] transition-transform group-hover:scale-x-100",
                )}
              />
            ) : null}
          </button>
          <button
            ref={(node) => {
              if (node) tabRefs.current.share = node;
              else delete tabRefs.current.share;
            }}
            type="button"
            aria-pressed={view === "share"}
            onClick={() => setEngagementView("share")}
            className={cn(
              "group relative flex flex-col items-start gap-0.5 px-4 pb-2 pt-1 transition-colors",
              view === "share" ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span className="micro-label">SHARE</span>
            <span className="text-[11px] italic text-muted-foreground">who else can see this?</span>
            {view !== "share" ? (
              <span
                className={cn(
                  "absolute bottom-[-1px] left-0 h-[2px] w-full scale-x-0 bg-[var(--nb-pencil)] transition-transform group-hover:scale-x-100",
                )}
              />
            ) : null}
          </button>
          <span
            aria-hidden
            className="pointer-events-none absolute bottom-[-2px] block h-[6px] [transition-duration:420ms] [transition-property:left,width] [transition-timing-function:var(--nb-ease)] motion-reduce:transition-none"
            style={{ left: tabRule.left, width: tabRule.width }}
          >
            <GraphiteRule className="text-[var(--nb-green)]" />
          </span>
        </div>
        <Link
          to="/engagements/$id/canvas-lab"
          params={{ id: engagementId }}
          search={{ from: "header" }}
          className="mb-2 shrink-0 font-hand text-[16px] text-green underline-offset-2 hover:underline md:hidden"
        >
          Workboard
        </Link>
        <Button asChild className="ml-4 hidden shrink-0 self-center md:inline-flex">
          <Link
            to="/engagements/$id/canvas-lab"
            params={{ id: engagementId }}
            search={{ from: "header" }}
          >
            Open workboard
          </Link>
        </Button>
      </div>
      <div className="nb-bench-grid relative">
        <div>
          {peekItem && profile ? (
            <PeekBody
              entry={peekItem}
              analysesInHeader
              onClose={() => setPeekItem(null)}
              // Ownership truth, not page truth: a person gets their own affordances
              // on their own items here, and a coach or another member stays read only.
              canEdit={Boolean(
                profile.role !== "coach" &&
                peekItem.owner_id &&
                peekItem.owner_id === profile.id,
              )}
              engagementId={engagementId}
              viewerProfileId={profile.id}
              onMap={(item) => {
                setPeekItem(null);
                setMapItem(item);
              }}
              onWorkDate={(item) => {
                setPeekItem(null);
                setDateItem(item);
              }}
              onMakePrivate={(item) => {
                setPeekItem(null);
                void makePrivate(item).then(async (message) => {
                  if (!message) {
                    await queryClient.invalidateQueries({
                      queryKey: ["engagement-tasks", engagementId],
                    });
                  }
                });
              }}
              onAnalyse={(item, preset) => {
                setPeekItem(null);
                // A thread analysis opens its own reader: no lens in between.
                if (isThreadReaderPreset(preset)) {
                  setLaunch({ item, preset });
                  return;
                }
                openAnalysis(item, preset);
              }}
            />
          ) : view === "work" ? (
            scopedTask ? (
              <WorkLedger
                task={scopedTask}
                onOpen={(item) => {
                  openPeek(item);
                }}
                headerAction={headerAction}
                orgId={profile?.org_id}
                profileId={profile?.id}
                isCoach={profile?.role === "coach"}
              />
            ) : (
              <>
                <EngagementCanvas
                  engagementId={engagementId}
                  tasks={boardTasks}
                  profile={profile}
                  onChanged={async () => {
                    await queryClient.invalidateQueries({
                      queryKey: ["engagement-tasks", engagementId],
                    });
                  }}
                  onOpen={(item) => {
                    openPeek(item);
                  }}
                  headerAction={headerAction}
                />
                {/* B2.1 — work brought in from the board lives in the default
                    home: on the board, in no workstream column. */}
                {boardDefaultItems.length > 0 ? (
                  <section className="mt-6 space-y-3">
                    <h2 className="micro-label micro-label-section">
                      ON THE BOARD, NOT IN A WORKSTREAM
                    </h2>
                    <div className="nb-paper-wall">
                      {boardDefaultItems.map((item) => (
                        <WorkNote key={item.id} item={item} onOpen={() => openPeek(item)} />
                      ))}
                    </div>
                  </section>
                ) : null}
                {/* PASS 143 — the wrap-up, when there is one. An engagement
                    without one is not incomplete, so nothing renders here. */}
                {wrapTask ? (
                  <Link
                    to="/engagements/$id"
                    params={{ id: engagementId }}
                    search={{ work: wrapTask.id }}
                    className="mt-6 block rounded-lg border-[1.4px] p-5"
                    style={{
                      borderColor: "var(--nb-green)",
                      background: "var(--nb-white)",
                    }}
                  >
                    <p className="micro-label" style={{ color: "var(--nb-green)" }}>
                      WRAPS UP THIS ENGAGEMENT
                    </p>
                    <p className="mt-1.5 text-base font-medium">{wrapTask.name}</p>
                    <p className="micro-label mt-1.5">
                      {wrapItemCount} {wrapItemCount === 1 ? "DELIVERABLE" : "DELIVERABLES"} · DRAWS
                      ON {boardTasks.length}{" "}
                      {boardTasks.length === 1 ? "PIECE OF WORK" : "PIECES OF WORK"}
                    </p>
                  </Link>
                ) : null}
              </>
            )
          ) : view === "brief" ? (
            <div className="space-y-4">
              {profile && profile.role !== "coach" ? (
                <EngagementBriefPanel
                  engagement={engagement}
                  engagementId={engagementId}
                  profileId={profile.id}
                  orgId={profile.org_id}
                  taskIds={(tasksQuery.data ?? []).map((task) => task.id)}
                  hasMappedWork={(tasksQuery.data ?? []).some(
                    (task) => (task.work_item_tasks ?? []).length > 0,
                  )}
                  canEdit={Boolean(membership.data?.isMember)}
                  termLabel={engagement.term_label}
                  defaultExpanded
                />
              ) : null}
              <section className="space-y-3">
                <h2 className="micro-label micro-label-section">WHAT WAS SAID</h2>
                {(() => {
                  const conversations = canvasItems.filter((item) => !isDeliverableType(item.type));
                  return conversations.length > 0 ? (
                    <div className="nb-paper-wall">
                      {conversations.map((item) => (
                        <WorkNote
                          key={item.id}
                          item={item}
                          onOpen={() => openPeek(item)}
                        />
                      ))}
                    </div>
                  ) : null;
                })()}
                <p className="text-xs text-muted-foreground">
                  Drift is read against what was said. This is what is here.
                </p>
              </section>
              {(() => {
                const showCallsLine = !hasCalls;
                const showBriefLine = !engagement.brief?.trim();
                return showCallsLine || showBriefLine ? (
                  <div className="rounded-lg border border-graphite bg-card p-5">
                    <p className="micro-label">WHAT IS NOT HERE YET</p>
                    {showCallsLine ? (
                      <p className="mt-2 text-[13px] text-muted-foreground">
                        No calls or transcripts have been brought into this engagement. When they are,
                        what was asked for and what is still unanswered can be read from them.
                      </p>
                    ) : null}
                    {showBriefLine ? (
                      <p className="mt-2 text-[13px] text-muted-foreground">
                        A document or a thread marked as the brief appears here alongside the written one.
                      </p>
                    ) : null}
                  </div>
                ) : null;
              })()}
            </div>
          ) : view === "verify" ? (
            <div className="space-y-3">
              <div className="border-b border-[var(--nb-rule)] pb-3">
                <h2 className="font-hand text-[16px] text-green">Workboard</h2>
                <p className="text-[13px] text-muted-foreground">
                  Arrange this engagement&apos;s work, calls and judgment on one board. Changes save as you go.
                </p>
                <div className="mt-2">
                  <Button asChild>
                    <Link
                      to="/engagements/$id/canvas-lab"
                      params={{ id: engagementId }}
                      search={{ from: "canvas_tab" }}
                    >
                      Open workboard
                    </Link>
                  </Button>
                </div>
              </div>
              <EngagementCanvasView engagementId={engagementId} items={scopedItems} onOpen={openPeek} />
            </div>
          ) : profile && profile.role !== "coach" ? (
            <SharedWithSection
              engagementId={engagementId}
              orgId={profile.org_id}
              items={canvasItems}
              profile={profile}
              quickFolder={isQuickFolder}
              personalOrg={!isBusinessOrg(profile)}
            />
          ) : (
            <div className="space-y-6">
              <div className="rounded-lg border border-graphite bg-card p-6">
                <h2 className="micro-label micro-label-section">Sharing</h2>
                <p className="mt-2 text-[13px] text-muted-foreground">
                  Sharing is managed by the firm.
                </p>
              </div>
              <section className="flex flex-col gap-2">
                <h2 className="micro-label micro-label-section">SEND TO THE FIRM</h2>
                <CanvasDeliverableActions
                  items={canvasItems}
                  engagementId={engagementId}
                  profile={profile}
                />
              </section>
            </div>
          )}
        </div>

      </div>

      <CaptureCoverage
        profileId={profile?.id}
        itemCount={mappedItemCount}
        scopeLabel="this engagement"
        isOwner={profile?.role !== "coach"}
      />
      <SubjectCoachingSection
        profileId={profile?.id}
        engagementId={engagementId}
        orgId={profile?.org_id}
        items={canvasItems}
        shipped={(shippedWork.data ?? []).some((card) => card.engagement_id === engagementId)}
      />


    </div>

        <aside className="nb-bench-aside">
          {rail === "closed" ? null : (
            /* The panel's inner edge. It sits in the 32px gap, so it takes no
               space from either column. */
            <div className="nb-panel-grip" {...panel.handleProps} />
          )}

          <div className="nb-bench-aside-inner">
            <ContextCard
              eyebrow={view === "share" ? "GOING TO" : contextScope === "engagement" ? "WORKING FROM" : "ASKING ABOUT"}
              title={selectedItem?.title ?? scopedTask?.name ?? engagementDisplayTitle(engagement)}
              scopeLabel={
                contextScope === "thread"
                  ? "SCOPE · THREAD"
                  : contextScope === "deliverable"
                    ? "SCOPE · DELIVERABLE"
                    : "SCOPE · ENGAGEMENT"
              }
              facts={contextFacts}
              vendors={contextVendors}
              actions={contextActions}
              panelOpen={panelShowing}
              onClosePanel={() => {

                // The close control clears the topmost content, not the column.
                if (peekItem) setPeekItem(null);
                else if (lensItem) closeAnalysis();
                else setAskRailOpen(false);
              }}
            />
            {profile && ((profile.role !== "coach" && askOpen) || lensItem) ? (
              <div className="nb-bench-rail rounded-b-[3px] rounded-t-none border border-t-0 border-[var(--nb-rule)] bg-[var(--nb-white)] p-[13px_14px] shadow-[0_3px_6px_-3px_rgb(22_24_26_/_0.2)]">
                {profile.role !== "coach" ? (
                  // Keep Ask mounted while an analysis is shown so its conversation remains intact.
                  <div hidden={Boolean(lensItem)} className="min-h-0 flex-1">
                    <EngagementAsk
                      open={askOpen}
                      onOpenChange={setAskRailOpen}
                      onConversationStart={() => {
                        setAskHadConversation(true);
                      }}
                      engagementId={engagementId}
                      engagementTitle={engagement.title}
                      profileId={profile.id}
                      orgId={profile.org_id}
                    />
                  </div>
                ) : null}
                {lensItem && !peekItem ? (
                  <AnalysisLensPanel
                    key={`${lensItem.id}:${lensPreset ?? "analysis"}`}
                    {...(lensPreset ? { initialPreset: lensPreset } : {})}
                    target={{
                      kind: "item",
                      id: lensItem.id,
                      title: lensItem.title,
                      scope: isDeliverableType(lensItem.type) ? "deliverable" : "thread",
                    }}
                    profileId={profile.id}
                    orgId={profile.org_id}
                    isCoach={profile.role === "coach"}
                  />
                ) : null}
              </div>
            ) : null}
          </div>
        </aside>
      </div>



      <MapDialog
        item={mapItem}
        open={mapItem !== null}
        onOpenChange={(next) => {
          if (!next) setMapItem(null);
        }}
      />

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

    </div>
  );
}
