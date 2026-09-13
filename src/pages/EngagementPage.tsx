import { useQueryClient } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { GraphiteRule } from "@/components/notebook/marks";
import { SpiderMark } from "@/components/notebook/SpiderMark";
import { PeekPanel } from "@/components/peek/PeekPanel";
import type { PeekAnalysisPreset } from "@/components/peek/PeekActionBar";
import { MapDialog } from "@/components/work/MapDialog";
import { WorkDateDialog } from "@/components/work/WorkDateDialog";
import { AnalysisLens } from "@/components/reflect/AnalysisLens";
import {
  ThreadAnalysisLauncher,
  isThreadReaderPreset,
  type ThreadReaderPreset,
} from "@/components/verify/ThreadAnalysisLauncher";
import { isDeliverableType } from "@/lib/lineage-shared";
import { useMakePrivate } from "@/hooks/use-make-private";
import { OneOnOneBrief } from "@/components/oneonone/OneOnOneBrief";
import { CaptureCoverage } from "@/components/common/CaptureCoverage";
import { EngagementCanvas, type CanvasTask } from "@/components/engagements/EngagementCanvas";
import { WorkLedger } from "@/components/engagements/WorkLedger";
import { ConnectToWorkSheet } from "@/components/engagements/ConnectToWorkSheet";
import { WhatFedThisButton } from "@/components/engagements/WhatFedThisButton";
import { CanvasDeliverableActions } from "@/components/engagements/CanvasDeliverableActions";
import { EngagementBriefPanel } from "@/components/engagements/EngagementBriefPanel";
import { EngagementStrip } from "@/components/engagements/EngagementStrip";
import { EngagementStats } from "@/components/engagements/EngagementStats";
import { EngagementAsk } from "@/components/engagements/InlineEngagementAsk";
import { SharedWithSection } from "@/components/engagements/SharedWithSection";
import { EngagementNote } from "@/components/engagements/EngagementNote";
import { InviteDialog } from "@/components/invites/InviteDialog";
import { SubjectCoachingSection } from "@/components/coaching/SubjectCoachingSection";
import { useRegisterAskLasso } from "@/components/reflect/ask-lasso-context";
import { usePerfNavFinish } from "@/hooks/use-perf-timer";
import { useProfile } from "@/hooks/use-profile";
import { useTraceParam } from "@/hooks/use-trace-param";
import { useJourneyParam } from "@/hooks/use-journey-param";
import { isBusinessOrg } from "@/hooks/use-profile";
import { useMyEngagementMembership } from "@/hooks/use-engagement-membership";
import { useEngagementPage, useEngagementSlice } from "@/hooks/use-engagement-page";
import { useEngagementCoaches } from "@/hooks/use-coach-share";
import { clientDisplayName, engagementDisplayCode, engagementDisplayTitle } from "@/lib/clients";
import { cn } from "@/lib/utils";
import { INVITE_ADMIN_ONLY_LINE } from "@/lib/invites-shared";
import { markOpenStart } from "@/lib/perf-timing";
import { logEvent } from "@/lib/telemetry";
import { supabase } from "@/integrations/supabase/client";
import type { WorkItemRow } from "@/lib/work-types";

type TaskWithWork = CanvasTask;
const engagementRoute = getRouteApi("/_authenticated/engagements/$id");

