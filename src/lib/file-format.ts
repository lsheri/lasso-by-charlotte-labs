/**
 * Pass 140: the real end product format of a piece of work, so a card can wear
 * the logo of the thing it actually is. One resolver, one precedence order, so
 * the icon and any label can never disagree.
 *
 * Precedence: an explicit meta.file_format, then the provider mime, then the
 * file name extension, then "other".
 */

export const FILE_FORMATS = [
  "word",
  "google_docs",
  "google_slides",
  "powerpoint",
  "google_sheets",
  "excel",
  "pdf",
  "text",
  "other",
] as const;

export type FileFormat = (typeof FILE_FORMATS)[number];

export type FileFormatInput = {
  meta?:
    | {
        file_format?: string | null;
        mime_type?: string | null;
        source_mime?: string | null;
      }
    | null
    | undefined;
  source_meta?:
    | {
        mime_type?: string | null;
        mime?: string | null;
        filename?: string | null;
      }
    | null
    | undefined;
  title?: string | null | undefined;
  filename?: string | null | undefined;
};

const MIME_FORMAT: Record<string, FileFormat> = {
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "word",
  "application/msword": "word",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "powerpoint",
  "application/vnd.ms-powerpoint": "powerpoint",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "excel",
  "application/vnd.ms-excel": "excel",
  "application/vnd.google-apps.document": "google_docs",
  "application/vnd.google-apps.presentation": "google_slides",
  "application/vnd.google-apps.spreadsheet": "google_sheets",
  "application/pdf": "pdf",
  "text/plain": "text",
  "text/markdown": "text",
};

const EXTENSION_FORMAT: Record<string, FileFormat> = {
  docx: "word",
  doc: "word",
  pptx: "powerpoint",
  ppt: "powerpoint",
  xlsx: "excel",
  xls: "excel",
  pdf: "pdf",
  txt: "text",
  md: "text",
};

function isFormat(value: unknown): value is FileFormat {
  return typeof value === "string" && (FILE_FORMATS as readonly string[]).includes(value);
}

/** The one resolver. Explicit format beats mime, mime beats extension. */
export function resolveFileFormat(item: FileFormatInput | null | undefined): FileFormat {
  if (!item) return "other";

  const explicit = item.meta?.file_format;
  if (isFormat(explicit)) return explicit;

  const mimes = [
    item.source_meta?.mime_type,
    item.source_meta?.mime,
    item.meta?.source_mime,
    item.meta?.mime_type,
  ];
  for (const mime of mimes) {
    const found = MIME_FORMAT[(mime ?? "").trim().toLowerCase()];
    if (found) return found;
  }

  const names = [item.filename, item.source_meta?.filename, item.title];
  for (const name of names) {
    const extension = /\.([a-z0-9]+)\s*$/.exec((name ?? "").trim().toLowerCase())?.[1];
    if (extension && EXTENSION_FORMAT[extension]) return EXTENSION_FORMAT[extension];
  }

  return "other";
}

/**
 * How the format is drawn. Conventional file type colors are icon fill only.
 * PDF stays graphite: this system reserves red, and the PDF mark is red.
 */
export type FileFormatGlyph =
  | "word"
  | "google_docs"
  | "google_slides"
  | "powerpoint"
  | "google_sheets"
  | "excel"
  | "document";

const FORMAT_GLYPH: Record<FileFormat, FileFormatGlyph> = {
  word: "word",
  google_docs: "google_docs",
  google_slides: "google_slides",
  powerpoint: "powerpoint",
  google_sheets: "google_sheets",
  excel: "excel",
  pdf: "document",
  text: "document",
  other: "document",
};

export function fileFormatGlyph(format: FileFormat): FileFormatGlyph {
  return FORMAT_GLYPH[format];
}
