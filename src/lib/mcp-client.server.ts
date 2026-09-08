/**
 * A small MCP client, server side only.
 *
 * Lasso already runs an MCP server for pushes coming in. This is the other
 * direction: reading from someone else's MCP server over streamable HTTP.
 * Written as a general client on purpose, because the next tool that ships an
 * MCP server should need no new transport code.
 *
 * No SDK dependency: initialize, tools/list and tools/call over fetch is the
 * whole surface we need, and a focused client keeps the failure messages ours.
 */

export type McpFailure =
  | "unauthorized"
  | "not_found"
  | "rate_limited"
  | "protocol"
  | "server"
  | "network";

export class McpClientError extends Error {
  kind: McpFailure;
  status: number | null;
  constructor(kind: McpFailure, message: string, status: number | null = null) {
    super(message);
    this.name = "McpClientError";
    this.kind = kind;
    this.status = status;
  }
}

export type McpTool = {
  name: string;
  description: string | null;
  /** The tool's declared arguments, when the server publishes them. */
  inputSchema?: Record<string, unknown> | null;
};

/** The argument names a tool actually declares, empty when it declares none. */
export function toolArgNames(tool: McpTool | null | undefined): string[] {
  const props = (tool?.inputSchema as { properties?: unknown } | null | undefined)?.properties;
  if (!props || typeof props !== "object") return [];
  return Object.keys(props as Record<string, unknown>);
}


export type McpContent = { type: string; text?: string; [key: string]: unknown };

export type McpToolResult = {
  /** Text blocks joined in order, the shape almost every server returns. */
  text: string;
  content: McpContent[];
  structured: unknown;
  isError: boolean;
};

const PROTOCOL_VERSION = "2025-06-18";

type JsonRpcResponse = {
  jsonrpc?: string;
  id?: unknown;
  result?: unknown;
  error?: { code?: number; message?: string };
};

function statusFailure(status: number): McpFailure {
  if (status === 401 || status === 403) return "unauthorized";
  if (status === 404) return "not_found";
  if (status === 429) return "rate_limited";
  return "server";
}

function friendly(kind: McpFailure, detail: string): string {
  if (kind === "unauthorized") return "That connection needs signing in again.";
  if (kind === "not_found") return "That server address did not answer.";
  if (kind === "rate_limited") return "The other side is busy. Wait a moment and try again.";
  if (kind === "protocol") return `That server replied in a shape we could not read. ${detail}`.trim();
  if (kind === "network") return "We could not reach that server.";
  return detail || "That server returned an error.";
}

/** Streamable HTTP allows a plain JSON body or a single SSE frame. */
function parseBody(raw: string, contentType: string): JsonRpcResponse {
  const isEvent = contentType.includes("text/event-stream");
  const payload = isEvent
    ? raw
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim())
        .join("")
    : raw.trim();
  if (!payload) throw new McpClientError("protocol", friendly("protocol", "It sent nothing back."));
  try {
    return JSON.parse(payload) as JsonRpcResponse;
  } catch {
    throw new McpClientError("protocol", friendly("protocol", "It sent something that is not JSON."));
  }
}

export type McpSession = {
  url: string;
  token: string | null;
  sessionId: string | null;
};

export function mcpSession(url: string, token: string | null): McpSession {
  return { url, token, sessionId: null };
}

async function rpc(
  session: McpSession,
  method: string,
  params: Record<string, unknown>,
): Promise<unknown> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    // Required by the streamable HTTP spec; servers reject requests without it.
    Accept: "application/json, text/event-stream",
    "MCP-Protocol-Version": PROTOCOL_VERSION,
  };
  if (session.token) headers["Authorization"] = `Bearer ${session.token}`;
  if (session.sessionId) headers["Mcp-Session-Id"] = session.sessionId;

  let response: Response;
  try {
    response = await fetch(session.url, {
      method: "POST",
      headers,
      body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
    });
  } catch {
    throw new McpClientError("network", friendly("network", ""));
  }

  const sid = response.headers.get("mcp-session-id");
  if (sid) session.sessionId = sid;

  const raw = await response.text().catch(() => "");
  if (!response.ok) {
    const kind = statusFailure(response.status);
    throw new McpClientError(kind, friendly(kind, raw.slice(0, 160)), response.status);
  }

  const body = parseBody(raw, response.headers.get("content-type") ?? "");
  if (body.error) {
    const message = body.error.message ?? "";
    const kind: McpFailure = /token|auth|unauthor/i.test(message) ? "unauthorized" : "server";
    throw new McpClientError(kind, friendly(kind, message.slice(0, 160)));
  }
  if (body.result === undefined) {
    throw new McpClientError("protocol", friendly("protocol", "It sent no result."));
  }
  return body.result;
}

export async function mcpInitialize(session: McpSession): Promise<McpSession> {
  await rpc(session, "initialize", {
    protocolVersion: PROTOCOL_VERSION,
    capabilities: {},
    clientInfo: { name: "lasso", version: "1.0.0" },
  });
  // Notification, best effort: servers that ignore it are still usable.
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "MCP-Protocol-Version": PROTOCOL_VERSION,
    };
    if (session.token) headers["Authorization"] = `Bearer ${session.token}`;
    if (session.sessionId) headers["Mcp-Session-Id"] = session.sessionId;
    await fetch(session.url, {
      method: "POST",
      headers,
      body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
    });
  } catch {
    /* the session is already open; nothing here changes that */
  }
  return session;
}

export function parseToolList(result: unknown): McpTool[] {
  const list = (result as { tools?: unknown } | null)?.tools;
  if (!Array.isArray(list)) {
    throw new McpClientError("protocol", friendly("protocol", "It listed no tools."));
  }
  return list
    .map((row) => {
      const tool = row as { name?: unknown; description?: unknown; inputSchema?: unknown };
      if (typeof tool.name !== "string" || !tool.name.trim()) return null;
      return {
        name: tool.name,
        description: typeof tool.description === "string" ? tool.description : null,
        inputSchema:
          tool.inputSchema && typeof tool.inputSchema === "object"
            ? (tool.inputSchema as Record<string, unknown>)
            : null,
      };

    })
    .filter((t): t is McpTool => t !== null);
}

export async function mcpListTools(session: McpSession): Promise<McpTool[]> {
  return parseToolList(await rpc(session, "tools/list", {}));
}

export function parseToolResult(result: unknown): McpToolResult {
  const row = result as { content?: unknown; structuredContent?: unknown; isError?: unknown } | null;
  const content = Array.isArray(row?.content) ? (row?.content as McpContent[]) : [];
  const structured = row?.structuredContent;
  if (content.length === 0 && structured === undefined) {
    throw new McpClientError("protocol", friendly("protocol", "It sent an empty result."));
  }
  const text = content
    .map((block) => (typeof block?.text === "string" ? block.text : ""))
    .filter(Boolean)
    .join("\n\n");
  return { text, content, structured, isError: row?.isError === true };
}

export async function mcpCallTool(
  session: McpSession,
  name: string,
  args: Record<string, unknown>,
): Promise<McpToolResult> {
  return parseToolResult(await rpc(session, "tools/call", { name, arguments: args }));
}

/** Text first, structured payload second: servers differ on which they fill. */
export function resultJson(result: McpToolResult): unknown {
  if (result.structured !== undefined && result.structured !== null) return result.structured;
  if (!result.text) return null;
  try {
    return JSON.parse(result.text);
  } catch {
    return null;
  }
}
