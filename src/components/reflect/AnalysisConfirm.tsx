import { useQuery } from "@tanstack/react-query";

import { SourceMark } from "@/components/work/SourceMark";
import { TypeBadge } from "@/components/work/TypeIcon";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useFirmChecks } from "@/hooks/use-firm-checks";
import { supabase } from "@/integrations/supabase/client";
import type { AnalysisPreset } from "@/lib/analysis-presets";
import type { WorkItemRow } from "@/lib/work-types";

/** What a confirm step is pointed at, taken from the run request itself. */
export type ConfirmTarget =
  | { kind: "item"; id: string; title: string; scope: "thread" | "deliverable" }
  | { kind: "engagement"; id: string; title: string; itemCount: number };

export type AnalysisConfirmRequest = {
  preset: AnalysisPreset;
  target: ConfirmTarget;
  /** Called when the person adjusts the selection instead of running. */
  onAdjust?: (() => void) | undefined;
};

type ItemRow = {
  id: string;
  title: string;
  type: WorkItemRow["type"];
  source: WorkItemRow["source"];
  source_vendor: WorkItemRow["source_vendor"];
  source_meta: WorkItemRow["source_meta"];
  meta: WorkItemRow["meta"];
};

/**
 * Step one of running an analysis: what Lasso is about to read, built from the
 * same selection state the run request will send. The Context Audit after the
 * run remains the proof of what was read.
 */
export function AnalysisConfirm({
  request,
  orgId,
  profileId,
  onCancel,
  onConfirm,
}: {
  request: AnalysisConfirmRequest | null;
  orgId?: string | undefined;
  profileId?: string | undefined;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const target = request?.target ?? null;
  const preset = request?.preset ?? null;

  const { data: item } = useQuery({
    queryKey: ["confirm-item", target?.kind === "item" ? target.id : null],
    enabled: target?.kind === "item",
    queryFn: async (): Promise<ItemRow | null> => {
      const { data } = await supabase
        .from("work_items")
        .select("id, title, type, source, source_vendor, source_meta, meta")
        .eq("id", (target as { id: string }).id)
        .maybeSingle();
      return (data ?? null) as ItemRow | null;
    },
  });

  const { data: checks } = useFirmChecks({
    orgId,
    engagementId: target?.kind === "engagement" ? target.id : null,
    subjectProfileId: profileId ?? null,
  });

  if (!request || !preset || !target) return null;

  const isFirmChecks = preset.id === "firm_checks";
  const includesBrief = preset.scope !== "thread";

  return (
    <Dialog open onOpenChange={(next) => (next ? undefined : onCancel())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="page-title text-[19px]">{preset.label}</DialogTitle>
          <DialogDescription>{preset.description}</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            onConfirm();
          }}
          className="space-y-4"
        >
          <div>
            <p className="micro-label mb-2">This will read:</p>
            <ul className="space-y-2">
              {target.kind === "item" ? (
                <li className="flex flex-wrap items-center gap-2 rounded-[var(--radius)] border border-border px-3 py-2">
                  {item ? <SourceMark item={item} /> : null}
                  <span className="min-w-0 break-words text-sm text-foreground">
                    {item?.title ?? target.title}
                  </span>
                  {item ? <TypeBadge item={item} size="sm" /> : null}
                </li>
              ) : (
                <li className="rounded-[var(--radius)] border border-border px-3 py-2 text-sm text-foreground">
                  {target.title}
                  <span className="ml-1 text-muted-foreground">
                    {target.itemCount === 1
                      ? "(1 piece of work mapped into this engagement)"
                      : `(${target.itemCount} pieces of work mapped into this engagement)`}
                  </span>
                </li>
              )}
              {includesBrief ? (
                <li className="rounded-[var(--radius)] border border-border px-3 py-2 text-sm text-muted-foreground">
                  The engagement brief, when one is written.
                </li>
              ) : null}
              {isFirmChecks ? (
                <li className="rounded-[var(--radius)] border border-border px-3 py-2">
                  <p className="micro-label">Checks that apply</p>
                  <ul className="mt-1 space-y-0.5">
                    {(checks ?? []).map((check) => (
                      <li key={check.id} className="text-sm text-foreground">
                        {check.title}
                      </li>
                    ))}
                    {(checks ?? []).length === 0 ? (
                      <li className="text-sm text-muted-foreground">
                        No checks apply to this work yet.
                      </li>
                    ) : null}
                  </ul>
                </li>
              ) : null}
            </ul>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" autoFocus>
              Run analysis
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            {request.onAdjust ? (
              <button
                type="button"
                onClick={request.onAdjust}
                className="text-xs text-accent-deep underline underline-offset-2"
              >
                Adjust what Lasso reads
              </button>
            ) : null}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
