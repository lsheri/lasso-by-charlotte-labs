/** AU-1b: which key check /auth runs, and when the key reads as not valid. */
export type KeyCheck = { ok: boolean; institution_name: string | null };

export async function resolveKeyCheck(
  signedIn: boolean,
  code: string,
  fns: {
    lookup: (a: { data: { code: string } }) => Promise<KeyCheck>;
    publicCheck: (a: { data: { code: string } }) => Promise<{ valid: boolean; institution_name: string | null }>;
  },
): Promise<KeyCheck> {
  if (signedIn) return fns.lookup({ data: { code } });
  const answer = await fns.publicCheck({ data: { code } });
  return { ok: answer.valid, institution_name: answer.institution_name };
}

/** Only a check that answered "not valid" counts; no answer keeps the generic notice. */
export function isKeyInvalid(key: string | undefined, check: KeyCheck | undefined): boolean {
  return Boolean(key) && check !== undefined && !check.ok;
}
