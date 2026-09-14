import { useQueryClient } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { GraphiteRule } from "@/components/notebook/marks";
import { PeekBody } from "@/components/peek/PeekPanel";
import { presetsForScope, type AnalysisPresetId } from "@/lib/analysis-presets";
import { MapDialog } from "@/components/work/MapDialog";
import { WorkDateDialog } from "@/components/work/WorkDateDialog";
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
import { SharedWithSection } from "@/components/engagements/SharedWithSection";
import { SubjectCoachingSection } from "@/components/coaching/SubjectCoachingSection";
import { useRegisterAskLasso } from "@/components/reflect/ask-lasso-context";
import { usePerfNavFinish } from "@/hooks/use-perf-timer";
import { useProfile } from "@/hooks/use-profile";
import { useTraceParam } from "@/hooks/use-trace-param";
import { useJourneyParam } from "@/hooks/use-journey-param";
import { isBusinessOrg } from "@/hooks/use-profile";
import { useMyEngagementMembership } from "@/hooks/use-engagement-membership";
import { useEngagementPage, useEngagementSlice } from "@/hooks/use-engagement-page";
import { clientDisplayName, engagementDisplayCode, engagementDisplayTitle } from "@/lib/clients";
import { workIdentityLabel } from "@/lib/work-identity";
import { cn } from "@/lib/utils";
import { markOpenStart } from "@/lib/perf-timing";
import { logEvent } from "@/lib/telemetry";
import { supabase } from "@/integrations/supabase/client";
import type { WorkItemRow } from "@/lib/work-types";
import { sourceVendorKey } from "@/components/work/SourceMark";
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
  const [rail, setRail] = useState<"closed" | "open" | "wide">("closed");
  const askOpen = rail !== "closed";
  const [askHadConversation, setAskHadConversation] = useState(false);
  const [peekItem, setPeekItem] = useState<WorkItemRow | null>(null);
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
    // Analyses need reading room, but this is not a person choosing a rail width.
    setRail("wide");
  };

  const closeAnalysis = () => {
    setLensItem(null);
    setLensPreset(undefined);
    setRail("open");
  };

  // A document reads beside the work, in the panel, never over it. Opening one
  // opens the panel when it is closed; this is not a person choosing a width,
  // so it does not fire engagement.ask_rail_toggled.
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

  // Open the Ask rail by default on desktop, but only on the client and only
  // after hydration. 1100px matches the .nb-bench-page[data-rail="open"] media
  // query. Use setRail directly so this default does NOT fire the tracked
  // engagement.ask_rail_toggled event — that event is reserved for a person's
  // explicit open/collapse choice.
  useEffect(() => {
    if (window.innerWidth >= 1100) setRail("open");
  }, []);

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
  const tasksQuery = useEngagementSlice<TaskWithWork[]>(
    engagementId,
    ["engagement-tasks", engagementId],
    (payload) => payload.tasks as unknown as TaskWithWork[],
  );

  // In-app route transitions only. A hard document load plus hydration is a
  // different measurement and is deliberately not covered in this pass.
  usePerfNavFinish("engagement.load", Boolean(engagementQuery.data?.engagement));

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
  const deliverables = canvasItems.filter((item) => isDeliverableType(item.type));
  const isCoach = profile?.role === "coach";
  const vendorVisible = useVendorVisible();
  const hasCalls = canvasItems.some((item) => item.type === "call");

  // PASS 143 — a wrap-up is an ordinary task carrying is_wrap. It never renders
  // as a board column: it reads below the board as the thing the rest fed.
  const allTasks = tasksQuery.data ?? [];
  const wrapTask = allTasks.find((task) => task.is_wrap === true);
  const boardTasks = allTasks.filter((task) => task.is_wrap !== true);
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
      <CanvasDeliverableActions
        items={canvasItems}
        engagementId={engagementId}
        profile={profile}
      />
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

  if (engagementQuery.isLoading) {
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
      <div className="nb-bench-page" data-rail={rail}>
        <div className="nb-bench-main">
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

      <div className="mb-2 border-b border-[var(--nb-rule)]" role="group" aria-label="Engagement views">
        <div className="flex flex-wrap">
          <button
            type="button"
            aria-pressed={view === "brief"}
            onClick={() => setEngagementView("brief")}
            className={cn(
              "group relative flex flex-col items-start gap-0.5 px-4 pb-2 pt-1 transition-colors",
              view === "brief" ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span className="micro-label">BRIEF</span>
            <span className="text-[11px] italic text-muted-foreground">what were we asked for?</span>
            <span
              className={cn(
                "absolute bottom-[-1px] left-0 h-[2px] w-full transition-transform",
                view === "brief" ? "scale-x-100" : "scale-x-0 bg-[var(--nb-pencil)] group-hover:scale-x-100",
              )}
              style={view === "brief" ? { background: "var(--nb-ink)" } : undefined}
            />
          </button>
          <button
            type="button"
            aria-pressed={view === "work"}
            onClick={() => setEngagementView("work")}
            className={cn(
              "group relative flex flex-col items-start gap-0.5 px-4 pb-2 pt-1 transition-colors",
              view === "work" ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span className="micro-label">WORK</span>
            <span className="text-[11px] italic text-muted-foreground">what is here, and what fed what?</span>
            <span
              className={cn(
                "absolute bottom-[-1px] left-0 h-[2px] w-full transition-transform",
                view === "work" ? "scale-x-100" : "scale-x-0 bg-[var(--nb-pencil)] group-hover:scale-x-100",
              )}
              style={view === "work" ? { background: "var(--nb-ink)" } : undefined}
            />
          </button>
          <button
            type="button"
            aria-pressed={view === "verify"}
            onClick={() => setEngagementView("verify")}
            className={cn(
              "group relative flex flex-col items-start gap-0.5 px-4 pb-2 pt-1 transition-colors",
              view === "verify" ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span className="micro-label">VERIFY</span>
            <span className="text-[11px] italic text-muted-foreground">can I stand behind this?</span>
            <span
              className={cn(
                "absolute bottom-[-1px] left-0 h-[2px] w-full transition-transform",
                view === "verify" ? "scale-x-100" : "scale-x-0 bg-[var(--nb-pencil)] group-hover:scale-x-100",
              )}
              style={view === "verify" ? { background: "var(--nb-ink)" } : undefined}
            />
          </button>
          <button
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
            <span
              className={cn(
                "absolute bottom-[-1px] left-0 h-[2px] w-full transition-transform",
                view === "share" ? "scale-x-100" : "scale-x-0 bg-[var(--nb-pencil)] group-hover:scale-x-100",
              )}
              style={view === "share" ? { background: "var(--nb-ink)" } : undefined}
            />
          </button>
        </div>
      </div>
      <div className="nb-bench-grid relative">
        <div>
          {view === "work" ? (
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
              {(() => {
                const showCallsLine = !hasCalls;
                const showBriefLine = true;
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
            <section className="space-y-3">
              <h2 className="micro-label micro-label-section">
                WHAT IS WORTH CHECKING BEFORE THIS GOES OUT
              </h2>
              {deliverables.length === 0 ? (
                <div className="rounded-lg border border-graphite bg-card p-5">
                  <p className="micro-label">NOTHING TO CHECK YET</p>
                  <p className="mt-2 text-[13px] text-muted-foreground">
                    When a deliverable is mapped to this engagement, what is worth checking lands
                    here.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {deliverables.map((item) => (
                    <div key={item.id} className="rounded-lg border border-graphite bg-card p-5">
                      <h3 className="text-base font-medium">{item.title}</h3>
                      <p className="micro-label mt-2">{workIdentityLabel(item)}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ) : profile && profile.role !== "coach" ? (
            <SharedWithSection
              engagementId={engagementId}
              orgId={profile.org_id}
              quickFolder={isQuickFolder}
              personalOrg={!isBusinessOrg(profile)}
            />
          ) : (
            <div className="rounded-lg border border-graphite bg-card p-6">
              <h2 className="micro-label micro-label-section">Sharing</h2>
              <p className="mt-2 text-[13px] text-muted-foreground">
                Sharing is managed by the firm.
              </p>
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
      />

    </div>

        <aside className="nb-bench-aside">
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
              panelWide={rail === "wide"}
              onTogglePanelWidth={() => {
                const next = rail === "wide" ? "open" : "wide";
                setRail(next);
                if (profile) {
                  logEvent("engagement.ask_rail_toggled", profile.org_id, {
                    state: next === "wide" ? "widened" : "narrowed",
                    had_conversation: askHadConversation,
                  });
                }
              }}
              onClosePanel={() => {
                // The close control clears the topmost content, not the column.
                if (peekItem) setPeekItem(null);
                else if (lensItem) closeAnalysis();
                else setAskRailOpen(false);
              }}
            />
            {profile && ((profile.role !== "coach" && askOpen) || lensItem || peekItem) ? (
              <div className="nb-bench-rail rounded-b-[3px] rounded-t-none border border-t-0 border-[var(--nb-rule)] bg-[var(--nb-white)] p-[13px_14px] shadow-[0_3px_6px_-3px_rgb(22_24_26_/_0.2)]">
                {profile.role !== "coach" ? (
                  // Keep Ask mounted while an analysis is shown so its conversation remains intact.
                  <div hidden={Boolean(lensItem) || Boolean(peekItem)} className="min-h-0 flex-1">
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
                {peekItem ? (
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
