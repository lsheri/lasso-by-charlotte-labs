import { beforeEach, describe, expect, it, vi } from "vitest";
import { Webhook } from "standardwebhooks";

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (t: string) => builder(t),
  },
}));

type R = Record<string, any>;

let rows: R[] = [];
let selectError: R | null = null;
let updateError: R | null = null;

function builder(table: string) {
  const filters: Array<(r: R) => boolean> = [];
  let op: "select" | "update" = "select";
  let patch: R = {};
  const api: any = {
    select: () => api,
    update: (p: R) => ((op = "update"), (patch = p), api),
    eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), api),
    maybeSingle: () => api,
    then: (res: (v: unknown) => void) => {
      expect(table).toBe("outbound_emails");
      if (op === "select") {
        const hit = rows.filter((r) => filters.every((f) => f(r)))[0];
        res({ data: hit ? { ...hit } : null, error: selectError });
        return;
      }
      const hit = rows.filter((r) => filters.every((f) => f(r)));
      hit.forEach((r) => Object.assign(r, patch));
      res({ data: hit.map((r) => ({ ...r })), error: updateError });
    },
  };
  return api;
}

process.env["RESEND_WEBHOOK_SECRET"] = "whsec_" + Buffer.from("c2VjcmV0LXNlY3JldC1zZWNyZXQ=").toString();

const { handleResendWebhook } = await import("@/routes/api/public/resend-webhook");

function requestFor(payload: R): Request {
  const body = JSON.stringify(payload);
  const wh = new Webhook(process.env["RESEND_WEBHOOK_SECRET"]!);
  const id = "msg_test";
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = wh.sign(id, new Date(), body);
  return new Request("http://localhost/api/public/resend-webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "webhook-id": id,
      "webhook-timestamp": timestamp,
      "webhook-signature": signature,
    },
    body,
  });
}

beforeEach(() => {
  rows = [];
  selectError = null;
  updateError = null;
});

describe("E5 resend webhook write errors", () => {
  it("delivered applies after sent", async () => {
    rows.push({ id: "row1", provider_id: "re_1", status: "sent" });
    const res = await handleResendWebhook(requestFor({ type: "email.delivered", data: { email_id: "re_1" } }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json).toMatchObject({ ok: true, status: "delivered" });
    expect(rows[0]!["status"]).toBe("delivered");
  });

  it("returns 500 when the update fails so Resend retries", async () => {
    rows.push({ id: "row1", provider_id: "re_1", status: "sent" });
    updateError = { message: "duplicate key" };
    const res = await handleResendWebhook(requestFor({ type: "email.bounced", data: { email_id: "re_1" } }));
    const json = await res.json();
    expect(res.status).toBe(500);
    expect(json).toMatchObject({ error: "update failed" });
    expect(rows[0]!["status"]).toBe("sent");
  });

  it("returns 500 when the select fails, distinct from no row", async () => {
    selectError = { message: "permission denied" };
    const res = await handleResendWebhook(requestFor({ type: "email.delivered", data: { email_id: "re_1" } }));
    const json = await res.json();
    expect(res.status).toBe(500);
    expect(json).toMatchObject({ error: "update failed" });
  });

  it("still returns 200 unmatched when no row exists and the select succeeds", async () => {
    const res = await handleResendWebhook(requestFor({ type: "email.delivered", data: { email_id: "re_missing" } }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json).toMatchObject({ ok: true, unmatched: true });
  });
});
