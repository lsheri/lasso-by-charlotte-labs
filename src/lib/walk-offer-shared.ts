/**
 * The once-only offer (Firm Brain Build Spec step 7): a call whose title reads like an interview offers the firm's
 * matching walk-through, once. Pure parts.
 *
 * - The offer is decided from the item's title and type alone. The title is never sent anywhere.
 * - It shows only to the item's owner, only in the signed-in reader, and only when the firm has work on that method.
 * - Opening it or dismissing it writes `meta.walk_offer` on the owner's own item, so it never returns on any device.
 */

import type { Method } from "./engagement-tags";

export const WALK_OFFER_KEY = "walk_offer";
export type WalkOfferState = "opened" | "dismissed";

export const WALK_OFFER_COPY = {
  line: "The firm has a walk-through for this. Read it?",
  read: "Read it",
  dismiss: "Not now",
  dismissLabel: "Dismiss this offer for good",
  error: "That could not be saved, so this offer may show again.",
  dialogTitle: (method: string) => `How we do this: ${method}`,
  dialogHint: "Written from past work shared with the firm.",
} as const;

/** Lower case, accents removed, every run of punctuation or space read as one space. */
function plain(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

const INTERNAL = /\b(?:review|standup|stand up|retro|retrospective|check in|checkin|sync|planning|kickoff|kick off|debrief|1 1|one on one|team meeting|status|steerco|readout)\b/;
const EXPERT = /\bexpert (?:call|interview|conversation|session)s?\b|\bexpert network\b/;
const CUSTOMER = /\b(?:customer|user|patient|buyer|member) (?:interview|discovery|call|conversation)s?\b|\bdiscovery (?:call|interview|session|conversation)s?\b/;
const INTERVIEW = /\binterviews?\b|\b(?:entrevista|entretien|intervista)s?\b|\bstakeholder (?:call|conversation|session|discussion)s?\b/;

/**
 * The method whose walk-through fits a call titled like this, or null. "Interview", "stakeholder call", "discovery
 * call", "expert call" and their like count; a review, a standup or any other internal meeting never does, whatever
 * else its title says. Case, accents and punctuation do not matter.
 */
export function interviewOfferMethod(title: string | null | undefined): Method | null {
  const text = plain(typeof title === "string" ? title.slice(0, 300) : "");
  if (!text || INTERNAL.test(text)) return null;
  if (EXPERT.test(text)) return "expert_calls";
  if (CUSTOMER.test(text)) return "customer_research";
  if (INTERVIEW.test(text)) return "stakeholder_interviews";
  return null;
}

function metaOf(meta: unknown): Record<string, unknown> {
  return meta && typeof meta === "object" && !Array.isArray(meta) ? { ...(meta as Record<string, unknown>) } : {};
}

/** Whether the offer was already opened or dismissed on this item, or null when it has not been shown to an end. */
export function walkOfferState(meta: unknown): WalkOfferState | null {
  const value = metaOf(meta)[WALK_OFFER_KEY];
  return value === "opened" || value === "dismissed" ? value : null;
}

/** The item's meta with the offer's state set, or cleared with null. Every other key is kept. */
export function withWalkOffer(meta: unknown, state: WalkOfferState | null): Record<string, unknown> {
  const next = metaOf(meta);
  if (state) next[WALK_OFFER_KEY] = state;
  else delete next[WALK_OFFER_KEY];
  return next;
}

/**
 * The method to offer on this item to this person, or null. Only a call, only to its owner, never to a coach, and
 * only until it has been opened or dismissed once.
 */
export function walkOfferFor(
  item: {
    type: string;
    title?: string | null | undefined;
    display_title?: string | null | undefined;
    owner_id?: string | null | undefined;
    meta?: unknown;
  },
  viewer: { id?: string | null | undefined; role?: string | null | undefined } | null | undefined,
): Method | null {
  if (item.type !== "call" || !viewer?.id || viewer.role === "coach") return null;
  if (!item.owner_id || item.owner_id !== viewer.id) return null;
  if (walkOfferState(item.meta)) return null;
  return interviewOfferMethod(item.display_title?.trim() || item.title);
}
