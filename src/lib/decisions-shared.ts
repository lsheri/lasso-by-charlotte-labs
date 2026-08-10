export type DraftedDecision = {
  situation: string;
  call: string;
  why: string;
  source_turn_nos: number[];
};

export const DRAFT_SYSTEM_PROMPT =
  "You extract CONSEQUENTIAL DECISIONS from a professional's AI conversation. A consequential decision is a moment the human chose a direction, rejected an option, corrected the AI, or set a constraint that shaped the outcome. Extract at most 3, only if genuinely consequential — zero is a valid answer. For each: situation (1 sentence, the context they faced), call (1 sentence, what they decided, active voice), why (1-2 sentences, the reasoning as evidenced or clearly implied — never invent motives), source_turn_nos (the turn numbers that evidence it). Write in second person plain language ('you decided...' style is NOT wanted — write neutrally: 'Rebuilt the flag on public filings...'). No praise, no scores, no advice.";

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
