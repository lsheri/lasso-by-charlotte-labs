import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Input } from "@/components/ui/input";
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
  work_item_tasks: { work_items: { id: string; title: string } | null }[];
};

export function EngagementPage({ engagementId }: { engagementId: string }) {
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const [aboutOpen, setAboutOpen] = useState(false);
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
        .select("id, name, work_item_tasks(work_items(id, title))")
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
        <h1 className="page-title">{engagement.title}</h1>
        <p className="mt-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
          {engagement.code}
          {engagement.term_label ? ` · ${engagement.term_label}` : ""}
        </p>

        <button
          type="button"
          onClick={() => setAboutOpen((v) => !v)}
          className="mt-4 rounded-full border border-border bg-card px-3 py-1 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:text-foreground"
        >
          About this engagement {aboutOpen ? "−" : "+"}
        </button>

        {aboutOpen ? (
          <div className="mt-3 space-y-3 rounded-[var(--radius)] border border-border bg-card px-5 py-4 shadow-card">
            <div>
              <p className="micro-label">Client</p>
              <p className="mt-1 text-sm text-foreground">{engagement.client_label ?? "—"}</p>
            </div>
            <div>
              <p className="micro-label">Brief</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                {engagement.brief ?? "—"}
              </p>
            </div>
          </div>
        ) : null}
      </header>

      <section>
        <h2 className="micro-label">Tasks</h2>
        <div className="mt-3 space-y-2">
          {(tasksQuery.data ?? []).map((task) => (
            <div
              key={task.id}
              className="rounded-[var(--radius)] border border-border bg-card px-4 py-3 shadow-card"
            >
              <p className="text-sm font-medium text-foreground">{task.name}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {task.work_item_tasks.length === 0 ? (
                  <span className="text-xs text-muted-foreground">No work mapped yet</span>
                ) : (
                  task.work_item_tasks.map((link) =>
                    link.work_items ? (
                      <span
                        key={link.work_items.id}
                        className="max-w-[240px] truncate rounded-full bg-accent-soft px-3 py-1 font-mono text-[11px] tracking-[0.06em] text-accent-deep"
                      >
                        {link.work_items.title}
                      </span>
                    ) : null,
                  )
                )}
              </div>
            </div>
          ))}

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
    </div>
  );
}
