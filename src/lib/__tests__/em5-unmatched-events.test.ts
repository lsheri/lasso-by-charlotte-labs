import { beforeEach, describe, expect, it, vi } from "vitest";
import { Webhook } from "standardwebhooks";

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (t: string) => builder(t),
  },
}));

type R = Record<string, any>;

let rows: R[] = [];
let emailEvents: R[] = [];
let upsertError: R | null = null;

function builder(table: string) {
  const filters: Array<(r: R) => boolean> = [];
  let op: "select" | "update" | "upsert" = "select";
  let patch: R = {};
  let upsertRow: R = {};
  const api: any = {
    select: () => api,
    update: (p: R) => ((op = "update"), (patch = p), api),
    upsert: (p: R) => ((op = "upsert"), (upsertRow = p), api),
    eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), api),
    maybeSingle: () => api,
    then: (res: (v: unknown) => void) => {
      if (table === "outbound_emails") {
        if (op === "select") {
          const hit = rows.filter((r) => filters.every((f) => f(r)))[0];
          res({ data: hit ? { ...hit } : null, error: null });
          return;
        }
        const hit = rows.filter((r) => filters.every((f) => f(r)));
        hit.forEach((r) => Object.assign(r, patch));
        res({ data: hit.map((r) => ({ ...r })), error: null });
        return;
      }
      expect(table).toBe("email_events");
      expect(op).toBe("upsert");
      if (upsertError) {
        res({ data: null, error: upsertError });
        return;
      }
      const existing = emailEvents.find(
        (r) => r["provider"] === upsertRow["provider"] && r["provider_id"] === upsertRow["provider_id"],
      );
      if (existing) Object.assign(existing, upsertRow);
      else emailEvents.push({ ...upsertRow });
      res({ data: null, error: null });
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
  emailEvents = [];
  upsertError = null;
});

describe("EM-5 unmatched delivery events land in email_events", () => {
  it("records recipient, subject, status and occurred_at for an unmatched event", async () => {
    const res = await handleResendWebhook(
      requestFor({
        type: "email.delivered",
        created_at: "2026-10-18T12:00:00.000Z",
        data: { email_id: "re_auth1", to: ["new@example.com"], subject: "Confirm your email" },
      }),
    );
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json).toMatchObject({ ok: true, recorded: "delivered" });
    expect(emailEvents).toHaveLength(1);
    expect(emailEvents[0]).toMatchObject({
      provider: "resend",
      provider_id: "re_auth1",
      to_email: "new@example.com",
      subject: "Confirm your email",
      status: "delivered",
      occurred_at: "2026-10-18T12:00:00.000Z",
    });
  });

  it("uses the first entry of a to array and accepts a plain string", async () => {
    await handleResendWebhook(
      requestFor({
        type: "email.delivered",
        data: { email_id: "re_a", to: ["first@example.com", "second@example.com"] },
      }),
    );
    expect(emailEvents[0]!["to_email"]).toBe("first@example.com");

    await handleResendWebhook(
      requestFor({
        type: "email.delivered",
        data: { email_id: "re_b", to: "plain@example.com" },
      }),
    );
    expect(emailEvents).toHaveLength(2);
    expect(emailEvents[1]!["to_email"]).toBe("plain@example.com");
  });

  it("records nothing and still returns ok when there is no recipient", async () => {
    const res = await handleResendWebhook(
      requestFor({ type: "email.delivered", data: { email_id: "re_norecip" } }),
    );
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json).toMatchObject({ ok: true, unmatched: "no recipient" });
    expect(emailEvents).toHaveLength(0);
  });

  it("upserts a second event for the same email instead of inserting a new row", async () => {
    await handleResendWebhook(
      requestFor({ type: "email.sent", data: { email_id: "re_dup", to: ["a@example.com"] } }),
    );
    const res = await handleResendWebhook(
      requestFor({ type: "email.delivered", data: { email_id: "re_dup", to: ["a@example.com"] } }),
    );
    expect(res.status).toBe(200);
    expect(emailEvents).toHaveLength(1);
    expect(emailEvents[0]!["status"]).toBe("delivered");
  });

  it("records nothing for email.opened or email.clicked", async () => {
    for (const type of ["email.opened", "email.clicked"]) {
      const res = await handleResendWebhook(
        requestFor({ type, data: { email_id: "re_eng", to: ["a@example.com"] } }),
      );
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json).toMatchObject({ ok: true, ignored: type });
    }
    expect(emailEvents).toHaveLength(0);
  });

  it("a matched event still updates outbound_emails and writes nothing to email_events", async () => {
    rows.push({ id: "row1", provider_id: "re_1", status: "sent" });
    const res = await handleResendWebhook(
      requestFor({
        type: "email.delivered",
        data: { email_id: "re_1", to: ["queued@example.com"], subject: "Queued mail" },
      }),
    );
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json).toMatchObject({ ok: true, status: "delivered" });
    expect(rows[0]!["status"]).toBe("delivered");
    expect(emailEvents).toHaveLength(0);
  });
});
