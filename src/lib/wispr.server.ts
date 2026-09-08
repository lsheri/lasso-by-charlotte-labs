/**
 * Wispr Flow, read through its remote MCP server.
 *
 * What we verified from Wispr's own published setup documents, before writing
 * a line of this: the server is read only, it exposes meetings with summaries,
 * notes, transcripts and attendees, and it will not accept a pasted key. Its
 * resource metadata points at an authorization service that speaks
 * authorization code with PKCE and accepts new apps automatically, so that is
 * the flow here. Wispr's own limits stand: Notetaker access is required, it is
 * not available on Wispr Enterprise accounts, and it is Mac only.
 *
 * The connection record lives in connector_accounts with toolkit "wispr". The
 * signed-in credentials live in connector_secrets as JSON, service role only,
 * the same table Granola's key uses. Nothing from that row reaches a browser.
 */

import {
  McpClientError,
  mcpCallTool,
  mcpInitialize,
  mcpListTools,
  mcpSession,
  resultJson,
  toolArgNames,
  type McpSession,
  type McpTool,
} from "@/lib/mcp-client.server";

import {
  discoverAuthServer,
  discoverProtectedResource,
  refreshTokens,
  type AuthServerMeta,
  type OAuthTokens,
} from "@/lib/mcp-oauth.server";

/** Wispr publishes one address for every account. */
export const WISPR_MCP_URL = "https://api.wisprflow.ai/connect/mcp";

export const WISPR_LIMITS =
  "Wispr's own limits apply: you need Notetaker access, it is not available on Wispr Enterprise accounts, and setup is Mac only.";

export type WisprCredentials = {
  mcpUrl: string;
  clientId: string;
  resource: string;
  issuer: string;
  tokens: OAuthTokens;
  /** The Wispr account the sign-in belongs to, when the server tells us. */
  identity: string | null;
};

export type WisprPending = {
  mcpUrl: string;
  clientId: string;
  resource: string;
  issuer: string;
  verifier: string;
  state: string;
  redirectUri: string;
  scopes: string[];
};

