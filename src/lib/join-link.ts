import { CANONICAL_ORIGIN } from "./app-host";

/** The admin invite link. Code is a query parameter: /join reads it from validateSearch. */
export function adminLink(code: string, origin: string = CANONICAL_ORIGIN): string {
  const url = new URL("/join", origin);
  url.searchParams.set("code", code);
  return url.toString();
}

/**
 * Server-built join link for an invite code. Never trust a caller-supplied
 * URL. An optional workboard id rides as the eng query parameter, matching
 * the on-screen copyable link exactly.
 */
export function buildJoinUrl(
  code: string,
  opts?: { eng?: string | undefined },
  origin: string = CANONICAL_ORIGIN,
): string {
  const url = new URL("/join", origin);
  url.searchParams.set("code", code);
  if (opts?.eng) url.searchParams.set("eng", opts.eng);
  return url.toString();
}

/** The attendee link for a key. The key's register rides as r so signed out recipients land on the right door. */
export function attendeeLink(code: string, register?: string, origin: string = CANONICAL_ORIGIN): string {
  const url = new URL(`/j/${code}`, origin);
  if (register) url.searchParams.set("r", register);
  return url.toString();
}
