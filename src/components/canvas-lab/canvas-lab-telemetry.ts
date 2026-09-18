import { logEvent } from "@/lib/telemetry";

export type LabNodeEventKind = "source" | "ai_work" | "human_judgment" | "decision" | "deliverable" | "draft_thread";
export type LabJudgmentEventType = "added_constraint" | "corrected_ai" | "rejected_option" | "requested_evidence" | "changed_direction" | "accepted_but_rewrote";
export type LabOwnershipEvent = "yours" | "teammate" | "draft";

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
export function noteWorkboardRelationship(orgId: string | undefined, action: "started" | "created" | "removed" | "cancelled" | "rejected"): void {
  if (orgId) logEvent("workboard.relationship_changed", orgId, { action });
}
export function noteWorkboardReviewOpened(orgId: string | undefined, format: "thread" | "document" | "deck" | "sheet"): void {
  if (orgId) logEvent("workboard.review_opened", orgId, { format });
}
export function noteWorkboardTrailSelected(orgId: string | undefined, group: "context" | "ai_work" | "human_judgment" | "decisions", focus: "exact" | "item"): void {
  if (orgId) logEvent("workboard.trail_item_selected", orgId, { group, focus });
}
export function noteWorkboardCardMenuOpened(orgId: string | undefined, nodeKind: LabNodeEventKind, ownership: LabOwnershipEvent): void {
  if (orgId) logEvent("workboard.card_menu_opened", orgId, { node_kind: nodeKind, ownership });
}

export type WorkboardPersistEntity = "board" | "frame" | "node" | "relationship";
export type WorkboardPersistAction = "create" | "update" | "archive" | "restore";

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