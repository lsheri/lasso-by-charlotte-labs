import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useEngagements } from "@/hooks/use-engagements";
import { useProfile } from "@/hooks/use-profile";
import { useWorkItems } from "@/hooks/use-work-items";
import { supabase } from "@/integrations/supabase/client";
import { SCOPE_MODES, type ContextScope, type ScopeMode } from "@/lib/reflect-shared";
import { engagementDisplayCode, engagementDisplayTitle, engagementLabel } from "@/lib/clients";

const MODE_LABEL: Record<ScopeMode, string> = {
  whole: "Whole record",
  engagements: "Pick engagements",
  tasks: "Pick workstreams",
  items: "Pick work items",
};

export function ScopePicker({
  scope,
  open,
  onOpenChange,
  onSave,
}: {
  scope: ContextScope;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (scope: ContextScope) => void;
}) {
  const { data: profile } = useProfile();
  const { data: engagements } = useEngagements(profile?.id);
  const { data: work } = useWorkItems();
  const [mode, setMode] = useState<ScopeMode>(scope.mode);
  const [ids, setIds] = useState<string[]>(scope.ids);

  const { data: tasks } = useQuery({
    queryKey: ["reflect-tasks", profile?.id],
    enabled: Boolean(profile?.id) && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, name, engagements(code)")
        .eq("owner_id", profile?.id as string)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as {
        id: string;
        name: string;
        engagements: { code: string } | null;
      }[];
    },
  });

  const options: { id: string; label: string }[] =
    mode === "engagements"
      ? (engagements ?? []).map((e) => ({ id: e.id, label: engagementLabel(e) }))
      : mode === "tasks"
        ? (tasks ?? []).map((t) => ({
            id: t.id,
            label: t.engagements
              ? `${engagementDisplayCode(t.engagements) ?? engagementDisplayTitle(t.engagements)} · ${t.name}`
              : t.name,
          }))
        : mode === "items"
          ? (work?.items ?? []).map((i) => ({ id: i.id, label: i.title }))
          : [];

  function toggle(id: string) {
    setIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>What should Reflect look at?</DialogTitle>
        </DialogHeader>
        <div className="flex flex-wrap gap-2">
          {SCOPE_MODES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setIds([]);
              }}
              className={
                m === mode
                  ? "rounded-full bg-accent-soft px-3 py-1 font-mono text-[11px] uppercase tracking-[0.08em] text-accent-deep"
                  : "rounded-full border border-border px-3 py-1 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:text-foreground"
              }
            >
              {MODE_LABEL[m]}
            </button>
          ))}
        </div>

        {mode !== "whole" ? (
          <div className="max-h-72 space-y-1 overflow-y-auto rounded-[var(--radius)] border border-border bg-card p-3">
            {options.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing here yet.</p>
            ) : (
              options.map((option) => (
                <label key={option.id} className="flex items-start gap-3 px-1 py-1.5 text-sm">
                  <Checkbox
                    checked={ids.includes(option.id)}
                    onCheckedChange={() => toggle(option.id)}
                  />
                  <span className="leading-snug">{option.label}</span>
                </label>
              ))
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Everything you have recorded, engagements, workstreams, and every work item you own.
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onSave(mode === "whole" ? { mode: "whole", ids: [] } : { mode, ids });
              onOpenChange(false);
            }}
          >
            Use this scope
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
