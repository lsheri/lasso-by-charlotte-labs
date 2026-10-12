/**
 * AU-1b: the signed-out key check. Answers only valid + institution name.
 * Never the kind, seats, org, uses, or why a key is invalid.
 */
import { createRateLimiter } from "./activation-keys";

export type PublicKeyAnswer = { valid: boolean; institution_name: string | null };

export type PublicKeyRow = {
  expires_at: string | null;
  revoked_at: string | null;
  max_uses: number | null;
  uses: number;
  institutions: { name: string } | null;
} | null;

/** Over the limit the page shows today's generic notice: nothing for a guesser. */
export const GENERIC_ANSWER: PublicKeyAnswer = { valid: true, institution_name: null };

// Best effort, in memory, per instance: about ten checks a minute per IP.
const allowPublicCheck = createRateLimiter(10, 60_000);

export function normaliseKeyCode(code: unknown): string {
  return typeof code === "string" ? code.trim().slice(0, 200).toUpperCase() : "";
}

export function evaluatePublicKey(row: PublicKeyRow, now = Date.now()): PublicKeyAnswer {
  if (!row) return { valid: false, institution_name: null };
  if (row.revoked_at) return { valid: false, institution_name: null };
  if (row.expires_at && Date.parse(row.expires_at) <= now) return { valid: false, institution_name: null };
  if (row.max_uses !== null && row.uses >= row.max_uses) return { valid: false, institution_name: null };
  return { valid: true, institution_name: row.institutions?.name ?? null };
}

export async function checkKeyPublic(
  code: string,
  ip: string,
  fetchRow: (code: string) => Promise<PublicKeyRow>,
  allow: (key: string) => boolean = allowPublicCheck,
): Promise<PublicKeyAnswer> {
  if (!allow(`public:${ip || "unknown"}`)) return { ...GENERIC_ANSWER };
  const clean = normaliseKeyCode(code);
  if (!clean) return { valid: false, institution_name: null };
  try {
    const { valid, institution_name } = evaluatePublicKey(await fetchRow(clean));
    return { valid, institution_name };
  } catch {
    return { ...GENERIC_ANSWER };
  }
}
