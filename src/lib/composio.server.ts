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

/** Backwards-compatible flat listing used by the older "Sync now" action. */
export async function listDriveFiles(entityId: string, limit = 20): Promise<DriveFile[]> {
  const data = await run("GOOGLEDRIVE_LIST_FILES", entityId, {
    q: "trashed = false",
    fields: "files(id,name,mimeType,modifiedTime,webViewLink)",
    orderBy: "modifiedTime desc",
    pageSize: limit,
  });
  const files = (data["files"] as DriveFile[] | undefined) ?? [];
  return Array.isArray(files) ? files.slice(0, limit) : [];
}

/** Bytes as Drive serves them. Google-native docs (which have no binary form)
 * come back as an exported PDF; everything else is byte-true. */
export async function fetchDriveFileBytes(
  entityId: string,
  fileId: string,
): Promise<{ bytes: Uint8Array; mimeType: string } | null> {
  const data = await run("GOOGLEDRIVE_PARSE_FILE", entityId, { file_id: fileId });
  const file = data["file"] as { s3url?: string; mimetype?: string } | undefined;
  if (!file?.s3url) return null;
  const response = await fetch(file.s3url);
  if (!response.ok) return null;
  return {
    bytes: new Uint8Array(await response.arrayBuffer()),
    mimeType: file.mimetype ?? "application/octet-stream",
  };
}

// --------------------------------------------------------------------- Granola

export type GranolaMeeting = {
  id: string;
  title: string;
  date: string | null;
};

/** Granola is an MCP-backed toolkit: its actions are published per connection
 * rather than in Composio's static catalogue, so we discover them at runtime. */
export async function granolaTools(entityId: string): Promise<string[]> {
  const apiKey = process.env["COMPOSIO_API_KEY"];
  if (!apiKey) throw new Error("Composio is not configured");
  const url = new URL("https://backend.composio.dev/api/v3/tools");
  url.searchParams.set("toolkit_slug", "granola_mcp");
  url.searchParams.set("limit", "100");
  url.searchParams.set("user_id", entityId);
  const response = await fetch(url, { headers: { "x-api-key": apiKey } });
  if (!response.ok) return [];
  const body = (await response.json()) as { items?: { slug?: string }[] };
  return (body.items ?? []).map((i) => i.slug ?? "").filter(Boolean);
}

function pickTool(slugs: string[], patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const hit = slugs.find((s) => pattern.test(s));
    if (hit) return hit;
  }
  return null;
}

function asRecords(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.filter((v): v is Record<string, unknown> => Boolean(v));
  if (value && typeof value === "object") {
    for (const key of ["items", "documents", "meetings", "notes", "results", "data"]) {
      const inner = (value as Record<string, unknown>)[key];
      if (Array.isArray(inner)) return inner as Record<string, unknown>[];
    }
  }
  return [];
}

function str(row: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const v = row[key];
    if (typeof v === "string" && v.trim()) return v;
  }
  return null;
}

/** Recent meetings, if the connection publishes a listing action. */
export async function listGranolaMeetings(
  entityId: string,
): Promise<{ meetings: GranolaMeeting[]; tool: string | null; available: string[] }> {
  const available = await granolaTools(entityId);
  const tool = pickTool(available, [
    /LIST.*(MEETING|DOCUMENT|NOTE)/i,
    /(RECENT|GET).*(MEETING|DOCUMENT|NOTE)S/i,
    /SEARCH.*(MEETING|DOCUMENT|NOTE)/i,
  ]);
  if (!tool) return { meetings: [], tool: null, available };

  const data = await run(tool, entityId, {});
  const meetings = asRecords(data)
    .map((row) => {
      const id = str(row, ["id", "document_id", "meeting_id", "uuid"]);
      if (!id) return null;
      return {
        id,
        title: str(row, ["title", "name", "subject"]) ?? "Untitled meeting",
        date: str(row, ["created_at", "date", "start_time", "startTime", "updated_at"]),
      };
    })
    .filter((m): m is GranolaMeeting => Boolean(m));
  return { meetings, tool, available };
}

/** Transcript / notes for one meeting, verbatim as Granola returns it. */
export async function fetchGranolaTranscript(
  entityId: string,
  meetingId: string,
): Promise<string | null> {
  const available = await granolaTools(entityId);
  const tool = pickTool(available, [
    /GET.*(TRANSCRIPT)/i,
    /GET.*(MEETING|DOCUMENT|NOTE)/i,
    /(TRANSCRIPT|NOTES)/i,
  ]);
  if (!tool) return null;
  const data = await run(tool, entityId, { id: meetingId, document_id: meetingId });
  const direct = str(data, ["transcript", "notes", "content", "text", "markdown"]);
  if (direct) return direct;
  const rows = asRecords(data);
  const joined = rows
    .map((row) => {
      const speaker = str(row, ["speaker", "role", "source"]);
      const text = str(row, ["text", "content", "value"]);
      if (!text) return null;
      return speaker ? `${speaker}: ${text}` : text;
    })
    .filter((line): line is string => Boolean(line))
    .join("\n");
  return joined || JSON.stringify(data);
}
