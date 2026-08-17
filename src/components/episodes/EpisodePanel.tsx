import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SourceMark } from "@/components/work/SourceMark";
import {
  closeEpisode,
  episodeForTask,
  setEpisodeObjective,
} from "@/lib/episodes.functions";

const ROLE_LABELS: Record<string, string> = {
  brief: "Brief",
  conversation: "Conversation",
  artifact: "Artifact",
  source: "Source",
  version: "Version",
  evidence: "Evidence",
};

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  delivered: "Delivered",
  accepted: "Accepted",
  abandoned: "Set aside",
  closed: "Closed",
};

/**
 * The quiet grouping. It is not a tracker and it holds no numbers about a
 * person: it is the piece of work, what went into it, and how it ended.
 */
export function EpisodePanel({
  taskId,
  profileId,
}: {
  taskId: string;
  profileId?: string | undefined;
}) {
  const queryClient = useQueryClient();
  const load = useServerFn(episodeForTask);
  const saveObjective = useServerFn(setEpisodeObjective);
  const close = useServerFn(closeEpisode);
  const [objective, setObjective] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const { data: episode } = useQuery({
    queryKey: ["episode", taskId],
    queryFn: () => load({ data: { task_id: taskId } }),
  });

  if (!episode) return null;
  const isOpen = episode.status === "open";

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["episode", taskId] });
  }

  async function onClose(status: "delivered" | "accepted" | "abandoned") {
    if (!episode) return;
    setPending(true);
    try {
      await close({ data: { episode_id: episode.id, status, profile_id: profileId } });
      await refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-3 rounded-[var(--radius)] border border-border bg-secondary/40 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="micro-label">This piece of work</p>
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
          {STATUS_LABELS[episode.status] ?? episode.status}
        </span>
      </div>

      <form
        className="mt-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void (async () => {
            setPending(true);
            try {
              await saveObjective({
                data: { episode_id: episode.id, objective: objective ?? "" },
              });
              await refresh();
            } finally {
              setPending(false);
            }
          })();
        }}
      >
        <Input
          value={objective ?? episode.objective ?? ""}
          onChange={(e) => setObjective(e.target.value)}
          placeholder="What is this piece of work meant to do?"
          className="h-8 text-sm"
        />
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          Save
        </Button>
      </form>

      {episode.items.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {episode.items.map((item) => (
            <li key={item.work_item_id} className="flex min-w-0 items-center gap-2 text-sm">
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                {ROLE_LABELS[item.item_role] ?? item.item_role}
              </span>
              <SourceMark item={{ source: item.source, source_vendor: item.source_vendor }} />
              <span className="min-w-0 truncate text-foreground">{item.title}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">Nothing is attached yet.</p>
      )}

      {isOpen ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={pending} onClick={() => void onClose("delivered")}>
            Delivered
          </Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => void onClose("accepted")}>
            Accepted
          </Button>
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => void onClose("abandoned")}>
            Set aside
          </Button>
        </div>
      ) : null}
    </div>
  );
}
