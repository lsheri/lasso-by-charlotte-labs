import { createFileRoute } from "@tanstack/react-router";

async function handle({ request, params }: { request: Request; params: { token: string } }) {
  const { handleMcpRequest } = await import("@/lib/mcp-handler.server");
  return handleMcpRequest(request, params.token);
}

export const Route = createFileRoute("/api/mcp/$token")({
  server: {
    handlers: {
      POST: handle,
      GET: handle,
      OPTIONS: handle,
    },
  },
});