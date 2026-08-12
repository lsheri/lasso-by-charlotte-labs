/**
 * A push should carry the work, not the assistant's account of the work. An
 * attachment that is already sitting inside the transcript is a restatement,
 * not a separate artifact, so we flag it and let the owner decide.
 */

const SHINGLE = 8;
/** A large majority of the attachment already present in the transcript. */
export const DUPLICATE_THRESHOLD = 0.8;
/** A large majority of the attachment sitting inside one single message. */
export const CONTAINMENT_THRESHOLD = 0.7;
/** Below this, shingle overlap is noise; shape rules govern instead. */
const MIN_WORDS_FOR_CONTAINMENT = 40;

function normalise(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/^[\s>#*\-+]+/gm, " ")
    .replace(/[`*_>#|~\-[\]()]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

function shingles(words: string[], size: number): string[] {
  if (words.length <= size) return words.length > 0 ? [words.join(" ")] : [];
  const out: string[] = [];
  for (let i = 0; i + size <= words.length; i += 1) out.push(words.slice(i, i + size).join(" "));
  return out;
}

/** Fraction of the attachment's word runs that already appear in the transcript. */
export function transcriptOverlap(content: string, transcript: string): number {
  const attachmentWords = normalise(content);
  if (attachmentWords.length === 0) return 0;
  const transcriptWords = normalise(transcript);
  if (transcriptWords.length === 0) return 0;

  const haystack = new Set(shingles(transcriptWords, SHINGLE));
  const needles = shingles(attachmentWords, SHINGLE);
  if (needles.length === 0) return 0;
  if (attachmentWords.length <= SHINGLE) {
    return transcriptWords.join(" ").includes(attachmentWords.join(" ")) ? 1 : 0;
  }
  let hits = 0;
  for (const needle of needles) if (haystack.has(needle)) hits += 1;
  return hits / needles.length;
}

export function looksLikeRestatement(content: string, transcript: string): boolean {
  return transcriptOverlap(content, transcript) >= DUPLICATE_THRESHOLD;
}

/**
 * Real artifact content arrives as its own object. Content that also sits
 * verbatim inside one message was lifted out of that message, so it is a slice
 * of the transcript, not an artifact. Tested per message, never against the
 * concatenated transcript: shared vocabulary across a whole conversation is
 * normal, a single reply containing the whole thing is not.
 */
export function isContainedInAnyMessage(attachmentContent: string, messages: string[]): boolean {
  const words = normalise(attachmentContent);
  if (words.length < MIN_WORDS_FOR_CONTAINMENT) return false;
  const needles = shingles(words, SHINGLE);
  if (needles.length === 0) return false;
  for (const message of messages) {
    const haystack = new Set(shingles(normalise(message), SHINGLE));
    if (haystack.size === 0) continue;
    let hits = 0;
    for (const needle of needles) if (haystack.has(needle)) hits += 1;
    if (hits / needles.length >= CONTAINMENT_THRESHOLD) return true;
  }
  return false;
}

/** Why an attachment was not made into a work item. */
export type RejectionReason =
  | "contained_in_message"
  | "restates_transcript"
  | "too_short_to_be_artifact"
  | "composed_section_title"
  | "no_source_artifact_id";

export const REJECTION_WORDS: Record<RejectionReason, string> = {
  contained_in_message: "reads as a section of one of your own messages, not a separate artifact",
  restates_transcript: "restates the conversation rather than being a separate artifact",
  too_short_to_be_artifact: "is too short to be an artifact",
  composed_section_title: "is titled like a composed section rather than a named artifact",
  no_source_artifact_id: "had no source_artifact_id",
};

/** Titles a model composes to label a section of its own reply. */
const COMPOSED_TITLES = [
  "summary",
  "key points",
  "key takeaways",
  "takeaways",
  "recap",
  "overview",
  "analysis",
  "notes",
  "next steps",
  "what we decided",
  "decisions",
  "conclusion",
  "tl;dr",
  "part 1",
  "part 2",
  "section",
  "appendix",
  "background",
  "introduction",
];

/** Title rules apply only where a composed label is plausible, never to code or files. */
const TITLE_RULE_KINDS = new Set(["artifact_markdown", "other"]);

const MIN_MARKDOWN_CHARS = 200;

export function attachmentRejection(
  attachment: { kind: string; title: string; content: string; sourceArtifactId: string },
  messages: string[],
  transcript: string,
): RejectionReason | null {
  if (!attachment.sourceArtifactId.trim()) return "no_source_artifact_id";

  if (TITLE_RULE_KINDS.has(attachment.kind)) {
    const title = attachment.title.trim().toLowerCase().replace(/[.:;,!?\s]+$/, "");
    if (attachment.title.trim().endsWith(":")) return "composed_section_title";
    if (COMPOSED_TITLES.some((t) => title === t || title.startsWith(t)))
      return "composed_section_title";
  }

  if (attachment.kind === "artifact_markdown" && attachment.content.length < MIN_MARKDOWN_CHARS)
    return "too_short_to_be_artifact";

  if (isContainedInAnyMessage(attachment.content, messages)) return "contained_in_message";
  if (looksLikeRestatement(attachment.content, transcript)) return "restates_transcript";
  return null;
}

/** Content-free size band for telemetry. */
export function flaggedBucket(n: number): "0" | "1-2" | "3+" {
  if (n <= 0) return "0";
  if (n <= 2) return "1-2";
  return "3+";
}
