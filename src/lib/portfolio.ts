/**
 * Portfolio is a promotion flag, never a move. The item stays exactly where it
 * lives; meta.portfolio simply says the person is proud of it.
 *
 * Portfolio surfaces show the work and its declared metadata only. No dates, no
 * session shapes, and never the assignment words.
 */

import type { EngagementKind } from "./edu-kinds";

export type PortfolioSection = "class" | "project" | "assignment" | "other";

export const PORTFOLIO_ADD_LABEL = "Add to Portfolio";
export const PORTFOLIO_REMOVE_LABEL = "Remove from Portfolio";
export const PORTFOLIO_EMPTY_LINE =
  "Nothing here yet. Add a piece of work you are proud of and it will keep its place.";
export const PORTFOLIO_PRIVACY_LINE =
  "Your Portfolio is private. It reaches a mentor only through what you already chose to share.";

export type PortfolioMeta = { portfolio?: boolean } & Record<string, unknown>;

export function isInPortfolio(item: { meta?: unknown } | null | undefined): boolean {
  const meta = (item?.meta ?? null) as PortfolioMeta | null;
  return meta?.["portfolio"] === true;
}

/** A new meta object with the flag set or cleared. Never mutates. */
export function withPortfolio(meta: unknown, on: boolean): Record<string, unknown> {
  const base = { ...((meta ?? {}) as Record<string, unknown>) };
  if (on) base["portfolio"] = true;
  else delete base["portfolio"];
  return base;
}

/** Closed vocabulary. Where the person promoted the item from. */
export function portfolioSection(
  kind: EngagementKind | null | undefined,
  opts?: { fromWorkstream?: boolean },
): PortfolioSection {
  if (opts?.fromWorkstream) return "assignment";
  if (kind === "class") return "class";
  if (kind === "project") return "project";
  return "other";
}
