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

/** Mirrors the shared TextStatus, minus "not_attempted" which is an absence. */
export type ItemTextStatus = "ok" | "unreadable" | "unsupported" | "failed";

export type ItemTextResult = {
  text: string | null;
  status: ItemTextStatus;
  note?: string;
  /** Short machine-readable reason, stored as meta.text_error when not ok. */
  reason?: string;
};

const MAX_ROWS_PER_SHEET = 500;
/** Below this, a PDF page layer is effectively empty: a scan, not a document. */
const MIN_PDF_CHARS = 40;
/** Nothing larger is decoded inline: a capture request must not be starved. */
const MAX_DECODE_BYTES = 15 * 1024 * 1024;
/** Page ceiling for PDF text extraction, for the same reason. */
const PDF_PAGE_CAP = 80;

type TextMeta = {
  text_ref?: string;
  text_chars?: number;
  text_status?: ItemTextStatus;
  text_note?: string;
  text_error?: string;
  text_source_hash?: string;
  text_extracted_at?: string;
};

function metaOf(item: TextItem): Record<string, unknown> & TextMeta {
  return (item.meta ?? {}) as Record<string, unknown> & TextMeta;
}

/** Older rows carry "empty"; it means the same thing as "unreadable". */
function normalizeStatus(raw: string | null | undefined): ItemTextStatus | null {
  if (!raw) return null;
  if (raw === "empty") return "unreadable";
  if (raw === "ok" || raw === "unsupported" || raw === "unreadable" || raw === "failed") return raw;
  return null;
}

function extensionOf(name: string): string {
  const parts = name.split(".");
  return parts.length > 1 ? (parts.pop() as string).toLowerCase() : "";
}

/** Which binary decoder, if any, can turn this item's bytes into plain text. */
type BinaryShape = "docx" | "xlsx" | "pdf" | "pptx" | "odt" | "ods" | "odp" | null;

const OPEN_DOCUMENT_MIME: Record<string, BinaryShape> = {
  "application/vnd.oasis.opendocument.text": "odt",
  "application/vnd.oasis.opendocument.spreadsheet": "ods",
  "application/vnd.oasis.opendocument.presentation": "odp",
};

