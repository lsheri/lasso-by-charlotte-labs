/**
 * The single source of truth for which hostnames are "this product in
 * production", and the only place a canonical hostname is written down.
 *
 * Runtime code must build absolute URLs from appOrigin() (the CURRENT origin),
 * never from a constant, so the app behaves identically on the new host, the
 * transitional host, and previews. CANONICAL_HOST is for static artefacts and
 * contract copy only (meta tags, manifest, MCP tool/server descriptions).
 */

/** The host the product is moving to. */
export const CANONICAL_HOST = "lasso.charlotte-labs.com";

/**
 * Both hosts are live during the transition. The old host keeps working until
 * the architect retires it.
 */
export const PRODUCTION_HOSTS = [
  CANONICAL_HOST,
  "pilot-platform.charlotte-labs.dev",
] as const;

export const CANONICAL_ORIGIN = `https://${CANONICAL_HOST}`;

/**
 * Exact match only, case-insensitive. Never a substring or suffix test:
 * "lasso.charlotte-labs.com.attacker.com" is not this app.
 */
export function isProductionHost(hostname: unknown): boolean {
  if (typeof hostname !== "string") return false;
  const host = hostname.trim().toLowerCase().replace(/\.$/, "");
  return (PRODUCTION_HOSTS as readonly string[]).includes(host);
}

/** The origin the app is actually being served from, or null on the server. */
export function appOrigin(): string | null {
  if (typeof window === "undefined") return null;
  return window.location.origin;
}

/**
 * OFF. The transitional host still serves the app directly; the architect
 * flips this to true in a later pass, once DNS for the canonical host is
 * verified.
 */
export const REDIRECT_TO_CANONICAL = false;

/**
 * The transition redirect. Same path, same query, same hash, canonical host.
 * Returns the URL it navigated to, or null when it did nothing.
 */
export function maybeRedirectToCanonical(): string | null {
  if (!REDIRECT_TO_CANONICAL) return null;
  if (typeof window === "undefined") return null;
  const host = window.location.hostname.toLowerCase();
  if (host === CANONICAL_HOST) return null;
  if (!isProductionHost(host)) return null;
  const target = `${CANONICAL_ORIGIN}${window.location.pathname}${window.location.search}${window.location.hash}`;
  window.location.replace(target);
  return target;
}
