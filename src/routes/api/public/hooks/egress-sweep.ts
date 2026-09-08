/**
 * Pass 173: an outside caller can drive one sweep. The body is signed with the
 * same shared secret the console uses, so an unsigned call does nothing.
 * Invocation only: what may leave each workspace is decided by the sweep.
 */

import { createFileRoute } from "@tanstack/react-router";

async function handle(request: Request): Promise<Response> {
  const secret = process.env["LASSO_DATA_INGEST_SECRET"];
  if (!secret) return Response.json({ error: "not_configured" }, { status: 503 });

  const body = await request.text();
  const provided = request.headers.get("x-signature") ?? "";
  const { signBody } = await import("@/lib/egress-shared");
  const expected = await signBody(secret, body);
  if (provided.length !== expected.length || provided !== expected) {
    return Response.json({ error: "bad_signature" }, { status: 401 });
  }

  const { runFullSweep } = await import("@/lib/egress.server");
  const { events, content } = await runFullSweep();
  return Response.json({
    events_sent: events.sent,
    events_skipped: events.skipped,
    events_failed: events.failed,
    samples_sent: content.sent,
    samples_skipped: content.skipped,
    samples_failed: content.failed,
  });
}

export const Route = createFileRoute("/api/public/hooks/egress-sweep")({
  server: {
    handlers: {
      POST: ({ request }) => handle(request),
    },
  },
});
