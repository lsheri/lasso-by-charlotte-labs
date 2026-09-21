import { safeChatUrl } from "@/lib/chat-url";

/**
 * W1.1 — one parameter for the conversation's URL.
 *
 * chat_url is the documented name. source_url is still read, silently, so a
 * push already written against it keeps working, but it is no longer offered.
 */
export function rawPushUrl(args: Record<string, unknown>): string | null {
  for (const key of ["chat_url", "source_url"]) {
    const value = args[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

/** The URL kept on the record: allowlisted host, and past the vendor front door. */
export function storedPushChatUrl(args: Record<string, unknown>): string | null {
  return safeChatUrl(rawPushUrl(args));
}

/**
 * What the caller is told when nothing usable arrived. It is read by a model in
 * the same turn, which is the only moment it can still fix it.
 */
export const MISSING_CHAT_URL_NOTE =
  " No link back to this chat was recorded. If you can see this conversation's URL, call again with chat_url so the saved work can point back to it.";

/** Silence when a real conversation URL came through. */
export function missingChatUrlNote(args: Record<string, unknown>): string {
  return storedPushChatUrl(args) ? "" : MISSING_CHAT_URL_NOTE;
}
