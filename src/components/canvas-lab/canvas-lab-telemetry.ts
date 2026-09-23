import type { UndoAction, UndoDirection } from "@/components/canvas-lab/canvas-lab-undo";
import { lengthBand } from "@/lib/canvas-lab-annotations-shared";
import type { WorkboardRelation } from "@/lib/canvas-lab-shared";
import { logEvent } from "@/lib/telemetry";

export type LabNodeEventKind = "source" | "ai_work" | "human_judgment" | "decision" | "deliverable" | "draft_thread" | "shape" | "text" | "answer";
export type LabJudgmentEventType = "added_constraint" | "corrected_ai" | "rejected_option" | "requested_evidence" | "changed_direction" | "accepted_but_rewrote";
export type LabOwnershipEvent = "yours" | "teammate" | "draft";
export type LabCardMenuEventKind = LabNodeEventKind | "frame";
export type LabCardMenuOwnershipEvent = LabOwnershipEvent | "shared";
export type WorkboardOpenVia = "header" | "canvas_tab" | "default" | "direct";
export type WorkboardDisplayMode = "sticky" | "preview";
export type WorkboardPreviewKind = "chat" | "document" | "deck" | "html";

export function noteWorkboardOpened(orgId: string | undefined, via: WorkboardOpenVia): void {
  if (orgId) logEvent("workboard.opened", orgId, { via });
}

export function noteWorkboardRail(orgId: string | undefined, state: "collapsed" | "reopened"): void {
  if (orgId) logEvent("workboard.rail_toggled", orgId, { state });
}
export function noteWorkboardNodeCreated(orgId: string | undefined, kind: LabNodeEventKind, judgmentType?: LabJudgmentEventType): void {
  if (orgId) logEvent("workboard.node_created", orgId, { kind, judgment_type: judgmentType ?? "none" });
}
export function noteWorkboardNodeDeleted(orgId: string | undefined, kind: LabNodeEventKind): void {
  if (orgId) logEvent("workboard.node_deleted", orgId, { kind });
}
export function noteWorkboardNodeEdited(orgId: string | undefined, kind: LabNodeEventKind): void {
  if (orgId) logEvent("workboard.node_edited", orgId, { kind });
}
export function noteWorkboardRecordVisibility(orgId: string | undefined, action: "hidden" | "restored", recordKind: "work" | "decision" | "brief"): void {
  if (orgId) logEvent("workboard.record_visibility_changed", orgId, { action, record_kind: recordKind });
}
export function noteWorkboardRelationship(
  orgId: string | undefined,
  action: "started" | "created" | "removed" | "cancelled" | "rejected" | "relation_changed",
  relation?: WorkboardRelation,
): void {
  if (orgId) logEvent("workboard.relationship_changed", orgId, relation ? { action, relation } : { action });
}
export function noteWorkboardReviewOpened(orgId: string | undefined, format: "thread" | "document" | "deck" | "sheet"): void {
  if (orgId) logEvent("workboard.review_opened", orgId, { format });
}
export function noteWorkboardTrailSelected(orgId: string | undefined, group: "context" | "ai_work" | "human_judgment" | "decisions", focus: "exact" | "item"): void {
  if (orgId) logEvent("workboard.trail_item_selected", orgId, { group, focus });
}
export function noteWorkboardCardMenuOpened(orgId: string | undefined, nodeKind: LabCardMenuEventKind, ownership: LabCardMenuOwnershipEvent): void {
  if (orgId) logEvent("workboard.card_menu_opened", orgId, { node_kind: nodeKind, ownership });
}

/** Widened additively for context documents, the trail, and the context area. */
export type WorkboardPersistEntity = "board" | "frame" | "node" | "relationship" | "context_doc" | "trail" | "context_area";
export type WorkboardPersistAction = "create" | "update" | "archive" | "restore" | "added" | "removed" | "created";

/** Phase 3: a durable Workboard change was confirmed. No ids, no content. */
export function noteWorkboardChangeSaved(orgId: string | undefined, entity: WorkboardPersistEntity, action: WorkboardPersistAction): void {
  if (orgId) logEvent("workboard.change_saved", orgId, { entity, action });
}

/** Phase 3: a durable Workboard change failed. Closed reasons only. */
export function noteWorkboardSaveFailed(orgId: string | undefined, entity: WorkboardPersistEntity, reason: "conflict" | "permission" | "network" | "validation" | "unknown"): void {
  if (orgId) logEvent("workboard.save_failed", orgId, { entity, reason });
}

/** Phase 3: a person settled a newer-version conflict. Choice only. */
export function noteWorkboardConflictResolved(orgId: string | undefined, entity: Exclude<WorkboardPersistEntity, "board">, choice: "latest" | "retry"): void {
  if (orgId) logEvent("workboard.conflict_resolved", orgId, { entity, choice });
}

export function noteWorkboardElementResized(orgId: string | undefined, elementKind: "card" | "frame" | "shape" | "text", method: "pointer" | "keyboard" | "fit_content", axis: "horizontal" | "vertical" | "both"): void {
  if (orgId) logEvent("workboard.element_resized", orgId, { element_kind: elementKind, method, axis });
}

