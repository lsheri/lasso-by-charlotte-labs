import { CANONICAL_ORIGIN } from "./app-host";

/** The admin invite link. Code is a query parameter: /join reads it from validateSearch. */
export function adminLink(code: string, origin: string = CANONICAL_ORIGIN): string {
  const url = new URL("/join", origin);
  url.searchParams.set("code", code);
  return url.toString();
}

/** Server-built join link for an invite code. Never trust a caller-supplied URL. */
export function buildJoinUrl(code: string, origin: string = CANONICAL_ORIGIN): string {
  return adminLink(code, origin);
}
