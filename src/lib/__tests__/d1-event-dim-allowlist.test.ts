import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { ALL_EVENT_DIM_KEYS, EVENT_DIM_KEYS, guardEventDims } from "../event-dim-allowlist";

/**
 * The live vocabulary, read out of the events table for every stamped event
 * outside workboard.*, grouped by family. Nothing here may be dropped.
 */
const LIVE_KEYS_BY_FAMILY: Record<string, readonly string[]> = {
  admin: ["panels_shown"],
  analysis: [
    "claims",
    "confirm_step",
    "cost_band",
    "cost_bucket",
    "deliverable_kind",
    "error_class",
    "handoff_parse",
    "handoffs_emitted",
    "items_read",
    "items_read_bucket",
    "outcome",
    "preset",
    "reason_class",
    "scope_type",
    "status",
    "suppressed",
    "suppressed_bucket",
    "tokens_in_bucket",
  ],
  archive: ["had_results", "matched", "result_count", "results"],
  canvas: ["direction", "from", "link_band", "method", "node_band", "shelf_band", "to"],
  capture: [
    "client_name",
    "client_version",
    "duration_band",
    "freshness_band",
    "had_code_blocks",
    "had_files",
    "had_images",
    "had_tables",
    "hour_band",
    "language",
    "prompt_len_band",
    "protocol_version",
    "push_size_band",
    "response_len_band",
    "tool_code_execution",
    "tool_file_tools",
    "tool_other",
    "tool_web_search",
    "weekday",
  ],
  chatlib: ["filter", "how", "selected", "vendor", "view"],
  client: ["engagements", "error_name", "fingerprint", "items", "route_class", "source", "unplaced"],
  demo: [],
  coach: ["role"],
  coachlink: ["access_level", "basis", "relation", "scope"],
  coachnote: ["by", "newest_age_band", "notes_shown_band", "surface"],
  connector: [
    "age_filter",
    "auth_mode",
    "connected_count",
    "from",
    "had_connector",
    "imported",
    "page_index",
    "scope",
    "surface",
    "toolkit",
    "total_count",
    "type_filter",
  ],
  consent: ["choice"],
  decision: ["edited", "status", "surface"],
  document: ["changed", "checked", "reason", "source"],
  engagement: [
    "access",
    "brief_files",
    "brief_skipped",
    "content",
    "created",
    "from",
    "had_conversation",
    "has_client",
    "preset",
    "quick_folder",
    "result",
    "scope",
    "state",
    "view",
    "width_bucket",
  ],
  extract: ["cost_bucket", "mode", "tokens_in_bucket"],
  findit: ["considered", "entry", "found", "had_quote", "mode", "result_band", "scope"],
  handoff: ["artifact_kind", "from_tool", "to_tool"],
  home: [],
  import: ["last_screen", "tier", "vendor"],
  invite: ["delivered", "reason", "variant"],
  link: [
    "action",
    "considered",
    "cost_bucket",
    "count",
    "relation",
    "scope",
    "source",
    "surface",
    "tokens_in_bucket",
  ],
  mcp: [
    "attachment_count",
    "attachment_versions",
    "degraded_refusals",
    "has_suggestion",
    "mode",
    "rejected_attachments",
    "suggestion_outcome",
    "target",
    "tool",
    "vendor",
    "windowed",
  ],
  model: ["model_id", "model_raw", "model_switched", "task_class", "turn_band", "vendor", "via"],
  onboarding: ["count"],
  oneonone: ["kind"],
  org: ["org_type"],
  perf: [
    "dom_ready_ms",
    "duration_ms",
    "fcp_ms",
    "lcp_ms",
    "load_ms",
    "name",
    "phase",
    "route_class",
    "state",
    "surface",
    "ttfb_ms",
  ],
  presence: ["engagement_count_band", "week_start"],
  profile: ["from_role", "same_org", "to_role"],
  reflect: [
    "context_mode",
    "finish_reason",
    "preset",
    "quote_repairs",
    "scope",
    "suppressed_quotes",
    "tier2_items",
    "truncated",
    "unmatched_quotes",
  ],
  thread: ["has_revision_loop", "role_alternation", "turn_band"],
  work: ["action", "on_board", "piece_kind", "vendor"],
  workflow: ["item_count"],
  workitem: ["channel", "source", "type"],
};

