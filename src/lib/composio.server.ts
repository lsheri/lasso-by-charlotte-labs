import { Composio } from "@composio/core";

import type { ConnectorToolkit } from "@/lib/connector-toolkits";
import {
  buildDriveQuery,
  type DriveAgeFilter,
  type DriveScope,
  type DriveTypeFilter,
} from "@/lib/drive-scope";

let client: Composio | undefined;

export function composio(): Composio {
  if (!client) {
    const apiKey = process.env["COMPOSIO_API_KEY"];
    if (!apiKey) throw new Error("Composio is not configured");
    client = new Composio({ apiKey });
  }
  return client;
}

const AUTH_CONFIG_NAMES: Record<ConnectorToolkit, string> = {
  googledrive: "Google Drive Auth Config",
  one_drive: "OneDrive Auth Config",
  sharepoint_graph: "SharePoint Auth Config",
  gmail: "Gmail Auth Config",
  slack: "Slack Auth Config",
  notion: "Notion Auth Config",
  granola_mcp: "Granola Auth Config",
};

/** Granola has no Composio-managed credentials; it authenticates through
 * dynamic client registration against Granola's own OAuth server. */
const CUSTOM_AUTH: Partial<Record<ConnectorToolkit, "DCR_OAUTH">> = {
  granola_mcp: "DCR_OAUTH",
};

/** Finds (or creates) the Composio auth config for a toolkit. */
export async function resolveAuthConfigId(toolkit: ConnectorToolkit): Promise<string> {
  const c = composio();
  const existing = await c.authConfigs.list({ toolkit });
  const match = existing.items?.[0];
  if (match?.id) return match.id;
  const scheme = CUSTOM_AUTH[toolkit];
  const created = scheme
    ? await c.authConfigs.create(toolkit, {
        type: "use_custom_auth",
        authScheme: scheme,
        name: AUTH_CONFIG_NAMES[toolkit],
        credentials: {},
      })
    : await c.authConfigs.create(toolkit, {
        type: "use_composio_managed_auth",
        name: AUTH_CONFIG_NAMES[toolkit],
      });
  return created.id;
}

/** Composio refuses "latest" for manual execution; we pin nothing and accept
 * the current published version of each action. */
async function run(
  slug: string,
  entityId: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const result = await composio().tools.execute(slug, {
    userId: entityId,
    dangerouslySkipVersionCheck: true,
    arguments: args,
  });
  if (result.successful === false) throw new Error(result.error ?? `${slug} failed`);
  return (result.data ?? {}) as Record<string, unknown>;
}

// ---------------------------------------------------------------- Google Drive

export type DriveFile = {
  id?: string;
  name?: string;
  mimeType?: string;
  modifiedTime?: string;
  webViewLink?: string;
  size?: string;
};

export const DRIVE_FOLDER_MIME = "application/vnd.google-apps.folder";

/** Writes a markdown brief into the person's own Drive as a Google Doc. */
export async function createDriveDoc(
  entityId: string,
  fileName: string,
  text: string,
): Promise<{ link: string | null }> {
  const data = await run("GOOGLEDRIVE_CREATE_FILE_FROM_TEXT", entityId, {
    file_name: fileName,
    text_content: text,
    mime_type: "text/markdown",
  });
  const nested = (data["file"] ?? data["response_data"] ?? data) as Record<string, unknown>;
  const link =
    (nested["webViewLink"] as string | undefined) ??
    (typeof nested["id"] === "string"
      ? `https://drive.google.com/file/d/${nested["id"] as string}/view`
      : null);
  return { link: link ?? null };
}

/** Which Google account is actually linked, verified against Drive itself. */
export async function driveAccountIdentity(entityId: string): Promise<string | null> {
  try {
    const data = await run("GOOGLEDRIVE_GET_ABOUT", entityId, { fields: "user" });
    const user = data["user"] as { emailAddress?: string; displayName?: string } | undefined;
    return user?.emailAddress ?? user?.displayName ?? null;
  } catch {
    return null;
  }
}

