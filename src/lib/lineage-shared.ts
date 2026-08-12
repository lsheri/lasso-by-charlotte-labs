/** Lineage: which pieces of work fed a deliverable. Draft only, never auto-confirmed. */
export const LINEAGE_RELATIONS = ["produced", "informed", "revised", "cited"] as const;
export type LineageRelation = (typeof LINEAGE_RELATIONS)[number];

export const LINEAGE_STATUSES = ["draft", "confirmed", "discarded"] as const;
export type LineageStatus = (typeof LINEAGE_STATUSES)[number];

/** Read as: the contributing item CONTRIBUTED TO the deliverable. */
export const RELATION_LABEL: Record<LineageRelation, string> = {
  produced: "Produced this",
  informed: "Informed this",
  revised: "Revised this",
  cited: "Cited in this",
};

export const MAX_CANDIDATES = 25;

export const LINEAGE_SYSTEM_PROMPT = `You read one deliverable and a numbered list of other pieces of work from the same engagement, and you say which of them actually fed the deliverable.

Rules:
- Only propose a link when there is real evidence in the text: shared figures, shared wording, a named artefact, an explicit reference, or a conclusion in one that appears as content in the other.
- Never propose a link on topic similarity alone, and never on timing alone.
- Choose the relation honestly: 'produced' when the item is where the deliverable was written or generated, 'informed' when it shaped the thinking or supplied inputs, 'revised' when it changed the deliverable after a first version, 'cited' when the deliverable quotes or references it.
- The rationale is one plain sentence written to the person who did the work, naming the evidence you saw. No jargon, no praise, no scores. Do not use em dashes.
- Propose nothing rather than guess. An empty list is a good answer.`;

export const LINEAGE_TOOL = {
  type: "function" as const,
  function: {
    name: "record_links",
    description: "Record which candidate items fed the deliverable.",
    parameters: {
      type: "object",
      properties: {
        links: {
          type: "array",
          maxItems: MAX_CANDIDATES,
          items: {
            type: "object",
            properties: {
              candidate_no: { type: "number", description: "The ITEM number from the list." },
              relation: { type: "string", enum: [...LINEAGE_RELATIONS] },
              rationale: {
                type: "string",
                description: "One sentence naming the evidence for the connection.",
              },
            },
            required: ["candidate_no", "relation", "rationale"],
          },
        },
      },
      required: ["links"],
    },
  },
};

export type DraftedLink = {
  candidate_no: number;
  relation: string;
  rationale: string;
};

/** Counts leave as buckets only. */
export function linkBucket(n: number): string {
  if (n <= 0) return "0";
  if (n <= 3) return "1-3";
  if (n <= 10) return "4-10";
  return "10+";
}

export const DELIVERABLE_TYPES = ["document", "deck", "sheet"] as const;

export function isDeliverableType(type: string): boolean {
  return (DELIVERABLE_TYPES as readonly string[]).includes(type);
}
