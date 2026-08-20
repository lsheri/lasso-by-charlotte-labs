import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Sparkle } from "lucide-react";

import { Input } from "@/components/ui/input";
import { EngagementDecisions } from "@/components/decisions/EngagementDecisions";
import { EngagementLineage } from "@/components/peek/EngagementLineage";
import { OneOnOneBrief } from "@/components/oneonone/OneOnOneBrief";
import { CaptureCoverage } from "@/components/common/CaptureCoverage";
import { EditEngagementDialog } from "@/components/engagements/EditEngagementDialog";
import { WorkstreamCard } from "@/components/engagements/WorkstreamCard";
import { EngagementBriefSection } from "@/components/engagements/EngagementBriefSection";
import { SharedWithSection } from "@/components/engagements/SharedWithSection";
import { FirmChecksCard } from "@/components/coaching/FirmChecksCard";
import { InviteDialog } from "@/components/invites/InviteDialog";
import { SubjectCoachingSection } from "@/components/coaching/SubjectCoachingSection";
import { AnalysisLens } from "@/components/reflect/AnalysisLens";
import { ReflectDock } from "@/components/reflect/ReflectDock";
import { useRegisterAskLasso } from "@/components/reflect/ask-lasso-context";
import { TaskWorkflow, type WorkflowElement } from "@/components/work/TaskWorkflow";
import { useProfile } from "@/hooks/use-profile";
import { isBusinessOrg } from "@/hooks/use-profile";
import { useMyEngagementMembership } from "@/hooks/use-engagement-membership";
import { useEngagementPage, useEngagementSlice } from "@/hooks/use-engagement-page";
import { useEngagementCoaches } from "@/hooks/use-coach-share";
import { supabase } from "@/integrations/supabase/client";
import { clientDisplayName, engagementDisplayCode, engagementDisplayTitle } from "@/lib/clients";
import { INVITE_ADMIN_ONLY_LINE } from "@/lib/invites-shared";

type TaskWithWork = {
  id: string;
  name: string;
  owner_id: string;
  detail: string | null;
  work_item_tasks: {
    step_no: number | null;
    step_confirmed: boolean;
    work_items: WorkflowElement["work_items"] | null;
  }[];
};

