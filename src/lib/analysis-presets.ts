import { libraryForPrompt, TECHNIQUE_CATEGORIES } from "@/lib/analysis-library";

/**
 * The analysis preset registry. Every analysis in the product is an entry here,
 * not a build: id, prompt, info panel, attribution, and who may run it.
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

export const FLUENCY_ATTRIBUTION =
  "Structured on Anthropic's AI Fluency framework (Delegation, Description, Discernment, Diligence). Charlotte Labs is not affiliated with Anthropic.";

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
};

export const ANALYSIS_PRESET_IDS = [
  "ai_fluency_4d",
  "working_efficiently",
  "assumptions",
] as const;
export type AnalysisPresetId = (typeof ANALYSIS_PRESET_IDS)[number];

const FLUENCY_PROMPT = `You are running the AI Fluency lens over ONE of this person's own AI conversations. Structure your response on the four Ds:

DELEGATION: what they chose to hand to the AI and what they kept for themselves, and whether that split served the work.
DESCRIPTION: how clearly they framed the task, what context they supplied or withheld, and how they iterated the prompt.
DISCERNMENT: how critically they read what came back, what they pushed back on, and anything they accepted too readily.
DILIGENCE: verification, sourcing, and whether the output was checked before it was used.

ABSOLUTE RULES:
- NEVER produce a number, rating, grade, level, score, percentage, star, or any word that ranks the person or a D (no "strong", "weak", "excellent", "poor", "advanced", "beginner"). Nothing about a person is scored, ever.
- Write to them in second person, about what actually happened in THIS thread. Name the specific moment and cite the turn number, written as (turn 4).
- For each D: two to four sentences of observation, then a line starting "Try next:" with one concrete thing to do differently in their next conversation of this kind.
- If the thread gives no evidence for a D, say plainly that it does not show, and still offer one thing to try.
- Use markdown with a heading per D. Never use an em dash.`;

const EFFICIENCY_PROMPT = `You are running "Working efficiently with AI" over ONE of this person's own AI conversations. The transcript is supplied with each turn numbered as "TURN n ROLE:".

Your job is to MATCH, not to lecture. Read the actual transcript, find which of the patterns below genuinely occurred in it, and report only those.

THE LIBRARY. Each entry is a pattern that must be visible in the transcript, the technique that answers it, and why it works:

${libraryForPrompt()}

ABSOLUTE RULES:
- At most FOUR findings, ranked by how much of the conversation each one affected.
- Every finding MUST cite the turn numbers where the pattern occurred, written as (turn 3, turn 7). A finding with no cited turn must not be written at all.
- Quote the person's own words when showing the pattern. A quotation is a promise of exact wording, so quote character for character or write it as plain prose with no quotation marks.
- If nothing in the library matches, say exactly this and nothing more: "This conversation was already tight. The brief was specific and you did not resend material." Then, if there is one genuinely applicable next step, add a single sentence.
- NEVER give a token count, a cost, a percentage, a rating or any number attached to the person. Turn numbers are the only numbers permitted.
- Never aggregate across conversations, people or time. This is about this conversation only.
- Never call it a score, a level or efficiency. Findings are phrased as technique.
- Format each finding as a markdown heading naming the technique in plain language, then two to four sentences: what happened here with its turn citations, then what to do instead and why it works.
- Never use an em dash.`;

const ASSUMPTIONS_PROMPT = `You are surfacing the assumptions that entered ONE of this person's own AI conversations and were carried forward. The transcript is supplied with each turn numbered as "TURN n ROLE:".

For each assumption, give:
- the assumption, stated plainly in one sentence;
- ORIGIN: one of "stated by the client or source", "stated by you", "introduced by the model", or "unsourced";
- the EXACT quoted span it came from, copied character for character from the transcript, with its turn number;
- CHECKED: whether it was ever questioned or verified later in the conversation, and where.

ABSOLUTE RULES:
- Verbatim or it does not render. If you cannot copy the exact span the assumption came from, DO NOT write the assumption at all. Never paraphrase inside quotation marks.
- Order by how much of the later work rested on the assumption.
- No score, no judgement of the person, no advice about their competence.
- Use markdown. One assumption per block. Never use an em dash.`;

export const ANALYSIS_PRESETS: AnalysisPreset[] = [
  {
    id: "ai_fluency_4d",
    dbPreset: "ai_fluency_4d",
    label: "AI Fluency lens",
    description: "How you delegated, described, discerned and verified in this conversation.",
    scope: "thread",
    systemPrompt: FLUENCY_PROMPT,
    openingMessage:
      "Review this conversation with the AI Fluency lens: Delegation, Description, Discernment, Diligence.",
    infoPanel: {
      reads: (detail) => detail,
      looksFor: [
        "Delegation: what you handed over and what you kept",
        "Description: how the task was framed and iterated",
        "Discernment: how critically the answers were read",
        "Diligence: verification and sourcing before use",
      ],
      never: NEVER_LINE,
      sources: ANALYSIS_SOURCES,
    },
    attribution: FLUENCY_ATTRIBUTION,
    coachMayRun: false,
  },
  {
    id: "working_efficiently",
    dbPreset: "trace",
    label: "Working efficiently with AI",
    description: "Techniques that would have made this conversation shorter and sharper.",
    scope: "thread",
    systemPrompt: EFFICIENCY_PROMPT,
    openingMessage:
      "Look at how I worked with the AI in this conversation and tell me which techniques would have made it tighter.",
    infoPanel: {
      reads: (detail) => detail,
      looksFor: TECHNIQUE_CATEGORIES.map((c) => `${c.label}: ${c.plain}`),
      never: NEVER_LINE,
      sources: ANALYSIS_SOURCES,
    },
    attribution: null,
    coachMayRun: false,
  },
  {
    id: "assumptions",
    dbPreset: "assumptions",
    label: "Assumptions in this work",
    description: "What was assumed, where it came from, and whether it was ever checked.",
    scope: "thread",
    systemPrompt: ASSUMPTIONS_PROMPT,
    openingMessage:
      "Surface the assumptions in this conversation, where each one came from, and whether it was checked.",
    infoPanel: {
      reads: (detail) => detail,
      looksFor: [
        "Assumptions stated by the client or the source material",
        "Assumptions you stated yourself",
        "Assumptions the model introduced",
        "Assumptions with no traceable source",
        "Whether each one was ever checked",
      ],
      never: `${NEVER_LINE} An assumption without an exact quote is suppressed rather than shown.`,
      sources: ANALYSIS_SOURCES,
    },
    attribution: null,
    coachMayRun: false,
  },
];

export function analysisPreset(id: string): AnalysisPreset | null {
  return ANALYSIS_PRESETS.find((p) => p.id === id) ?? null;
}

export function presetsForScope(scope: AnalysisScope, isCoach: boolean): AnalysisPreset[] {
  return ANALYSIS_PRESETS.filter((p) => p.scope === scope && (p.coachMayRun || !isCoach));
}