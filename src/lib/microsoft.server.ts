import { composio } from "@/lib/composio.server";

/**
 * Microsoft browsing (OneDrive + SharePoint) over Composio.
 *
 * Composio's one_drive toolkit only publishes a *root* listing action
 * (ONE_DRIVE_ONEDRIVE_LIST_ITEMS) and a folders-only finder, so real
 * folder-first navigation goes through Composio's authenticated proxy to
 * Microsoft Graph. Downloads use the published actions, which stream the file
 * to Composio's file backend and hand back a short-lived URL.
 */

export type MsToolkit = "one_drive" | "sharepoint_graph";

export type MsItem = {
  id: string;
  name: string;
  isFolder: boolean;
  mimeType: string | null;
  modified: string | null;
  webUrl: string | null;
};

type GraphItem = {
  id?: string;
  name?: string;
  displayName?: string;
  webUrl?: string;
  lastModifiedDateTime?: string;
  folder?: unknown;
  file?: { mimeType?: string };
};

/** SharePoint ids are composite: a site or a (drive, item) pair. */
const SITE = "site|";
const DRIVE = "drive|";

function encodeDriveItem(driveId: string, itemId: string): string {
  return `${DRIVE}${driveId}|${itemId}`;
}

export function decodeDriveItem(id: string): { driveId: string; itemId: string } | null {
  if (!id.startsWith(DRIVE)) return null;
  const [, driveId, itemId] = id.split("|");
  return driveId && itemId ? { driveId, itemId } : null;
}

export type MsAuth = { entityId: string; accountId: string };

async function graph(auth: MsAuth, endpoint: string): Promise<Record<string, unknown>> {
  const response = await composio().tools.proxyExecute({
    connectedAccountId: auth.accountId,
    endpoint,
    method: "GET",
  });
  const body = (response as { data?: unknown }).data ?? response;
  return (body ?? {}) as Record<string, unknown>;
}

function values(body: Record<string, unknown>): GraphItem[] {
  const direct = body["value"];
  if (Array.isArray(direct)) return direct as GraphItem[];
  const nested = (body["data"] as Record<string, unknown> | undefined)?.["value"];
  return Array.isArray(nested) ? (nested as GraphItem[]) : [];
}

function toItem(raw: GraphItem, id: string): MsItem {
  return {
    id,
    name: raw.name ?? raw.displayName ?? "Untitled",
    isFolder: Boolean(raw.folder),
    mimeType: raw.file?.mimeType ?? null,
    modified: raw.lastModifiedDateTime ?? null,
    webUrl: raw.webUrl ?? null,
  };
}

function escapeQuery(term: string): string {
  return encodeURIComponent(term.replace(/'/g, "''"));
}

async function browseOneDrive(
  auth: MsAuth,
  opts: { folderId: string | null; search: string | null },
): Promise<MsItem[]> {
  const term = opts.search?.trim();
  const endpoint = term
    ? `/me/drive/root/search(q='${escapeQuery(term)}')?$top=50`
    : opts.folderId
      ? `/me/drive/items/${encodeURIComponent(opts.folderId)}/children?$top=50`
      : `/me/drive/root/children?$top=50`;
  const body = await graph(auth, endpoint);
  return values(body).map((raw) => toItem(raw, raw.id ?? ""));
}

async function browseSharePoint(
  auth: MsAuth,
  opts: { folderId: string | null; search: string | null },
): Promise<MsItem[]> {
  const term = opts.search?.trim();

  // Top level is the list of sites the user can reach.
  if (!opts.folderId) {
    const body = await graph(auth, `/sites?search=${term ? escapeQuery(term) : "*"}`);
    return values(body).map((raw) => ({
      id: `${SITE}${raw.id ?? ""}`,
      name: raw.displayName ?? raw.name ?? "Site",
      isFolder: true,
      mimeType: null,
      modified: raw.lastModifiedDateTime ?? null,
      webUrl: raw.webUrl ?? null,
    }));
  }

  // Entering a site drops into its default document library.
  if (opts.folderId.startsWith(SITE)) {
    const siteId = opts.folderId.slice(SITE.length);
    const drive = await graph(auth, `/sites/${encodeURIComponent(siteId)}/drive`);
    const driveId = String(
      drive["id"] ?? (drive["data"] as Record<string, unknown> | undefined)?.["id"] ?? "",
    );
    if (!driveId) return [];
    const body = await graph(auth, `/drives/${encodeURIComponent(driveId)}/root/children?$top=50`);
    return values(body).map((raw) => toItem(raw, encodeDriveItem(driveId, raw.id ?? "")));
  }

  const decoded = decodeDriveItem(opts.folderId);
  if (!decoded) return [];
  const body = await graph(
    auth,
    `/drives/${encodeURIComponent(decoded.driveId)}/items/${encodeURIComponent(decoded.itemId)}/children?$top=50`,
  );
  return values(body).map((raw) => toItem(raw, encodeDriveItem(decoded.driveId, raw.id ?? "")));
}

export async function browseMicrosoft(
  toolkit: MsToolkit,
  auth: MsAuth,
  opts: { folderId?: string | null; search?: string | null },
): Promise<MsItem[]> {
  const args = { folderId: opts.folderId ?? null, search: opts.search ?? null };
  const items =
    toolkit === "one_drive"
      ? await browseOneDrive(auth, args)
      : await browseSharePoint(auth, args);
  return items
    .filter((item) => item.id)
    .sort((a, b) => Number(b.isFolder) - Number(a.isFolder) || a.name.localeCompare(b.name));
}

/** Who is actually linked, so users can confirm the right Microsoft account. */
export async function microsoftIdentity(auth: MsAuth): Promise<string | null> {
  try {
    const body = await graph(auth, "/me?$select=userPrincipalName,displayName,mail");
    const pool = ((body["data"] as Record<string, unknown> | undefined) ?? body) as Record<
      string,
      unknown
    >;
    for (const key of ["mail", "userPrincipalName", "displayName"]) {
      const value = pool[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
  } catch {
    /* identity is best-effort; the card falls back to the connection date */
  }
  return null;
}

export async function fetchMicrosoftFileBytes(
  toolkit: MsToolkit,
  entityId: string,
  id: string,
  fallbackName: string,
): Promise<{ bytes: Uint8Array; mimeType: string; name: string; webViewLink: string | null } | null> {
  const decoded = decodeDriveItem(id);
  const slug = toolkit === "one_drive" ? "ONE_DRIVE_DOWNLOAD_FILE" : "SHAREPOINT_GRAPH_DOWNLOAD_DRIVE_ITEM";
  const args: Record<string, unknown> =
    toolkit === "one_drive"
      ? { item_id: id, file_name: fallbackName }
      : { drive_id: decoded?.driveId ?? "", item_id: decoded?.itemId ?? "" };

  const result = await composio().tools.execute(slug, {
    userId: entityId,
    dangerouslySkipVersionCheck: true,
    arguments: args,
  });
  if (result.successful === false) throw new Error(result.error ?? `${slug} failed`);

  const data = (result.data ?? {}) as Record<string, unknown>;
  const content = (data["content"] ?? data["file"] ?? data) as Record<string, unknown>;
  const url = (content["s3url"] ?? content["s3_url"] ?? content["url"]) as string | undefined;
  if (!url) return null;
  const response = await fetch(url);
  if (!response.ok) return null;
  return {
    bytes: new Uint8Array(await response.arrayBuffer()),
    mimeType: (content["mimetype"] as string | undefined) ?? "application/octet-stream",
    name: (content["name"] as string | undefined) ?? fallbackName,
    webViewLink: (data["display_url"] as string | undefined) ?? null,
  };
}
