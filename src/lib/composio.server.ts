import { Composio } from "@composio/core";

import type { ConnectorToolkit } from "@/lib/connector-toolkits";

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

/** Which Google account is actually linked — verified against Drive itself. */
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
  opts: { folderId?: string | null; search?: string | null; pageToken?: string | null },
): Promise<{ files: DriveFile[]; nextPageToken: string | null }> {
  const clauses = ["trashed = false"];
  const term = opts.search?.trim();
  if (term) clauses.push(`name contains '${term.replace(/'/g, "\\'")}'`);
  else clauses.push(`'${opts.folderId || "root"}' in parents`);

  const data = await run("GOOGLEDRIVE_LIST_FILES", entityId, {
    q: clauses.join(" and "),
    fields: "nextPageToken, files(id,name,mimeType,modifiedTime,webViewLink,size)",
    orderBy: term ? "modifiedTime desc" : "folder,modifiedTime desc",
    pageSize: 50,
    ...(opts.pageToken ? { pageToken: opts.pageToken } : {}),
  });
  const files = (data["files"] as DriveFile[] | undefined) ?? [];
  return {
    files: Array.isArray(files) ? files : [],
    nextPageToken: (data["nextPageToken"] as string | undefined) ?? null,
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

/** Bytes as Drive serves them. Google-native docs (which have no binary form)
 * come back as an exported PDF; everything else is byte-true. */
export async function fetchDriveFileBytes(
  entityId: string,
  fileId: string,
): Promise<{
  bytes: Uint8Array;
  mimeType: string;
  name: string;
  webViewLink: string | null;
} | null> {
  const data = await run("GOOGLEDRIVE_PARSE_FILE", entityId, { file_id: fileId });
  const file = data["file"] as { s3url?: string; mimetype?: string; name?: string } | undefined;
  if (!file?.s3url) return null;
  const response = await fetch(file.s3url);
  if (!response.ok) return null;
  return {
    bytes: new Uint8Array(await response.arrayBuffer()),
    mimeType: file.mimetype ?? "application/octet-stream",
    name: file.name ?? "Untitled file",
    webViewLink: (data["display_url"] as string | undefined) ?? null,
  };
}

// --------------------------------------------------------------------- Granola
