/**
 * A pushed conversation may carry the URL it lives at in the source app. It is
 * user-supplied, so it is only kept when it is an https URL that points past a
 * vendor front door. Any AI tool's host is accepted (CL-1). Anything else is
 * dropped silently: the push still succeeds, the link simply does not exist.
 */
const MAX_CHAT_URL_LENGTH = 2048;

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
  if (!trimmed || trimmed.length > MAX_CHAT_URL_LENGTH) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (!url.hostname || url.username || url.password) return null;
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
/** CL-1: a version 4 UUID (15th character "4"). Claude's real conversation ids are v4. */
const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Only Claude. Its stored conversation id is the vendor's own UUID, so the URL
 * is deterministic. Only v4 ids: harness-minted v5 ids build dead links. Elsewhere the same field holds model-minted slugs, and a
 * fabricated link would be a dead link and a lie, so nothing is derived.
 */
export function deriveChatUrl(
  vendor: string | null | undefined,
  origConversationId: string | null | undefined,
): string | null {
  if (typeof origConversationId !== "string") return null;
  const id = origConversationId.trim();
  if (!UUID_V4_RE.test(id)) return null;
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

/**
 * CU1: a link a person pasted. No host list: any https link to any AI tool is
 * accepted. Anything else (http, javascript:, data:, unparseable, embedded
 * credentials, over 2048 characters) is refused. safeChatUrl is unchanged.
 */
export function pastedChatUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 2048) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (!url.hostname || url.username || url.password) return null;
  return url.toString();
}

/** CL-1: the Claude project a push named, when its id is a canonical UUID. */
export function deriveProjectUrl(projectId: unknown): string | null {
  if (typeof projectId !== "string") return null;
  const id = projectId.trim();
  if (!UUID_RE.test(id)) return null;
  return `https://claude.ai/project/${id}`;
}

/** Which rung of the ladder a link came from, so the label can say so. */
export type ChatLinkKind = "pasted" | "conversation" | "project";
export type ChatLink = { url: string; kind: ChatLinkKind };

type ChatLinkItem = {
  meta?: { chat_url?: string | null } | null | undefined;
  source_meta?: { url?: string | null; source_project?: { id?: unknown } | null } | null | undefined;
  source_vendor?: string | null | undefined;
  orig_conversation_id?: string | null | undefined;
} | null | undefined;

/**
 * CL-1 ladder: pasted, then pushed, then derived from a v4 Claude id, then the
 * Claude project the push named. Null when no rung holds.
 */
export function itemChatLink(item: ChatLinkItem): ChatLink | null {
  const pasted = pastedChatUrl(item?.meta?.chat_url);
  if (pasted) return { url: pasted, kind: "pasted" };
  const pushed = safeChatUrl(item?.source_meta?.url);
  if (pushed) return { url: pushed, kind: "conversation" };
  const derived = deriveChatUrl(item?.source_vendor ?? null, item?.orig_conversation_id ?? null);
  if (derived) return { url: derived, kind: "conversation" };
  const project = deriveProjectUrl(item?.source_meta?.source_project?.id);
  if (project) return { url: project, kind: "project" };
  return null;
}

/** The ladder's url alone, for callers that only need the string. */
export function itemChatUrl(item: ChatLinkItem): string | null {
  return itemChatLink(item)?.url ?? null;
}

/** The label for a ladder rung. A project link never claims to be the conversation. */
export function chatLinkLabel(link: ChatLink): string {
  if (link.kind === "project") return "Open the project";
  return chatUrlLabel(link.url);
}
