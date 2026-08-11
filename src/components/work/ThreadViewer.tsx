import { useQuery } from "@tanstack/react-query";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DraftDecisionsButton } from "@/components/decisions/DraftDecisionsButton";
import { supabase } from "@/integrations/supabase/client";
import { vendorLabel } from "@/lib/conversation-shared";
import type { WorkItemRow } from "@/lib/work-types";

type Turn = {
  id: string;
  turn_no: number;
  role: string;
  content: string;
  ts: string | null;
  model?: string | null;
};

function turnTime(ts: string | null): string | null {
  if (!ts) return null;
  const date = new Date(ts);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString();
}

export function ThreadViewer({
  item,
  open,
  onOpenChange,
}: {
  item: WorkItemRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: turns, error } = useQuery({
    queryKey: ["turns", item?.id],
    enabled: Boolean(item && open),
    queryFn: async (): Promise<Turn[]> => {
      const { data, error: turnsError } = await supabase
        .from("turns")
        .select("id, turn_no, role, content, ts, model")
        .eq("work_item_id", item?.id as string)
        .order("turn_no", { ascending: true });
      if (turnsError) throw turnsError;
      return (data ?? []) as Turn[];
    },
  });

  const meta = item?.source_meta ?? null;
  const model = meta?.model ?? null;
  const metaBits = [
    meta?.skills_used && meta.skills_used.length > 0
      ? `Skills: ${meta.skills_used.join(", ")}`
      : null,
    meta?.thinking_level && meta.thinking_level !== "none"
      ? `Thinking: ${meta.thinking_level}`
      : null,
    meta?.research_mode && meta.research_mode !== "none"
      ? `Research: ${meta.research_mode.replace("_", " ")}`
      : null,
    meta?.notes ?? null,
  ].filter((bit): bit is string => Boolean(bit));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="page-title">{item?.title ?? "Thread"}</DialogTitle>
        </DialogHeader>

        {item?.source_vendor || model ? (
          <p className="-mt-2 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
            {vendorLabel(item?.source_vendor ?? meta?.vendor)}
            {model ? ` · ${model}` : ""}
          </p>
        ) : null}
        {metaBits.length > 0 ? (
          <p className="text-xs text-muted-foreground">{metaBits.join(" · ")}</p>
        ) : null}

        {error ? <p className="text-sm text-destructive">{(error as Error).message}</p> : null}

        {item?.content_fidelity === "summary" ? (
          <p className="rounded-[var(--radius)] border border-border bg-secondary/60 px-4 py-3 text-sm text-foreground">
            Copilot exports contain summaries, not full replies. For work that matters, paste the
            conversation for full fidelity.
          </p>
        ) : null}

        <div className="space-y-5">
          {(turns ?? []).map((turn) =>
            turn.role === "user" ? (
              <div key={turn.id} className="flex flex-col items-end">
                <div className="micro-label mb-1">
                  Turn {turn.turn_no} · {turn.role}
                  {turnTime(turn.ts) ? ` · ${turnTime(turn.ts)}` : ""}
                </div>
                <div className="max-w-[85%] whitespace-pre-wrap rounded-[var(--radius)] bg-primary px-4 py-3 font-mono text-xs leading-relaxed text-primary-foreground">
                  {turn.content}
                </div>
              </div>
            ) : (
              <div key={turn.id}>
                <div className="micro-label mb-1">
                  Turn {turn.turn_no} · {turn.role}
                  {turn.model ? ` · ${turn.model}` : model ? ` · ${model}` : ""}
                  {turnTime(turn.ts) ? ` · ${turnTime(turn.ts)}` : ""}
                </div>
                <div className="max-w-[85%] whitespace-pre-wrap rounded-[var(--radius)] border border-border bg-card px-4 py-3 font-mono text-xs leading-relaxed text-foreground shadow-card">
                  {turn.content}
                </div>
              </div>
            ),
          )}
          {turns && turns.length === 0 ? (
            <p className="text-sm text-muted-foreground">No turns stored for this item.</p>
          ) : null}
        </div>

        {item && item.type === "ai_thread" ? (
          <div className="mt-6 flex justify-end border-t border-border pt-4">
            <DraftDecisionsButton workItemId={item.id} />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