/** One page of a folder's contents, or of a name search across the Drive. */
export async function browseDrive(
  entityId: string,
  opts: {
    folderId?: string | null;
    search?: string | null;
    pageToken?: string | null;
    scope?: DriveScope;
    driveId?: string | null;
    typeFilter?: DriveTypeFilter;
    ageFilter?: DriveAgeFilter;
  },
): Promise<{ files: DriveFile[]; nextPageToken: string | null }> {
  const query = buildDriveQuery({
    scope: opts.scope,
    driveId: opts.driveId ?? null,
    folderId: opts.folderId ?? null,
    search: opts.search ?? null,
    typeFilter: opts.typeFilter,
    ageFilter: opts.ageFilter,
  });

  const data = await run("GOOGLEDRIVE_LIST_FILES", entityId, {
    q: query.q,
    fields: "nextPageToken, files(id,name,mimeType,modifiedTime,webViewLink,size)",
    orderBy: opts.search?.trim() ? "modifiedTime desc" : "folder,modifiedTime desc",
    pageSize: 50,
    corpora: query.corpora,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    ...(query.driveId ? { driveId: query.driveId } : {}),
    ...(opts.pageToken ? { pageToken: opts.pageToken } : {}),
  });
  const files = (data["files"] as DriveFile[] | undefined) ?? [];
  return {
    files: Array.isArray(files) ? files : [],
    nextPageToken: (data["nextPageToken"] as string | undefined) ?? null,
  };
}

/** The shared drives this person can reach, listed as navigable places. */
export async function listSharedDrives(
  entityId: string,
  opts: { pageToken?: string | null } = {},
): Promise<{ drives: { id: string; name: string }[]; nextPageToken: string | null }> {
  const data = await run("GOOGLEDRIVE_LIST_SHARED_DRIVES", entityId, {
    pageSize: 100,
    ...(opts.pageToken ? { pageToken: opts.pageToken } : {}),
  });
  const nested = (data["data"] as Record<string, unknown> | undefined) ?? data;
  const raw = (nested["drives"] ?? data["drives"]) as { id?: string; name?: string }[] | undefined;
  return {
    drives: (Array.isArray(raw) ? raw : [])
      .filter((drive) => typeof drive.id === "string" && drive.id)
      .map((drive) => ({ id: drive.id as string, name: drive.name ?? "Shared drive" })),
    nextPageToken:
      (nested["nextPageToken"] as string | undefined) ??
      (data["nextPageToken"] as string | undefined) ??
      null,
  };
}


/**
 * Best-effort human identity for a connected account, so users can verify they
 * linked the right one. Composio exposes this inconsistently across toolkits,
 * so we look through the usual places and return null rather than guess.
 */
