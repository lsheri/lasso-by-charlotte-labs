/**
 * Clients sit above engagements. They are optional: an engagement with no
 * client still works exactly as it did. A quick folder is a client with one
 * hidden engagement behind it, so the person sees a folder and never a
 * ceremony they did not ask for.
 */

/** The hidden engagement behind a quick folder. Never shown to anyone. */
export const QUICK_FOLDER_ENGAGEMENT_TITLE = "General work";

export type ClientRef = { name: string; quick_folder: boolean } | null | undefined;

export type EngagementLike = {
  title: string;
  code?: string | null;
  client_label?: string | null;
  clients?: ClientRef;
};

/** Never let the synthetic engagement title reach a person or a prompt. */
export function engagementDisplayTitle(engagement: EngagementLike): string {
  if (engagement.clients?.quick_folder) return engagement.clients.name;
  return engagement.title;
}

/** Quick folders have no meaningful code to show. */
export function engagementDisplayCode(engagement: EngagementLike): string | null {
  if (engagement.clients?.quick_folder) return null;
  return engagement.code ?? null;
}

/** client_id is the truth; the old free-text label is a read-only fallback. */
export function clientDisplayName(engagement: EngagementLike): string | null {
  return engagement.clients?.name ?? engagement.client_label ?? null;
}

export function isQuickFolder(engagement: EngagementLike): boolean {
  return Boolean(engagement.clients?.quick_folder);
}

/** Selected wherever an engagement is read alongside its client. */
export const CLIENT_JOIN = "clients(id, name, quick_folder)";

/** The one label used wherever an engagement is listed to a person. */
export function engagementLabel(engagement: EngagementLike): string {
  const code = engagementDisplayCode(engagement);
  const title = engagementDisplayTitle(engagement);
  return code ? `${code} · ${title}` : title;
}
