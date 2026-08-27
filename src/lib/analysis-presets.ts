import { BRIEF_PROMPT_RULES } from "@/lib/brief-shared";
import type { HandoffKind } from "@/lib/handoffs-shared";

/**
 * The analysis preset registry. Every analysis in the product is an entry here,
 * not a build: id, prompt, info panel, attribution, and who may run it.
 *
 * THE NAMING RULE.
 * A name is legitimate when a partner could say it out loud in a review without it
 * sounding like software. Person-shaped analyses use second person and stay owner-only.
 * Artifact-shaped analyses make the WORK the subject of the sentence, and those are the
 * only ones a coach or practitioner may run. Never "score", "level", "assessment",
 * "audit", "rating", or "efficiency" in a label: efficiency reads as a productivity
 * measure of a person even when the content is pure craft.
 */

export const ANALYSIS_SOURCES = [
  {
    label: "Anthropic, Prompting best practices",
    href: "https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices",
  },
  {
    label: "Anthropic, Effective context engineering for AI agents",
    href: "https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents",
  },
  {
    label: "Anthropic, Prompt caching",
    href: "https://platform.claude.com/docs/en/build-with-claude/prompt-caching",
  },
  {
    label: "Anthropic, Token-saving updates",
    href: "https://www.anthropic.com/news/token-saving-updates",
  },
  {
    label: "Anthropic, AI Fluency framework",
    href: "https://www.anthropic.com/learn/claude-for-you",
  },
] as const;

export const GROUNDING_LINE =
  "Grounded in published guidance from the model vendors. It is not a measurement, and no claim is made that following it improves outcomes.";

export const NEVER_LINE =
  "This produces observations, not a score. Nothing here rates you. No number about you is stored or shared.";

export type AnalysisScope = "thread" | "deliverable" | "engagement";

export type AnalysisPreset = {
  id: AnalysisPresetId;
  /**
   * The value written to analysis_runs.preset. The architect's check constraint
   * on that column predates this registry and allows a fixed set of names, so
   * the product id and the stored id are mapped rather than the schema changed.
   */
  dbPreset: string;
  label: string;
  description: string;
  scope: AnalysisScope;
  systemPrompt: string;
  openingMessage: string;
  infoPanel: {
    /** Filled with real run state by the caller, for example the message count. */
    reads: (detail: string) => string;
    looksFor: string[];
    never: string;
    sources: readonly { label: string; href: string }[];
  };
  attribution: string | null;
  coachMayRun: boolean;
  /**
   * The smallest number of pieces of work this analysis can honestly read.
   * Engagement scoped analyses each set their own: "What recurs" needs three
   * to call anything a recurrence, a sequence needs two to have an order.
   */
  minItems?: number | undefined;
  /**
   * The structured handoff kind this analysis may draft, if any. The schema and
   * the tail instruction live in handoffs-shared; nothing here edits a prompt.
   * Person-shaped presets have none and the server refuses one anyway.
   */
  handoffSchema?: HandoffKind | undefined;
};


export const ANALYSIS_PRESET_IDS = [
  "decision_origin",
  "verification",
  "verification_thread",
  "still_on_brief",
  "what_fed_this",
  "firm_checks",
] as const;


export type AnalysisPresetId = (typeof ANALYSIS_PRESET_IDS)[number];

