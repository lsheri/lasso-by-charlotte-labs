import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { fileNameFor, needsTextFetch, peekFormat } from "@/lib/peek-format";
import type { WorkItemRow } from "@/lib/work-types";

type Db = SupabaseClient<Database>;

/** The columns any caller must select for text extraction to work. */
export const ITEM_TEXT_COLUMNS = "id, title, type, content_ref, content_hash, source_meta, meta";

export type TextItem = Pick<
  WorkItemRow,
  "id" | "title" | "type" | "content_ref" | "source_meta" | "meta"
> & { content_hash?: string | null | undefined };

export type ItemTextStatus = "ok" | "empty" | "unsupported" | "failed";

export type ItemTextResult = {
  text: string | null;
  status: ItemTextStatus;
  note?: string;
};

const MAX_ROWS_PER_SHEET = 500;
/** Below this, a PDF page layer is effectively empty: a scan, not a document. */
const MIN_PDF_CHARS = 40;

type TextMeta = {
  text_ref?: string;
  text_chars?: number;
  text_status?: ItemTextStatus;
  text_note?: string;
  text_source_hash?: string;
  text_extracted_at?: string;
};

function metaOf(item: TextItem): Record<string, unknown> & TextMeta {
  return (item.meta ?? {}) as Record<string, unknown> & TextMeta;
}

function extensionOf(name: string): string {
  const parts = name.split(".");
  return parts.length > 1 ? (parts.pop() as string).toLowerCase() : "";
}

/** Which binary decoder, if any, can turn this item's bytes into plain text. */
type BinaryShape = "docx" | "xlsx" | "pdf" | "pptx" | null;

function binaryShape(item: TextItem): BinaryShape {
  const mime = item.meta?.mime_type ?? null;
  if (mime === "application/pdf") return "pdf";
  if (mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    return "docx";
  if (mime === "application/msword") return "docx";
  if (
    mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mime === "application/vnd.ms-excel"
  )
    return "xlsx";
  if (
    mime === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    mime === "application/vnd.ms-powerpoint"
  )
    return "pptx";

  const ext = extensionOf(fileNameFor(item as WorkItemRow));
  if (ext === "pdf") return "pdf";
  if (ext === "docx" || ext === "doc") return "docx";
  if (ext === "xlsx" || ext === "xls") return "xlsx";
  if (ext === "pptx" || ext === "ppt") return "pptx";
  return null;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as unknown as ArrayBuffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function downloadBytes(path: string): Promise<Uint8Array | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.storage.from("work-files").download(path);
  if (error || !data) return null;
  return new Uint8Array(await data.arrayBuffer());
}

async function downloadText(path: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.storage.from("work-files").download(path);
  if (error || !data) return null;
  return await data.text();
}

/** Derived text lives beside the original. The original is never touched. */
function derivedPath(item: TextItem, hash: string): string {
  const dir = (item.content_ref ?? "").split("/").slice(0, -1).join("/") || "derived";
  return `${dir}/derived/${item.id}-${hash.slice(0, 8)}.txt`;
}

async function writeCache(item: TextItem, hash: string, result: ItemTextResult): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: TextMeta = {
      text_status: result.status,
      text_source_hash: hash,
      text_chars: result.text?.length ?? 0,
      text_extracted_at: new Date().toISOString(),
    };
    if (result.note) patch.text_note = result.note;
    if (result.text) {
      const path = derivedPath(item, hash);
      const upload = await supabaseAdmin.storage
        .from("work-files")
        .upload(path, new Blob([result.text], { type: "text/plain" }), {
          upsert: true,
          contentType: "text/plain",
        });
      if (!upload.error) patch.text_ref = path;
    }
    const next = {
      ...metaOf(item),
      ...patch,
    } as unknown as Database["public"]["Tables"]["work_items"]["Row"]["meta"];
    await supabaseAdmin.from("work_items").update({ meta: next }).eq("id", item.id);
  } catch (e) {
    console.error("[item-text] cache write failed:", (e as Error).message);
  }
}

async function extractDocx(bytes: Uint8Array): Promise<ItemTextResult> {
  const mammoth = (await import("mammoth")).default;
  const result = await mammoth.extractRawText({
    buffer: Buffer.from(bytes as unknown as ArrayBuffer),
  });
  const text = (result.value ?? "").trim();
  if (!text) return { text: null, status: "empty", note: "this document has no readable text" };
  return { text, status: "ok" };
}

