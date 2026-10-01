import { createFileRoute } from "@tanstack/react-router";

async function handle({ request }: { request: Request }) {
  const { handleHeaderMcp } = await import("@/lib/mcp-header.server");
  return handleHeaderMcp(request);
}

export const Route = createFileRoute("/api/mcp")({
  server: {
    handlers: {
      POST: handle,
      GET: handle,
      OPTIONS: handle,
    },
  },
});
