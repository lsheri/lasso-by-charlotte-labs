/**
 * ONE place decides which brand mark a piece of work wears. SourceMark draws
 * it, BrandLogo holds the art, and this module holds the judgment: a Google
 * Drive item shows the specific Google app mark when the record actually
 * evidences which app it came from, and the plain Drive mark when it does not.
 *
 * Evidence, in order: the file's original Google mime, then the Drive web view
 * link path, then the work type when the type itself is specific.
 */

export type DriveMarkKey = "googledocs" | "googlesheets" | "googleslides" | "googledrive";

export type MarkItem = {
  type?: string | null | undefined;
  meta?: { mime_type?: string | null; source_mime?: string | null; web_view_link?: string | null } | null | undefined;
  source_meta?: { mime?: string | null; mime_type?: string | null } | null | undefined;
};

function lower(value: string | null | undefined): string {
  return (value ?? "").toLowerCase();
}

/** The original Google mime for an item, when the record kept one. */
export function originalGoogleMime(item: MarkItem): string | null {
  const candidates = [item.meta?.source_mime, item.source_meta?.mime];
  for (const candidate of candidates) {
    const value = lower(candidate);
    if (value.startsWith("application/vnd.google-apps")) return value;
  }
  return null;
}

/** Which Google app mark a Drive item should wear. */
export function driveMarkKey(item: MarkItem): DriveMarkKey {
  const mime = originalGoogleMime(item);
  if (mime?.endsWith("presentation")) return "googleslides";
  if (mime?.endsWith("spreadsheet")) return "googlesheets";
  if (mime?.endsWith("document")) return "googledocs";


  const link = lower(item.meta?.web_view_link);
  if (link.includes("/presentation/")) return "googleslides";
  if (link.includes("/spreadsheets/")) return "googlesheets";
  if (link.includes("/document/")) return "googledocs";

  if (item.type === "deck") return "googleslides";
  if (item.type === "sheet") return "googlesheets";

  return "googledrive";
}
