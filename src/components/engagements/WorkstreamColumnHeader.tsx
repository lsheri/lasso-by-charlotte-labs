import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MoreHorizontal } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { closeEpisode, episodeForTask, setEpisodeObjective } from "@/lib/episodes.functions";
import {
  deleteWorkstream,
  moveWorkstream,
  renameWorkstream,
} from "@/lib/workstreams.functions";
import {
  closeEpisodePayload,
  isStatusChoice,
  STATUS_MENU,
  WORKSTREAM_STATUS_LABELS,
} from "@/lib/workstream-status";

const TASK_LINE_PLACEHOLDER = "What is this piece of work meant to do?";

export const DELETE_WORKSTREAM_LINE =
  "Work mapped here goes back to your Work pile unless it is mapped in another workstream or engagement. Nothing is deleted.";

/**
 * A column head on the canvas: what the workstream is, how much sits in it,
 * whether its sequence is confirmed, and one quiet menu holding everything the
 * stacked card used to show inline. No filled primary lives here.
 */
export function WorkstreamColumnHeader({
  task,
  count,
  confirmed,
  profile,
  canOrder,
  engagementId,
  canMoveLeft,
  canMoveRight,
  onReset,
}: {
  task: { id: string; name: string; owner_id: string; detail: string | null };
  count: number;
  confirmed: boolean;
  profile: { id: string; org_id: string; role: string } | null | undefined;
  canOrder: boolean;
  engagementId: string;
  canMoveLeft: boolean;
  canMoveRight: boolean;
  onReset: () => void;
}) {
  const queryClient = useQueryClient();
  const load = useServerFn(episodeForTask);
  const saveObjective = useServerFn(setEpisodeObjective);
  const close = useServerFn(closeEpisode);
  const rename = useServerFn(renameWorkstream);
  const move = useServerFn(moveWorkstream);
  const remove = useServerFn(deleteWorkstream);

  const [editingLine, setEditingLine] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(task.name);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: episode } = useQuery({
    queryKey: ["episode", task.id],
    queryFn: () => load({ data: { task_id: task.id } }),
  });

  const isOwner = Boolean(profile && task.owner_id === profile.id);
  const isOpen = episode?.status === "open";
  const objective = episode?.objective ?? null;

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["episode", task.id] });
  }

  /** Every surface that reads this engagement's columns has to hear about it. */
  async function refreshWorkstreams() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["engagement-tasks", engagementId] }),
      queryClient.invalidateQueries({ queryKey: ["engagement-page", engagementId] }),
      queryClient.invalidateQueries({ queryKey: ["work-items"] }),
      queryClient.invalidateQueries({ queryKey: ["brief-tasks"] }),
    ]);
  }

  const canManage = Boolean(profile && profile.role !== "coach" && task.owner_id === profile.id);

  async function onMove(direction: "left" | "right") {
    setPending(true);
    try {
      await move({ data: { task_id: task.id, engagement_id: engagementId, direction } });
      await refreshWorkstreams();
    } finally {
      setPending(false);
    }
  }

  async function onRename() {
    const name = nameDraft.trim();
    if (!name || name === task.name) {
      setEditingName(false);
      return;
    }
    setPending(true);
    try {
      await rename({ data: { task_id: task.id, name } });
      await refreshWorkstreams();
      setEditingName(false);
    } finally {
      setPending(false);
    }
  }

  async function onDelete() {
    setPending(true);
    try {
      await remove({ data: { task_id: task.id } });
      setConfirmDelete(false);
      await refreshWorkstreams();
    } finally {
      setPending(false);
    }
  }

  async function onPick(value: string) {
    if (!episode || !isStatusChoice(value)) return;
    setPending(true);
    try {
      await close({ data: closeEpisodePayload(episode.id, value, profile?.id) });
      await refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <header className="flex flex-col gap-1.5 border-b border-border px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        {editingName ? (
          <form
            className="flex min-w-0 flex-1 gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void onRename();
            }}
          >
            <Input
              autoFocus
              aria-label={`Rename ${task.name}`}
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={() => void onRename()}
              className="h-8 text-sm"
            />
            <Button type="submit" size="sm" variant="outline" disabled={pending}>
              Save
            </Button>
          </form>
        ) : (
          <p className="min-w-0 flex-1 text-sm font-medium text-foreground">{task.name}</p>
        )}
        <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
          {count}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={`Workstream options for ${task.name}`}
            className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {episode ? (
              <>
                <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                  Status
                </DropdownMenuLabel>
                {STATUS_MENU.map((option) => (
                  <DropdownMenuItem
                    key={option.value}
                    disabled={
                      !option.enabled ||
                      pending ||
                      !isOwner ||
                      (option.value === "open" ? isOpen : !isOpen)
                    }
                    onSelect={() => void onPick(option.value)}
                  >
                    {option.label}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled={!isOwner} onSelect={() => setEditingLine(true)}>
                  Edit the task line
                </DropdownMenuItem>
              </>
            ) : null}
            <DropdownMenuItem disabled={!canOrder || !confirmed} onSelect={onReset}>
              Reset to date order
            </DropdownMenuItem>
            {canManage ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => {
                    setNameDraft(task.name);
                    setEditingName(true);
                  }}
                >
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!canMoveLeft || pending}
                  onSelect={() => void onMove("left")}
                >
                  Move left
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!canMoveRight || pending}
                  onSelect={() => void onMove("right")}
                >
                  Move right
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={() => setConfirmDelete(true)}
                >
                  Delete workstream
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {episode ? (
          <span className="rounded-full border border-border bg-secondary px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
            {WORKSTREAM_STATUS_LABELS[episode.status] ?? episode.status}
          </span>
        ) : null}
        {confirmed ? (
          <span className="rounded-full border border-border bg-secondary px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
            Confirmed sequence
          </span>
        ) : null}
      </div>

      {task.detail ? (
        <p className="whitespace-pre-wrap text-xs text-muted-foreground">{task.detail}</p>
      ) : null}

      {episode && editingLine ? (
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
      ) : objective ? (
        <p className="text-xs text-muted-foreground">{objective}</p>
      ) : null}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {task.name}?</AlertDialogTitle>
            <AlertDialogDescription>{DELETE_WORKSTREAM_LINE}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Keep it</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={(e) => {
                e.preventDefault();
                void onDelete();
              }}
            >
              Delete workstream
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </header>
  );
}
