/** KX1: the carried-key notice. Tests pin these strings. Shared by /auth and /onboarding. */
export const KEY_NOTICE_COPY = {
  named: (institution: string) => `You are joining with a key from ${institution}.`,
  neutral: "You are joining with a sponsored key.",
  body: "You choose what you share with them.",
  remove: "Not with them? Remove this key.",
} as const;

export function KeyNoticeSentence({ institution }: { institution: string | null | undefined }) {
  if (!institution) return <>{KEY_NOTICE_COPY.neutral}</>;
  const sentence = KEY_NOTICE_COPY.named(institution);
  // The name is positioned last in the sentence, one character before the
  // trailing full stop. Revisit this slice if that copy ever changes.
  const prefixLength = sentence.length - institution.length - 1;
  return <>{sentence.slice(0, prefixLength)}<span className="text-accent-deep">{institution}</span>{sentence.slice(-1)}</>;
}
