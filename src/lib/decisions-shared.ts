import { BRIEF_PROMPT_RULES } from "./brief-shared";
import { QUOTE_RULE } from "./quote-check";

export type DraftedDecision = {
  situation: string;
  call: string;
  why: string;
  source_turn_nos: number[];
};

export const DRAFT_SYSTEM_PROMPT =
  "You extract CONSEQUENTIAL DECISIONS from one piece of a professional's work. It may be an AI conversation transcript, or a document, deck or sheet they produced. A consequential decision is a moment the human chose a direction, rejected an option, corrected the AI, or set a constraint that shaped the outcome. In a deliverable, a decision shows up as a commitment, a term, a scope line, a number that was settled. Extract at most 3, only if genuinely consequential, zero is a valid answer. For each: situation (1 sentence, the context they faced), call (1 sentence, what they decided, active voice, neutral), why (1-2 sentences, the reasoning as evidenced or clearly implied, never invent motives). When the source is a transcript, set source_turn_nos to the turn numbers that evidence it. When the source is a document, deck or sheet there are no turns, so return an empty array. When a decision appears with no visible deliberation behind it, say so plainly rather than inventing a rationale. No praise, no scores, no advice. Never use an em dash in your output. A decision that answers a question the brief raised is a stronger decision than one that answers nothing anybody asked for, so prefer those and say which question of the brief each one answers. " +
  BRIEF_PROMPT_RULES +
  " " +
  QUOTE_RULE;

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
  "You read one professional engagement: its brief, its workstreams, and the work that was produced across AI conversations, documents, decks, sheets, calls and messages. You extract the CONSEQUENTIAL DECISIONS the human made across that whole engagement. A consequential decision is a moment they chose a direction, rejected an option, changed course, corrected the AI, or set a constraint that shaped the outcome. Extract at most 5, only genuinely consequential ones, and zero is a valid answer. The strongest decisions are the ones where a conversation shows the deliberation and a deliverable shows the result. Look for that pair, and cite both item numbers when you find it. When a decision appears in a deliverable with no discussion behind it, that is worth surfacing too: say plainly that the reasoning is not visible in the record, rather than inventing a rationale. For each: situation (1 sentence of context they faced), call (1 sentence, what they decided, active voice, neutral not second person), why (1 to 2 sentences, the reasoning as evidenced or clearly implied, never invented), source_item_nos (the ITEM numbers that evidence it, at least one). Never rate, score, grade or praise the person. No advice. Never use an em dash in your output. A decision that answers a question the brief raised is a stronger decision than one that answers nothing anybody asked for, so prefer those and say which question of the brief each one answers. " +
  BRIEF_PROMPT_RULES +
  " " +
  QUOTE_RULE;

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
