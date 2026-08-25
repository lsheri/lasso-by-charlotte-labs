import { MoreHorizontal, Plus } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RAIL_LABEL } from "@/lib/span-readability";
import { stitchTabFullLabel, tabsNewestFirst } from "@/lib/span-replay";
import type { AuditStitch } from "@/lib/span-provenance.functions";
import { spanStatusClass } from "@/lib/span-status-style";

export const DELETE_CONFIRM_LINE = "Removes this question and its answer. The work is untouched.";

/** How many questions the rail shows before it offers the rest. */
export const RAIL_COLLAPSED_COUNT = 8;

/**
 * Every question asked about this anchor, newest first. The rail is the history
 * of the loop: clicking one replays what was circled and where the answer came
 * from, and only the owner of the circled work can take one back out. The rail
 * wraps rather than scrolls, so the questions are all readable at any width, and
 * the housekeeping opens above everything rather than inside a thin strip.
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
  const [expanded, setExpanded] = useState(false);
  const tabs = tabsNewestFirst(stitches);
  const overflowing = tabs.length > RAIL_COLLAPSED_COUNT;
  const shown = overflowing && !expanded ? tabs.slice(0, RAIL_COLLAPSED_COUNT) : tabs;

  return (
    <div className="shrink-0 border-b border-border px-4 py-2">
      <p className="micro-label micro-label-ai">{RAIL_LABEL}</p>
      <div data-testid="stitch-tabs" className="mt-1.5 flex flex-wrap items-center gap-1.5">
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
        {shown.map((stitch) => {
          const active = activeId === stitch.id;
          const label = stitchTabFullLabel(stitch);
          return (
            <div key={stitch.id} className="group relative">
              <div
                className={`flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
                  active
                    ? "border-accent bg-accent-soft text-foreground"
                    : "border-border text-muted-foreground"
                }`}
              >
                <button
                  type="button"
                  data-testid={`stitch-tab-${stitch.id}`}
                  onClick={() => onSelect(stitch)}
                  className="flex min-w-0 items-center gap-1.5"
                  title={label}
                >
                  <span
                    aria-hidden
                    className={`h-1.5 w-1.5 shrink-0 rounded-full nb-stitch-status ${spanStatusClass(stitch.status)}`}
                    style={{ backgroundColor: "currentColor" }}
                  />
                  <span className="truncate max-w-[160px] sm:max-w-[240px] lg:max-w-[320px]">
                    {label}
                  </span>
                </button>
                <Popover
                  open={menu === stitch.id}
                  onOpenChange={(next) => {
                    setConfirming(null);
                    setMenu(next ? stitch.id : null);
                  }}
                >
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      aria-label="More for this question"
                      data-testid={`stitch-tab-menu-${stitch.id}`}
                      className={`shrink-0 rounded-full text-muted-foreground transition-colors hover:text-foreground ${
                        active || menu === stitch.id
                          ? "opacity-100"
                          : "opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
                      }`}
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="end"
                    data-testid={`stitch-tab-overflow-${stitch.id}`}
                    className="w-64 max-w-[calc(100vw-24px)] p-1"
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
                        <p className="break-words text-xs font-medium text-foreground">{label}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{DELETE_CONFIRM_LINE}</p>
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
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          );
        })}
        {overflowing ? (
          <button
            type="button"
            data-testid="stitch-tabs-toggle"
            onClick={() => setExpanded((prev) => !prev)}
            className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            {expanded ? "Fewer" : `All questions (${tabs.length})`}
          </button>
        ) : null}
      </div>
    </div>
  );
}
