export type WorkboardDisplayMode = "sticky" | "preview";

export type WorkboardPreviewTurn = {
  turnNo: number;
  role: string;
  content: string;
};

export type WorkboardCardPreview = {
  workItemId: string;
  summary?: string | null;
  turns: WorkboardPreviewTurn[];
  firstUserTurn?: WorkboardPreviewTurn | null;
  turnCount: number;
  model: string | null;
};

export type WorkboardFilePreview = {
  workItemId: string;
  kind: "pdf" | "slide" | "text" | "html" | "mermaid" | "fallback";
  url: string | null;
  lines: string[];
  slideTitle: string | null;
  html?: string;
  pages?: { title: string | null; lines: string[] }[];
  versionCount: number;
};

export type WorkboardFilePreviewMap = Record<string, WorkboardFilePreview>;

export function workboardDisplayModeKey(profileId: string, engagementId: string): string {
  return `lasso:workboard:${profileId}:${engagementId}:display`;
}

export function readWorkboardDisplayMode(value: string | null): WorkboardDisplayMode {
  return value === "sticky" ? "sticky" : "preview";
}

export const PREVIEW_CSP = "default-src 'none'; script-src 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; style-src 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; font-src https://fonts.gstatic.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net data:; img-src data: https:; connect-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'";

const CSP_META = `<meta http-equiv="Content-Security-Policy" content="${PREVIEW_CSP}">`;

/** Give an isolated artifact one closed policy, always first in its head. */
export function withPreviewCsp(source: string): string {
  const withoutCsp = source.replace(/<meta\b[^>]*http-equiv\s*=\s*["']?content-security-policy["']?[^>]*>/gi, "");
  if (/<head\b[^>]*>/i.test(withoutCsp)) {
    return withoutCsp.replace(/<head\b([^>]*)>/i, `<head$1>${CSP_META}`);
  }
  if (/<html\b[^>]*>/i.test(withoutCsp)) {
    return withoutCsp.replace(/<html\b([^>]*)>/i, `<html$1><head>${CSP_META}</head>`);
  }
  return `<!doctype html><html><head>${CSP_META}</head><body>${withoutCsp}</body></html>`;
}

/** A focused mini-window consumes the wheel only while it can move that way. */
export function previewWheelConsumesScroll(
  focused: boolean,
  deltaY: number,
  scrollTop: number,
  clientHeight: number,
  scrollHeight: number,
): boolean {
  if (!focused || deltaY === 0) return false;
  return deltaY < 0 ? scrollTop > 0 : scrollTop + clientHeight < scrollHeight;
}