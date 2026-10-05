export const MCP_RESOURCE_URL = "https://lasso.charlotte-labs.com/api/mcp";
export const OAUTH_RESOURCE_METADATA_URL =
  "https://lasso.charlotte-labs.com/api/oauth-protected-resource";

export const OAUTH_PROTECTED_RESOURCE_BODY = {
  resource: MCP_RESOURCE_URL,
  authorization_servers: ["https://oksycelinhrffzabdguy.supabase.co/auth/v1"],
} as const;

const OAUTH_CORS_HEADERS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "authorization, content-type",
};

export function buildOAuthProtectedResourceResponse(request: Request): Response {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: OAUTH_CORS_HEADERS });
  }
  return new Response(JSON.stringify(OAUTH_PROTECTED_RESOURCE_BODY), {
    status: 200,
    headers: { "content-type": "application/json", ...OAUTH_CORS_HEADERS },
  });
}

export function bearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer ([^\s]+)$/);
  return match?.[1] ?? null;
}

function withChallenge(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set(
    "WWW-Authenticate",
    `Bearer resource_metadata="${OAUTH_RESOURCE_METADATA_URL}"`,
  );
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

type McpHandlerModule = {
  CORS_HEADERS: Record<string, string>;
  handleMcpRequest: (
    request: Request,
    token: string,
    authKind?: "path" | "header",
  ) => Promise<Response>;
};

export async function handleHeaderMcp(
  request: Request,
  loadHandler: () => Promise<McpHandlerModule> = () => import("./mcp-handler.server"),
): Promise<Response> {
  const { CORS_HEADERS, handleMcpRequest } = await loadHandler();
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  const token = bearerToken(request);
  if (!token) {
    return withChallenge(
      new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json", ...CORS_HEADERS },
      }),
    );
  }
  const response = await handleMcpRequest(request, token, "header");
  return response.status === 401 ? withChallenge(response) : response;
}
