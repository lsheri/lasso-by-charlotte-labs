import { CANONICAL_ORIGIN } from "./app-host";

/** Copy for the passwordless sign-in addition. Plain words, no em dashes. */
export const SIGN_IN_LINK_COPY = {
  control: "Email me a sign-in link",
  sending: "Sending",
  needEmail: "Enter your email first.",
  sentTitle: "Check your inbox",
  sentBody: "If that address has a Lasso account, a sign-in link is on its way. The link works once.",
  alreadySent: "We already sent one. Check your inbox, or ask again in a minute.",
  back: "Back to sign in",
} as const;

/**
 * Where the emailed link returns. Built against CANONICAL_ORIGIN (the same
 * constant join-link.ts uses) and carries the page's ENTIRE raw query, so
 * intent, key, invite and next all survive, including values the route's
 * validateSearch would otherwise drop.
 */
export function signInLinkRedirect(currentSearch: string, origin: string = CANONICAL_ORIGIN): string {
  const url = new URL("/auth", origin);
  new URLSearchParams(currentSearch).forEach((value, name) => url.searchParams.append(name, value));
  return url.toString();
}

/** Supabase send cooldown, by status or by its message. */
export function isSendCooldown(error: { status?: number | undefined; code?: string | undefined; message?: string | undefined } | null): boolean {
  if (!error) return false;
  if (error.status === 429) return true;
  if (error.code === "over_email_send_rate_limit") return true;
  return /rate limit|security purposes|after \d+ seconds/i.test(error.message ?? "");
}

/** Options passed to signInWithOtp. A sign-in link never creates an account. */
export function signInLinkOptions(currentSearch: string) {
  return { shouldCreateUser: false, emailRedirectTo: signInLinkRedirect(currentSearch) } as const;
}
