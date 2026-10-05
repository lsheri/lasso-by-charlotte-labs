/** M3-C3b. The one deep link /auth preserves for an AI tool sign-in. Pure. */
export const CONSENT_PATH = "/oauth/consent";

export const AUTHORIZATION_ID_SHAPE = /^[A-Za-z0-9_-]{1,200}$/;

export function consentNext(authorizationId: string): string {
  return `${CONSENT_PATH}?authorization_id=${encodeURIComponent(authorizationId)}`;
}

export function consentTarget(next: string | null | undefined): { authorization_id: string } | null {
  const prefix = `${CONSENT_PATH}?`;
  if (typeof next !== "string" || !next.startsWith(prefix)) return null;
  const id = new URLSearchParams(next.slice(prefix.length)).get("authorization_id");
  if (!id || !AUTHORIZATION_ID_SHAPE.test(id)) return null;
  return { authorization_id: id };
}
