/**
 * Pass 113: the Work Artifact. The overlay that used to be "the journey" keeps
 * its spine and gains the part a firm actually learns from: how the models were
 * used, the prompts that did the work, how it was checked, who decided what,
 * the reusable process, and what the record honestly does not show.
 *
 * Browser safe half: the shape, the labels, the honesty gate. The gate is the
 * whole point. A quote that is not verbatim in the record is DROPPED, never
 * repaired, and a turn reference that does not exist takes its entry with it.
 */

import { containsVerbatim } from "@/lib/span-provenance-shared";

/** The stored preset id. Never rendered in any chip menu, ever. */
export const WORK_ARTIFACT_PRESET = "work_artifact";

export type TurnRef = { item_id: string; turn_no: number };

export type ArtifactStage = { stage: string; what_happened: string; turn_refs: TurnRef[] };
export type ArtifactPrompt = { quote: string; why_it_worked: string; turn_ref: TurnRef | null };
export type ArtifactCheck = { step: string; evidence: string; turn_refs: TurnRef[] };
export type ArtifactDecision = {
  decision: string;
  decided_by: "person" | "ai" | "unclear";
  turn_refs: TurnRef[];
};

export type WorkArtifact = {
  how_ai_was_used: ArtifactStage[];
  example_prompts: ArtifactPrompt[];
  verification_steps: ArtifactCheck[];
  decisions: ArtifactDecision[];
  process_steps: string[];
  honest_gaps: string[];
};

/** What the validator checks a claim against: the record as the model saw it. */
export type ArtifactRecord = {
  items: { id: string; text: string; turns: { turn_no: number }[] }[];
};

export const WORK_ARTIFACT_TITLE = "Work Artifact";

export const WORK_ARTIFACT_SECTIONS = {
  how: "HOW THE AI WAS USED",
  prompts: "PROMPTS THAT DID THE WORK",
  checks: "HOW IT WAS CHECKED",
  decisions: "WHO DECIDED WHAT",
  process: "THE PROCESS, REUSABLE",
  gaps: "WHAT THE RECORD DOES NOT SHOW",
} as const;

export const NO_VERIFICATION_LINE = "The record shows no verification steps.";
export const NO_DECISIONS_LINE = "The record does not show who decided what.";
export const NO_PROCESS_LINE = "The record does not show a process to reuse yet.";
export const NO_PROMPTS_LINE = "The record holds no prompt that can be quoted word for word.";
export const NO_STAGES_LINE = "The record does not show how the models were used.";
export const NO_GAPS_LINE = "The record covers this work without an obvious gap.";

export const BUILD_ARTIFACT_LABEL = "Build the Work Artifact";
export const BUILD_ARTIFACT_LINE =
  "Reads this work's record and writes how it was made. One analysis.";
export const REBUILD_ARTIFACT_LABEL = "Rebuild";
export const RUNNING_ARTIFACT_LINE = "Reading how this was made";
export const NO_ARTIFACT_VIEWER_LINE = "The owner has not built this work's artifact yet.";

export const WORK_ARTIFACT_PROMPT = `You are writing a WORK ARTIFACT: a teaching card that shows how one finished piece of work was actually made, using only the record supplied.

You are given the brief where one exists, every conversation mapped to this work rendered as numbered turns ("TURN n ROLE:"), and the finished deliverable's own text. Each item is introduced by "ITEM <id>".

Return STRICT JSON and nothing else:
{
  "how_ai_was_used": [{ "stage": string, "what_happened": string, "turn_refs": [{ "item_id": string, "turn_no": number }] }],
  "example_prompts": [{ "quote": string, "why_it_worked": string, "turn_ref": { "item_id": string, "turn_no": number } }],
  "verification_steps": [{ "step": string, "evidence": string, "turn_refs": [{ "item_id": string, "turn_no": number }] }],
  "decisions": [{ "decision": string, "decided_by": "person" | "ai" | "unclear", "turn_refs": [{ "item_id": string, "turn_no": number }] }],
  "process_steps": [string],
  "honest_gaps": [string]
}

RULES:
- Every "quote" MUST be copied character for character out of the supplied record. Never tidy, shorten inside, translate or reconstruct a quote. If you cannot copy it exactly, leave the entry out.
- Every item_id and turn_no MUST exist in the supplied record. Never invent a reference.
- Write about the WORK, never about the person. No judgment of pace, speed, effort or skill. No score, no rating, no measure of anyone.
- "how_ai_was_used" describes the stages the work moved through and what the model was asked to do at each.
- "example_prompts" are the instructions in the record that visibly moved the work forward; "why_it_worked" is at most two sentences about the instruction, not the author.
- "verification_steps" exist ONLY where the record shows something being checked against another source. If nothing was checked, return an empty list. An empty list is the honest answer.
- "decisions" name what was settled and whether the person or the model settled it; "unclear" is a legitimate answer.
- "process_steps" is the reusable recipe another person could follow, in order, at most eight steps, each one sentence.
- "honest_gaps" names what this record cannot show. Always return at least one gap.
- Never use an em dash.`;

function cleanText(value: unknown, max = 400): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function validRefs(raw: unknown, record: ArtifactRecord): TurnRef[] | null {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) return null;
  const refs: TurnRef[] = [];
  for (const entry of raw) {
    const ref = validRef(entry, record);
    if (!ref) return null;
    refs.push(ref);
  }
  return refs;
}

