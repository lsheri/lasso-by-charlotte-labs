/**
 * Honest source dates. Nothing here invents a value: an absent provider field
 * stays absent, and an existing work_date is never overwritten.
 */

/** yyyy-MM-dd for a provider timestamp, or null when there isn't one. */
export function dateOnly(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const value = typeof iso === "string" && /^\d+$/.test(iso) ? Number(iso) : iso;
  const parsed = new Date(value as string | number);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

/**
 * The work_date to write on import: whatever is already set wins, otherwise
 * the provider's own date, otherwise nothing.
 */
export function defaultWorkDate(
  existing: string | null | undefined,
  provider: string | null | undefined,
): string | null {
  if (existing) return existing;
  return dateOnly(provider);
}

export type DriveSourceMeta = {
  filename: string;
  mime_type: string;
  /** The file's real Drive mimeType, including Google-native types. */
  mime?: string;
  /** Set only when a Google-native file was exported to a readable format. */
  export_mime?: string;
  created_at?: string;
  modified_at?: string;
};

/** source_meta for a Drive import. Absent provider fields are left out. */
export function driveSourceMeta(input: {
  filename: string;
  storedMime: string;
  sourceMime?: string | null;
  exportMime?: string | null;
  createdTime?: string | null;
  modifiedTime?: string | null;
}): DriveSourceMeta {
  const meta: DriveSourceMeta = {
    filename: input.filename,
    mime_type: input.storedMime,
  };
  if (input.sourceMime) meta.mime = input.sourceMime;
  if (input.exportMime) meta.export_mime = input.exportMime;
  if (input.createdTime) meta.created_at = input.createdTime;
  if (input.modifiedTime) meta.modified_at = input.modifiedTime;
  return meta;
}
