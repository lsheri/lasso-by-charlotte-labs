import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Sparkle } from "lucide-react";

import { Input } from "@/components/ui/input";
import { EngagementDecisions } from "@/components/decisions/EngagementDecisions";
import { EngagementLineage } from "@/components/peek/EngagementLineage";
import { OneOnOneBrief } from "@/components/oneonone/OneOnOneBrief";
import { CaptureCoverage } from "@/components/common/CaptureCoverage";
import { EditEngagementDialog } from "@/components/engagements/EditEngagementDialog";
import { EpisodePanel } from "@/components/episodes/EpisodePanel";
import { EditTaskDialog } from "@/components/engagements/EditTaskDialog";
import { EngagementBriefSection } from "@/components/engagements/EngagementBriefSection";
import { InviteDialog } from "@/components/invites/InviteDialog";
import { SubjectCoachingSection } from "@/components/coaching/SubjectCoachingSection";
import { AnalysisLens } from "@/components/reflect/AnalysisLens";
import { ReflectDock } from "@/components/reflect/ReflectDock";
import { TaskWorkflow, type WorkflowElement } from "@/components/work/TaskWorkflow";
import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";

type Engagement = {
  id: string;
  code: string;
  title: string;
  client_label: string | null;
  brief: string | null;
  brief_by: string | null;
  term_label: string | null;
};

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

  const engagementQuery = useQuery({
    queryKey: ["engagement", engagementId],
    queryFn: async (): Promise<Engagement | null> => {
      const { data, error: e } = await supabase
        .from("engagements")
        .select("id, code, title, client_label, brief, brief_by, term_label")
        .eq("id", engagementId)
        .maybeSingle();
      if (e) throw e;
      return data;
    },
  });

  const tasksQuery = useQuery({
    queryKey: ["engagement-tasks", engagementId],
    queryFn: async (): Promise<TaskWithWork[]> => {
      const { data, error: e } = await supabase
        .from("tasks")
        .select(
          "id, name, owner_id, detail, work_item_tasks(step_no, step_confirmed, work_items(id, owner_id, title, type, source, visibility, captured_at, content_ref, created_at_source, work_date, content_fidelity, meta))",
        )
        .eq("engagement_id", engagementId)
        .order("position", { ascending: true });
      if (e) throw e;
      return (data ?? []) as unknown as TaskWithWork[];
    },
  });

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

  const engagement = engagementQuery.data;

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
    return <p className="text-sm text-destructive">{(engagementQuery.error as Error).message}</p>;
  }

  if (!engagement) {
    return <p className="text-sm text-muted-foreground">This engagement isn't available.</p>;
  }

  return (
    <div>
      <header className="mb-8">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
          <div className="min-w-0">
            <h1 className="page-title">{engagement.title}</h1>
            <p className="mt-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
              {engagement.code}
              {engagement.term_label ? ` · ${engagement.term_label}` : ""}
            </p>
          </div>
          {profile && profile.role !== "coach" ? (
            <button
              type="button"
              onClick={() => setAskOpen(true)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:text-foreground"
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
          {profile?.role !== "coach" ? <EditEngagementDialog engagement={engagement} /> : null}
          <button
            type="button"
            onClick={() => setAboutOpen((v) => !v)}
            className="rounded-full border border-border bg-card px-3 py-1 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:text-foreground"
          >
            About this engagement {aboutOpen ? "−" : "+"}
          </button>
          {profile?.role === "admin" || profile?.role === "lead" ? (
            <InviteDialog
              engagementId={engagementId}
              trigger={
                <button
                  type="button"
                  className="rounded-full border border-border bg-card px-3 py-1 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:text-foreground"
                >
                  Invite a coach
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

        {aboutOpen ? (
          <div className="mt-3 space-y-3 rounded-[var(--radius)] border border-border bg-card px-5 py-4 shadow-card">
            <div>
              <p className="micro-label">Client</p>
              <p className="mt-1 text-sm text-foreground">{engagement.client_label ?? "Not set"}</p>
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
        <h2 className="micro-label">Tasks</h2>
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
              <div
                key={task.id}
                className="rounded-[var(--radius)] border border-border bg-card px-4 py-3 shadow-card"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{task.name}</p>
                    {task.detail ? (
                      <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                        {task.detail}
                      </p>
                    ) : null}
                  </div>
                  {profile && profile.role !== "coach" && task.owner_id === profile.id ? (
                    <EditTaskDialog task={task} engagementId={engagementId} />
                  ) : null}
                </div>
                <EpisodePanel taskId={task.id} profileId={profile?.id} />
                <div className="mt-2">
                  <TaskWorkflow
                    taskId={task.id}
                    elements={elements}
                    canEdit={canEdit}
                    orgId={profile?.org_id}
                    onChanged={async () => {
                      await queryClient.invalidateQueries({
                        queryKey: ["engagement-tasks", engagementId],
                      });
                    }}
                  />
                </div>
              </div>
            );
          })}

          <form onSubmit={addTask} className="pt-2">
            <Input
              value={taskName}
              onChange={(e) => setTaskName(e.target.value)}
              placeholder="Add a task and press enter"
            />
          </form>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
      </section>

      <SubjectCoachingSection profileId={profile?.id} engagementId={engagementId} />

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
