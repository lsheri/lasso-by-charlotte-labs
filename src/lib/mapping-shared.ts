export type MappingSuggestion = {
  work_item_id: string;
  task_id: string;
  confidence: "high" | "medium";
  reason: string;
};

export const SUGGEST_SYSTEM_PROMPT = [
  "Match work items to the workstream they most likely belong to, using titles, codes, dates, and the organization's naming conventions.",
  "In the payload each workstream carries an id; return that id in the task_id field.",
  "Only suggest when there is a real signal (matching code, client name, topic overlap).",
  "Omit items with no good match.",
  "Reasons are short and factual ('title contains EMP-COAL') and never longer than 60 characters.",
].join(" ");

export const SUGGEST_TOOL = {
  type: "function" as const,
  function: {
    name: "record_suggestions",
    description:
      "Record work item to workstream mapping suggestions. task_id carries the workstream id.",
    parameters: {
      type: "object",
      properties: {
        suggestions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              work_item_id: { type: "string" },
              task_id: { type: "string" },
              confidence: { type: "string", enum: ["high", "medium"] },
              reason: { type: "string" },
            },
            required: ["work_item_id", "task_id", "confidence", "reason"],
            additionalProperties: false,
          },
        },
      },
      required: ["suggestions"],
      additionalProperties: false,
    },
  },
};