const VERIFICATION_PROMPT = `You are checking ONE finished piece of work against the conversations that produced it, to establish which material claims rest on the model's word and which were verified. You are given the deliverable, the conversations that fed it, and the brief when one exists. Turns are numbered as "TURN n ROLE:".

A material claim is a statement in the deliverable that would change a reader's decision if it were wrong: a number, a factual assertion, a comparison, a citation, a legal or technical statement, or a recommendation resting on any of these.

For each material claim that originated with the model, give:
- THE CLAIM, quoted verbatim from the deliverable, with its location.
- WHERE IT CAME FROM: the turn where the model produced it, quoted exactly.
- VERIFICATION IN THE RECORD, exactly one of: CHECKED IN THE CONVERSATION (the person challenged it, recalculated it, or demanded sources; quote the span), CHECKED AGAINST A SOURCE (a source in the record confirms it; quote both sides), CONTRADICTED IN THE WORK OR RECORD (the claim conflicts with another span of the deliverable itself or with a source in the record; quote BOTH sides verbatim with the location of each), or NOTHING VISIBLE (no verification appears in the captured record).
- FOR NOTHING VISIBLE ONLY, ONE WAY TO CHECK IT: a specific verification move for this exact claim in this exact piece of work: a prompt to run against the model, a named kind of source to consult, a calculation to reproduce, or a person to ask. Concrete enough to do in minutes. Never a generic "double-check this."

FOOT THE FIGURES. Where the record contains the inputs to a number in the deliverable (line items behind a total, a base and a rate behind a percentage, components behind a sum), reproduce the calculation. If the reproduced value differs, report it with both numbers quoted and the working shown; that claim is CONTRADICTED IN THE WORK OR RECORD. If it matches, that claim is CHECKED AGAINST A SOURCE with the working as the evidence.

THE WORK IS THE SUBJECT. Never write "you did not verify". Write what the record shows about the claim. "No verification appears in the captured record" is the strongest permitted statement of absence, because the captured record is not the person's whole process.

BE HONEST LIKE A COACH. If most claims show nothing visible, the summary line says so plainly. Do not soften, do not pad with praise, do not manufacture reassurance. Praise is permitted only with a verbatim quote showing the verification it praises. An empty list of verified claims is a true result and must be reported as one.

ORDER: CONTRADICTED IN THE WORK OR RECORD first, because an internal contradiction is checkable right now with no outside source and it is the highest consequence finding a reviewer can make. Then NOTHING VISIBLE, highest consequence first. Then the checked items, so the person sees what their verification looks like when it happens.

THE ROLLUP LINE. When more material claims show nothing visible than the eight you list, end with one line stating how many further numeric or factual claims show no visible verification and are not listed. This is a count about the work, never about the person.

ABSOLUTE RULES:
- Verbatim or it does not render. No quote, no claim.
- At most eight claims, chosen by consequence, not by ease.
- No count or proportion characterising the person, no "you rarely verify", no habit statements. This analysis reads one piece of work.
- No judgement of the person, no advice about their competence.
- Never use an em dash.`;

/**
 * The thread scoped sibling. The prompt above is reused word for word, so the
 * contract a reader meets is identical; one line is added, and only because
 * ink has to know which turn produced the claim.
 */
const VERIFICATION_THREAD_PROMPT = `${VERIFICATION_PROMPT}

THE ANCHOR. This run reads one conversation. For every claim you list, give the turn identifier the claim was produced in, as the anchor.`;



const DECISION_ORIGIN_PROMPT = `You are establishing, for ONE finished piece of work, where each significant call came from. You are given the deliverable, the conversations that fed it, and the brief when one exists. Turns are numbered as "TURN n ROLE:".

A significant call is a choice that shaped the deliverable and could have gone another way: a scope boundary, a method, a number or assumption that drives an output, a recommendation, a framing, an exclusion.

For each significant call, give:
- THE CALL, in one plain sentence.
- ORIGIN, exactly one of: REQUIRED BY THE BRIEF, MADE BY YOU, PROPOSED BY THE MODEL AND ACCEPTED BY YOU, PROPOSED BY THE MODEL AND CHANGED BY YOU, or CARRIED IN FROM A SOURCE.
- THE EVIDENCE: the exact quoted span the origin rests on, copied character for character, with its turn number or the deliverable location.
- WHAT IT DECIDED: the part of the deliverable that follows from it.

PROVENANCE, NEVER PROPORTION. This is the hard constraint on this analysis and it is not negotiable. Never state or imply how much of the work was AI and how much was human. No percentages, no counts of calls by origin, no summary sentence characterising the balance, no "mostly", "largely" or "heavily". A reader who wants the balance can read the list. The moment this produces a ratio it becomes a measurement of a person and it is the model that failed.

ORDER: PROPOSED BY THE MODEL AND ACCEPTED BY YOU first, because an accepted proposal that nobody examined is the one worth seeing. Then MADE BY YOU, then the rest.

ABSOLUTE RULES:
- Verbatim or it does not render. If you cannot copy the exact span, do not write the call at all.
- If a call cannot be traced to any evidence, say so plainly as its own entry with origin UNTRACEABLE and no quote. Do not infer an origin.
- No judgement of the person, no advice about their competence, no number attached to them.
- Never use an em dash.`;

