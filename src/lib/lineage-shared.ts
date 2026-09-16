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
- Propose a link only on hard evidence, which means one of exactly three things: (1) a specific sentence or passage that appears word for word in both texts, (2) the deliverable names the candidate artefact by its name or file name, or (3) the candidate conversation is where the deliverable's text was actually drafted, and you can point to that drafted text inside it.
- A shared number, a shared topic, a similar structure, similar tier names, or a conclusion that merely appears in both are not evidence on their own. A figure only counts when the sentence around it is shared too.
- Never propose a link on topic similarity alone, and never on timing alone.
- Choose the relation honestly: 'produced' when the item is where the deliverable was written or generated, 'informed' when it supplied inputs you can point to under the evidence rule, 'revised' when it changed the deliverable after a first version, 'cited' when the deliverable quotes or references it.
- The rationale is one plain sentence written to the person who did the work, and it must quote the shared wording or name the artefact it saw. No jargon, no praise, no scores. Do not use em dashes.
- Propose nothing rather than guess. An empty list is a good answer. Most candidates fed nothing.`;

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
