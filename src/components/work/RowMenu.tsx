import { MoreHorizontal } from "lucide-react";
import { useState } from "react";

import { useDraftDecisions } from "@/components/decisions/DraftDecisionsButton";
import { MarkBriefDialog } from "@/components/work/MarkBriefDialog";
import { DeleteWorkItemDialog, DELETE_LABEL } from "@/components/work/DeleteWorkItemDialog";
import {
  RemoveFromEngagementDialog,
  REMOVE_HELP,
  REMOVE_LABEL,
} from "@/components/work/RemoveFromEngagementDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useProfile } from "@/hooks/use-profile";
import { isBriefItem } from "@/lib/brief-shared";
import type { WorkItemRow } from "@/lib/work-types";

/**
 * The row's quieter actions live behind one control, so the AI actions get a
 * full label instead of competing for row width as muted text.
 */
export function RowMenu({
  item,
  onFluency,
  engagementId,
  onRemoved,
}: {
  item: WorkItemRow;
  onFluency?: ((item: WorkItemRow) => void) | undefined;
  /** Present only where the row is being read inside one engagement. */
  engagementId?: string | undefined;
  onRemoved?: (() => void) | undefined;
}) {
  const { busy, draft } = useDraftDecisions(item.id);
  const [briefOpen, setBriefOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const profile = useProfile();
  const isThread = item.type === "ai_thread";
  const isDeliverable = ["document", "deck", "sheet"].includes(item.type);
  const readable = isThread || ["document", "deck", "sheet"].includes(item.type);
  // Ownership truth, not page truth: coaches never see these two.
  const owned = Boolean(
    profile && profile.role !== "coach" && item.owner_id && item.owner_id === profile.id,
  );

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
          {owned ? <DropdownMenuSeparator /> : null}
          {owned && engagementId ? (
            <DropdownMenuItem
              className="flex-col items-start gap-0.5"
              onSelect={() => setRemoveOpen(true)}
            >
              <span>{REMOVE_LABEL}</span>
              <span className="text-[11px] text-muted-foreground">{REMOVE_HELP}</span>
            </DropdownMenuItem>
          ) : null}
          {owned ? (
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={() => setDeleteOpen(true)}
            >
              {DELETE_LABEL}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      <MarkBriefDialog item={item} open={briefOpen} onOpenChange={setBriefOpen} />
      {owned && engagementId ? (
        <RemoveFromEngagementDialog
          workItemId={item.id}
          title={item.title}
          engagementId={engagementId}
          open={removeOpen}
          onOpenChange={setRemoveOpen}
          onDone={onRemoved}
        />
      ) : null}
      {owned ? (
        <DeleteWorkItemDialog
          workItemId={item.id}
          title={item.title}
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          onDone={onRemoved}
        />
      ) : null}
    </>
  );
}
