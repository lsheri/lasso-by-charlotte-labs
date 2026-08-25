/**
 * A traced question, sendable. The link is the engagement page plus the id of
 * one span link; whether it opens is decided by the reader's own access, never
 * by the link itself.
 */

export const TRACE_PARAM = "trace";

export const TRACE_UNAVAILABLE_LINE = "That traced question is not available to you.";

export function traceLinkFor(origin: string, engagementId: string, stitchId: string): string {
  return `${origin.replace(/\/$/, "")}/engagements/${engagementId}?${TRACE_PARAM}=${stitchId}`;
}

/** The traced stitch id in a query string, if there is one. */
export function readTraceId(search: string): string | null {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const value = params.get(TRACE_PARAM);
  return value && value.trim().length > 0 ? value.trim() : null;
}

/** The same url with the trace parameter taken back off. */
export function stripTraceParam(url: string): string {
  const [base, search = ""] = url.split("?");
  const params = new URLSearchParams(search);
  params.delete(TRACE_PARAM);
  const rest = params.toString();
  return rest.length > 0 ? `${base}?${rest}` : (base as string);
}

export type TracedStitch = { id: string; from_item_id: string; anchor_title: string };

/**
 * Follow a traced link once. Unreadable is a normal outcome, not a failure: the
 * reader is told plainly and the page carries on.
 */
export async function handleTrace(input: {
  stitchId: string;
  engagementId: string;
  fetchStitch: (stitchId: string) => Promise<TracedStitch | null>;
  open: (request: {
    anchorId: string;
    anchorTitle: string;
    engagementId: string;
    initialStitchId: string;
  }) => void;
  onUnavailable: (line: string) => void;
}): Promise<boolean> {
  let traced: TracedStitch | null = null;
  try {
    traced = await input.fetchStitch(input.stitchId);
  } catch {
    traced = null;
  }
  if (!traced) {
    input.onUnavailable(TRACE_UNAVAILABLE_LINE);
    return false;
  }
  input.open({
    anchorId: traced.from_item_id,
    anchorTitle: traced.anchor_title,
    engagementId: input.engagementId,
    initialStitchId: traced.id,
  });
  return true;
}
