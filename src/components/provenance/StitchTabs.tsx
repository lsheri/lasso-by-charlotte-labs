import { MoreHorizontal, Plus } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { RAIL_LABEL } from "@/lib/span-readability";
import { stitchTabLabel, tabsNewestFirst } from "@/lib/span-replay";
import type { AuditStitch } from "@/lib/span-provenance.functions";
import { spanStatusClass } from "@/lib/span-status-style";

export const DELETE_CONFIRM_LINE = "Removes this question and its answer. The work is untouched.";

/**
 * Every question asked about this anchor, newest first. The rail is the history
 * of the loop: clicking one replays what was circled and where the answer came
 * from, and only the owner of the circled work can take one back out. The
 * housekeeping lives behind a small menu on the tab itself, so the rail reads as
 * questions and nothing else.
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
  const [menu, setMenu] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const tabs = tabsNewestFirst(stitches);

  return (
    <div className="shrink-0 border-b border-border px-4 py-2">
      <p className="micro-label micro-label-ai">{RAIL_LABEL}</p>
      <div data-testid="stitch-tabs" className="mt-1.5 flex items-center gap-1.5 overflow-x-auto">
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
        {tabs.map((stitch) => {
          const active = activeId === stitch.id;
          return (
            <div key={stitch.id} className="group relative shrink-0">
              <div
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
                  active
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
                  aria-label="More for this question"
                  data-testid={`stitch-tab-menu-${stitch.id}`}
                  onClick={() => {
                    setConfirming(null);
                    setMenu((prev) => (prev === stitch.id ? null : stitch.id));
                  }}
                  className={`rounded-full text-muted-foreground transition-colors hover:text-foreground ${
                    active || menu === stitch.id
                      ? "opacity-100"
                      : "opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
                  }`}
                >
                  <MoreHorizontal className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>

              {menu === stitch.id ? (
                <div
                  data-testid={`stitch-tab-overflow-${stitch.id}`}
                  className="absolute right-0 top-full z-20 mt-1 w-48 rounded-[var(--radius-md)] border border-border bg-card p-1 shadow-md"
                >
                  <button
                    type="button"
                    data-testid={`stitch-tab-copy-${stitch.id}`}
                    onClick={() => {
                      setMenu(null);
                      onCopyLink(stitch);
                    }}
                    className="block w-full rounded-[var(--radius-sm)] px-2 py-1.5 text-left text-xs text-foreground hover:bg-secondary"
                  >
                    Copy link
                  </button>
                  {canDelete ? (
                    <button
                      type="button"
                      data-testid={`stitch-tab-delete-${stitch.id}`}
                      onClick={() => setConfirming(stitch.id)}
                      className="block w-full rounded-[var(--radius-sm)] px-2 py-1.5 text-left text-xs text-foreground hover:bg-secondary"
                    >
                      Remove
                    </button>
                  ) : null}

                  {confirming === stitch.id ? (
                    <div
                      data-testid={`stitch-tab-confirm-${stitch.id}`}
                      className="mt-1 border-t border-border px-2 pb-1 pt-2"
                    >
                      <p className="text-xs text-muted-foreground">{DELETE_CONFIRM_LINE}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            setConfirming(null);
                            setMenu(null);
                            onDelete(stitch);
                          }}
                        >
                          Remove
                        </Button>
                        <button
                          type="button"
                          onClick={() => {
                            setConfirming(null);
                            setMenu(null);
                          }}
                          className="text-xs text-muted-foreground hover:text-foreground"
                        >
                          Keep
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
