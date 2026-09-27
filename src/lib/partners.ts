/**
 * The single source of truth for partner institutions. Every slug here must
 * match a row in the institutions table; these are database slugs, case
 * sensitive on purpose.
 */
export const PARTNER_SLUGS = ["ceiba_uni", "artemis", "cabin_ai"] as const;
export type PartnerSlug = (typeof PARTNER_SLUGS)[number];

export function isPartnerSlug(value: unknown): value is PartnerSlug {
  return typeof value === "string" && (PARTNER_SLUGS as readonly string[]).includes(value);
}
