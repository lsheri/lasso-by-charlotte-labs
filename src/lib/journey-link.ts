/**
 * A journey, sendable. The link carries only the id of the deliverable: what
 * opens is decided by the reader's own access, never by the link.
 */

export const JOURNEY_PARAM = "journey";

export const JOURNEY_UNAVAILABLE_LINE = "That work artifact is not available to you.";

export function journeyLinkFor(origin: string, engagementId: string, itemId: string): string {
  return `${origin.replace(/\/$/, "")}/engagements/${engagementId}?${JOURNEY_PARAM}=${itemId}`;
}

/** The deliverable id in a query string, if there is one. */
export function readJourneyId(search: string): string | null {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const value = params.get(JOURNEY_PARAM);
  return value && value.trim().length > 0 ? value.trim() : null;
}

/** The same url with the journey parameter taken back off. */
export function stripJourneyParam(url: string): string {
  const [base, search = ""] = url.split("?");
  const params = new URLSearchParams(search);
  params.delete(JOURNEY_PARAM);
  const rest = params.toString();
  return rest.length > 0 ? `${base}?${rest}` : (base as string);
}

export type JourneyTarget = { id: string; title: string };

/**
 * Follow a journey link once. Unreadable is a normal outcome: the reader is
 * told plainly and the page carries on.
 */
export async function handleJourneyLink(input: {
  itemId: string;
  engagementId: string;
  fetchItem: (itemId: string) => Promise<JourneyTarget | null>;
  open: (request: { anchorId: string; anchorTitle: string; engagementId: string }) => void;
  onUnavailable: (line: string) => void;
}): Promise<boolean> {
  let target: JourneyTarget | null = null;
  try {
    target = await input.fetchItem(input.itemId);
  } catch {
    target = null;
  }
  if (!target) {
    input.onUnavailable(JOURNEY_UNAVAILABLE_LINE);
    return false;
  }
  input.open({
    anchorId: target.id,
    anchorTitle: target.title,
    engagementId: input.engagementId,
  });
  return true;
}
