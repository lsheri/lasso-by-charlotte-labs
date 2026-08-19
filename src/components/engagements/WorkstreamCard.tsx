import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { EditTaskDialog } from "@/components/engagements/EditTaskDialog";
import { TaskWorkflow, type WorkflowElement } from "@/components/work/TaskWorkflow";
import { closeEpisode, episodeForTask, setEpisodeObjective } from "@/lib/episodes.functions";
import {
  closeEpisodePayload,
  isCloseChoice,
  REOPEN_UNAVAILABLE_LINE,
  STATUS_EXPLAINER,
  STATUS_EXPLAINER_SEEN_KEY,
  STATUS_MENU,
  WORKSTREAM_STATUS_LABELS,
} from "@/lib/workstream-status";

const TASK_LINE_PLACEHOLDER = "What is this piece of work meant to do?";

function readExplainerSeen(): boolean {
  try {
    return window.localStorage.getItem(STATUS_EXPLAINER_SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

function markExplainerSeen(): void {
  try {
    window.localStorage.setItem(STATUS_EXPLAINER_SEEN_KEY, "1");
  } catch {
    /* the explainer is a courtesy, not a requirement */
  }
}

/**
 * One card per workstream: what it is, what it was meant to do, the records in
 * sequence, and how it ended. The records are listed once, by TaskWorkflow,
 * which owns the confirmed ordering.
 */
export function WorkstreamCard({
  task,
  engagementId,
  elements,
  canEdit,
  profile,
  onChanged,
}: {
  task: { id: string; name: string; owner_id: string; detail: string | null };
  engagementId: string;
  elements: WorkflowElement[];
  canEdit: boolean;
  profile: { id: string; org_id: string; role: string } | null | undefined;
  onChanged: () => Promise<void> | void;
}) {
  const queryClient = useQueryClient();
  const load = useServerFn(episodeForTask);
  const saveObjective = useServerFn(setEpisodeObjective);
  const close = useServerFn(closeEpisode);

  const [editingLine, setEditingLine] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [explainer, setExplainer] = useState(false);

  const { data: episode } = useQuery({
    queryKey: ["episode", task.id],
    queryFn: () => load({ data: { task_id: task.id } }),
  });

  const isOwner = Boolean(profile && task.owner_id === profile.id);
  const canDeclare = Boolean(episode) && episode?.status === "open";

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["episode", task.id] });
  }

  async function onPick(value: string) {
    if (!episode || !isCloseChoice(value)) return;
    setPending(true);
    try {
      await close({ data: closeEpisodePayload(episode.id, value, profile?.id) });
      await refresh();
    } finally {
      setPending(false);
    }
  }

  function openStatusMenu() {
    if (readExplainerSeen()) return;
    setExplainer(true);
    markExplainerSeen();
  }

  const objective = episode?.objective ?? null;

  return (
    <div className="rounded-[var(--radius)] border border-border bg-card px-4 py-3 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 flex-1 text-sm font-medium text-foreground">{task.name}</p>
        <div className="flex shrink-0 items-center gap-1.5">
          {episode ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="Change status"
                disabled={pending || !isOwner}
                onClick={openStatusMenu}
                className="flex items-center gap-1 rounded-full border border-border bg-secondary px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
              >
                {WORKSTREAM_STATUS_LABELS[episode.status] ?? episode.status}
                {isOwner ? <ChevronDown className="h-3 w-3" /> : null}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {STATUS_MENU.map((option) => (
                  <DropdownMenuItem
                    key={option.value}
                    disabled={!option.enabled || pending || (option.enabled && !canDeclare)}
                    onSelect={() => void onPick(option.value)}
                  >
                    {option.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
          {profile && profile.role !== "coach" && task.owner_id === profile.id ? (
            <EditTaskDialog task={task} engagementId={engagementId} />
          ) : null}
        </div>
      </div>

      {explainer ? (
        <p className="mt-1.5 text-xs text-muted-foreground">{STATUS_EXPLAINER}</p>
      ) : null}
      {episode && episode.status !== "open" ? (
        <p className="mt-1.5 text-xs text-muted-foreground">{REOPEN_UNAVAILABLE_LINE}</p>
      ) : null}

      {task.detail ? (
        <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{task.detail}</p>
      ) : null}

      {episode ? (
        <div className="mt-2">
          {editingLine ? (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void (async () => {
                  setPending(true);
                  try {
                    await saveObjective({
                      data: { episode_id: episode.id, objective: draft ?? objective ?? "" },
                    });
                    await refresh();
                    setEditingLine(false);
                    setDraft(null);
                  } finally {
                    setPending(false);
                  }
                })();
              }}
            >
              <Input
                autoFocus
                value={draft ?? objective ?? ""}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={TASK_LINE_PLACEHOLDER}
                className="h-8 text-sm"
              />
              <Button type="submit" size="sm" variant="outline" disabled={pending}>
                Save
              </Button>
            </form>
          ) : (
            <button
              type="button"
              disabled={!isOwner}
              onClick={() => setEditingLine(true)}
              className="w-full truncate rounded-[var(--radius)] px-0 py-1 text-left text-sm text-muted-foreground transition-colors hover:text-foreground disabled:hover:text-muted-foreground"
            >
              {objective ?? (isOwner ? `Task line: ${TASK_LINE_PLACEHOLDER}` : "No task line yet")}
            </button>
          )}
        </div>
      ) : null}

      <div className="mt-2">
        <TaskWorkflow
          taskId={task.id}
          elements={elements}
          canEdit={canEdit}
          orgId={profile?.org_id}
          onChanged={onChanged}
        />
      </div>
    </div>
  );
}