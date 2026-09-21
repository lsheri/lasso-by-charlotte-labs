/**
 * A pushed conversation may carry the URL it lives at in the source app. It is
 * user-supplied, so it is only ever kept when it is an https URL on one of the
 * chat hosts we know. Anything else is dropped silently: the push still
 * succeeds, the link simply does not exist.
 */
export const CHAT_URL_HOSTS = [
  "claude.ai",
  "chatgpt.com",
  "chat.openai.com",
  "gemini.google.com",
] as const;

/**
 * A front door is not a conversation. These single segments are the vendors'
 * own landing and index pages, so a URL that stops there points at nothing in
 * particular and is treated as if no URL was stored at all.
 */
const FRONT_DOOR_SEGMENTS = new Set(["app", "chat", "chats", "c", "new", "g", "gpts"]);

/** True when the URL goes no deeper than a vendor's front door. */
export function isBareChatOrigin(url: URL): boolean {
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length === 0) return true;
  if (segments.length === 1 && FRONT_DOOR_SEGMENTS.has(segments[0]!.toLowerCase())) return true;
  return false;
}

/** The stored URL, or null when there is nothing safe to store. */
export function safeChatUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.toLowerCase();
  if (!(CHAT_URL_HOSTS as readonly string[]).includes(host)) return null;
  if (isBareChatOrigin(url)) return null;
  return url.toString();
}

/** "Open in Claude" and friends, named by the host the link points at. */
export function chatUrlLabel(url: string): string {
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return "Open the conversation";
  }
  if (host === "claude.ai") return "Open in Claude";
  if (host === "chatgpt.com" || host === "chat.openai.com") return "Open in ChatGPT";
  if (host === "gemini.google.com") return "Open in Gemini";
  return "Open the conversation";
}

/** A canonical 8-4-4-4-12 hex UUID, anchored so nothing can be bolted on. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Only Claude. Its stored conversation id is the vendor's own UUID, so the URL
 * is deterministic. Elsewhere the same field holds model-minted slugs, and a
 * fabricated link would be a dead link and a lie, so nothing is derived.
 */
export function deriveChatUrl(
  vendor: string | null | undefined,
  origConversationId: string | null | undefined,
): string | null {
  if (typeof origConversationId !== "string") return null;
  const id = origConversationId.trim();
  if (!UUID_RE.test(id)) return null;
  const v = (vendor ?? "").trim().toLowerCase();
  if (v === "claude") return safeChatUrl(`https://claude.ai/chat/${id}`);
  return null;
}

/** The explicit pushed URL wins; derivation is only ever the fallback. */
export function effectiveChatUrl(
  explicitUrl: unknown,
  vendor: string | null | undefined,
  origConversationId: string | null | undefined,
): string | null {
  return safeChatUrl(explicitUrl) ?? deriveChatUrl(vendor, origConversationId);
}