const STILL_ON_BRIEF_PROMPT = `You are comparing ONE finished piece of work against the brief it was commissioned under, to establish where the work departed from the brief and whether each departure was acknowledged anywhere in the captured record. You are given the deliverable, the conversations that fed it, and the brief. Turns are numbered as "TURN n ROLE:".

A departure is a place where the work and the brief genuinely diverge. Style is not a departure. Depth is not a departure unless the brief specified depth. Report at most six departures, chosen by how much of the deliverable each one shaped.

For each departure, give:
- CLASS, exactly one of: ADDED (the work covers something the brief never asked for), DROPPED (the brief asked for something and the work does not contain it), CHANGED (the brief specified one thing and the work does another), REFRAMED (the deliverable answers a different question than the brief posed).
- THE BRIEF SIDE: the exact span of the brief, quoted character for character.
- THE WORK SIDE: the exact span of the deliverable that departs, quoted character for character. For DROPPED, name the section where the item would belong and state plainly that it is absent.
- WHERE IT ENTERED: the turn where the work first moved, quoted, with its origin: proposed by the model, chosen in the conversation, or carried in from a source. If the departure cannot be traced to any turn, say so plainly.
- THE VERDICT LINE, exactly one of: ACKNOWLEDGED IN THE RECORD (someone named the departure in the conversation or the deliverable; quote the acknowledgment), or NOT VISIBLE IN THE CAPTURED RECORD.

DRIFT IS NOT ERROR. A departure can be good judgment. Never call a departure wrong, unauthorized, or a mistake. Never write "you drifted" or any sentence with the person as the subject of the departure. The work departed; the record either shows the departure being named or it does not. That is the entire claim.

THE COVERAGE LINE IS MANDATORY. End with: scope changes are often agreed in conversations Lasso never saw, so a departure NOT VISIBLE in the captured record may have been agreed elsewhere. This line appears in every result, every time, without exception.

REFRAMED FIRST. Order departures with NOT VISIBLE before ACKNOWLEDGED, and within NOT VISIBLE put REFRAMED first, because an inherited reframing decides everything downstream of it.

WHEN THE BRIEF IS THIN OR STALE, SAY SO. If the brief is too short or too vague to support this comparison, report that as the finding: the work has moved past what the brief specifies, and the brief may need updating. That is a statement about the brief, not about the person.

ABSOLUTE RULES:
- Verbatim or it does not render, on both sides of every departure.
- No count or proportion characterising the person, no drift score, no habit statements. This analysis reads one piece of work against one brief.
- No judgement of the person, no advice about their competence.
- Never use an em dash.`;

const WHAT_FED_THIS_PROMPT = `You are reconstructing what went into ONE finished piece of work. You are given the deliverable and the candidate items from this person's record: conversations, documents, transcripts, earlier versions.

For each item that genuinely fed the deliverable, give:
- THE ITEM, by its title.
- RELATION, exactly one of: PRODUCED (this item is where the deliverable was drafted), INFORMED (material or reasoning from it reached the deliverable), REVISED (it changed an existing version), CITED (the deliverable quotes or references it).
- THE EVIDENCE: the specific overlap, quoted verbatim from both sides where possible, or the concrete reason with its location.

WHAT NOT TO LINK. Shared vocabulary is not a link. Same client, same week, or same engagement is not a link. If the only thing connecting an item to the deliverable is topic, do not link it. An over-linked record is worse than a sparse one, because a link the person cannot recognise teaches them the whole feature is guesswork.

If nothing fed it that you can evidence, say exactly that. An empty result is a true result.

ABSOLUTE RULES:
- Every link carries evidence. No evidence, no link.
- Draft only. Say plainly at the end that these are proposed links for the person to confirm or discard, and that nothing is recorded until they do.
- No count of how many items fed the work, no completeness claim, no number about the person.
- Never use an em dash.`;





const FIRM_CHECKS_PROMPT = `You are running a firm's own checks against ONE finished piece of work. You are given the deliverable, the conversations that fed it, the brief when one exists, and the CHECKS block below: the exact checks a coach or the firm wrote for this work. Turns are numbered as "TURN n ROLE:".

For each check, in the order given:
- THE CHECK, referenced by its TITLE only. Never reprint the body of a check.
- WHAT THE WORK SHOWS, exactly one of: ADDRESSED (the work satisfies the check; quote the span of the deliverable or conversation that shows it, verbatim), PARTLY (quote what is there, then name plainly what the check asks for that is not), or NOT VISIBLE IN THE CAPTURED RECORD (nothing in the record speaks to this check).
- FOR PARTLY AND NOT VISIBLE, ONE NEXT STEP: the smallest concrete action that would satisfy the check for this specific piece of work.

THE WORK IS THE SUBJECT. Never write that the person failed, passed, missed, or ignored a check. The work either shows the thing or the record does not contain it.

BE HONEST LIKE A COACH. Do not soften. Do not pad with praise. An entirely NOT VISIBLE result is a true result and must be reported as one. Praise only with the verbatim quote that earns it.

END WITH THE COVERAGE LINE: the captured record may not include everything the person did, so a check NOT VISIBLE here may have been handled somewhere Lasso cannot see.

ABSOLUTE RULES:
- Verbatim or it does not render, on every evidence quote.
- Answer every check given, in order. Do not add checks of your own.
- No count of checks addressed, no pass rate, no score, no judgement of the person.
- Never use an em dash.`;

