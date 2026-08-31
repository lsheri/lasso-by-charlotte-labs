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