export function binaryShape(item: TextItem): BinaryShape {
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
  if (mime && OPEN_DOCUMENT_MIME[mime]) return OPEN_DOCUMENT_MIME[mime] ?? null;

  const ext = extensionOf(fileNameFor(item as WorkItemRow));
  if (ext === "pdf") return "pdf";
  if (ext === "docx" || ext === "doc") return "docx";
  if (ext === "xlsx" || ext === "xls") return "xlsx";
  if (ext === "pptx" || ext === "ppt") return "pptx";
  if (ext === "odt") return "odt";
  if (ext === "ods") return "ods";
  if (ext === "odp") return "odp";
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
    if (result.status !== "ok") patch.text_error = result.reason ?? "unknown";
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

/** One health row per unreadable file, always carrying the work item id. */
async function reportUnread(item: TextItem, result: ItemTextResult, shape: string): Promise<void> {
  if (result.status === "ok") return;
  const { logHealth } = await import("@/lib/health.server");
  await logHealth({
    kind: result.status === "failed" ? "error" : "empty_context",
    surface: "item_text",
    detail: result.reason ?? result.status,
    meta: {
      work_item_id: item.id,
      text_status: result.status,
      reason: result.reason ?? "unknown",
      shape,
    },
  });
}

/**
 * Every exit from getItemText goes through here: the status a person is later
 * shown is written on the same path that produced it, so a silent failure
 * cannot leave a file looking readable.
 */
async function finish(
  item: TextItem,
  hash: string,
  result: ItemTextResult,
  shape: string,
): Promise<ItemTextResult> {
  await writeCache(item, hash, result);
  await reportUnread(item, result, shape);
  return result;
}

async function extractDocx(bytes: Uint8Array): Promise<ItemTextResult> {
  const mammoth = (await import("mammoth")).default;
  const result = await mammoth.extractRawText({
    buffer: Buffer.from(bytes as unknown as ArrayBuffer),
  });
  const text = (result.value ?? "").trim();
  if (!text)
    return {
      text: null,
      status: "unreadable",
      note: "this document has no readable text",
      reason: "empty_document",
    };
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
  if (!text)
    return {
      text: null,
      status: "unreadable",
      note: "this spreadsheet has no cell contents",
      reason: "empty_spreadsheet",
    };
  return { text, status: "ok" };
}

async function extractPdf(bytes: Uint8Array): Promise<ItemTextResult> {
  // pdf.js always sets up a "fake worker" outside the browser, and that setup
  // tries to resolve the worker file from disk, which this bundled server
  // runtime has no module for. Handing it the already-bundled worker module on
  // globalThis makes the resolution step unnecessary, so no file is looked up.
  const workerModule = await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
  (globalThis as unknown as { pdfjsWorker?: unknown }).pdfjsWorker = workerModule;
  // The legacy build is the one that runs outside a browser.
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({
    data: bytes,
    isEvalSupported: false,
    useSystemFonts: false,
    // Bundled with the package, so no network fetch and no missing-font throw.
    standardFontDataUrl: STANDARD_FONTS,
  }).promise;

  const pages: string[] = [];
  const limit = Math.min(doc.numPages, PDF_PAGE_CAP);
  for (let n = 1; n <= limit; n += 1) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    const line = content.items
      .map((entry) => ("str" in entry ? entry.str : ""))
      .join(" ")
      .replace(/[ \t]+/g, " ")
      .trim();
    if (line) pages.push(line);
  }
  if (doc.numPages > limit) {
    pages.push(
      `[this file was cut after ${limit} pages, ${doc.numPages - limit} more pages are not shown]`,
    );
  }
  const text = pages.join("\n\n").trim();
  if (text.length < MIN_PDF_CHARS) {
    return {
      text: null,
      status: "unreadable",
      note: "this looks like a scanned document with no text layer",
      reason: "pdf_no_text_layer",
    };
  }
  return { text, status: "ok" };
}

function unescapeXml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
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
      unescapeXml(m[1] ?? "").trim(),
    );
    const body = runs.filter(Boolean).join("\n");
    if (body) blocks.push(`## Slide ${index + 1}\n${body}`);
  });
  const text = blocks.join("\n\n").trim();
  if (!text)
    return {
      text: null,
      status: "unreadable",
      note: "no text was found on these slides",
      reason: "empty_slides",
    };
  return {
    text: `[Slide text only, layout and images are not captured.]\n\n${text}`,
    status: "ok",
  };
}

/**
 * OpenDocument text, spreadsheets and presentations are zip containers whose
 * whole body lives in content.xml. Deterministic, no service, no model.
 */
export function openDocumentText(xml: string): string {
  const withBreaks = xml
    .replace(/<text:line-break\s*\/>/g, "\n")
    .replace(/<text:tab\s*\/>/g, "\t")
    .replace(/<\/text:(p|h)>/g, "\n")
    .replace(/<\/table:table-row>/g, "\n")
    .replace(/<\/table:table-cell>/g, "\t")
    .replace(/<\/draw:frame>/g, "\n")
    .replace(/<\/office:body>/g, "\n");
  const stripped = withBreaks.replace(/<[^>]+>/g, "");
  return unescapeXml(stripped)
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, "").trimStart())
    .filter((line, index, all) => line.trim() !== "" || (all[index - 1] ?? "").trim() !== "")
    .join("\n")
    .trim();
}

const OPEN_DOCUMENT_LABEL: Record<"odt" | "ods" | "odp", string> = {
  odt: "document",
  ods: "spreadsheet",
  odp: "presentation",
};

async function extractOpenDocument(
  bytes: Uint8Array,
  shape: "odt" | "ods" | "odp",
): Promise<ItemTextResult> {
  const { unzipSync, strFromU8 } = await import("fflate");
  const files = unzipSync(bytes);
  const entry = files["content.xml"];
  if (!entry) {
    return {
      text: null,
      status: "failed",
      note: "this OpenDocument file has no content part",
      reason: "odf_no_content_xml",
    };
  }
  const text = openDocumentText(strFromU8(entry));
  if (!text) {
    return {
      text: null,
      status: "unreadable",
      note: `this ${OPEN_DOCUMENT_LABEL[shape]} has no readable text`,
      reason: "empty_document",
    };
  }
  return { text, status: "ok" };
}

