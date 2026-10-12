/** Resend inserts template variables raw, so anything a person typed is escaped. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Resend reuses a variable in subject, HTML and plain text; strip tag brackets only so apostrophes stay readable. */
export function emailVar(value: unknown): string {
  return String(value ?? "").replace(/[<>]/g, "");
}
