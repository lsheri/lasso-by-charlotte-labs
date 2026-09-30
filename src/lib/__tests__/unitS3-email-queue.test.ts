import { beforeEach, describe, expect, it, vi } from "vitest";

import { REGISTER_COPY, type Register } from "@/lib/register";

type R = Record<string, any>;
const rows: R[] = [];
const sendMock = vi.fn();

function builder(table: string) {
  const filters: Array<(r: R) => boolean> = [];
  let op: "select" | "update" = "select";
  let patch: R = {};
  let limit = Infinity;
  const api: any = {
    select: () => api,
    update: (p: R) => ((op = "update"), (patch = p), api),
    eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), api),
    in: (k: string, v: unknown[]) => (filters.push((r) => v.includes(r[k])), api),
    lt: (k: string, v: number) => (filters.push((r) => r[k] < v), api),
    order: () => api,
    limit: (n: number) => ((limit = n), api),
    then: (res: (v: unknown) => void) => {
      expect(table).toBe("outbound_emails");
      const hit = rows.filter((r) => filters.every((f) => f(r))).slice(0, limit);
      if (op === "update") hit.forEach((r) => Object.assign(r, patch));
      res({ data: hit.map((r) => ({ ...r })), error: null });
    },
  };
  return api;
}

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from: (t: string) => builder(t) },
}));
vi.mock("@/lib/invites.server", () => ({
  resendApiKey: () => "k",
  sendResendTemplate: (...a: unknown[]) => sendMock(...a),
}));

const { runEmailQueue, buildJoinUrl, privacyLineFor } = await import("@/lib/email-queue.server");

const row = (over: R = {}): R => ({
  id: "r1",
  to_email: "a@example.com",
  template: "provision-partner-admin",
  payload: { WORKSPACE_NAME: "HowlerCo", CODE: "ADM-K7P2QX", SEATS: 3, EXPIRES_DAYS: 14, REGISTER: "partner" },
  status: "queued",
  attempts: 0,
  created_at: "2026-09-30",
  ...over,
});

beforeEach(() => {
  rows.length = 0;
  sendMock.mockReset();
});

describe("Unit S3 email queue", () => {
  it("claims, sends and marks a queued row sent with the provider id", async () => {
    rows.push(row());
    sendMock.mockResolvedValue({ ok: true, id: "re_123" });
    const r = await runEmailQueue();
    expect(r.sent).toBe(1);
    expect(rows[0]).toMatchObject({ status: "sent", provider_id: "re_123", attempts: 1 });
    expect(rows[0]!["sent_at"]).toBeTruthy();
    const vars = sendMock.mock.calls[0]![1].variables;
    expect(vars).toMatchObject({ WORKSPACE_NAME: "HowlerCo", SEATS: 3, EXPIRES_DAYS: 14 });
    expect(vars.PRIVACY_LINE).toBe(REGISTER_COPY.partner.privacy);
    const u = new URL(vars.JOIN_URL);
    expect(u.pathname).toBe("/join");
    expect(u.searchParams.get("code")).toBe("ADM-K7P2QX");
  });

  it("builds JOIN_URL with code as a query parameter, never a path segment", () => {
    const url = buildJoinUrl("ADM-XXXXXX", "https://example.test");
    expect(url).toMatch(/\/join\?code=ADM-XXXXXX$/);
    expect(url).not.toContain("/join/ADM");
  });

  it("takes PRIVACY_LINE from REGISTER_COPY for every register, company otherwise", () => {
    for (const key of Object.keys(REGISTER_COPY) as Register[]) {
      expect(privacyLineFor(key)).toBe(REGISTER_COPY[key].privacy);
    }
    expect(privacyLineFor("nope")).toBe(REGISTER_COPY.company.privacy);
    expect(privacyLineFor(undefined)).toBe(REGISTER_COPY.company.privacy);
  });

  it("marks a failed send failed with last_error and does not throw", async () => {
    rows.push(row());
    sendMock.mockResolvedValue({ ok: false, status: 422, detail: "bad address" });
    await expect(runEmailQueue()).resolves.toMatchObject({ failed: 1 });
    expect(rows[0]).toMatchObject({ status: "failed", attempts: 1 });
    expect(rows[0]!["last_error"]).toContain("bad address");

    sendMock.mockRejectedValue(new Error("network down"));
    await expect(runEmailQueue()).resolves.toMatchObject({ failed: 1 });
    expect(rows[0]!["last_error"]).toContain("network down");
  });

  it("retries a throwing send on each sweep until attempts reaches 5, then leaves it", async () => {
    rows.push(row());
    sendMock.mockRejectedValue(new Error("boom"));
    for (let i = 0; i < 7; i++) await runEmailQueue();
    expect(sendMock).toHaveBeenCalledTimes(5);
    expect(rows[0]).toMatchObject({ status: "failed", attempts: 5 });
  });

  it("never selects a row at five attempts", async () => {
    rows.push(row({ status: "failed", attempts: 5 }));
    await runEmailQueue();
    expect(sendMock).not.toHaveBeenCalled();
    expect(rows[0]!["attempts"]).toBe(5);
  });

  it("never picks up a row already sent, or one mid-send", async () => {
    rows.push(row({ id: "s", status: "sent", attempts: 1, provider_id: "re_1" }));
    rows.push(row({ id: "m", status: "sending", attempts: 1 }));
    sendMock.mockResolvedValue({ ok: true, id: "re_2" });
    await runEmailQueue();
    await runEmailQueue();
    expect(sendMock).not.toHaveBeenCalled();
    expect(rows[0]).toMatchObject({ status: "sent", provider_id: "re_1", attempts: 1 });
  });

  it("reads SEATS sent as a string", async () => {
    rows.push(row({ payload: { WORKSPACE_NAME: "X", CODE: "ADM-NDMECQ", SEATS: "3", REGISTER: "partner" } }));
    sendMock.mockResolvedValue({ ok: true, id: "re_9" });
    await runEmailQueue();
    expect(sendMock.mock.calls[0]![1].variables.SEATS).toBe(3);
  });
});
