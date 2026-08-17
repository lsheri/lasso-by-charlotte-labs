/**
 * The technique library behind "Working efficiently with AI".
 *
 * Structured data, not prose, so the preset prompt is composed from it and the
 * info panel can name the categories from the same source. Every technique is
 * grounded in published guidance from the model vendors. None of it is claimed
 * to be proven to improve outcomes.
 */

export type TechniqueCategory = {
  id: "A" | "B" | "C" | "D" | "E";
  label: string;
  plain: string;
};

export type Technique = {
  id: string;
  category: TechniqueCategory["id"];
  /** What must actually be visible in the transcript for this to apply. */
  pattern: string;
  /** What to do instead, phrased as technique. */
  technique: string;
  /** Why it works. Mechanism, never a promise of outcome. */
  mechanism: string;
};

export const TECHNIQUE_CATEGORIES: TechniqueCategory[] = [
  { id: "A", label: "Output control", plain: "the shape and length of what comes back" },
  { id: "B", label: "What you send", plain: "what goes into the conversation, and in what order" },
  { id: "C", label: "Conversation structure", plain: "how threads are started, split and ended" },
  { id: "D", label: "Ask framing", plain: "how the ask itself is written" },
  { id: "E", label: "Verification", plain: "how the answer is checked before it is used" },
];