export function maskIdentity(value: string | null): string | null {
  if (!value) return null;
  const at = value.indexOf("@");
  if (at <= 1) return `${value.slice(0, 1)}••••`;
  return `${value.slice(0, 2)}••••${value.slice(at)}`;
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function wisprAccountId(profileId: string): Promise<string | null> {
  const db = await admin();
  const { data } = await db
    .from("connector_accounts")
    .select("id")
    .eq("profile_id", profileId)
    .eq("toolkit", "wispr")
    .maybeSingle();
  return data?.id ?? null;
}

export async function upsertWisprAccount(
  profileId: string,
  status: "pending" | "connected",
  watchConfig: Record<string, unknown> | null,
): Promise<string> {
  const db = await admin();
  const existing = await wisprAccountId(profileId);
  const row = {
    profile_id: profileId,
    toolkit: "wispr",
    composio_account_id: null,
    status,
    connected_at: status === "connected" ? new Date().toISOString() : null,
    ...(watchConfig ? { watch_config: watchConfig as never } : {}),
  };
  const write = existing
    ? await db.from("connector_accounts").update(row).eq("id", existing).select("id").single()
    : await db.from("connector_accounts").insert(row).select("id").single();
  if (write.error) throw new Error(write.error.message);
  return write.data.id;
}

export async function savePending(profileId: string, pending: WisprPending): Promise<void> {
  await upsertWisprAccount(profileId, "pending", { wispr_pending: pending });
}

export async function readPending(profileId: string): Promise<WisprPending | null> {
  const db = await admin();
  const { data } = await db
    .from("connector_accounts")
    .select("watch_config")
    .eq("profile_id", profileId)
    .eq("toolkit", "wispr")
    .maybeSingle();
  const value = (data?.watch_config as Record<string, unknown> | null)?.["wispr_pending"];
  return value ? (value as WisprPending) : null;
}

export async function saveCredentials(
  profileId: string,
  credentials: WisprCredentials,
): Promise<void> {
  const accountId = await upsertWisprAccount(profileId, "connected", { wispr_pending: null });
  const db = await admin();
  const write = await db
    .from("connector_secrets")
    .upsert(
      { account_id: accountId, api_key: JSON.stringify(credentials) },
      { onConflict: "account_id" },
    );
  if (write.error) throw new Error(write.error.message);
}

export async function readCredentials(profileId: string): Promise<WisprCredentials | null> {
  const db = await admin();
  const { data: account } = await db
    .from("connector_accounts")
    .select("id, status")
    .eq("profile_id", profileId)
    .eq("toolkit", "wispr")
    .maybeSingle();
  if (!account || account.status !== "connected") return null;
  const { data: secret } = await db
    .from("connector_secrets")
    .select("api_key")
    .eq("account_id", account.id)
    .maybeSingle();
  if (!secret?.api_key) return null;
  try {
    return JSON.parse(secret.api_key) as WisprCredentials;
  } catch {
    return null;
  }
}

export async function forgetWispr(profileId: string): Promise<void> {
  const db = await admin();
  const accountId = await wisprAccountId(profileId);
  if (!accountId) return;
  await db.from("connector_secrets").delete().eq("account_id", accountId);
  await db
    .from("connector_accounts")
    .update({ status: "disconnected", connected_at: null, watch_config: {} })
    .eq("id", accountId);
}

/** A live access token, refreshed quietly when the old one is close to done. */
async function freshToken(
  profileId: string,
  creds: WisprCredentials,
  force = false,
): Promise<string> {
  const expires = creds.tokens.expiresAt;
  const stale = force || (expires ? expires - Date.now() <= 60_000 : false);
  if (!stale || !creds.tokens.refreshToken) {
    return creds.tokens.accessToken;
  }
  const meta: AuthServerMeta = await discoverAuthServer(creds.issuer);
  const tokens = await refreshTokens({
    meta,
    clientId: creds.clientId,
    refreshToken: creds.tokens.refreshToken,
    resource: creds.resource,
  });
  await saveCredentials(profileId, {
    ...creds,
    tokens: { ...tokens, refreshToken: tokens.refreshToken ?? creds.tokens.refreshToken },
  });
  return tokens.accessToken;
}

async function openSession(profileId: string, force = false) {
  const creds = await readCredentials(profileId);
  if (!creds) {
    throw new Error("Wispr Flow is not connected. Connect it on Where work lives.");
  }
  const token = await freshToken(profileId, creds, force);
  const session = mcpSession(creds.mcpUrl || WISPR_MCP_URL, token);
  await mcpInitialize(session);
  return session;
}

/**
 * A token can be refused before its recorded expiry. One refused call earns one
 * forced refresh and one retry, never a loop.
 */
async function withRetry<T>(
  profileId: string,
  run: (session: McpSession) => Promise<T>,
): Promise<T> {
  try {
    return await run(await openSession(profileId));
  } catch (error) {
    if (!(error instanceof McpClientError) || error.kind !== "unauthorized") throw error;
    console.info("[wispr] retrying after a refused token");
    return run(await openSession(profileId, true));
  }
}


export async function wisprTools(profileId: string): Promise<McpTool[]> {
  return mcpListTools(await openSession(profileId));
}

/**
 * Wispr names its tools itself, and we have not been able to sign in to a live
 * account to read the exact names, so the one that reads meetings is chosen by
 * shape rather than assumed.
 */
function chooseTool(tools: McpTool[], words: string[], avoid: string[] = []): string | null {
  const match = tools.find((tool) => {
    const name = tool.name.toLowerCase();
    if (avoid.some((word) => name.includes(word))) return false;
    return words.every((word) => name.includes(word));
  });
  return match?.name ?? null;
}

export type WisprMeeting = {
  id: string;
  title: string;
  date: string | null;
  attendeeCount: number | null;
};

function str(row: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

/** The names a payload may use for its list of rows, widest first. */
const ROW_KEYS = [
  "meetings",
  "conversations",
  "notes",
  "recordings",
  "sessions",
  "items",
  "results",
  "records",
  "rows",
  "entries",
  "data",
  "result",
  "content",
];

export function rowsOf(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload as Record<string, unknown>[];
  const row = payload as Record<string, unknown> | null;
  if (!row || typeof row !== "object") return [];
  for (const key of ROW_KEYS) {
    const value = row[key];
    if (Array.isArray(value)) return value as Record<string, unknown>[];
    // One level of nesting, e.g. { data: { meetings: [...] } }.
    if (value && typeof value === "object" && !Array.isArray(value)) {
      for (const inner of ROW_KEYS) {
        const nested = (value as Record<string, unknown>)[inner];
        if (Array.isArray(nested)) return nested as Record<string, unknown>[];
      }
    }
  }
  // Last resort: the only array of objects on the payload.
  const arrays = Object.values(row).filter(
    (value): value is Record<string, unknown>[] =>
      Array.isArray(value) && value.every((v) => v && typeof v === "object"),
  );
  return arrays.length === 1 ? (arrays[0] as Record<string, unknown>[]) : [];
}

function attendeesOf(row: Record<string, unknown>): number | null {
  for (const key of ["attendees", "participants", "attendee_list"]) {
    const value = row[key];
    if (Array.isArray(value)) return value.length;
  }
  for (const key of ["attendee_count", "participant_count"]) {
    const value = row[key];
    if (typeof value === "number") return value;
  }
  return null;
}

/** Any identifier the row offers, including ones we have not seen named yet. */
function idOf(row: Record<string, unknown>): string | null {
  const named = str(row, [
    "id",
    "meeting_id",
    "conversation_id",
    "note_id",
    "session_id",
    "recording_id",
    "uuid",
    "slug",
  ]);
  if (named) return named;
  for (const [key, value] of Object.entries(row)) {
    if (!/(^id$|_id$|Id$|uuid)/.test(key)) continue;
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number") return String(value);
  }
  return null;
}

export function mapMeetings(payload: unknown): WisprMeeting[] {
  return rowsOf(payload)
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const id = idOf(row);
      if (!id) return null;
      return {
        id,
        title:
          str(row, ["title", "name", "subject", "summary_title", "headline"]) ?? "Untitled meeting",
        date: str(row, [
          "start_time",
          "startTime",
          "started_at",
          "startedAt",
          "date",
          "created_at",
          "createdAt",
          "timestamp",
        ]),
        attendeeCount: attendeesOf(row),
      };
    })
    .filter((m): m is WisprMeeting => Boolean(m));
}

