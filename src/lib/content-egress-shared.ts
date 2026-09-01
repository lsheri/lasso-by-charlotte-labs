/**
 * Pure half of the full work sync.
 *
 * Only a workspace that chose full openness, with the content switch on, and
 * whose latest choice was made against the current wording, ever has its work
 * itself leave. Everything else is marked with a plain reason and stays put.
 */

import { CONSENT_TEXT_VERSION } from "./data-consent-shared";

/** How many items one content sweep takes. */
export const CONTENT_BATCH_SIZE = 50;

/** Path on the same base the event sync already posts to. */
export const CONTENT_INGEST_PATH = "/api/public/ingest-content";

export type ContentSkipReason = "below_tier_d" | "switch_off" | "pre_dc_v3";

export type OrgPosture = {
  org_id: string;
  org_name?: string | null;
  tier: string | null;
  tier_d_switch: boolean | null;
  ledger_version: number | null;
  /** The wording the latest org choice was made against. */
  consent_text_version: string | null;
};

/** 'dc-v3' -> 3. Anything unreadable counts as older than current. */
export function textVersionNumber(version: string | null | undefined): number {
  const match = /^dc-v(\d+)$/.exec(version ?? "");
  return match ? Number(match[1]) : 0;
}

export const CURRENT_TEXT_VERSION_NUMBER = textVersionNumber(CONSENT_TEXT_VERSION);

export type Eligibility = { ok: true } | { ok: false; reason: ContentSkipReason };

/** The whole bar, in one place. */
export function contentEligibility(posture: OrgPosture | undefined | null): Eligibility {
  if (!posture || posture.tier !== "d") return { ok: false, reason: "below_tier_d" };
  if (!posture.tier_d_switch) return { ok: false, reason: "switch_off" };
  if (textVersionNumber(posture.consent_text_version) < CURRENT_TEXT_VERSION_NUMBER) {
    return { ok: false, reason: "pre_dc_v3" };
  }
  return { ok: true };
}

export type ContentTurn = { turn_no: number; role: string; content: string; ts?: string | null };

export type WorkItemRow = {
  id: string;
  org_id: string;
  owner_id: string;
  title: string;
  captured_at: string;
  created_at_source?: string | null;
  meta?: unknown;
};

export type WorkSample = {
  sample_uuid: string;
  workspace_ref: string;
  workspace_name: string | null;
  person_key: string | null;
  work_item_ref: string;
  work_item_title: string;
  output_kind: string | null;
  created_ts: string;
  turns: ContentTurn[];
  analysis_summary: string | null;
  declared: Record<string, unknown>;
  consent_tier: "d";
  consent_ledger_version: number | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** What one item looks like when a full-openness workspace shares it. */
export function mapWorkSampleForEgress(
  item: WorkItemRow,
  input: {
    posture: OrgPosture;
    turns: ContentTurn[];
    analysisSummary?: string | null;
    personKey?: string | null;
  },
): WorkSample {
  const meta = asRecord(item.meta);
  const declared = asRecord(meta["declared"]);
  const workflow = asRecord(meta["workflow"]);
  const outcome = asRecord(meta["coach_outcome"]);
  const outputKind = typeof declared["output_kind"] === "string" ? declared["output_kind"] : null;

  return {
    sample_uuid: item.id,
    workspace_ref: item.org_id,
    workspace_name: input.posture.org_name ?? null,
    person_key: input.personKey ?? null,
    work_item_ref: item.id,
    work_item_title: item.title,
    output_kind: outputKind,
    created_ts: item.created_at_source || item.captured_at,
    turns: [...input.turns].sort((a, b) => a.turn_no - b.turn_no),
    analysis_summary: input.analysisSummary ?? null,
    declared: {
      ...declared,
      ...(Object.keys(workflow).length > 0 ? { workflow } : {}),
      ...(Object.keys(outcome).length > 0 ? { coach_outcome: outcome } : {}),
    },
    consent_tier: "d",
    consent_ledger_version: input.posture.ledger_version ?? null,
  };
}

export type ContentPlanEntry =
  | { kind: "send"; id: string; sample: WorkSample }
  | { kind: "skip"; id: string; reason: ContentSkipReason };

/** Nothing below the bar can enter a batch, by construction. */
export function planContentBatch(
  items: WorkItemRow[],
  input: {
    postures: Map<string, OrgPosture>;
    turnsByItem: Map<string, ContentTurn[]>;
    analysisByItem?: Map<string, string>;
    personKeyByItem?: Map<string, string | null>;
  },
): ContentPlanEntry[] {
  return items.map((item) => {
    const posture = input.postures.get(item.org_id);
    const verdict = contentEligibility(posture);
    if (!verdict.ok) return { kind: "skip", id: item.id, reason: verdict.reason };
    return {
      kind: "send",
      id: item.id,
      sample: mapWorkSampleForEgress(item, {
        posture: posture as OrgPosture,
        turns: input.turnsByItem.get(item.id) ?? [],
        analysisSummary: input.analysisByItem?.get(item.id) ?? null,
        personKey: input.personKeyByItem?.get(item.id) ?? null,
      }),
    };
  });
}