export function EngagementPage({ engagementId }: { engagementId: string }) {
  const { work } = engagementRoute.useSearch();
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const [askOpen, setAskOpen] = useState(false);
  const [askHadConversation, setAskHadConversation] = useState(false);
  const [prepOpen, setPrepOpen] = useState(false);
  const [peekItem, setPeekItem] = useState<WorkItemRow | null>(null);
  // PASS 129 — the peek's action bar reads the same on both surfaces, so the
  // same dialogs are mounted here as on the Work pile.
  const [mapItem, setMapItem] = useState<WorkItemRow | null>(null);
  const [dateItem, setDateItem] = useState<WorkItemRow | null>(null);
  const [lensItem, setLensItem] = useState<WorkItemRow | null>(null);
  const [lensPreset, setLensPreset] = useState<PeekAnalysisPreset | undefined>(undefined);
  // A thread analysis launched from the peek: confirm, then the reader itself.
  const [launch, setLaunch] = useState<{ item: WorkItemRow; preset: ThreadReaderPreset } | null>(
    null,
  );
  const makePrivate = useMakePrivate();
  // The coaching note opens on its own; the brief is always legible above it.
  const [coachingOpen, setCoachingOpen] = useState(false);
  // The right rail was chosen over Figma 36:1936 on 12 Sep 2026; the frame has
  // not yet been updated. The page holds the shared open state that used to
  // pass through the strip's render prop.
  // Collapsed on arrival: expanded it pushed the view switcher 700px down the
  // page, below the fold on a 13-inch screen.
  const [stripExpanded, setStripExpanded] = useState(false);
  const [view, setView] = useState<"brief" | "work" | "trace">("work");
  const [creatingWrap, setCreatingWrap] = useState(false);
  const previousWorkRef = useRef(work);

  const setAskRailOpen = (open: boolean) => {
    if (open === askOpen) return;
    setAskOpen(open);
    if (profile) {
      logEvent("engagement.ask_rail_toggled", profile.org_id, {
        state: open ? "opened" : "collapsed",
        had_conversation: askHadConversation,
      });
    }
  };

  const setEngagementView = (next: "brief" | "work" | "trace") => {
    if (next === view) return;
    setView(next);
    if (profile) {
      logEvent("engagement.view_changed", profile.org_id, {
        view: next,
        scope: work ? "work_item" : "engagement",
      });
    }
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
  // after hydration. 1100px matches the .nb-bench-grid[data-rail="open"] media
  // query. Use setAskOpen directly so this default does NOT fire the tracked
  // engagement.ask_rail_toggled event — that event is reserved for a person's
  // explicit open/collapse choice.
  useEffect(() => {
    if (window.innerWidth >= 1100) setAskOpen(true);
  }, []);

  // A shared "?trace=" link opens the audit on exactly what was circled.
  useTraceParam(engagementId);
  useJourneyParam(engagementId);

  const coaches = useEngagementCoaches(engagementId);
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
  const hasCoaches = (coaches.data ?? []).length > 0;

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
  const hasCalls = canvasItems.some((item) => item.type === "call");

  // PASS 143 — a wrap-up is an ordinary task carrying is_wrap. It never renders
  // as a board column: it reads below the board as the thing the rest fed.
  const allTasks = tasksQuery.data ?? [];
  const wrapTask = allTasks.find((task) => task.is_wrap === true);
  const boardTasks = allTasks.filter((task) => task.is_wrap !== true);
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
      {profile.role !== "coach" ? (
        <WhatFedThisButton
          items={canvasItems}
          orgId={profile.org_id}
          profileId={profile.id}
        />
      ) : null}
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
        <ConnectToWorkSheet
          engagementId={engagementId}
          streams={(tasksQuery.data ?? []).map((task) => ({
            id: task.id,
            name: task.name,
          }))}
          profile={{ id: profile.id, org_id: profile.org_id }}
          onChanged={async () => {
            await queryClient.invalidateQueries({
              queryKey: ["engagement-tasks", engagementId],
            });
          }}
        />
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
      <header className="mb-8">
        <div className="nb-sticky-head grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
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
          {profile && profile.role !== "coach" ? (
            <button
              type="button"
              onClick={() => {
                markOpenStart("ask_dock.open");
                setAskRailOpen(true);
              }}
              className="hidden shrink-0 items-center gap-2.5 rounded-full border border-border px-[18px] py-2.5 font-mono text-[16px] uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:text-foreground md:inline-flex"
            >
              <SpiderMark size={27} /> Ask Lasso
            </button>
          ) : null}
        </div>

        <CaptureCoverage
          profileId={profile?.id}
          itemCount={mappedItemCount}
          scopeLabel="this engagement"
          isOwner={profile?.role !== "coach"}
        />

        {profile && profile.role !== "coach" ? (
          <div className="mt-5 space-y-3">
            <EngagementNote
              tone="green"
              open={coachingOpen}
              onToggle={() => setCoachingOpen((v) => !v)}
              title="Coaching and sharing"
              summary={
                isQuickFolder
                  ? "Quick folder, not shareable"
                  : (coaches.data ?? []).length === 0
                    ? "Not shared with anyone"
                    : `Shared with ${coaches.data?.length} coach${(coaches.data?.length ?? 0) === 1 ? "" : "es"}`
              }
            >
              <div className="flex flex-wrap items-center gap-2">
                {profile.role === "admin" && !isQuickFolder ? (
                  <InviteDialog
                    engagementId={engagementId}
                    trigger={
                      <button type="button" className="nb-hi">
                        {hasCoaches ? "Invite a new coach" : "Invite a coach"}
                      </button>
                    }
                  />
                ) : null}
                <button type="button" onClick={() => setPrepOpen(true)} className="nb-hi">
                  Prepare a 1:1
                </button>
              </div>
              {profile.role !== "admin" && isBusinessOrg(profile) && !isQuickFolder ? (
                <p className="mt-2 text-xs text-muted-foreground">{INVITE_ADMIN_ONLY_LINE}</p>
              ) : null}
              <div className="mt-4">
                <SharedWithSection
                  engagementId={engagementId}
                  orgId={profile.org_id}
                  quickFolder={isQuickFolder}
                  personalOrg={!isBusinessOrg(profile)}
                />
              </div>
            </EngagementNote>
          </div>
        ) : null}
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
            aria-pressed={view === "trace"}
            onClick={() => setEngagementView("trace")}
            className={cn(
              "group relative flex flex-col items-start gap-0.5 px-4 pb-2 pt-1 transition-colors",
              view === "trace" ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span className="micro-label">TRACE</span>
            <span className="text-[11px] italic text-muted-foreground">how does this connect?</span>
            <span
              className={cn(
                "absolute bottom-[-1px] left-0 h-[2px] w-full transition-transform",
                view === "trace" ? "scale-x-100" : "scale-x-0 bg-[var(--nb-pencil)] group-hover:scale-x-100",
              )}
              style={view === "trace" ? { background: "var(--nb-ink)" } : undefined}
            />
          </button>
        </div>
      </div>
      <p className="micro-label mb-4">
        SCOPE · {scopedTask ? scopedTask.name.toUpperCase() : "EVERYTHING IN THIS ENGAGEMENT"}
      </p>

      {/* Figma 36:1936: the strip is a full-width band under the header. */}
      {profile && profile.role !== "coach" ? (
        <div className="mb-8">
          <EngagementStrip
            engagement={engagement}
            tasks={tasksQuery.data ?? []}
            deliverables={deliverables}
            expanded={stripExpanded}
            onExpandedChange={setStripExpanded}
          />
        </div>
      ) : null}

      <div className="nb-bench-grid" data-rail={askOpen ? "open" : "closed"}>
        <div>
          {view === "work" ? (
            scopedTask ? (
              <WorkLedger
                task={scopedTask}
                onOpen={(item) => {
                  markOpenStart("peek.open");
                  setPeekItem(item);
                }}
                headerAction={headerAction}
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
                    markOpenStart("peek.open");
                    setPeekItem(item);
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
          ) : (
            <div className="rounded-lg border border-graphite bg-card p-6">
              <h2 className="micro-label micro-label-section">How does this connect?</h2>
              <p className="mt-2 text-[13px] text-muted-foreground">
                The map of what fed what lands here next.
              </p>
            </div>
          )}
        </div>

        {profile && profile.role !== "coach" ? (
          <div className="nb-bench-rail">
            <EngagementAsk
              open={askOpen}
              onOpenChange={setAskRailOpen}
              expanded={stripExpanded}
              onConversationStart={() => {
                setAskHadConversation(true);
                setStripExpanded(false);
              }}
              engagementId={engagementId}
              engagementTitle={engagement.title}
              profileId={profile.id}
              orgId={profile.org_id}
            />
          </div>
        ) : null}
      </div>

      <PeekPanel
        entry={peekItem}
        open={peekItem !== null}
        onOpenChange={(next) => {
          if (!next) setPeekItem(null);
        }}
        // Ownership truth, not page truth: a person gets their own affordances
        // on their own items here, and a coach or another member stays read only.
        canEdit={Boolean(
          profile &&
          profile.role !== "coach" &&
          peekItem?.owner_id &&
          peekItem.owner_id === profile.id,
        )}
        engagementId={engagementId}
        viewerProfileId={profile?.id ?? null}
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
          setLensPreset(preset);
          setLensItem(item);
        }}
      />

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

      <SubjectCoachingSection
        profileId={profile?.id}
        engagementId={engagementId}
        orgId={profile?.org_id}
      />

      {profile && profile.role !== "coach" ? (
        <OneOnOneBrief
          open={prepOpen}
          onOpenChange={setPrepOpen}
          profileId={profile.id}
          engagementId={engagementId}
          scopeLabel={engagement.title}
        />
      ) : null}

    </div>
  );
}
