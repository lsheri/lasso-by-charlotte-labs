import { CANONICAL_ORIGIN } from "./app-host";

/** The admin invite link. Code is a query parameter: /join reads it from validateSearch. */
export function adminLink(code: string, origin: string = CANONICAL_ORIGIN): string {
  const url = new URL("/join", origin);
  url.searchParams.set("code", code);
  return url.toString();
}
