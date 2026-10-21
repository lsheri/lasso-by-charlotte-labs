/**
 * Suggested board structures from a person's own text.
 *
 * Server only. Returns candidates; never writes to a board. Uses the existing
 * chatComplete path, which records cost through recordUsage on every call.
 */

import { chatComplete, type AiMeta } from "@/lib/ai.server";
import {
  GENERIC_REGION_NAMES,
  REGION_NAME_MAX,
  REGIONS_MAX,
  REGIONS_MIN,
  STRUCTURE_COUNT,
  validateInput,
  validateStructures,
  type StructureCut,
  type StructureSuggestResult,
  type SuggestedStructure,
} from "@/lib/structure-suggest-shared";

const SYSTEM_PROMPT = [
  "You propose ways to lay out a consultant's workboard as named regions.",
  `Return exactly ${STRUCTURE_COUNT} structures. Use the cuts "question", "deliverable" and "workstream". Only when the text has an obvious time arc, use "phase" in place of one of them, never as a fourth. Each cut appears once.`,
  `Each structure has a short title, a one-line why, and ${REGIONS_MIN} to ${REGIONS_MAX} region names.`,
  `Region names are at most ${REGION_NAME_MAX} characters and unique within a structure.`,
  "NAMING RULE: every region name must come from the nouns in the person's own text: a named place, object, function, cost pool or decision. Good: \"Warehouse cost\", \"Asset 1 diligence\", \"Procurement savings\".",
  `Never use generic names. Forbidden: ${GENERIC_REGION_NAMES.join(", ")}.`,
  "Do not use em dashes.",
].join("\n");

const RESPONSE_FORMAT = {
  type: "json_schema",
  json_schema: {
    name: "board_structures",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["structures"],
      properties: {
        structures: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["cut", "title", "why", "regions"],
            properties: {
              cut: { type: "string", enum: ["question", "deliverable", "workstream", "phase"] },
              title: { type: "string" },
              why: { type: "string" },
              regions: { type: "array", items: { type: "string" } },
            },
          },
        },
      },
    },
  },
};

function parse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function ask(userText: string, meta: AiMeta | undefined): Promise<unknown> {
  const result = await chatComplete(
    [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userText },
    ],
    { tier: "smart", responseFormat: RESPONSE_FORMAT, meta },
  );
  return parse(result.text);
}

function sourceBlock(kind: string, text: string): string {
  return `Source kind: ${kind}\n\n<source>\n${text}\n</source>`;
}

/** Three candidate structures, or fewer with the reason said plainly. */
export async function suggestStructures(input: unknown, meta?: AiMeta): Promise<StructureSuggestResult> {
  const checked = validateInput(input);
  if (!checked.ok) return { status: "refused", reason: checked.reason };
  const { text, kind } = checked.value;

  let first: unknown;
  try {
    first = await ask(sourceBlock(kind, text), meta);
  } catch {
    return { status: "failed", reason: "The suggestion could not be generated." };
  }
  const kept: SuggestedStructure[] = validateStructures(first).valid.slice(0, STRUCTURE_COUNT);

  if (kept.length < STRUCTURE_COUNT) {
    // One regeneration, for the missing structures only, with different cuts.
    const missing = STRUCTURE_COUNT - kept.length;
    const usedCuts = kept.map((entry) => entry.cut);
    const retryText = `${sourceBlock(kind, text)}\n\nReturn ${missing} structure(s) only. Do not use these cuts: ${usedCuts.join(", ") || "none"}. Every region name must be a noun from the source; no generic names.`;
    try {
      const second = await ask(retryText, meta);
      for (const entry of validateStructures(second).valid) {
        if (kept.length >= STRUCTURE_COUNT) break;
        if (kept.some((have) => have.cut === entry.cut)) continue;
        if (entry.cut === "phase" && kept.some((have) => have.cut === "phase")) continue;
        kept.push(entry);
      }
    } catch {
      // Fall through with what passed the first time.
    }
  }

  if (kept.length === 0) return { status: "failed", reason: "No suggestion met the naming and shape rules." };
  const structures = kept.map((entry, index) => ({ ...entry, id: `s${index + 1}-${entry.cut as StructureCut}` }));
  const shortfall = structures.length < STRUCTURE_COUNT
    ? `Only ${structures.length} of ${STRUCTURE_COUNT} suggestions met the naming and shape rules after one retry.`
    : null;
  return { status: "ok", structures, shortfall };
}
