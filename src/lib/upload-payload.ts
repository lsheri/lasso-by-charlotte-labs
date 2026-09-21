/**
 * Pass 141: what a manual upload records about the file itself. The browser
 * knows the real mime type at capture time; keeping it here is what lets the
 * format resolver read an uploaded file without any hand written metadata.
 */

export type UploadSourceMeta = {
  filename: string;
  mime_type?: string;
};

/** The source_meta written when a file is captured by hand. */
export function buildUploadSourceMeta(file: { name: string; type?: string | null }): UploadSourceMeta {
  const mime = (file.type ?? "").trim();
  return mime ? { filename: file.name, mime_type: mime } : { filename: file.name };
}

/**
 * F1: the key a file is stored under.
 *
 * Storage refuses keys carrying characters like square brackets, so the key is
 * cleaned while the person keeps the name they gave the file as the title. The
 * extension survives, so the format is still read from it, and the unique id
 * keeps two files of the same name apart.
 */
export function safeStorageName(filename: string): string {
  const name = (filename ?? "").trim();
  const dot = name.lastIndexOf(".");
  const hasExt = dot > 0 && dot < name.length - 1;
  const stem = hasExt ? name.slice(0, dot) : name;
  const ext = hasExt ? name.slice(dot + 1) : "";
  const clean = (value: string) => value.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "");
  const safeStem = clean(stem).slice(0, 100) || "file";
  const safeExt = clean(ext).slice(0, 20);
  return safeExt ? `${safeStem}.${safeExt}` : safeStem;
}

/** The full object key: owner folder, unique id, cleaned name. */
export function storageObjectKey(userId: string, uniqueId: string, filename: string): string {
  return `${userId}/${uniqueId}-${safeStorageName(filename)}`;
}
