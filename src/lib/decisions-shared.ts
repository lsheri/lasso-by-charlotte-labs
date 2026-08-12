export type DraftedDecision = {
  situation: string;
  call: string;
  why: string;
  source_turn_nos: number[];
};

export const DRAFT_SYSTEM_PROMPT =
  "You extract CONSEQUENTIAL DECISIONS from a professional's AI conversation. A consequential decision is a moment the human chose a direction, rejected an option, corrected the AI, or set a constraint that shaped the outcome. Extract at most 3, only if genuinely consequential, zero is a valid answer. For each: situation (1 sentence, the context they faced), call (1 sentence, what they decided, active voice), why (1-2 sentences, the reasoning as evidenced or clearly implied, never invent motives), source_turn_nos (the turn numbers that evidence it). Write in second person plain language ('you decided...' style is NOT wanted, write neutrally: 'Rebuilt the flag on public filings...'). No praise, no scores, no advice.";

export const DRAFT_TOOL = {
  type: "function",
  function: {
    name: "record_decisions",
    description: "Record the consequential decisions found in the conversation.",
    parameters: {
      type: "object",
      properties: {
        decisions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              situation: { type: "string" },
              call: { type: "string" },
              why: { type: "string" },
              source_turn_nos: { type: "array", items: { type: "integer" } },
            },
            required: ["situation", "call", "why", "source_turn_nos"],
            additionalProperties: false,
          },
        },
      },
      required: ["decisions"],
      additionalProperties: false,
    },
  },
} as const;

export function dateLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ------------------------------------------------- engagement-wide drafting

export type DraftedEngagementDecision = {
  situation: string;
  call: string;
  why: string;
  source_item_nos: number[];
};

export const ENGAGEMENT_DRAFT_SYSTEM_PROMPT =
  "You read one professional engagement: its brief, its tasks, and the work that was produced across AI conversations, documents, calls and messages. You extract the CONSEQUENTIAL DECISIONS the human made across that whole engagement. A consequential decision is a moment they chose a direction, rejected an option, changed course, corrected the AI, or set a constraint that shaped the outcome. Extract at most 5, only genuinely consequential ones, and zero is a valid answer. Prefer decisions evidenced across more than one item. For each: situation (1 sentence of context they faced), call (1 sentence, what they decided, active voice, neutral not second person), why (1 to 2 sentences, the reasoning as evidenced or clearly implied, never invented), source_item_nos (the ITEM numbers that evidence it, at least one). Never rate, score, grade or praise the person. No advice. Never use an em dash in your output.";

export const ENGAGEMENT_DRAFT_TOOL = {
  type: "function",
  function: {
    name: "record_engagement_decisions",
    description: "Record the consequential decisions found across this engagement.",
    parameters: {
      type: "object",
      properties: {
        decisions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              situation: { type: "string" },
              call: { type: "string" },
              why: { type: "string" },
              source_item_nos: { type: "array", items: { type: "integer" } },
            },
            required: ["situation", "call", "why", "source_item_nos"],
            additionalProperties: false,
          },
        },
      },
      required: ["decisions"],
      additionalProperties: false,
    },
  },
} as const;
