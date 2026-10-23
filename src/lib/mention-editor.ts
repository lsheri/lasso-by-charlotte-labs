import { clampMentions, serializeMentions, type Mention } from "@/lib/mention-shared";

export type MentionCandidate = { profileId: string; displayName: string };
export type MentionTrigger = { start: number; end: number; query: string };

export function mentionTrigger(text: string, caret: number): MentionTrigger | null {
  const match = /(?:^|\s)@([^@\s]*)$/.exec(text.slice(0, caret));
  if (!match) return null;
  const query = match[1] ?? "";
  return { start: caret - query.length - 1, end: caret, query };
}

/** Preserve offsets through ordinary edits, dropping runs that were edited. */
export function mentionsAfterEdit(before: string, after: string, mentions: readonly Mention[]): Mention[] {
  let start = 0;
  while (start < before.length && start < after.length && before[start] === after[start]) start += 1;
  let oldEnd = before.length;
  let newEnd = after.length;
  while (oldEnd > start && newEnd > start && before[oldEnd - 1] === after[newEnd - 1]) { oldEnd -= 1; newEnd -= 1; }
  const delta = newEnd - oldEnd;
  return clampMentions(mentions.flatMap((mention) => {
    if (mention.start + mention.length <= start) return [mention];
    if (mention.start >= oldEnd) return [{ ...mention, start: mention.start + delta }];
    return [];
  }), after.length);
}

export function insertMention(text: string, mentions: readonly Mention[], trigger: MentionTrigger, candidate: MentionCandidate) {
  const run = `@${candidate.displayName}`;
  const next = text.slice(0, trigger.start) + run + " " + text.slice(trigger.end);
  const shifted = mentionsAfterEdit(text, next, mentions);
  return { text: next, mentions: serializeMentions([...shifted, { profileId: candidate.profileId, label: candidate.displayName, start: trigger.start, length: run.length }]), caret: trigger.start + run.length + 1 };
}

/** Comment trimming must move offsets by the same amount as the plain body. */
export function committedComment(text: string, mentions: readonly Mention[]) {
  const leading = text.length - text.trimStart().length;
  const body = text.trim();
  return { body, mentions: serializeMentions(clampMentions(mentions.map((mention) => ({ ...mention, start: mention.start - leading })), body.length)) };
}
/** Sticky editor gate: the plain mention editor is used only when someone can be mentioned. */
export function stickyMentionCandidates(list: readonly MentionCandidate[] | undefined): readonly MentionCandidate[] | undefined {
  return list && list.length > 0 ? list : undefined;
}
