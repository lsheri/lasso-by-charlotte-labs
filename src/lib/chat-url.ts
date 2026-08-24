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