/** Canvas Lab polish: how a "Move to" prompt ended. Closed answer only. */
export function noteWorkboardDropPromptAnswered(orgId: string | undefined, answer: "yes" | "keep" | "dismissed"): void {
  if (orgId) logEvent("workboard.drop_prompt_answered", orgId, { answer });
}

export function noteWorkboardStructureToggled(orgId: string | undefined, state: "structured" | "freeform"): void {
  if (orgId) logEvent("workboard.structure_toggled", orgId, { state });
}

/** B3a: the built-in sample board was opened. Entry point only. */
export function noteWorkboardExampleViewed(orgId: string | undefined, via: "header"): void {
  if (orgId) logEvent("workboard.example_viewed", orgId, { via });
}

export function noteWorkboardDisplayModeToggled(orgId: string | undefined, mode: WorkboardDisplayMode): void {
  if (orgId) logEvent("workboard.display_mode_toggled", orgId, { mode });
}

export function noteWorkboardCardContentViewed(orgId: string | undefined, kind: WorkboardPreviewKind, via: "scroll" | "open" = "scroll"): void {
  if (orgId) logEvent("workboard.card_content_viewed", orgId, { kind, via });
}

/** Canvas Lab polish 2c-iv: how a save error ended. Closed choice only. */
export function noteWorkboardSaveErrorResolved(orgId: string | undefined, entity: WorkboardPersistEntity, choice: "retry" | "discard"): void {
  if (orgId) logEvent("workboard.save_error_resolved", orgId, { entity, choice });
}

/** Closed union so later actions can be added without repurposing a field. */
export type WorkboardContextAction = "cleared";

/** Canvas Lab polish 2c-iv: the local context selection changed. Action only. */
export function noteWorkboardContextChanged(orgId: string | undefined, action: WorkboardContextAction): void {
  if (orgId) logEvent("workboard.context_changed", orgId, { action });
}

/** Canvas Lab polish 2c-v: one arranging step taken back or put back. */
export function noteWorkboardUndoUsed(orgId: string | undefined, action: UndoAction, direction: UndoDirection): void {
  if (orgId) logEvent("workboard.undo_used", orgId, { action, direction });
}

/** Where added work came from, and how the panel was reached. No ids, no titles. */
export type WorkAddedSource = "inbox" | "upload" | "connector" | "brief";
export type WorkAddedVia = "header" | "context_menu" | "new_engagement";

/** B2: work landed on the board. Fired once per successful add. */
export function noteWorkboardWorkAdded(orgId: string | undefined, source: WorkAddedSource, via: WorkAddedVia, count: number): void {
  if (orgId) logEvent("workboard.work_added", orgId, { source, via, count });
}

/**
 * B4: one workstream was drawn on the board. How many cards the box claimed,
 * and whether a prompt was shown. No names, no ids.
 */
export function noteWorkboardWorkstreamDrawn(orgId: string | undefined, claimed: number, asked: "true" | "false"): void {
  if (orgId) logEvent("workboard.workstream_drawn", orgId, { claimed, asked });
}

/**
 * W3: a drawn region was named, which makes it a workstream, or had its name
 * taken off, which turns it back into paint. Shape only: a band for how many
 * cards it took in, and the colour family, never the name a person typed.
 */
export function noteWorkboardRegionNamed(
  orgId: string | undefined,
  state: "named" | "cleared",
  claimed: number,
  fill: string | null | undefined,
): void {
  if (!orgId) return;
  const [family = "none", strength = "none"] = (fill ?? "none").split("-");
  logEvent("workboard.region_named", orgId, {
    state,
    claimed: claimed <= 0 ? "0" : claimed <= 4 ? "1-4" : claimed <= 19 ? "5-19" : "20+",
    fill_family: family,
    fill_strength: strength,
  });
}

/**
 * Slice 2a: a highlight or a comment was made, changed or removed. Shape only:
 * no text, no hash, no ids, no author and no role.
 */
export type AnnotationChange = {
  kind: "highlight" | "comment";
  action: "created" | "edited" | "archived";
  anchorKind: "turn" | "item";
  visibility: "just_me" | "engagement";
  /** How long the passage or the written note was, in characters. */
  length: number;
  isReply: boolean;
};

export function noteAnnotationChanged(orgId: string | undefined, change: AnnotationChange): void {
  if (!orgId) return;
  logEvent("workboard.annotation_changed", orgId, {
    kind: change.kind,
    action: change.action,
    anchor_kind: change.anchorKind,
    visibility: change.visibility,
    length_band: lengthBand(change.length),
    is_reply: change.isReply,
  });
}

/** The common highlight case, kept short at every call site. */
export function noteHighlightChanged(
  orgId: string | undefined,
  action: "created" | "archived",
  visibility: "just_me" | "engagement",
  excerptLength: number,
): void {
  noteAnnotationChanged(orgId, {
    kind: "highlight",
    action,
    anchorKind: "turn",
    visibility,
    length: excerptLength,
    isReply: false,
  });
}