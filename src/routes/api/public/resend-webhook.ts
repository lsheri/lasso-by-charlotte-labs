import { createFileRoute } from "@tanstack/react-router";
import { Webhook } from "standardwebhooks";

import { isTerminalFailure, shouldApply, statusForEvent } from "@/lib/email-events";

// Resend delivery-event receiver. Updates outbound_emails.status only.
// Opened and clicked events are ignored by design.

type ResendPayload = {
  type?: string;
  created_at?: string;
  data?: {
    email_id?: string;
    bounce?: { message?: string; subType?: string };
    reason?: string;
  };
};

function header(request: Request, name: string): string {
  return request.headers.get(`svix-${name}`) ?? request.headers.get(`webhook-${name}`) ?? "";
}

function failureReason(payload: ResendPayload, fallback: string): string {
  const d = payload.data ?? {};
  const parts = [d.bounce?.message, d.bounce?.subType, d.reason]
    .filter((p): p is string => typeof p === "string" && p.trim().length > 0)
    .map((p) => p.trim());
  const reason = parts.length > 0 ? parts.join(" | ") : fallback;
  return reason.trim().slice(0, 300);
}

export async function handleResendWebhook(request: Request): Promise<Response> {
  const secret = process.env["RESEND_WEBHOOK_SECRET"];
  if (!secret) {
    console.error("[resend-webhook] RESEND_WEBHOOK_SECRET is not set; refusing to process");
    return Response.json({ error: "webhook secret not configured" }, { status: 500 });
  }
  const body = await request.text();
  let payload: ResendPayload;
  try {
    const wh = new Webhook(secret.replace(/^v1,whsec_/, ""));
    payload = wh.verify(body, {
      "webhook-id": header(request, "id"),
      "webhook-timestamp": header(request, "timestamp"),
      "webhook-signature": header(request, "signature"),
    }) as ResendPayload;
  } catch {
    return Response.json({ error: "invalid signature" }, { status: 401 });
  }

  const type = typeof payload?.type === "string" ? payload.type : "";
  const status = statusForEvent(type);
  if (status === null) return Response.json({ ok: true, ignored: type });

  const emailId = payload.data?.email_id;
  if (!emailId) return Response.json({ ok: true, ignored: "no email_id" });

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: row } = await supabaseAdmin
    .from("outbound_emails")
    .select("id, status")
    .eq("provider_id", emailId)
    .maybeSingle();
  if (!row) return Response.json({ ok: true, unmatched: true });

  if (!shouldApply(row.status, status)) return Response.json({ ok: true, skipped: true });

  const update: { status: string; last_error?: string } = { status };
  if (isTerminalFailure(status)) {
    update.last_error = failureReason(payload, type);
    console.warn("[resend-webhook] " + status + " for " + emailId);
  }
  await supabaseAdmin.from("outbound_emails").update(update).eq("id", row.id);

  return Response.json({ ok: true, status });
}

export const Route = createFileRoute("/api/public/resend-webhook")({
  server: { handlers: { POST: ({ request }) => handleResendWebhook(request) } },
});