/**
 * Appended to every analysis system prompt. Brevity comes from cutting preamble
 * and echo, never from cutting evidence or honesty.
 */
export const OUTPUT_DISCIPLINE = `OUTPUT DISCIPLINE:
- Start with the first finding. No preamble, no restatement of these instructions, no summary of what you were given.
- Beyond the quotes the rules above require, each finding gets at most two sentences.
- No closing summary, no encouragement, no offer to help further. When a mandated coverage or rollup line exists, it is the last line.`;

/**
 * Historic floors. The engagement-wide analyses that used them were retired in
 * pass 103; the constants stay because old run rows and their copy still refer
 * to them.
 */
export const MIN_ITEMS_FOR_RECURRENCE = 3;
export const MIN_ITEMS_FOR_SEQUENCE = 2;

const RAW_ANALYSIS_PRESETS: AnalysisPreset[] = [

  {
    id: "verification",
    handoffSchema: "open_checks",
    dbPreset: "verification",
    label: "What to verify",
    description:
      "Reads this deliverable and the conversation behind it, and names the claims that rest on the model's word with a way to check each one.",
    scope: "deliverable",
    systemPrompt: VERIFICATION_PROMPT,
    openingMessage:
      "For this piece of work, set out which material claims came from the model and whether verification appears in the record.",
    infoPanel: {
      reads: (detail) => detail,
      looksFor: [
        "Material claims in the deliverable that came from the model",
        "Where each claim was produced in the conversation",
        "Whether the record shows it being challenged, recalculated or sourced",
        "One concrete way to check each claim with nothing visible",
      ],
      never:
        "Never a judgment of you, never a score, never a claim about what you did outside the captured record.",
      sources: ANALYSIS_SOURCES,
    },
    attribution: null,
    coachMayRun: true,
  },
  {
    id: "verification_thread",
    handoffSchema: "open_checks",
    dbPreset: "verification_thread",
    label: "What to verify here",
    description:
      "Reads this conversation on its own and names the claims the model produced that show no follow up in the record, with a way to check each one. The findings are drawn on the transcript itself.",
    scope: "thread",
    systemPrompt: VERIFICATION_THREAD_PROMPT,
    openingMessage:
      "For this conversation, set out which claims the model produced and whether verification appears in the record.",
    infoPanel: {
      reads: (detail) => detail,
      looksFor: [
        "Claims the model produced in this conversation",
        "The turn each claim was produced in",
        "Whether the record shows it being challenged, recalculated or sourced",
        "One concrete way to check each claim with nothing visible",
      ],
      never:
        "Never a judgment of you, never a score, never a claim about what you did outside the captured record. Marks land on the model's words, never on yours.",
      sources: ANALYSIS_SOURCES,
    },
    attribution: null,
    coachMayRun: false,
  },

  {
    id: "still_on_brief",
    handoffSchema: "departures",
    dbPreset: "still_on_brief",
    label: "Drift analysis",
    description:
      "Reads this deliverable against its brief and names each departure as added, dropped, changed or reframed, with whether the record shows it being acknowledged.",
    scope: "deliverable",
    systemPrompt: STILL_ON_BRIEF_PROMPT,
    openingMessage:
      "Compare this piece of work against its brief and set out where the work departed, and whether the record shows the departure being named.",
    infoPanel: {
      reads: (detail) => detail,
      looksFor: [
        "Departures between what the brief asked for and what the work does",
        "Which class each departure falls in: added, dropped, changed or reframed",
        "The turn where the work first moved, and where that move came from",
        "Whether the record shows the departure being acknowledged",
      ],
      never:
        "Never a judgment of you, never a drift score, never a claim that a departure was wrong. A departure not visible in the record may have been agreed somewhere Lasso cannot see.",
      sources: ANALYSIS_SOURCES,
    },
    attribution: null,
    coachMayRun: true,
  },
  {
    id: "decision_origin",
    handoffSchema: "decision_candidates",
    dbPreset: "decision_origin",
    label: "Who decided what",
    description:
      "Reads this deliverable and its conversations and sets out every significant call, and whether it came from the brief, from you, from the model, or from a source.",
    scope: "deliverable",
    systemPrompt: DECISION_ORIGIN_PROMPT,
    openingMessage:
      "For this piece of work, set out every significant call and where each one came from.",
    infoPanel: {
      reads: (detail) => detail,
      looksFor: [
        "Calls the brief required",
        "Calls you made yourself",
        "Calls the model proposed and you accepted",
        "Calls the model proposed and you changed",
        "Calls carried in from a source",
      ],
      never: `${NEVER_LINE} No ratio of human to AI is produced anywhere, by design.`,
      sources: ANALYSIS_SOURCES,
    },
    attribution: null,
    coachMayRun: true,
  },
  {
    id: "what_fed_this",
    dbPreset: "what_fed_this",
    label: "What fed this",
    description:
      "Opens the two-pane provenance audit: this deliverable's record beside the engagement's other work. Circle or select a span to trace where it came from.",
    scope: "deliverable",
    systemPrompt: WHAT_FED_THIS_PROMPT,
    openingMessage: "Reconstruct what fed this piece of work, with the evidence for each link.",
    infoPanel: {
      reads: (detail) => detail,
      looksFor: [
        "The conversation this was drafted in",
        "Material or reasoning that reached the work",
        "Items that revised an earlier version",
        "Items the work quotes or references",
      ],
      never: `${NEVER_LINE} Every proposal is a draft you confirm or discard, and nothing is recorded until you do.`,
      sources: ANALYSIS_SOURCES,
    },
    attribution: null,
    coachMayRun: true,
  },
  {
    id: "firm_checks",
    handoffSchema: "check_results",
    dbPreset: "firm_checks",
    label: "Firm checks",
    description:
      "Runs each of your firm's checks against this deliverable on the server, one check at a time, by title.",
    scope: "deliverable",
    systemPrompt: FIRM_CHECKS_PROMPT,
    openingMessage: "Run my firm's checks against this piece of work.",
    infoPanel: {
      reads: (detail) =>
        `${detail} It also reads the brief when one exists, and your firm's checks.`,
      looksFor: [
        "What the work shows against each check, with evidence",
        "The smallest next step where a check is not yet visible",
      ],
      never: `${NEVER_LINE} Never a pass rate, never a score, never a judgment of you. A check not visible in the record may have been handled where Lasso cannot see.`,
      sources: ANALYSIS_SOURCES,
    },
    attribution: null,
    coachMayRun: true,
  },
];

