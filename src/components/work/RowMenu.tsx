import { MoreHorizontal } from "lucide-react";

import { useDraftDecisions } from "@/components/decisions/DraftDecisionsButton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  const isThread = item.type === "ai_thread";
  if (!isThread) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="More actions"
        className="rounded-full border border-border bg-card p-1.5 text-muted-foreground transition-colors hover:text-foreground"
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuItem disabled={busy} onSelect={() => draft()}>
          {busy ? "Reading this conversation…" : "Find decisions in this conversation"}
        </DropdownMenuItem>
        {onFluency ? (
          <DropdownMenuItem onSelect={() => onFluency(item)}>
            Analyse this conversation
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
