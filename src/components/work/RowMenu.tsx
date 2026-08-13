import { MoreHorizontal } from "lucide-react";
import { useState } from "react";

import { useDraftDecisions } from "@/components/decisions/DraftDecisionsButton";
import { MarkBriefDialog } from "@/components/work/MarkBriefDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { isBriefItem } from "@/lib/brief-shared";
import type { WorkItemRow } from "@/lib/work-types";

/**
 * The row's quieter actions live behind one control, so the AI actions get a
 * full label instead of competing for row width as muted text.
 */
export function RowMenu({
  item,
  onFluency,
}: {
  item: WorkItemRow;
  onFluency?: ((item: WorkItemRow) => void) | undefined;
}) {
  const { busy, draft } = useDraftDecisions(item.id);
  const [briefOpen, setBriefOpen] = useState(false);
  const isThread = item.type === "ai_thread";
  const isDeliverable = ["document", "deck", "sheet"].includes(item.type);
  const readable = isThread || ["document", "deck", "sheet"].includes(item.type);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="More actions"
          className="rounded-full border border-border bg-card p-1.5 text-muted-foreground transition-colors hover:text-foreground"
          onClick={(event) => event.stopPropagation()}
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuItem onSelect={() => setBriefOpen(true)}>
            {isBriefItem(item) ? "Change what this briefs" : "Mark as the brief"}
          </DropdownMenuItem>
          {readable ? (
            <DropdownMenuItem disabled={busy} onSelect={() => draft()}>
              {busy
                ? isThread
                  ? "Reading this conversation…"
                  : "Reading this document…"
                : isThread
                  ? "Find decisions in this conversation"
                  : "Find decisions in this document"}
            </DropdownMenuItem>
          ) : null}
          {onFluency && (isThread || isDeliverable) ? (
            <DropdownMenuItem onSelect={() => onFluency(item)}>
              {isThread ? "Analyse this conversation" : "Analyse this work"}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      <MarkBriefDialog item={item} open={briefOpen} onOpenChange={setBriefOpen} />
    </>
  );
}