/** Every preset, with the shared output discipline block appended once. */
export const ANALYSIS_PRESETS: AnalysisPreset[] = RAW_ANALYSIS_PRESETS.map((preset) => ({
  ...preset,
  systemPrompt: `${preset.systemPrompt}\n\n${OUTPUT_DISCIPLINE}`,
}));

/** Appended to the firm checks preset at run time; empty means the chip is disabled. */
export const NO_FIRM_CHECKS_LINE = "no firm checks written yet";

/** Kept for historical run rows whose preset no longer exists. */
export const NOT_ENOUGH_WORK_LINE = "There is not enough work in this engagement yet.";
export const NOT_ENOUGH_FOR_SEQUENCE_LINE =
  "There is not enough work in this engagement to show a sequence yet.";

/**
 * The minimum this preset can honestly read, and the plain reason when the
 * selection is short of it. Every chip surface asks these two, so a new
 * engagement preset carries its own gate rather than inheriting one.
 */
export function minItemsFor(preset: AnalysisPreset): number {
  return preset.minItems ?? 1;
}

export function notEnoughWorkLine(preset: AnalysisPreset): string {
  // Sequence-shaped presets are retired; anything left says the plain line.
  return minItemsFor(preset) >= MIN_ITEMS_FOR_SEQUENCE
    ? NOT_ENOUGH_FOR_SEQUENCE_LINE
    : NOT_ENOUGH_WORK_LINE;
}

/** The wording used where the person is choosing items, not viewing a scope. */
export function needsMoreSelectedLine(preset: AnalysisPreset): string {
  const min = minItemsFor(preset);
  const word = min === 2 ? "two" : min === 3 ? "three" : String(min);
  return `needs at least ${word} pieces of work selected`;
}

export function analysisPreset(id: string): AnalysisPreset | null {
  return ANALYSIS_PRESETS.find((p) => p.id === id) ?? null;
}


export function presetsForScope(scope: AnalysisScope, isCoach: boolean): AnalysisPreset[] {
  return ANALYSIS_PRESETS.filter((p) => p.scope === scope && (p.coachMayRun || !isCoach));
}