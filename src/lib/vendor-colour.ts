/**
 * The one mapping from a source vendor to its provenance colour. Every
 * surface that colours by vendor (bundle stems, piece borders, stack edges,
 * chat links) reads through here, so the mapping exists exactly once.
 */
export function vendorColour(vendor: string | null | undefined): string {
  const v = (vendor ?? "").trim().toLowerCase();
  if (v === "claude") return "var(--vendor-claude)";
  if (v === "chatgpt") return "var(--vendor-chatgpt)";
  if (v === "gemini") return "var(--vendor-gemini)";
  return "var(--vendor-unknown)";
}

/**
 * The vendor a chat URL points at, by host. Mirrors the host list in
 * chatUrlLabel (src/lib/chat-url.ts); anything else or an unparseable URL
 * is null, and the caller falls back to the unknown colour.
 */
export function vendorFromChatUrl(url: string): string | null {
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
  if (host === "claude.ai") return "claude";
  if (host === "chatgpt.com" || host === "chat.openai.com") return "chatgpt";
  if (host === "gemini.google.com") return "gemini";
  return null;
}