export function connectedAccountIdentity(account: Record<string, unknown>): string | null {
  const pools: unknown[] = [
    account,
    account["data"],
    account["params"],
    account["metadata"],
    (account["state"] as Record<string, unknown> | undefined)?.["val"],
    account["state"],
  ];
  const keys = [
    "email",
    "user_email",
    "account_email",
    "email_address",
    "login",
    "username",
    "user_name",
    "workspace_name",
    "team_name",
    "account_name",
    "name",
  ];
  for (const pool of pools) {
    if (!pool || typeof pool !== "object") continue;
    const record = pool as Record<string, unknown>;
    for (const key of keys) {
      const value = record[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
  }
  return null;
}

/**
 * Google-native docs have no binary form, so they must be exported. We export
 * them as text shapes the context layer and the peek panel can both read; PDF
 * is a last resort for slides only. Non-Google binaries are byte-true.
 */
const GOOGLE_EXPORTS: Record<string, { mime: string; ext: string }[]> = {
  "application/vnd.google-apps.document": [
    { mime: "text/markdown", ext: "md" },
    { mime: "text/plain", ext: "txt" },
  ],
  "application/vnd.google-apps.spreadsheet": [{ mime: "text/csv", ext: "csv" }],
  "application/vnd.google-apps.presentation": [
    { mime: "text/plain", ext: "txt" },
    { mime: "application/pdf", ext: "pdf" },
  ],
};

function withExtension(name: string, ext: string): string {
  const base = name.replace(/\.[a-z0-9]{1,6}$/i, "");
  return `${base}.${ext}`;
}

async function exportGoogleDoc(
  entityId: string,
  fileId: string,
  sourceMime: string,
  name: string,
): Promise<{ bytes: Uint8Array; mimeType: string; name: string } | null> {
  for (const target of GOOGLE_EXPORTS[sourceMime] ?? []) {
    try {
      const data = await run("GOOGLEDRIVE_DOWNLOAD_FILE", entityId, {
        file_id: fileId,
        mime_type: target.mime,
      });
      const file = data["file"] as { s3url?: string; name?: string } | undefined;
      if (!file?.s3url) continue;
      const response = await fetch(file.s3url);
      if (!response.ok) continue;
      return {
        bytes: new Uint8Array(await response.arrayBuffer()),
        mimeType: target.mime,
        name: withExtension(file.name ?? name, target.ext),
      };
    } catch {
      // Try the next export shape rather than failing the import.
    }
  }
  return null;
}

export type DriveFetch = {
  bytes: Uint8Array;
  mimeType: string;
  name: string;
  webViewLink: string | null;
  /** The file's own Drive mimeType, including Google-native types. */
  sourceMime?: string | null;
  /** Set only when a Google-native file was exported to a readable format. */
  exportMime?: string | null;
  createdTime?: string | null;
  modifiedTime?: string | null;
};

/**
 * Drive's own timestamps for one file. Best effort on purpose: when Drive does
 * not answer, the dates stay absent rather than being invented.
 */
async function driveFileTimes(
  entityId: string,
  fileId: string,
): Promise<{ createdTime: string | null; modifiedTime: string | null; mimeType: string | null }> {
  const empty = { createdTime: null, modifiedTime: null, mimeType: null };
  try {
    const data = await run("GOOGLEDRIVE_GET_FILE_METADATA", entityId, {
      file_id: fileId,
      fields: "id,name,mimeType,createdTime,modifiedTime",
    });
    const file = (data["file"] ?? data) as Record<string, unknown>;
    const pick = (key: string, alt: string) => {
      const value = file[key] ?? file[alt];
      return typeof value === "string" ? value : null;
    };
    return {
      createdTime: pick("createdTime", "created_time"),
      modifiedTime: pick("modifiedTime", "modified_time"),
      mimeType: pick("mimeType", "mime_type"),
    };
  } catch {
    return empty;
  }
}

export async function fetchDriveFileBytes(
  entityId: string,
  fileId: string,
  sourceMime?: string | null,
): Promise<DriveFetch | null> {
  const data = await run("GOOGLEDRIVE_PARSE_FILE", entityId, { file_id: fileId });
  const file = data["file"] as { s3url?: string; mimetype?: string; name?: string } | undefined;
  if (!file?.s3url) return null;
  const webViewLink = (data["display_url"] as string | undefined) ?? null;
  const name = file.name ?? "Untitled file";

  const times = await driveFileTimes(entityId, fileId);

  // A Google-native file must be exported as structured text. Falling through
  // to the PDF render is what left documents readable only as page images.
  const reported =
    (data["mimeType"] as string | undefined) ?? times.mimeType ?? file.mimetype ?? null;
  const native =
    sourceMime ?? (reported && reported.startsWith("application/vnd.google-apps") ? reported : null);
  const dates = {
    sourceMime: native ?? reported,
    createdTime: times.createdTime,
    modifiedTime: times.modifiedTime,
  };
  if (native && GOOGLE_EXPORTS[native]) {
    const exported = await exportGoogleDoc(entityId, fileId, native, name);
    if (exported) {
      console.log(`[drive] ${fileId} exported as ${exported.mimeType} from ${native}`);
      return { ...exported, webViewLink, ...dates, exportMime: exported.mimeType };
    }
    console.log(`[drive] ${fileId} export failed for ${native}, falling back to stored render`);
  }

  const response = await fetch(file.s3url);
  if (!response.ok) return null;
  console.log(`[drive] ${fileId} taken as ${file.mimetype ?? "unknown"} bytes`);
  return {
    bytes: new Uint8Array(await response.arrayBuffer()),
    mimeType: file.mimetype ?? "application/octet-stream",
    name,
    webViewLink,
    ...dates,
    exportMime: null,
  };
}


// --------------------------------------------------------------------- Granola
