/** Whitespace-only differences are not content differences. Re-exporting an
 *  unchanged document reflows it; collapsing runs is what stops that reflow
 *  reading as an edit. Case is preserved, because case is content. */
export function normalizeForHash(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export async function normalizedTextHash(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(normalizeForHash(text));
  const digest = await crypto.subtle.digest("SHA-256", bytes as unknown as ArrayBuffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** meta key holding the hash of the extracted text, as opposed to
 *  text_source_hash which hashes the bytes the text came from. */
export const TEXT_CONTENT_HASH_KEY = "text_content_hash";
