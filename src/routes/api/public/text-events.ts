import { createFileRoute } from "@tanstack/react-router";

// 20 Nov 2026, Proposal Desk: delivery reports and replies for the texts the desk sends. Signed by the sender;
// every rule is in text-events.server.ts.
export const Route = createFileRoute("/api/public/text-events")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleTextEventRequest, realTextEventDeps } = await import("@/lib/text-events.server");
        return handleTextEventRequest(request, await realTextEventDeps());
      },
    },
  },
});
