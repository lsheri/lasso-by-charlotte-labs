import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

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
import { INVITE_ADMIN_ONLY_LINE } from "@/lib/invites-shared";
import { markOpenStart } from "@/lib/perf-timing";
import type { WorkItemRow } from "@/lib/work-types";

type TaskWithWork = CanvasTask;

export function EngagementPage({ engagementId }: { engagementId: string }) {
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const [askOpen, setAskOpen] = useState(false);
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

  // A shared "?trace=" link opens the audit on exactly what was circled.
  useTraceParam(engagementId);
  useJourneyParam(engagementId);

  const coaches = useEngagementCoaches(engagementId);
  const membership = useMyEngagementMembership(engagementId, profile?.id);

  // On phones the floating button is the only Ask Lasso entry, and on this page
  // it opens this engagement's dock rather than navigating to Reflect.
  useRegisterAskLasso(() => {
    markOpenStart("ask_dock.open");
    setAskOpen(true);
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
            <p className="micro-label mb-1.5">
              {engagementDisplayCode(engagement) ?? "Quick folder"}
              {clientDisplayName(engagement) ? ` · ${clientDisplayName(engagement)}` : ""}
              {engagement.term_label ? ` · ${engagement.term_label}` : ""}
            </p>
            <h1 className="nb-title-strip page-title">
              {engagementDisplayTitle(engagement)}
              <GraphiteRule />
            </h1>
            <p className="page-subtitle">
              <EngagementStats engagementId={engagement.id} tasks={tasksQuery.data ?? []} />
            </p>
          </div>
          {profile && profile.role !== "coach" ? (
            <button
              type="button"
              onClick={() => {
                markOpenStart("ask_dock.open");
                setAskOpen(true);
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
            />

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

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_400px]">
        <EngagementCanvas
          engagementId={engagementId}
          tasks={tasksQuery.data ?? []}
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
          headerAction={
            profile ? (
              <div className="flex flex-wrap items-center gap-2">
                {profile.role !== "coach" ? (
                  <WhatFedThisButton
                    items={canvasItems}
                    orgId={profile.org_id}
                    profileId={profile.id}
                  />
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
            ) : null
          }
        />

        {profile && profile.role !== "coach" ? (
          <EngagementStrip
            engagement={engagement}
            tasks={tasksQuery.data ?? []}
            deliverables={deliverables}
          >
            {(expanded, setExpanded) => (
              <EngagementAsk
                open={askOpen}
                onOpenChange={setAskOpen}
                expanded={expanded}
                onConversationStart={() => setExpanded(false)}
                engagementId={engagementId}
                engagementTitle={engagement.title}
                profileId={profile.id}
                orgId={profile.org_id}
              />
            )}
          </EngagementStrip>
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
