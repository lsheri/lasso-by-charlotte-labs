export function bearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer ([^\s]+)$/);
  return match?.[1] ?? null;
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
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json", ...CORS_HEADERS },
    });
  }
  return handleMcpRequest(request, token, "header");
}