/** The closed band a diagnostic event reports instead of a raw count. */
export function resultBand(count: number): "0" | "1-10" | "11-30" | "31+" {
  if (count <= 0) return "0";
  if (count <= 10) return "1-10";
  if (count <= 30) return "11-30";
  return "31+";
}


const CURSOR_KEYS = ["next_cursor", "nextCursor", "cursor", "next_page_token", "nextPageToken"];

export function nextCursor(payload: unknown): string | null {
  const row = payload as Record<string, unknown> | null;
  if (!row || typeof row !== "object") return null;
  const pick = (obj: Record<string, unknown>): string | null => {
    for (const key of CURSOR_KEYS) {
      const value = obj[key];
      if (typeof value === "string" && value.trim()) return value;
    }
    return null;
  };
  const direct = pick(row);
  if (direct) return direct;
  for (const key of ["pagination", "page_info", "pageInfo", "meta"]) {
    const nested = row[key];
    if (nested && typeof nested === "object") {
      const found = pick(nested as Record<string, unknown>);
      if (found) return found;
    }
  }
  return null;
}

/** Machine facts about one browse call. Names, keys and counts only. */
export type WisprBrowseDiagnostics = {
  toolNames: string[];
  toolChosen: string;
  payloadKeys: string[];
  rowCount: number;
  mappedCount: number;
  hasCursor: boolean;
};

/** The listing tool, chosen by shape across every name Wispr might use. */
function chooseListTool(tools: McpTool[]): McpTool | null {
  const avoid = ["get", "detail", "transcript", "create", "delete", "update"];
  const subjects = ["meeting", "conversation", "note", "recording", "session"];
  for (const subject of subjects) {
    const name =
      chooseTool(tools, ["list", subject]) ??
      chooseTool(tools, [subject, "list"]) ??
      chooseTool(tools, [subject], avoid) ??
      chooseTool(tools, ["search", subject]);
    if (name) return tools.find((t) => t.name === name) ?? null;
  }
  const listing = tools.find((tool) => {
    const name = tool.name.toLowerCase();
    return (name.includes("list") || name.includes("search")) && !avoid.some((w) => name.includes(w));
  });
  return listing ?? null;
}

/** Only arguments the tool declares; a server may refuse anything else. */
function listArgs(tool: McpTool, opts: { limit: number; cursor: string | null }) {
  const declared = toolArgNames(tool);
  const out: Record<string, unknown> = {};
  const put = (aliases: string[], value: unknown) => {
    if (value === null || value === undefined) return;
    if (declared.length === 0) {
      out[aliases[0] as string] = value;
      return;
    }
    const key = aliases.find((alias) => declared.includes(alias));
    if (key) out[key] = value;
  };
  put(["limit", "page_size", "pageSize", "max_results", "count", "n"], opts.limit);
  put(["cursor", "page_token", "pageToken", "next_cursor", "offset"], opts.cursor);
  return out;
}

