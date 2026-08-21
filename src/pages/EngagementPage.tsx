import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { SpiderMark } from "@/components/notebook/SpiderMark";
import { PeekPanel } from "@/components/peek/PeekPanel";
import { OneOnOneBrief } from "@/components/oneonone/OneOnOneBrief";
import { CaptureCoverage } from "@/components/common/CaptureCoverage";
import { EditEngagementDialog } from "@/components/engagements/EditEngagementDialog";
import { EngagementCanvas, type CanvasTask } from "@/components/engagements/EngagementCanvas";
import { EngagementBriefSection } from "@/components/engagements/EngagementBriefSection";
import { SharedWithSection } from "@/components/engagements/SharedWithSection";
import { EngagementNote } from "@/components/engagements/EngagementNote";
import { InviteDialog } from "@/components/invites/InviteDialog";
import { SubjectCoachingSection } from "@/components/coaching/SubjectCoachingSection";
import { ReflectDock } from "@/components/reflect/ReflectDock";
import { useRegisterAskLasso } from "@/components/reflect/ask-lasso-context";
import { useProfile } from "@/hooks/use-profile";
import { isBusinessOrg } from "@/hooks/use-profile";
import { useMyEngagementMembership } from "@/hooks/use-engagement-membership";
import { useEngagementPage, useEngagementSlice } from "@/hooks/use-engagement-page";
import { useEngagementCoaches } from "@/hooks/use-coach-share";
import { clientDisplayName, engagementDisplayCode, engagementDisplayTitle } from "@/lib/clients";
import { INVITE_ADMIN_ONLY_LINE } from "@/lib/invites-shared";
import type { WorkItemRow } from "@/lib/work-types";


type TaskWithWork = CanvasTask;

export function EngagementPage({ engagementId }: { engagementId: string }) {
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const [askOpen, setAskOpen] = useState(false);
  const [prepOpen, setPrepOpen] = useState(false);
  const [peekItem, setPeekItem] = useState<WorkItemRow | null>(null);

  const coaches = useEngagementCoaches(engagementId);
  const membership = useMyEngagementMembership(engagementId, profile?.id);

  // On phones the floating button is the only Ask Lasso entry, and on this page
  // it opens this engagement's dock rather than navigating to Reflect.
  useRegisterAskLasso(() => setAskOpen(true));

  // One consolidated read for this engagement: the record, its workstreams,
  // the coaches it is shared with, the caller's own membership, the decisions
  // and the sequence order all arrive together.
  const engagementQuery = useEngagementPage(engagementId);
  const tasksQuery = useEngagementSlice<TaskWithWork[]>(
    engagementId,
    ["engagement-tasks", engagementId],
    (payload) => payload.tasks as unknown as TaskWithWork[],
  );




  const engagement = engagementQuery.data?.engagement ?? null;
  const isQuickFolder = engagement?.clients?.quick_folder === true;
  const hasCoaches = (coaches.data ?? []).length > 0;

  // Mapped items in this engagement, the only input to whether "What recurs"
  // has enough work to run. No count is ever shown to the person.
  const mappedItemCount = new Set(
    (tasksQuery.data ?? []).flatMap((task) =>
      (task.work_item_tasks ?? [])
        .map((link) => link.work_items?.id)
        .filter((id): id is string => Boolean(id)),
    ),
  ).size;

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
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
          <div className="min-w-0">
            <h1 className="nb-title-strip page-title">{engagementDisplayTitle(engagement)}</h1>
            <p className="mt-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
              {engagementDisplayCode(engagement) ?? "Quick folder"}
              {clientDisplayName(engagement) ? ` · ${clientDisplayName(engagement)}` : ""}
              {engagement.term_label ? ` · ${engagement.term_label}` : ""}
            </p>
          </div>
          {profile && profile.role !== "coach" ? (
            <button
              type="button"
              onClick={() => setAskOpen(true)}
              className="hidden shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:text-foreground md:inline-flex"
            >
              <SpiderMark size={18} /> Ask Lasso
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
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <EngagementNote
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

            <EngagementNote
              title="Brief and details"
              summary={engagement.brief ?? "No brief yet"}
            >
              <div className="space-y-3">
                <div>
                  <p className="micro-label">Client</p>
                  <p className="mt-1 text-sm text-foreground">
                    {clientDisplayName(engagement) ?? "Not set"}
                  </p>
                </div>
                <div>
                  <p className="micro-label">Brief</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                    {engagement.brief ?? "Not set"}
                  </p>
                </div>
                {membership.data?.isMember ? (
                  <EditEngagementDialog engagement={engagement} />
                ) : null}
                <EngagementBriefSection
                  engagementId={engagementId}
                  profileId={profile.id}
                  orgId={profile.org_id}
                  taskIds={(tasksQuery.data ?? []).map((task) => task.id)}
                  hasMappedWork={(tasksQuery.data ?? []).some(
                    (task) => (task.work_item_tasks ?? []).length > 0,
                  )}
                />
              </div>
            </EngagementNote>
          </div>
        ) : null}

      </header>

      <EngagementCanvas
        engagementId={engagementId}
        tasks={tasksQuery.data ?? []}
        profile={profile}
        onChanged={async () => {
          await queryClient.invalidateQueries({
            queryKey: ["engagement-tasks", engagementId],
          });
        }}
        onOpen={(item) => setPeekItem(item)}
      />

      <PeekPanel
        entry={peekItem}
        open={peekItem !== null}
        onOpenChange={(next) => {
          if (!next) setPeekItem(null);
        }}
        canEdit={false}
      />


      <SubjectCoachingSection profileId={profile?.id} engagementId={engagementId} />

      {profile && profile.role !== "coach" ? (
        <OneOnOneBrief
          open={prepOpen}
          onOpenChange={setPrepOpen}
          profileId={profile.id}
          engagementId={engagementId}
          scopeLabel={engagement.title}
        />
      ) : null}

      {profile && profile.role !== "coach" ? (
        <ReflectDock
          open={askOpen}
          onOpenChange={setAskOpen}
          engagementId={engagementId}
          engagementTitle={engagement.title}
          profileId={profile.id}
          orgId={profile.org_id}
        />
      ) : null}
    </div>
  );
}
