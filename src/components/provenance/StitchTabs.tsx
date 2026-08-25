import { Plus, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { stitchTabLabel, tabsNewestFirst } from "@/lib/span-replay";
import type { AuditStitch } from "@/lib/span-provenance.functions";
import { spanStatusClass } from "@/lib/span-status-style";

export const DELETE_CONFIRM_LINE = "Removes this question and its answer. The work is untouched.";

/**
 * Every question asked about this anchor, newest first. The rail is the history
 * of the loop: clicking one replays what was circled and where the answer came
 * from, and only the owner of the circled work can take one back out.
 */
export function StitchTabs({
  stitches,
  activeId,
  canDelete,
  onSelect,
  onNew,
  onCopyLink,
  onDelete,
}: {
  stitches: AuditStitch[];
  activeId: string | null;
  canDelete: boolean;
  onSelect: (stitch: AuditStitch) => void;
  onNew: () => void;
  onCopyLink: (stitch: AuditStitch) => void;
  onDelete: (stitch: AuditStitch) => void;
}) {
  const [confirming, setConfirming] = useState<string | null>(null);
  const tabs = tabsNewestFirst(stitches);

  return (
    <div
      data-testid="stitch-tabs"
      className="flex shrink-0 items-center gap-1.5 overflow-x-auto border-b border-border px-4 py-2"
    >
      <Button
        type="button"
        size="sm"
        variant="outline"
        data-testid="stitch-tab-new"
        onClick={onNew}
        className="shrink-0"
      >
        <Plus className="mr-1 h-3.5 w-3.5" aria-hidden />
        New question
      </Button>
      {tabs.map((stitch) => (
        <div key={stitch.id} className="relative shrink-0">
          <div
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
              activeId === stitch.id
                ? "border-accent bg-accent-soft text-foreground"
                : "border-border text-muted-foreground"
            }`}
          >
            <button
              type="button"
              data-testid={`stitch-tab-${stitch.id}`}
              onClick={() => onSelect(stitch)}
              className="flex items-center gap-1.5"
            >
              <span
                aria-hidden
                className={`h-1.5 w-1.5 rounded-full nb-stitch-status ${spanStatusClass(stitch.status)}`}
                style={{ backgroundColor: "currentColor" }}
              />
              {stitchTabLabel(stitch)}
            </button>
            <button
              type="button"
              data-testid={`stitch-tab-copy-${stitch.id}`}
              onClick={() => onCopyLink(stitch)}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              Copy link
            </button>
            {canDelete ? (
              <button
                type="button"
                aria-label="Remove this question"
                data-testid={`stitch-tab-delete-${stitch.id}`}
                onClick={() => setConfirming((prev) => (prev === stitch.id ? null : stitch.id))}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            ) : null}
          </div>
          {confirming === stitch.id ? (
            <div
              data-testid={`stitch-tab-confirm-${stitch.id}`}
              className="absolute right-0 top-full z-20 mt-1 w-56 rounded-[var(--radius-md)] border border-border bg-card p-2 shadow-md"
            >
              <p className="text-xs text-muted-foreground">{DELETE_CONFIRM_LINE}</p>
              <div className="mt-2 flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    setConfirming(null);
                    onDelete(stitch);
                  }}
                >
                  Remove
                </Button>
                <button
                  type="button"
                  onClick={() => setConfirming(null)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Keep
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