async function decode(
  shape: Exclude<BinaryShape, null>,
  bytes: Uint8Array,
): Promise<ItemTextResult> {
  if (shape === "docx") return extractDocx(bytes);
  if (shape === "xlsx") return extractXlsx(bytes);
  if (shape === "pdf") return extractPdf(bytes);
  if (shape === "pptx") return extractPptx(bytes);
  return extractOpenDocument(bytes, shape);
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
      .select("turn_no, role, content")
      .eq("work_item_id", item.id)
      .order("turn_no", { ascending: true });
    const text = (data ?? [])
      .map((t) => `TURN ${t.turn_no} ${t.role.toUpperCase()}: ${t.content}`)
      .join("\n\n");
    const turnHash = `turns:${(data ?? []).length}:${text.length}`;
    return finish(
      item,
      turnHash,
      text.trim()
        ? { text, status: "ok" }
        : {
            text: null,
            status: "unreadable",
            note: "no turns are stored for this conversation",
            reason: "empty_thread",
          },
      "thread",
    );
  }

  if (!item.content_ref) {
    return finish(
      item,
      "none",
      {
        text: null,
        status: "unreadable",
        note: "nothing is stored for this item",
        reason: "no_stored_bytes",
      },
      "none",
    );
  }

  if (needsTextFetch(format)) {
    const raw = await downloadText(item.content_ref);
    if (raw === null) {
      return finish(
        item,
        item.content_hash ?? "text",
        {
          text: null,
          status: "failed",
          note: "the stored file could not be opened",
          reason: "download_failed",
        },
        format.kind,
      );
    }
    return finish(
      item,
      item.content_hash ?? `text:${raw.length}`,
      raw.trim()
        ? { text: raw, status: "ok" }
        : { text: null, status: "unreadable", note: "this file is empty", reason: "empty_file" },
      format.kind,
    );
  }

  const shape = binaryShape(item);
  if (!shape) {
    return finish(
      item,
      item.content_hash ?? "unsupported",
      {
        text: null,
        status: "unsupported",
        note: format.kind === "image" ? "this is an image" : "this format cannot be read as text",
        reason: format.kind === "image" ? "image_format" : "unsupported_format",
      },
      format.kind,
    );
  }

  const meta = metaOf(item);
  const known = normalizeStatus(meta.text_status);
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
  if (!bytes) {
    return finish(
      item,
      item.content_hash ?? "missing",
      {
        text: null,
        status: "failed",
        note: "the stored file could not be opened",
        reason: "download_failed",
      },
      shape,
    );
  }
  const hash = await sha256Hex(bytes);

  if (known && knownHash === hash) {
    if (known === "ok" && meta.text_ref) {
      const cached = await downloadText(meta.text_ref);
      if (cached) return { text: cached, status: "ok" };
    } else if (known !== "ok") {
      return { text: null, status: known, ...(meta.text_note ? { note: meta.text_note } : {}) };
    }
  }

  // A very large file is never decoded inline: the capture request that asked
  // for it would time out and take every later item in the batch with it.
  if (bytes.byteLength > MAX_DECODE_BYTES) {
    return finish(
      item,
      hash,
      {
        text: null,
        status: "unreadable",
        note: "this file is too large to read here",
        reason: "too_large",
      },
      shape,
    );
  }

  let result: ItemTextResult;
  try {
    result = await decode(shape, bytes);
  } catch (e) {
    const reason = (e as Error).message ?? "unknown error";
    result = /password|encrypt/i.test(reason)
      ? {
          text: null,
          status: "failed",
          note: "this file is password protected",
          reason: "password_protected",
        }
      : {
          text: null,
          status: "failed",
          note: `this file could not be decoded (${reason.slice(0, 120)})`,
          reason: "decode_error",
        };
  }
  return finish(item, hash, result, shape);
}
