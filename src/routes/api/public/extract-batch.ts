import { createFileRoute } from "@tanstack/react-router";

/**
 * Drains finished extract batches. Called on a schedule with a shared secret,
 * never by a browser, and it returns counts only.
 */
export const Route = createFileRoute("/api/public/extract-batch")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const secret = process.env["EXTRACT_BATCH_SECRET"];
        if (!secret) return new Response("Not configured", { status: 503 });
        if (request.headers.get("x-batch-secret") !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }
        const { drainExtractBatches } = await import("@/lib/extract-batch.server");
        const result = await drainExtractBatches();
        return Response.json(result);
      },
    },
  },
});
