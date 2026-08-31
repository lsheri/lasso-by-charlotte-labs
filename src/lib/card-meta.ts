/**
 * Pass 142: the metadata sub-card. Everything that describes a deliverable and
 * the person who shipped it reads as one small tile, so a card's headline stays
 * the headline. Tints are paper safe washes and the avatar colour is seeded by
 * profile id, never random, so a person keeps the same colour everywhere.
 */

import { hashId } from "@/components/work/pile-scatter";
import { deliverableKindOf } from "@/lib/deliverable-kinds";

export type ChipTint = { background: string; color: string };

const GREY_TINT: ChipTint = { background: "var(--nb-grey-2)", color: "var(--nb-graphite)" };

/** Soft washes only, and no reds anywhere. */
const KIND_TINTS: Record<string, ChipTint> = {
  memo_or_report: GREY_TINT,
  deck: { background: "#faf1e2", color: "var(--nb-amber)" },
  proposal: { background: "#e7efe9", color: "var(--nb-green-deep)" },
  model_or_budget: { background: "#e8f0fb", color: "var(--nb-blue)" },
  sheet: { background: "#e8f0fb", color: "var(--nb-blue)" },
};

/**
 * The tint for a kind chip. The chosen deliverable kind speaks first; the work
 * item type is the fallback; anything unmapped stays grey.
 */
export function kindChipTint(meta: unknown, type: string | null | undefined): ChipTint {
  const kind = deliverableKindOf(meta);
  const key = kind ?? (type ?? "").toLowerCase();
  return KIND_TINTS[key] ?? GREY_TINT;
}

/** The avatar palette, in the order the picker indexes it. */
export const AVATAR_COLORS = [
  "var(--nb-green-deep)",
  "var(--nb-blue)",
  "var(--nb-amber)",
  "var(--nb-graphite)",
] as const;

/** Same profile id, same colour, on every render and every machine. */
export function avatarColorFor(profileId: string | null | undefined): string {
  const id = (profileId ?? "").trim();
  return AVATAR_COLORS[hashId(id) % AVATAR_COLORS.length]!;
}

/** Two initials at most, from whatever the name gives us. */
export function initialsOf(name: string | null | undefined): string {
  const parts = (name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]![0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]![0] ?? "") : (parts[0]![1] ?? "");
  return (first + last).toUpperCase();
}