const LIVE_KEYS_BY_EVENT: Record<string, readonly string[]> = {
  "chatlib.panel_opened": ["panel"],
  "reflect.trail_opened": ["read_band", "also_in_band", "not_read_band"],
  "work.filter_changed": ["filter", "selected", "result_band"],
  "work.import_menu_opened": [],
  "work.panel_opened": ["panel"],
  "work.preview_mode_changed": ["mode", "kind"],
  "demo.step_completed": ["step", "engagement"],
  "demo.tour_skipped": ["step"],
  "demo.filter_changed": ["tool"],
  "landing.section_jumped": ["section"],
  "landing.proof_link_opened": ["step", "target"],
  "landing.proof_turn_toggled": ["turn", "state"],
};

/** Every name in the canonical union, read as data rather than as wording. */
function unionEventNames(): string[] {
  const source = readFileSync("src/lib/telemetry-shared.ts", "utf8");
  const union = source.slice(0, source.indexOf("export type TelemetryDims"));
  return [...new Set([...union.matchAll(/\|\s*"([a-z0-9_]+\.[a-z0-9_]+)"/g)].map((m) => m[1]!))];
}

describe("the runtime dim allowlist", () => {
  it("drops nothing that is emitted today", () => {
    const dropped: string[] = [];
    for (const name of Object.keys(EVENT_DIM_KEYS)) {
      const family = name.split(".")[0]!;
      const live = LIVE_KEYS_BY_EVENT[name] ?? LIVE_KEYS_BY_FAMILY[family];
      if (!live) continue;
      const dims = Object.fromEntries(live.map((key) => [key, "value"]));
      const kept = guardEventDims(name, dims).dims;
      for (const key of live) {
        if (!(key in kept)) dropped.push(`${name}.${key}`);
      }
    }
    expect(dropped).toEqual([]);
  });

  it("covers every name in the canonical union", () => {
    const missing = unionEventNames().filter(
      (name) => !Object.prototype.hasOwnProperty.call(ALL_EVENT_DIM_KEYS, name),
    );
    expect(missing).toEqual([]);
  });

  it("drops an unlisted key without dropping the event", () => {
    const result = guardEventDims("org.created", {
      org_type: "firm",
      client_name_typed_by_hand: "Artemis Connection",
    });
    expect(result.keep).toBe(true);
    expect(result.dims).toEqual({ org_type: "firm" });
  });
});

describe("unit 7 answer_retried", () => {
  it("keeps answer_retried on reflect.message_sent", () => {
    const kept = guardEventDims("reflect.message_sent", { answer_retried: true, finish_reason: "stop" }).dims;
    expect(kept).toMatchObject({ answer_retried: true, finish_reason: "stop" });
  });
  it("keeps scope_source on reflect.message_sent and drops an unlisted dimension", () => {
    const kept = guardEventDims("reflect.message_sent", { scope_source: "board_pick", picked_count: 2 }).dims;
    expect(kept).toEqual({ scope_source: "board_pick" });
  });
  it("keeps card and input_mode on landing.usecase_played and drops anything else", () => {
    expect(EVENT_DIM_KEYS["landing.usecase_played"]).toEqual(["card", "input_mode"]);
    const kept = guardEventDims("landing.usecase_played", { card: "every_number", input_mode: "tap", title: "x" }) as Record<string, unknown>;
    expect(kept).toMatchObject({ keep: true, dims: { card: "every_number", input_mode: "tap" } });
    expect((kept["dims"] as Record<string, unknown>)["title"]).toBeUndefined();
  });
});