function validRef(raw: unknown, record: ArtifactRecord): TurnRef | null {
  const input = (raw ?? null) as Record<string, unknown> | null;
  if (!input) return null;
  const itemId = typeof input["item_id"] === "string" ? input["item_id"] : null;
  const turnNo = Number(input["turn_no"]);
  if (!itemId || !Number.isFinite(turnNo)) return null;
  const item = record.items.find((row) => row.id === itemId);
  if (!item) return null;
  if (!item.turns.some((turn) => turn.turn_no === turnNo)) return null;
  return { item_id: itemId, turn_no: turnNo };
}

/** Is this quote really in the record, allowing only whitespace a reader would not notice? */
export function quoteIsInRecord(quote: string, record: ArtifactRecord): boolean {
  return record.items.some((item) => containsVerbatim(item.text, quote));
}

/**
 * The honesty gate. Everything that cannot be proved against the supplied
 * record is dropped whole. Nothing is ever repaired into something truer.
 */
export function validateWorkArtifact(
  raw: Record<string, unknown>,
  record: ArtifactRecord,
): WorkArtifact {
  const stages: ArtifactStage[] = [];
  for (const entry of Array.isArray(raw["how_ai_was_used"]) ? raw["how_ai_was_used"] : []) {
    const row = (entry ?? {}) as Record<string, unknown>;
    const stage = cleanText(row["stage"], 120);
    const what = cleanText(row["what_happened"], 600);
    const refs = validRefs(row["turn_refs"], record);
    if (!stage || !what || refs === null) continue;
    stages.push({ stage, what_happened: what, turn_refs: refs });
  }

  const prompts: ArtifactPrompt[] = [];
  for (const entry of Array.isArray(raw["example_prompts"]) ? raw["example_prompts"] : []) {
    const row = (entry ?? {}) as Record<string, unknown>;
    const quote = typeof row["quote"] === "string" ? row["quote"].trim().slice(0, 1200) : "";
    const why = cleanText(row["why_it_worked"], 400);
    if (!quote || !quoteIsInRecord(quote, record)) continue;
    const ref = row["turn_ref"] === undefined || row["turn_ref"] === null
      ? null
      : validRef(row["turn_ref"], record);
    if (row["turn_ref"] !== undefined && row["turn_ref"] !== null && !ref) continue;
    prompts.push({ quote, why_it_worked: why, turn_ref: ref });
  }

  const checks: ArtifactCheck[] = [];
  for (const entry of Array.isArray(raw["verification_steps"]) ? raw["verification_steps"] : []) {
    const row = (entry ?? {}) as Record<string, unknown>;
    const step = cleanText(row["step"], 240);
    const evidence = cleanText(row["evidence"], 600);
    const refs = validRefs(row["turn_refs"], record);
    if (!step || refs === null) continue;
    checks.push({ step, evidence, turn_refs: refs });
  }

  const decisions: ArtifactDecision[] = [];
  for (const entry of Array.isArray(raw["decisions"]) ? raw["decisions"] : []) {
    const row = (entry ?? {}) as Record<string, unknown>;
    const decision = cleanText(row["decision"], 400);
    const by = row["decided_by"];
    const decidedBy: ArtifactDecision["decided_by"] =
      by === "person" || by === "ai" ? by : "unclear";
    const refs = validRefs(row["turn_refs"], record);
    if (!decision || refs === null) continue;
    decisions.push({ decision, decided_by: decidedBy, turn_refs: refs });
  }

  const process = (Array.isArray(raw["process_steps"]) ? raw["process_steps"] : [])
    .map((step) => cleanText(step, 300))
    .filter((step) => step.length > 0)
    .slice(0, 8);

  const gaps = (Array.isArray(raw["honest_gaps"]) ? raw["honest_gaps"] : [])
    .map((gap) => cleanText(gap, 300))
    .filter((gap) => gap.length > 0)
    .slice(0, 6);

  return {
    how_ai_was_used: stages.slice(0, 8),
    example_prompts: prompts.slice(0, 8),
    verification_steps: checks.slice(0, 8),
    decisions: decisions.slice(0, 8),
    process_steps: process,
    honest_gaps: gaps.length > 0 ? gaps : [NO_GAPS_LINE],
  };
}

/** Did anything at all survive the gate? */
export function artifactIsEmpty(artifact: WorkArtifact): boolean {
  return (
    artifact.how_ai_was_used.length === 0 &&
    artifact.example_prompts.length === 0 &&
    artifact.verification_steps.length === 0 &&
    artifact.decisions.length === 0 &&
    artifact.process_steps.length === 0
  );
}

/** How long each section waits before it enters. Section paced, never a rush. */
export const ARTIFACT_SECTION_ENTER_MS = 450;

/**
 * Pass 114: the sections arrive as a grid, so their beats follow the reading
 * eye rather than the DOM. Index order is the strict list order: usage,
 * prompts, checks, decisions, process, gaps.
 */
export const ARTIFACT_SECTION_OFFSETS_MS = [0, 1000, 500, 1500, 2200, 2900] as const;

/** The grid area each section takes at the two column width. */
export const ARTIFACT_SECTION_AREAS = [
  "usage",
  "prompts",
  "checks",
  "decisions",
  "process",
  "gaps",
] as const;

export function artifactSectionDelayMs(index: number, spineMs: number): number {
  const offset = ARTIFACT_SECTION_OFFSETS_MS[index] ?? 0;
  return Math.round(spineMs + offset);
}

