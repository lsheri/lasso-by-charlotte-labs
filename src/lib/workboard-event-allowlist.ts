/**
 * Server-side guard for Workboard events.
 *
 * The Workboard helpers in src/components/canvas-lab/canvas-lab-telemetry.ts
 * send a small, closed set of names and dim keys. Anything else arriving on a
 * `workboard.*` name is either a mistake or content, so it never gets stored.
 */

import type { TelemetryDims } from "./telemetry-shared";

/** Every workboard event name mapped to the exact dim keys its helper sends. */
export const WORKBOARD_EVENT_DIMS: Readonly<Record<string, readonly string[]>> = {
  "workboard.opened": ["via", "bundles"],
  "workboard.rail_toggled": ["state"],
  "workboard.zoom_changed": ["direction", "method"],
  "workboard.view_fitted": ["via"],
  // LIFT (lift-v1): what kind of work was lifted, and expanded. Counts only, never reading time.
  "workboard.work_lifted": ["kind"],
  "workboard.work_lift_expanded": ["kind"],
  "workboard.work_trail_opened": ["kind"],
  // S2 (10 Nov): stickies on the work. Where and on what, never who, never how long.
  "workboard.sticky_created": ["anchor_kind", "work_kind", "assigned", "visibility"],
  "workboard.sticky_removed": ["anchor_kind"],
  "workboard.sticky_opened": ["from"],
  // S4b: done from the sticky or from the inbox, and reopened. Never who, never how long it took.
  "workboard.sticky_done": ["via"],
  "workboard.sticky_reopened": [],
  "workboard.deck_expanded": ["state", "slides_band"],
  "workboard.face_toggled": ["face", "scope"],
  "workboard.node_moved": ["kind", "via"],
  "workboard.ask_moved": ["to", "draft"],
  // COV-1 (9 Nov): choice and route for H7 hand-offs; held for a question held while an answer finishes.
  "workboard.ask_view": ["action", "draft", "choice", "route", "held"],
  "workboard.pasted": ["what", "outcome", "via"],
  "workboard.pinned_chat_opened": ["draft"],
  "workboard.node_created": ["kind", "judgment_type", "via"],
  "workboard.node_deleted": ["kind"],
  "workboard.node_edited": ["kind"],
  "workboard.record_visibility_changed": ["action", "record_kind"],
  "workboard.relationship_changed": ["action", "relation"],
  "workboard.review_opened": ["format"],
  "workboard.ledger_opened": ["via"],
  "workboard.trail_item_selected": ["group", "focus"],
  "workboard.card_menu_opened": ["node_kind", "ownership"],
  "workboard.board_menu_opened": ["target", "via"],
  "workboard.change_saved": ["entity", "action"],
  "workboard.save_failed": ["entity", "reason"],
  "workboard.conflict_resolved": ["entity", "choice"],
  "workboard.live_applied": ["trigger"],
  "workboard.offline": ["duration"],
  "workboard.element_resized": ["element_kind", "method", "axis"],
  "workboard.drop_prompt_answered": ["answer"],
  "workboard.structure_toggled": ["state"],
  "workboard.example_viewed": ["via"],
  "workboard.display_mode_toggled": ["mode"],
  "workboard.card_content_viewed": ["kind", "via"],
  "workboard.save_error_resolved": ["entity", "choice"],
  "workboard.context_changed": ["action"],
  "workboard.undo_used": ["action", "direction"],
  "workboard.work_added": ["source", "via", "count", "shared"],
  "workboard.add_work_source_opened": ["source"],
  "workboard.workstream_drawn": ["claimed", "asked"],
  "workboard.workstream_created": ["via", "claimed"],
  "workboard.region_named": ["state", "claimed", "fill_family", "fill_strength"],
  "workboard.section_created": ["via", "fill_family", "fill_strength"],
  "workboard.section_filled": ["fill_family", "fill_strength", "via"],
  "workboard.section_moved": ["frames", "cards"],
  "workboard.section_removed": [],
  "workboard.section_marker_set": ["kind", "preset", "via"],
  "workboard.section_marker_cleared": [],
  "workboard.section_shifted": ["direction"],
  "workboard.board_jumped": ["to"],
  "workboard.document_created": ["via"],
  "workboard.reference_file_added": ["matched", "via"],
  "workboard.bundle_toggled": ["state", "pieces", "via"],
  "workboard.mention_created": ["surface", "count_band"],
  "workboard.annotation_changed": [
    "kind",
    "action",
    "anchor_kind",
    "visibility",
    "length_band",
    "is_reply",
  ],
} as const;

const SAFE_VALUE = /^[a-z0-9_.:-]{1,40}$/;

export function isWorkboardEvent(name: string): boolean {
  return name.startsWith("workboard.");
}

function valueAllowed(value: unknown): boolean {
  if (typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "string") return SAFE_VALUE.test(value);
  return false;
}

export type WorkboardGuardResult = { keep: false } | { keep: true; dims: TelemetryDims };

/**
 * Drops unknown workboard events entirely, and strips unknown dim keys, unsafe
 * values and any `payload` from the ones that stay.
 */
export function guardWorkboardEvent(name: string, dims: TelemetryDims): WorkboardGuardResult {
  const allowed = WORKBOARD_EVENT_DIMS[name];
  if (!allowed) {
    console.warn("[telemetry] dropped unknown workboard event");
    return { keep: false };
  }
  const clean: TelemetryDims = {};
  for (const key of allowed) {
    if (key === "payload") continue;
    if (!Object.prototype.hasOwnProperty.call(dims, key)) continue;
    const value = dims[key];
    if (valueAllowed(value)) clean[key] = value as TelemetryDims[string];
  }
  return { keep: true, dims: clean };
}
