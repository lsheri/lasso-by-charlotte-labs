import { MoreHorizontal } from "lucide-react";

import { PencilHatch } from "@/components/notebook/marks";
import { useDraftDecisions } from "@/components/decisions/DraftDecisionsButton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { analysisPreset } from "@/lib/analysis-presets";
import { isBriefItem } from "@/lib/brief-shared";
import { isDeliverableType } from "@/lib/lineage-shared";
import { DELETE_LABEL } from "@/components/work/DeleteWorkItemDialog";
import { REMOVE_LABEL } from "@/components/work/RemoveFromEngagementDialog";
import { SHIP_ACTION_LABEL } from "@/lib/shipped-work-shared";
import type { WorkItemRow } from "@/lib/work-types";

/** The peek's analyses, opened by preset so no button ever dead-ends. */
export type PeekAnalysisPreset =
  | "verification"
  | "verification_thread"
  | "decision_origin"
  | "decision_origin_thread";

/** One set of names, in one order, on every surface the peek is mounted on. */
export const PEEK_WORK_ARTIFACT_LABEL = "Work Artifact";
export const PEEK_WORK_DATE_LABEL = "Work date";
export const PEEK_MAKE_PRIVATE_LABEL = "Make private";

export function PencilAction({
  seed,
  onClick,
  children,
}: {
  seed: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="nb-pencil-cta nb-pencil-cta--sm"
      data-seed={seed}
    >
      <PencilHatch seed={seed} />
      <span>{children}</span>
    </button>
  );
}

/**
 * PASS 129 — the peek's actions read at the top, in one fixed order. Primary
 * work sits in the row; the quieter and heavier actions live behind one control.
 */
export function PeekActionBar({
  item,
  group,
  canEdit,
  owned,
  engagementId,
  onMap,
  onWorkDate,
  onMakePrivate,
  onAnalyse,
  onWorkArtifact,
  onShip,
  onBrief,
  onRemove,
  onDelete,
}: {
  item: WorkItemRow;
  group?: WorkItemRow[] | undefined;
  canEdit: boolean;
  owned: boolean;
  engagementId?: string | undefined;
  onMap?: ((item: WorkItemRow, group?: WorkItemRow[]) => void) | undefined;
  onWorkDate?: ((item: WorkItemRow) => void) | undefined;
  onMakePrivate?: ((item: WorkItemRow) => void) | undefined;
  onAnalyse?: ((item: WorkItemRow, preset: PeekAnalysisPreset) => void) | undefined;
  onWorkArtifact?: (() => void) | undefined;
  onShip: () => void;
  onBrief: () => void;
  onRemove: () => void;
  onDelete: () => void;
}) {
  const isThread = item.type === "ai_thread";
  const isDeliverable = isDeliverableType(item.type);
  const { busy, draft } = useDraftDecisions(item.id);

  // Labels are read from the registry, never written out here.
  const factCheckLabel =
    analysisPreset(isThread ? "verification_thread" : "verification")?.label ?? "";
  const decisionsLabel = analysisPreset("decision_origin")?.label ?? "";

  const showFactCheck = canEdit && Boolean(onAnalyse) && (isThread || isDeliverable);
  const showDecisions = canEdit && Boolean(onAnalyse) && (isThread || isDeliverable);
  const readable = isThread || isDeliverable;

  return (
    <div
      data-testid="peek-action-bar"
      className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3"
    >
      {canEdit && onMap ? (
        <PencilAction seed="peek-map" onClick={() => onMap(item, group)}>
          {item.visibility === "mapped" ? "Remap" : "Map to a workstream"}
        </PencilAction>
      ) : null}
      {showFactCheck ? (
        <PencilAction
          seed="peek-verify"
          onClick={() => onAnalyse?.(item, isThread ? "verification_thread" : "verification")}
        >
          {factCheckLabel}
        </PencilAction>
      ) : null}
      {showDecisions ? (
        <PencilAction
          seed="peek-decisions"
          onClick={() =>
            onAnalyse?.(item, isThread ? "decision_origin_thread" : "decision_origin")
          }
        >
          {decisionsLabel}
        </PencilAction>
      ) : null}

      <div className="ml-auto">
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="More actions"
            className="rounded-full border border-border bg-card p-1.5 text-muted-foreground transition-colors hover:text-foreground"
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            {onWorkArtifact ? (
              <DropdownMenuItem onSelect={() => onWorkArtifact()}>
                {PEEK_WORK_ARTIFACT_LABEL}
              </DropdownMenuItem>
            ) : null}
            {owned && isDeliverable ? (
              <DropdownMenuItem onSelect={() => onShip()}>{SHIP_ACTION_LABEL}</DropdownMenuItem>
            ) : null}
            {canEdit && onWorkDate ? (
              <DropdownMenuItem onSelect={() => onWorkDate(item)}>
                {PEEK_WORK_DATE_LABEL}
              </DropdownMenuItem>
            ) : null}
            {canEdit ? (
              <DropdownMenuItem onSelect={() => onBrief()}>
                {isBriefItem(item) ? "Change what this briefs" : "Mark as the brief"}
              </DropdownMenuItem>
            ) : null}
            {canEdit && readable ? (
              <DropdownMenuItem disabled={busy} onSelect={() => draft()}>
                {isThread
                  ? "Find decisions in this conversation"
                  : "Find decisions in this document"}
              </DropdownMenuItem>
            ) : null}
            {canEdit && onMakePrivate && item.visibility !== "private" ? (
              <DropdownMenuItem onSelect={() => onMakePrivate(item)}>
                {PEEK_MAKE_PRIVATE_LABEL}
              </DropdownMenuItem>
            ) : null}
            {owned ? <DropdownMenuSeparator /> : null}
            {owned && engagementId ? (
              <DropdownMenuItem onSelect={() => onRemove()}>{REMOVE_LABEL}</DropdownMenuItem>
            ) : null}
            {owned ? (
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => onDelete()}
              >
                {DELETE_LABEL}
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
