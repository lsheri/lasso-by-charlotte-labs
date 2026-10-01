/** v1.3 part 2. Pure reading of a rendition R1 stored on a file placeholder. */

export type ReferenceRendition = {
  ref: string;
  format: "markdown" | "html";
  method: "extracted_by_script" | "written_by_model";
  match: "yes" | "no" | "unknown";
  /** sha256_computed when it is 64 lowercase hex, else null. */
  sha: string | null;
  chars: number | null;
};

/** Only rendition files R1 wrote: "<uuid>/rendition-<...>.md|.html". Never an original. */
export const RENDITION_REF_SHAPE = /^[0-9a-f-]{36}\/rendition-[^/]+\.(md|html)$/;

export function renditionOf(
  item: { source_meta?: unknown } | null | undefined,
): ReferenceRendition | null {
  const sm = item?.source_meta;
  if (!sm || typeof sm !== "object") return null;
  const r = (sm as Record<string, unknown>)["rendition"];
  if (!r || typeof r !== "object" || Array.isArray(r)) return null;
  const o = r as Record<string, unknown>;
  const ref = o["ref"];
  if (typeof ref !== "string" || !RENDITION_REF_SHAPE.test(ref)) return null;
  const sha = o["sha256_computed"];
  const chars = o["chars"];
  return {
    ref,
    format: o["format"] === "html" ? "html" : "markdown",
    method: o["method"] === "extracted_by_script" ? "extracted_by_script" : "written_by_model",
    match: o["match"] === "yes" ? "yes" : o["match"] === "no" ? "no" : "unknown",
    sha: typeof sha === "string" && /^[0-9a-f]{64}$/.test(sha) ? sha : null,
    chars: typeof chars === "number" && Number.isFinite(chars) ? chars : null,
  };
}

export const renditionTitle = (filename: string) => `Rendition of ${filename}`;
export const RENDITION_BY_SCRIPT = "Made by a script in the chat. Not the original.";
export const RENDITION_BY_MODEL =
  "Written by the AI in the chat. Not the original, and not copied from it.";
export const RENDITION_MATCH_YES = "Copied exactly from the chat's script.";
export const RENDITION_MATCH_NO = "Changed after the script made it.";

export function renditionSourceLine(r: ReferenceRendition): string {
  return r.method === "extracted_by_script" ? RENDITION_BY_SCRIPT : RENDITION_BY_MODEL;
}

export function renditionMatchLine(r: ReferenceRendition): string | null {
  if (r.method !== "extracted_by_script") return null;
  if (r.match === "yes") return RENDITION_MATCH_YES;
  if (r.match === "no") return RENDITION_MATCH_NO;
  return null;
}

export function renditionTextHeader(r: ReferenceRendition, filename: string): string {
  if (r.method === "extracted_by_script") {
    const head = `[Rendition of ${filename}, made by a script in the chat. Not the original file.]`;
    return r.match === "no"
      ? `${head}\n[This rendition was changed after the script made it.]`
      : head;
  }
  return `[AI-written summary of ${filename}. Not the original file and not copied from it.]`;
}

export function renditionPlainText(r: ReferenceRendition, raw: string): string {
  if (r.format !== "html") return raw;
  return raw
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<style\b[\s\S]*?<\/style\s*>/gi, "")
    .replace(/<\/?(p|div|br|li|h[1-6]|tr)\b[^>]*>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
