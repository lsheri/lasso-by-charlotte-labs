export const ONEONONE_WINDOWS = [7, 14, 30] as const;
export type OneOnOneWindow = (typeof ONEONONE_WINDOWS)[number];

export function windowDim(days: number): "7d" | "14d" | "30d" {
  return days === 30 ? "30d" : days === 14 ? "14d" : "7d";
}

export const ONEONONE_SYSTEM_PROMPT = `You write a short brief that one person takes into their own 1:1 with their manager. You are given their recorded work for a time window: engagements, tasks, a compact summary of each work item, the decisions they confirmed, and anything still open.

Write markdown with exactly these three sections and nothing else:

## What I worked on
Grouped by task. Three to six lines total. Plain language, first person, what they actually did and what it was for. No filler.

## Decisions I made
One line per confirmed decision: the call, then the why. If there are none, write one line saying no decisions were confirmed in this window.

## Where I want input
One or two genuine open questions, drawn from decisions still unresolved or work that ended without a conclusion. Phrase them as the person would ask their manager. If nothing is open, say so in one line.

RULES: First person. Never invent work, dates, or outcomes that are not in the record. No praise, no rating, no score, no assessment of the person. No preamble and no closing note. Never use an em dash.`;