export function EngagementPage({ engagementId }: { engagementId: string }) {
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const [aboutOpen, setAboutOpen] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const [analyseOpen, setAnalyseOpen] = useState(false);
  const [prepOpen, setPrepOpen] = useState(false);
  const [taskName, setTaskName] = useState("");
  const [error, setError] = useState<string | null>(null);
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

  async function addTask(event: React.FormEvent) {
    event.preventDefault();
    if (!profile || !taskName.trim()) return;
    setError(null);
    const { error: e } = await supabase
      .from("tasks")
      .insert({ engagement_id: engagementId, owner_id: profile.id, name: taskName.trim() });
    if (e) {
      setError(e.message);
      return;
    }
    setTaskName("");
    await queryClient.invalidateQueries({ queryKey: ["engagement-tasks", engagementId] });
  }

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
            <h1 className="page-title">{engagementDisplayTitle(engagement)}</h1>
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
              <Sparkle className="h-3.5 w-3.5" aria-hidden /> Ask Lasso
            </button>
          ) : null}
          {profile && profile.role !== "coach" ? (
            <button
              type="button"
              onClick={() => setAnalyseOpen(true)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:text-foreground"
            >
              Analyse this engagement
            </button>
          ) : null}
        </div>

        <CaptureCoverage
          profileId={profile?.id}
          itemCount={mappedItemCount}
          scopeLabel="this engagement"
          isOwner={profile?.role !== "coach"}
        />

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {profile && profile.role !== "coach" && !isQuickFolder && hasCoaches ? (
            <a
              href="#shared-with"
              className="rounded-full border border-accent bg-accent-soft px-3 py-1 font-mono text-[11px] uppercase tracking-[0.08em] text-foreground transition-colors hover:opacity-80"
            >
              Share with a coach
            </a>
          ) : null}
          {profile && profile.role !== "coach" && !isQuickFolder ? (
            <a
              href="#shared-with"
              className="rounded-full border border-border bg-card px-3 py-1 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:text-foreground"
            >
              {(coaches.data ?? []).length === 0
                ? "Not shared with anyone"
                : `Shared with ${coaches.data?.length} coach${(coaches.data?.length ?? 0) === 1 ? "" : "es"}`}
            </a>
          ) : null}
          {membership.data?.isMember ? <EditEngagementDialog engagement={engagement} /> : null}
          <button
            type="button"
            onClick={() => setAboutOpen((v) => !v)}
            className="rounded-full border border-border bg-card px-3 py-1 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:text-foreground"
          >
            About this engagement {aboutOpen ? "−" : "+"}
          </button>
          {profile?.role === "admin" && !isQuickFolder ? (
            <InviteDialog
              engagementId={engagementId}
              trigger={
                <button
                  type="button"
                  className="rounded-full border border-border bg-card px-3 py-1 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:text-foreground"
                >
                  {hasCoaches ? "Invite a new coach" : "Invite a coach"}
                </button>
              }
            />
          ) : null}
          {profile && profile.role !== "coach" ? (
            <button
              type="button"
              onClick={() => setPrepOpen(true)}
              className="rounded-full border border-border bg-card px-3 py-1 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:text-foreground"
            >
              Prepare a 1:1
            </button>
          ) : null}
        </div>

        {profile &&
        profile.role !== "coach" &&
        profile.role !== "admin" &&
        isBusinessOrg(profile) &&
        !isQuickFolder ? (
          <p className="mt-2 text-xs text-muted-foreground">{INVITE_ADMIN_ONLY_LINE}</p>
        ) : null}

        {aboutOpen ? (
          <div className="mt-3 space-y-3 rounded-[var(--radius)] border border-border bg-card px-5 py-4 shadow-card">
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
          </div>
        ) : null}
      </header>

      {profile && profile.role !== "coach" ? (
        <EngagementBriefSection
          engagementId={engagementId}
          profileId={profile.id}
          orgId={profile.org_id}
          taskIds={(tasksQuery.data ?? []).map((task) => task.id)}
          hasMappedWork={(tasksQuery.data ?? []).some(
            (task) => (task.work_item_tasks ?? []).length > 0,
          )}
        />
      ) : null}

      <section>
        <h2 className="micro-label">Workstreams</h2>
        <div className="mt-3 space-y-2">
          {(tasksQuery.data ?? []).map((task) => {
            const elements: WorkflowElement[] = task.work_item_tasks
              .filter((link) => link.work_items !== null)
              .map((link) => ({
                step_no: link.step_no,
                step_confirmed: link.step_confirmed,
                work_items: { ...link.work_items!, work_item_tasks: [] },
              }));
            const canEdit =
              !!profile &&
              profile.role !== "coach" &&
              elements.every((e) => e.work_items.owner_id === profile.id);
            return (
              <WorkstreamCard
                key={task.id}
                task={task}
                engagementId={engagementId}
                elements={elements}
                canEdit={canEdit}
                profile={profile}
                onChanged={async () => {
                  await queryClient.invalidateQueries({
                    queryKey: ["engagement-tasks", engagementId],
                  });
                }}
              />
            );
          })}

          <form onSubmit={addTask} className="pt-2">
            <Input
              value={taskName}
              onChange={(e) => setTaskName(e.target.value)}
              placeholder="Add a workstream and press enter"
            />
          </form>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
      </section>

      <SubjectCoachingSection profileId={profile?.id} engagementId={engagementId} />

      {profile && profile.role !== "coach" ? (
        <SharedWithSection
          engagementId={engagementId}
          orgId={profile.org_id}
          quickFolder={isQuickFolder}
          personalOrg={!isBusinessOrg(profile)}
        />
      ) : null}

      <FirmChecksCard
        orgId={profile?.org_id}
        authorProfileId={profile?.id}
        role={profile?.role}
        engagementId={engagementId}
      />

      {profile && profile.role !== "coach" ? (
        <EngagementDecisions
          engagementId={engagementId}
          profileId={profile.id}
          canEdit={profile.role !== "coach"}
        />
      ) : null}

      {profile && profile.role !== "coach" ? (
        <EngagementLineage engagementId={engagementId} profileId={profile.id} />
      ) : null}

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
        <AnalysisLens
          open={analyseOpen}
          onOpenChange={setAnalyseOpen}
          target={{
            kind: "engagement",
            id: engagementId,
            title: engagement.title,
            itemCount: mappedItemCount,
          }}
          profileId={profile.id}
          orgId={profile.org_id}
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