export const TECHNIQUES: Technique[] = [
  {
    id: "A1",
    category: "A",
    pattern: "long prose came back where a decision or a value was wanted",
    technique:
      'state the output contract up front: "one sentence", "three bullets", "just the number"',
    mechanism: "output is the expensive half, and constraining the format cuts it at source",
  },
  {
    id: "A2",
    category: "A",
    pattern: "a rewrite was asked for immediately after a long answer",
    technique: "specify format, length and audience in the first ask",
    mechanism: "a correction resends everything and regenerates everything",
  },
  {
    id: "A3",
    category: "A",
    pattern: "answers carry preamble, a restatement of the question and a closing summary",
    technique: "a standing instruction: no preamble, no recap, lead with the answer",
    mechanism: "structural filler carries no information for an expert reader",
  },
  {
    id: "A4",
    category: "A",
    pattern: "shorter answers were asked for more than once",
    technique: "put the length rule in the project or custom instruction, not in each message",
    mechanism: "a rule stated once applies to every turn without being resent by hand",
  },
  {
    id: "A5",
    category: "A",
    pattern: "unwanted caveats, disclaimers or alternative options kept appearing",
    technique: "say explicitly what to leave out",
    mechanism: "negative constraints are followed reliably",
  },
  {
    id: "A6",
    category: "A",
    pattern: "paragraphs were returned where a table would have served",
    technique: "name the shape and the columns you want",
    mechanism: "structured output is denser per token",
  },
  {
    id: "A7",
    category: "A",
    pattern: "a long answer came back to a yes or no question",
    technique: "ask closed questions, and request reasoning only when the answer surprises you",
    mechanism: "the reasoning is generated whether or not it is read",
  },
  {
    id: "B1",
    category: "B",
    pattern: "the same document or brief was pasted more than once",
    technique: "paste it once at the top and refer back to it",
    mechanism:
      "history is resent on every turn, so a document pasted three times is paid for repeatedly",
  },
  {
    id: "B2",
    category: "B",
    pattern: "long material was placed after the question",
    technique: "put long-form material first and the question last",
    mechanism: "this is documented long-context guidance and it makes the stable prefix cacheable",
  },
  {
    id: "B3",
    category: "B",
    pattern: "standing context was edited or reordered between turns",
    technique: "keep the standing block byte identical once it is written",
    mechanism: "caching only hits on an unchanged prefix",
  },
  {
    id: "B4",
    category: "B",
    pattern: "a whole document was supplied when one section mattered",
    technique: "send the section and say what it is part of",
    mechanism: "smaller high-signal context outperforms larger context",
  },
  {
    id: "B5",
    category: "B",
    pattern: "screenshots were used to carry text",
    technique: "paste the text",
    mechanism: "an image of text costs more and reads less reliably than the text",
  },
  {
    id: "B6",
    category: "B",
    pattern: "raw codebases, exports or logs were pasted whole",
    technique: "filter first to the relevant file, the failing lines or the rows in question",
    mechanism: "the irrelevant remainder is paid for on every later turn",
  },
  {
    id: "C1",
    category: "C",
    pattern: "one thread covered unrelated topics",
    technique: "start a new conversation per task",
    mechanism: "unrelated history is paid for on every turn and dilutes attention",
  },
  {
    id: "C2",
    category: "C",
    pattern: "the thread ran long with stale early turns",
    technique: "ask for a handoff summary and start fresh with it",
    mechanism: "this is compaction: the useful state carries over, the rest does not",
  },
  {
    id: "C3",
    category: "C",
    pattern: "answers got vaguer as the thread grew",
    technique: "restart with a clear brief",
    mechanism: "more context is not monotonically better",
  },
  {
    id: "C4",
    category: "C",
    pattern: "the same background was re-explained across threads",
    technique: "move it into a project instruction, a custom GPT, a skill or a gem",
    mechanism: "standing context written once stops being retyped",
  },
  {
    id: "C5",
    category: "C",
    pattern: "several near-identical questions were asked in sequence",
    technique: "batch them into one turn",
    mechanism: "each turn resends the whole conversation",
  },
  {
    id: "D1",
    category: "D",
    pattern: "a vague opening was followed by several clarifying rounds",
    technique: "front-load the goal, the audience, the format and what good looks like",
    mechanism: "each clarification is a full turn that resends everything",
  },
  {
    id: "D2",
    category: "D",
    pattern: "a task with a specific desired shape was asked without an example",
    technique: "give one example of the output you want",
    mechanism: "an example specifies shape more precisely than a description of it",
  },
  {
    id: "D3",
    category: "D",
    pattern: "the role or audience was never stated",
    technique: "say who it is for and what they already know",
    mechanism: "audience determines both level and length",
  },
  {
    id: "D4",
    category: "D",
    pattern: "extended reasoning was requested for simple lookups",
    technique: "reserve extended thinking for hard problems",
    mechanism: "reasoning is generated and paid for even when the task is trivial",
  },
  {
    id: "D5",
    category: "D",
    pattern: "a complex multi-part task was asked in one shot and then corrected repeatedly",
    technique: "break it into steps and confirm the plan first",
    mechanism: "a wrong plan executed in full is regenerated in full",
  },
  {
    id: "D6",
    category: "D",
    pattern: "success criteria were never stated",
    technique: "say how you will judge the answer",
    mechanism: "an unstated bar is guessed at",
  },
  {
    id: "E1",
    category: "E",
    pattern: "factual claims were accepted with no source requested",
    technique: "ask for sources, or for what it is unsure about",
    mechanism: "an unsourced claim cannot be checked later",
  },
  {
    id: "E2",
    category: "E",
    pattern: "numbers were carried downstream unchecked",
    technique: "ask it to show the calculation",
    mechanism: "the working can be checked even when the result cannot",
  },
  {
    id: "E3",
    category: "E",
    pattern: "the first answer was used as the final answer",
    technique: 'ask "what did you miss" or "argue against this" once',
    mechanism: "a single adversarial pass surfaces omissions cheaply",
  },
  {
    id: "E4",
    category: "E",
    pattern: "there was no pushback anywhere in a long thread",
    technique: "note it as an observation about the prompting",
    mechanism: "agreement throughout is a property of the exchange, never a judgement of a person",
  },
];

/** The library, rendered for a system prompt. */
export function libraryForPrompt(): string {
  return TECHNIQUE_CATEGORIES.map((category) => {
    const rows = TECHNIQUES.filter((t) => t.category === category.id)
      .map((t) => `${t.id}. PATTERN: ${t.pattern} | TECHNIQUE: ${t.technique} | WHY: ${t.mechanism}`)
      .join("\n");
    return `${category.id}. ${category.label.toUpperCase()}\n${rows}`;
  }).join("\n\n");
}