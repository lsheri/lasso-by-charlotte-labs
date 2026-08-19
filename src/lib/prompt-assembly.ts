/**
 * Message ORDER only. Not one byte of prompt text lives here: every string is
 * passed in by the caller. Keeping the ordering pure makes prefix stability
 * testable without a database or a model.
 */
export type ChatTurn = { role: "system" | "user" | "assistant"; content: string };

/**
 * Chat: the stable prefix first (system prompts, then the running history),
 * then the assembled record, then the new question.
 */
export function buildReflectConversation(input: {
  prompts: ChatTurn[];
  historyMessages: ChatTurn[];
  scopeMode: string;
  context: string;
  message: string;
}): ChatTurn[] {
  return [
    ...input.prompts,
    ...input.historyMessages,
    {
      role: "system",
      content: `THE PERSON'S RECORDED WORK (scope: ${input.scopeMode}):\n\n${input.context}`,
    },
    { role: "user", content: input.message },
  ];
}

/**
 * Analysis: the firm's checks are their own message rather than being glued to
 * the preset prompt, so the preset prefix is identical on every run.
 */
export function buildAnalysisConversation(input: {
  systemPrompt: string;
  presetPrompt: string;
  checksBlock: string | null;
  heading: string;
  context: string;
  kindLine: string;
  tailInstruction: string | null;
  openingMessage: string;
}): ChatTurn[] {
  return [
    { role: "system", content: input.systemPrompt },
    { role: "system", content: input.presetPrompt },
    ...(input.checksBlock ? [{ role: "system" as const, content: input.checksBlock }] : []),
    {
      role: "system",
      content: `${input.heading}:\n\n${input.context}${input.kindLine}`,
    },
    ...(input.tailInstruction
      ? [{ role: "system" as const, content: input.tailInstruction }]
      : []),
    { role: "user", content: input.openingMessage },
  ];
}