import { useState } from "react";
import { toast } from "sonner";

import { PeekPanel } from "@/components/peek/PeekPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MarkBriefDialog } from "@/components/work/MarkBriefDialog";
import { PasteThreadDialog } from "@/components/work/PasteThreadDialog";
import { UploadFilesButton } from "@/components/work/UploadFilesButton";
import { setBriefRole, useBriefs, useInvalidateBriefs } from "@/hooks/use-briefs";
import { useWorkItems } from "@/hooks/use-work-items";
import { supabase } from "@/integrations/supabase/client";
import { logEvent } from "@/lib/telemetry";
import type { WorkItemRow } from "@/lib/work-types";

const DISMISS_PREFIX = "lasso.brief_share_nudge.";

function dismissed(engagementId: string): boolean {
  try {
    return window.localStorage.getItem(DISMISS_PREFIX + engagementId) === "1";
  } catch {
    return false;
  }
}

function dismiss(engagementId: string): void {
  try {
    window.localStorage.setItem(DISMISS_PREFIX + engagementId, "1");
  } catch {
    /* remembering a dismissal is a nicety, not a requirement */
  }
}

/**
 * The brief sits above the workflow because it is what the work was asked to
 * do. Marking it is a statement about the work; it shares nothing by itself.
 */
export function EngagementBriefSection({
  engagementId,
  profileId,
  orgId,
  taskIds,
  hasMappedWork,
}: {
  engagementId: string;
  profileId: string;
  orgId: string;
  taskIds: string[];
  hasMappedWork: boolean;
}) {
  const { data: briefs } = useBriefs(profileId);
  const invalidate = useInvalidateBriefs();
  const [peekOpen, setPeekOpen] = useState(false);
  const [markItem, setMarkItem] = useState<WorkItemRow | null>(null);
  const [pickOpen, setPickOpen] = useState(false);
  const [nudgeGone, setNudgeGone] = useState(() =>
    typeof window === "undefined" ? true : dismissed(engagementId),
  );
  const [sharing, setSharing] = useState(false);

  const brief =
    (briefs ?? []).find(
      (candidate) =>
        (candidate.brief_scope.type === "engagement" &&
          candidate.brief_scope.id === engagementId) ||
        (candidate.brief_scope.type === "task" && taskIds.includes(candidate.brief_scope.id)),
    ) ?? null;

  async function markExisting(item: WorkItemRow) {
    try {
      await setBriefRole(item.id, { type: "engagement", id: engagementId });
      logEvent("brief.marked", orgId, { scope_type: "engagement" });
      await invalidate();
      setPickOpen(false);
      toast.success("Marked as the brief.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function shareBrief() {
    if (!brief || taskIds.length === 0) return;
    setSharing(true);
    try {
      await supabase.from("work_item_tasks").delete().eq("work_item_id", brief.id);
      const { error } = await supabase
        .from("work_item_tasks")
        .insert({ work_item_id: brief.id, task_id: taskIds[0]! });
      if (error) throw error;
      const update = await supabase
        .from("work_items")
        .update({ visibility: "mapped" })
        .eq("id", brief.id);
      if (update.error) throw update.error;
      logEvent("workitem.mapped", orgId, { type: brief.type, source: brief.source });
      await invalidate();
      toast.success("The brief is now shared.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSharing(false);
    }
  }

  if (!brief) {
    return (
      <section className="mb-8 rounded-[var(--radius)] border border-dashed border-accent bg-accent-soft/40 px-5 py-4">
        <h2 className="micro-label micro-label-section">The brief</h2>
        <p className="mt-2 text-sm font-medium text-foreground">Add the brief.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          What was this work supposed to do? An SOW, an assignment, a client request, or your own
          written brief.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={() => setPickOpen(true)}>
            Pick an existing work item
          </Button>
          <UploadFilesButton
            label="Upload the brief"
            onCaptured={async (ids) => {
              const first = ids[0];
              if (!first) return;
              await setBriefRole(first, { type: "engagement", id: engagementId });
              logEvent("brief.marked", orgId, { scope_type: "engagement" });
              await invalidate();
              toast.success("Captured and marked as the brief.");
            }}
          />
          <PasteThreadDialog
            trigger={
              <button
                type="button"
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Paste the brief
              </button>
            }
            onCaptured={async (ids) => {
              const first = ids[0];
              if (!first) return;
              await setBriefRole(first, { type: "engagement", id: engagementId });
              logEvent("brief.marked", orgId, { scope_type: "engagement" });
              await invalidate();
              toast.success("Captured and marked as the brief.");
            }}
          />
        </div>
        <PickBriefDialog open={pickOpen} onOpenChange={setPickOpen} onPick={markExisting} />
      </section>
    );
  }

  const showNudge = hasMappedWork && brief.visibility !== "mapped" && !nudgeGone;

  return (
    <section className="mb-8">
      <div className="rounded-[var(--radius)] border border-accent bg-card px-5 py-4 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="micro-label micro-label-section">The brief</h2>
            <p className="mt-1.5 text-sm font-medium text-foreground">{brief.title}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              What this work was asked to do.
              {brief.brief_scope.type === "task" ? " Marked against one task." : ""}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setPeekOpen(true)}
              className="text-xs font-medium text-accent-deep transition-opacity hover:opacity-70"
            >
              Open
            </button>
            <button
              type="button"
              onClick={() => setMarkItem(brief)}
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Change
            </button>
          </div>
        </div>

        {showNudge ? (
          <div className="mt-4 border-t border-border pt-3">
            <p className="text-sm text-muted-foreground">
              Your coach will not see what you were asked to do. Share the brief too?
            </p>
            <div className="mt-2 flex items-center gap-3">
              <button
                type="button"
                disabled={sharing || taskIds.length === 0}
                onClick={() => void shareBrief()}
                className="text-xs font-medium text-accent-deep transition-opacity hover:opacity-70 disabled:opacity-50"
              >
                {sharing ? "Sharing…" : "Share the brief"}
              </button>
              <button
                type="button"
                onClick={() => {
                  dismiss(engagementId);
                  setNudgeGone(true);
                }}
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Not now
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <PeekPanel entry={brief} open={peekOpen} onOpenChange={setPeekOpen} canEdit />
      <MarkBriefDialog
        item={markItem}
        open={markItem !== null}
        onOpenChange={(open) => {
          if (!open) setMarkItem(null);
        }}
      />
    </section>
  );
}

function PickBriefDialog({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (item: WorkItemRow) => void | Promise<void>;
}) {
  const { data } = useWorkItems();
  const [term, setTerm] = useState("");
  const items = (data?.items ?? []).filter((item) =>
    item.title.toLowerCase().includes(term.trim().toLowerCase()),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="page-title">Pick the brief</DialogTitle>
        </DialogHeader>
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search your work"
        />
        <div className="max-h-[50vh] space-y-1 overflow-y-auto pr-1">
          {items.slice(0, 60).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => void onPick(item)}
              className="w-full rounded-[var(--radius)] border border-border bg-card px-3 py-2 text-left text-sm text-foreground transition-colors hover:border-accent"
            >
              <span className="block truncate">{item.title}</span>
            </button>
          ))}
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing here matches that.</p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