async function extractXlsx(bytes: Uint8Array): Promise<ItemTextResult> {
  const XLSX = await import("xlsx");
  const book = XLSX.read(bytes, { type: "array" });
  const blocks: string[] = [];
  for (const name of book.SheetNames) {
    const sheet = book.Sheets[name];
    if (!sheet) continue;
    const csv = XLSX.utils.sheet_to_csv(sheet);
    const rows = csv.split("\n");
    const kept = rows.slice(0, MAX_ROWS_PER_SHEET);
    const truncated = rows.length > kept.length;
    blocks.push(
      [
        `## Sheet: ${name}`,
        kept.join("\n"),
        truncated
          ? `[this sheet was cut after ${MAX_ROWS_PER_SHEET} rows, ${rows.length - kept.length} more rows are not shown]`
          : null,
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }
  const text = blocks.join("\n\n").trim();
  if (!text) return { text: null, status: "empty", note: "this spreadsheet has no cell contents" };
  return { text, status: "ok" };
}

async function extractPdf(bytes: Uint8Array): Promise<ItemTextResult> {
  // The legacy build is the one that runs outside a browser.
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({
    data: bytes,
    isEvalSupported: false,
    useSystemFonts: false,
  }).promise;
  const pages: string[] = [];
  for (let n = 1; n <= doc.numPages; n += 1) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    const line = content.items
      .map((entry) => ("str" in entry ? entry.str : ""))
      .join(" ")
      .replace(/[ \t]+/g, " ")
      .trim();
    if (line) pages.push(line);
  }
  const text = pages.join("\n\n").trim();
  if (text.length < MIN_PDF_CHARS) {
    return {
      text: null,
      status: "empty",
      note: "this looks like a scanned document with no text layer",
    };
  }
  return { text, status: "ok" };
}

async function extractPptx(bytes: Uint8Array): Promise<ItemTextResult> {
  const { unzipSync, strFromU8 } = await import("fflate");
  const files = unzipSync(bytes);
  const slides = Object.keys(files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const na = Number(a.replace(/\D+/g, ""));
      const nb = Number(b.replace(/\D+/g, ""));
      return na - nb;
    });
  const blocks: string[] = [];
  slides.forEach((name, index) => {
    const entry = files[name];
    if (!entry) return;
    const xml = strFromU8(entry);
    const runs = Array.from(xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)).map((m) =>
      (m[1] ?? "")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .trim(),
    );
    const body = runs.filter(Boolean).join("\n");
    if (body) blocks.push(`## Slide ${index + 1}\n${body}`);
  });
  const text = blocks.join("\n\n").trim();
  if (!text) return { text: null, status: "empty", note: "no text was found on these slides" };
  return {
    text: `[Slide text only, layout and images are not captured.]\n\n${text}`,
    status: "ok",
  };
}

async function decode(
  shape: Exclude<BinaryShape, null>,
  bytes: Uint8Array,
): Promise<ItemTextResult> {
  if (shape === "docx") return extractDocx(bytes);
  if (shape === "xlsx") return extractXlsx(bytes);
  if (shape === "pdf") return extractPdf(bytes);
  return extractPptx(bytes);
}

/**
 * The ONE way a stored work item becomes plain text. Threads come from `turns`,
 * text-shaped files are downloaded as-is, and office formats are decoded once
 * and cached as derived text in the same bucket. Nothing else in the codebase
 * may open a stored file for reading: a second path is how a model ends up
 * describing a document it never saw.
 */
export async function getItemText(supabase: Db, item: TextItem): Promise<ItemTextResult> {
  const format = peekFormat(item as WorkItemRow);

  if (format.kind === "thread") {
    const { data } = await supabase
      .from("turns")
      .select("role, content")
      .eq("work_item_id", item.id)
      .order("turn_no", { ascending: true });
    const text = (data ?? []).map((t) => `${t.role.toUpperCase()}: ${t.content}`).join("\n\n");
    return text.trim() ? { text, status: "ok" } : { text: null, status: "empty" };
  }

  if (!item.content_ref) {
    return { text: null, status: "empty", note: "nothing is stored for this item" };
  }

  if (needsTextFetch(format)) {
    const raw = await downloadText(item.content_ref);
    if (raw === null)
      return { text: null, status: "failed", note: "the stored file could not be opened" };
    return raw.trim() ? { text: raw, status: "ok" } : { text: null, status: "empty" };
  }

  const shape = binaryShape(item);
  if (!shape) {
    return {
      text: null,
      status: "unsupported",
      note: format.kind === "image" ? "this is an image" : "this format cannot be read as text",
    };
  }

  const meta = metaOf(item);
  const known = meta.text_status;
  const knownHash = meta.text_source_hash;

  // A cheap cache hit: the stored content hash still matches what we decoded.
  if (known && knownHash && item.content_hash && knownHash === item.content_hash) {
    if (known === "ok" && meta.text_ref) {
      const cached = await downloadText(meta.text_ref);
      if (cached) return { text: cached, status: "ok" };
    } else if (known !== "ok") {
      return { text: null, status: known, ...(meta.text_note ? { note: meta.text_note } : {}) };
    }
  }

  const bytes = await downloadBytes(item.content_ref);
  if (!bytes) return { text: null, status: "failed", note: "the stored file could not be opened" };
  const hash = await sha256Hex(bytes);

  if (known && knownHash === hash) {
    if (known === "ok" && meta.text_ref) {
      const cached = await downloadText(meta.text_ref);
      if (cached) return { text: cached, status: "ok" };
    } else if (known !== "ok") {
      return { text: null, status: known, ...(meta.text_note ? { note: meta.text_note } : {}) };
    }
  }

  let result: ItemTextResult;
  try {
    result = await decode(shape, bytes);
  } catch (e) {
    const reason = (e as Error).message ?? "unknown error";
    result = {
      text: null,
      status: "failed",
      note: /password|encrypt/i.test(reason)
        ? "this file is password protected"
        : `this file could not be decoded (${reason.slice(0, 120)})`,
    };
  }
  await writeCache(item, hash, result);
  return result;
}
