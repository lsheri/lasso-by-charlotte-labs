import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useBriefs, setBriefRole, useInvalidateBriefs } from "@/hooks/use-briefs";
import { useEngagements } from "@/hooks/use-engagements";
import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { briefScopeOf, type BriefScope } from "@/lib/brief-shared";
import { logEvent } from "@/lib/telemetry";
import { logV2 } from "@/lib/telemetry-v2";
import type { WorkItemRow } from "@/lib/work-types";
import { engagementLabel } from "@/lib/clients";

type TaskRow = { id: string; name: string; engagement_id: string };

function keyOf(scope: BriefScope): string {
  return `${scope.type}:${scope.id}`;
}

/**
 * Marking is a statement about the work, not a change to who can see it.
 * One item briefs exactly one scope: this board, or one workstream on it.
 */
export function MarkBriefDialog({
  item,
  engagementId,
  open,
  onOpenChange,
}: {
  item: WorkItemRow | null;
  /** The one board this item can brief. The dialog never offers another. */
  engagementId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: profile } = useProfile();
  const { data: engagements } = useEngagements(profile?.id);
  const { data: briefs } = useBriefs(profile?.id);
  const invalidate = useInvalidateBriefs();
  const [pending, setPending] = useState(false);

  const tasksQuery = useQuery({
    queryKey: ["brief-tasks", profile?.id, engagementId],
    enabled: Boolean(profile?.id) && open,
    queryFn: async (): Promise<TaskRow[]> => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, name, engagement_id")
        .eq("owner_id", profile!.id)
        .eq("engagement_id", engagementId)
        .order("position", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as TaskRow[];
    },
  });

  if (!item) return null;
  const engagement = (engagements ?? []).find((e) => e.id === engagementId) ?? null;
  // Belt and braces: the query already asks for this board only.
  const tasks = (tasksQuery.data ?? []).filter((t) => t.engagement_id === engagementId);
  const engagementScope: BriefScope = { type: "engagement", id: engagementId };
  const current = briefScopeOf(item.meta);
  const takenBy = new Map(
    (briefs ?? [])
      .filter((brief) => brief.id !== item.id)
      .map((brief) => [keyOf(brief.brief_scope), brief.title]),
  );

  const engagementTaken = takenBy.get(keyOf(engagementScope));

  async function apply(scope: BriefScope | null) {
    if (!item || !profile) return;
    setPending(true);
    try {
      await setBriefRole(item.id, scope);
      logEvent(scope ? "brief.marked" : "brief.cleared", profile.org_id, {
        scope_type: scope?.type ?? current?.type ?? "none",
      });
      if (scope) {
        logV2("brief.linked", { scope: scope.type }, { profileId: profile.id, workItemId: item.id });
      }
      await invalidate();
      toast.success(scope ? "Marked as the brief." : "Brief marking removed.");
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="page-title">Mark as the brief</DialogTitle>
        </DialogHeader>

        {engagement ? (
          <>
            <p className="text-sm text-muted-foreground">
              What was <span className="text-foreground">{item.title}</span> the brief for on{" "}
              <span className="text-foreground">{engagementLabel(engagement)}</span>? A brief shapes
              what the AI on this board is told the work was asked to do. Marking it changes nothing
              about who can see it.
            </p>

            <div className="max-h-[50vh] space-y-1 overflow-y-auto pr-1">
              <ChoiceRow
                label="The whole workboard"
                selected={current?.type === "engagement" && current.id === engagement.id}
                note={engagementTaken ? `Already briefed by ${engagementTaken}` : null}
                disabled={pending}
                onSelect={() => void apply(engagementScope)}
              />
              {tasks.map((task) => {
                const scope: BriefScope = { type: "task", id: task.id };
                const taken = takenBy.get(keyOf(scope));
                return (
                  <ChoiceRow
                    key={task.id}
                    label={task.name}
                    indent
                    selected={current?.type === "task" && current.id === task.id}
                    note={taken ? `Already briefed by ${taken}` : null}
                    disabled={pending}
                    onSelect={() => void apply(scope)}
                  />
                );
              })}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">This board could not be read.</p>
        )}

        {current ? (
          <Button variant="outline" disabled={pending} onClick={() => void apply(null)}>
            Remove the brief marking
          </Button>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ChoiceRow({
  label,
  note,
  selected,
  indent = false,
  disabled,
  onSelect,
}: {
  label: string;
  note: string | null;
  selected: boolean;
  indent?: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={`flex w-full items-center justify-between gap-3 rounded-[var(--radius)] border px-3 py-2 text-left text-sm transition-colors disabled:opacity-60 ${
        selected
          ? "border-accent-deep bg-accent-soft text-foreground"
          : "border-border bg-card text-foreground hover:border-accent"
      } ${indent ? "ml-4" : ""}`}
    >
      <span className="min-w-0 truncate">{label}</span>
      <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
        {selected ? "Current brief" : (note ?? "")}
      </span>
    </button>
  );
}