export async function listWisprMeetings(
  profileId: string,
  opts: { limit?: number; cursor?: string | null } = {},
): Promise<{
  meetings: WisprMeeting[];
  cursor: string | null;
  unsupported: string | null;
  diagnostics: WisprBrowseDiagnostics;
}> {
  return withRetry(profileId, async (session: McpSession) => {
    const tools = await mcpListTools(session);
    const toolNames = tools.map((tool) => tool.name);
    const tool = chooseListTool(tools);
    console.info("[wispr] tools", { tools: toolNames, chosen: tool?.name ?? "none" });
    if (!tool) {
      return {
        meetings: [],
        cursor: null,
        unsupported: "Wispr Flow did not offer a way to list meetings on this account.",
        diagnostics: {
          toolNames,
          toolChosen: "none",
          payloadKeys: [],
          rowCount: 0,
          mappedCount: 0,
          hasCursor: false,
        },
      };
    }
    const args = listArgs(tool, { limit: opts.limit ?? 30, cursor: opts.cursor ?? null });
    const result = await mcpCallTool(session, tool.name, args);
    const payload = resultJson(result);
    const payloadKeys =
      payload && typeof payload === "object" && !Array.isArray(payload)
        ? Object.keys(payload as Record<string, unknown>)
        : Array.isArray(payload)
          ? ["<array>"]
          : [];
    const rows = rowsOf(payload);
    const meetings = mapMeetings(payload);
    const cursor = nextCursor(payload);
    console.info("[wispr] browse", {
      tool: tool.name,
      args: Object.keys(args),
      payload_keys: payloadKeys,
      rows: rows.length,
      mapped: meetings.length,
      cursor: Boolean(cursor),
    });
    return {
      meetings,
      cursor,
      unsupported: null,
      diagnostics: {
        toolNames,
        toolChosen: tool.name,
        payloadKeys,
        rowCount: rows.length,
        mappedCount: meetings.length,
        hasCursor: Boolean(cursor),
      },
    };
  });
}


/**
 * One meeting as markdown, shaped exactly like the Granola import: what was
 * said kept apart from what a model wrote about it.
 */
export function meetingMarkdown(input: {
  title: string;
  transcript: string | null;
  summary: string | null;
  notes: string | null;
}): string {
  const parts = [`# ${input.title}`];
  if (input.transcript) parts.push("## Transcript", input.transcript);
  const written = [input.summary, input.notes].filter(Boolean).join("\n\n");
  if (written) parts.push("---", "## AI notes (generated by Wispr Flow)", written);
  return parts.join("\n\n");
}

function transcriptText(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value;
  if (!Array.isArray(value)) return null;
  const lines = (value as Record<string, unknown>[])
    .map((line) => {
      const text = str(line, ["text", "content", "value"]);
      if (!text) return null;
      const speaker = str(line, ["speaker", "name", "role"]);
      return speaker ? `**${speaker}:** ${text}` : text;
    })
    .filter((l): l is string => Boolean(l));
  return lines.length > 0 ? lines.join("\n\n") : null;
}

export function mapMeetingDetail(
  payload: unknown,
): { title: string; date: string | null; markdown: string } | null {
  const row = ((payload as Record<string, unknown> | null)?.["meeting"] ??
    (payload as Record<string, unknown> | null)?.["data"] ??
    payload) as Record<string, unknown> | null;
  if (!row || typeof row !== "object") return null;
  const title = str(row, ["title", "name", "subject"]) ?? "Untitled meeting";
  const date = str(row, ["start_time", "started_at", "date", "created_at", "createdAt"]);
  const transcript = transcriptText(row["transcript"] ?? row["transcript_segments"]);
  const summary = str(row, ["summary", "ai_summary", "overview"]);
  const notes = str(row, ["notes", "note", "markdown", "content"]);
  if (!transcript && !summary && !notes) return null;
  return { title, date, markdown: meetingMarkdown({ title, transcript, summary, notes }) };
}

export async function fetchWisprMeeting(
  profileId: string,
  id: string,
): Promise<{ title: string; date: string | null; markdown: string } | null> {
  const session = await openSession(profileId);
  const tools = await mcpListTools(session);
  const name =
    chooseTool(tools, ["get", "meeting"]) ??
    chooseTool(tools, ["meeting", "transcript"]) ??
    chooseTool(tools, ["meeting", "detail"]);
  if (!name) return null;
  const result = await mcpCallTool(session, name, { meeting_id: id, id });
  return mapMeetingDetail(resultJson(result));
}

/** Discovery for the connect flow, kept here so the server fn stays thin. */
export async function wisprAuthMeta(): Promise<{
  resource: string;
  issuer: string;
  scopes: string[];
  meta: AuthServerMeta;
}> {
  const prm = await discoverProtectedResource(WISPR_MCP_URL);
  const meta = await discoverAuthServer(prm.authorizationServer);
  return {
    resource: prm.resource,
    issuer: prm.authorizationServer,
    scopes: prm.scopes.length > 0 ? prm.scopes : ["openid", "offline_access"],
    meta,
  };
}
