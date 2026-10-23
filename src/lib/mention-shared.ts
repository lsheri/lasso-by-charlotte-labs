/** Mention offsets address plain text, never rich markup. */
export type Mention = { profileId: string; label: string; start: number; length: number };

export function parseMentions(value: unknown): Mention[] {
  try {
    if (!Array.isArray(value)) return [];
    const mentions: Mention[] = [];
    for (const entry of value) {
      try {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
        const { profileId, label, start, length } = entry;
        if (typeof profileId !== "string" || !profileId.trim()) continue;
        if (typeof label !== "string" || !label.trim()) continue;
        if (!Number.isInteger(start) || start < 0 || !Number.isFinite(start)) continue;
        if (!Number.isInteger(length) || length < 0 || !Number.isFinite(length)) continue;
        mentions.push({ profileId, label, start, length });
      } catch {
        // An unreadable entry must not prevent usable siblings from being read.
      }
    }
    return mentions;
  } catch {
    return [];
  }
}

export function serializeMentions(mentions: readonly Mention[]): Mention[] {
  const sorted = parseMentions(mentions)
    .map((mention) => ({ ...mention, label: mention.label.trim() }))
    .sort((a, b) => a.start - b.start);
  const result: Mention[] = [];
  let end = 0;
  for (const mention of sorted) {
    if (mention.start < end) continue;
    result.push(mention);
    end = mention.start + mention.length;
  }
  return result;
}

export function mentionedProfileIds(mentions: readonly Mention[]): string[] {
  return [...new Set(mentions.map((mention) => mention.profileId))];
}

export function clampMentions(mentions: readonly Mention[], textLength: number): Mention[] {
  if (!Number.isFinite(textLength) || textLength < 0) return [];
  return parseMentions(mentions).filter((mention) => mention.start + mention.length <= textLength);
}