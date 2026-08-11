import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useEngagements } from "@/hooks/use-engagements";
import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { logEvent } from "@/lib/telemetry";
import type { WorkItemRow } from "@/lib/work-types";

type TaskRow = { id: string; name: string };

export function MapDialog({
  item,
  groupItems,
  open,
  onOpenChange,
}: {
  item: WorkItemRow | null;
  groupItems?: WorkItemRow[] | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: profile } = useProfile();
  const { data: engagements } = useEngagements(profile?.id);
  const queryClient = useQueryClient();
  const [engagementId, setEngagementId] = useState<string | null>(null);
  const [newTask, setNewTask] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: tasks } = useQuery({
    queryKey: ["tasks", engagementId],
    enabled: Boolean(engagementId),
    queryFn: async (): Promise<TaskRow[]> => {
      const { data, error: taskError } = await supabase
        .from("tasks")
        .select("id, name")
        .eq("engagement_id", engagementId as string)
        .order("position", { ascending: true });
      if (taskError) throw taskError;
      return data ?? [];
    },
  });

  function reset() {
    setEngagementId(null);
    setNewTask("");
    setError(null);
  }

  async function mapToTask(taskId: string) {
    if (!item || !profile) return;
    setPending(true);
    setError(null);

    // A conversation maps as a unit: transcript and every attachment together.
    const targets = groupItems && groupItems.length > 0 ? groupItems : [item];
    const ids = targets.map((t) => t.id);

    const cleanup = await supabase.from("work_item_tasks").delete().in("work_item_id", ids);
    if (cleanup.error) {
      setError(cleanup.error.message);
      setPending(false);
      return;
    }

    const link = await supabase
      .from("work_item_tasks")
      .insert(ids.map((workItemId) => ({ work_item_id: workItemId, task_id: taskId })));
    if (link.error) {
      setError(link.error.message);
      setPending(false);
      return;
    }

    const update = await supabase.from("work_items").update({ visibility: "mapped" }).in("id", ids);
    if (update.error) {
      setError(update.error.message);
      setPending(false);
      return;
    }

    for (const target of targets) {
      logEvent("workitem.mapped", profile.org_id, { type: target.type, source: target.source });
    }
    await queryClient.invalidateQueries({ queryKey: ["work-items"] });
    await queryClient.invalidateQueries({ queryKey: ["engagement"] });
    setPending(false);
    onOpenChange(false);
    reset();
  }

  async function createAndMap() {
    if (!engagementId || !profile || !newTask.trim()) return;
    setPending(true);
    const { data, error: createError } = await supabase
      .from("tasks")
      .insert({ engagement_id: engagementId, owner_id: profile.id, name: newTask.trim() })
      .select("id")
      .maybeSingle();
    if (createError || !data) {
      setError(createError?.message ?? "Could not create the task.");
      setPending(false);
      return;
    }
    setNewTask("");
    await queryClient.invalidateQueries({ queryKey: ["tasks", engagementId] });
    await mapToTask(data.id);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="page-title">Map to a task</DialogTitle>
        </DialogHeader>

        {item ? (
          <div className="-mt-2 flex min-w-0 items-center gap-2">
            <TypeIcon item={item} size="sm" />
            <p className="min-w-0 truncate text-sm text-muted-foreground">
              {item.title}
              {groupItems && groupItems.length > 1
                ? ` · whole conversation (${groupItems.length} items)`
                : ""}
            </p>
          </div>
        ) : null}

        {!engagementId ? (
          <div className="space-y-2">
            <p className="micro-label">Choose an engagement</p>
            {(engagements ?? []).map((engagement) => (
              <button
                key={engagement.id}
                type="button"
                onClick={() => setEngagementId(engagement.id)}
                className="flex w-full items-center gap-2 rounded-[var(--radius)] border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-accent-soft"
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: `var(${engagementHue(engagement.id)})` }}
                  aria-hidden
                />
                <span className="font-mono text-xs text-muted-foreground">{engagement.code}</span>
                <span className="text-sm text-foreground">{engagement.title}</span>
              </button>
            ))}
            {engagements && engagements.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Create an engagement in the sidebar first.
              </p>
            ) : null}
          </div>
        ) : (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setEngagementId(null)}
              className="micro-label text-accent-deep"
            >
              ← Engagements
            </button>
            <p className="micro-label">Choose a task</p>
            {(tasks ?? []).map((task) => (
              <button
                key={task.id}
                type="button"
                disabled={pending}
                onClick={() => void mapToTask(task.id)}
                className="w-full rounded-[var(--radius)] border border-border bg-card px-4 py-3 text-left text-sm text-foreground transition-colors hover:bg-accent-soft"
              >
                {task.name}
              </button>
            ))}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void createAndMap();
              }}
              className="flex gap-2 pt-2"
            >
              <Input
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                placeholder="Or type a new task name"
              />
              <Button type="submit" disabled={pending || !newTask.trim()}>
                Add
              </Button>
            </form>
          </div>
        )}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </DialogContent>
    </Dialog>
  );
}
