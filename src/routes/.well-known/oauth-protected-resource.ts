import { createFileRoute } from "@tanstack/react-router";

async function handle({ request }: { request: Request }) {
  const { buildOAuthProtectedResourceResponse } = await import(
    "@/lib/mcp-header.server"
  );
  return buildOAuthProtectedResourceResponse(request);
}

export const Route = createFileRoute("/.well-known/oauth-protected-resource")({
  server: {
    handlers: {
      GET: handle,
      OPTIONS: handle,
    },
  },
});
