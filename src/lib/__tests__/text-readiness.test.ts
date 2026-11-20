// 20 Nov 2026, chat pill Phase 0 (Liam, D-97): the sender counts as ready only when it can send. The pause rule,
// the sender remembering a refusal, the database telling another copy of the server, and the words.
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";

import { pastWorkByLead } from "@/lib/proposal-desk-shared";
import {
  SENDER_PAUSE_MS,
  senderPaused,
  senderReady,
  TEXTS_NOT_STARTED_COPY,
} from "@/lib/text-readiness-shared";
import {
  readyTextConfig,
  resetSenderRefusal,
  sendText,
  senderRefusedRecently,
  type TextConfig,
} from "@/lib/text-sender.server";

const NOW = Date.parse("2026-11-20T12:00:00Z");
const ENV = { BIRD_API_KEY: "bk_us1_testkey12345", BIRD_SMS_FROM: "+14255550100" };
const CONFIG: TextConfig = {
  apiKey: ENV.BIRD_API_KEY,
  from: ENV.BIRD_SMS_FROM,
  host: "https://us1.platform.bird.com",
};

afterEach(() => resetSenderRefusal());

/** A tiny stand-in for the one query the sender makes: the latest rejected text since a time. */
function db(rows: { status: string; status_at: string }[], fail = false) {
  const calls: string[] = [];
  return {
    calls,
    client: {
      from(table: string) {
        calls.push(table);
        let status = "";
        let since = "";
        const query = {
          select: () => query,
          eq: (_c: string, v: string) => ((status = v), query),
          gte: (_c: string, v: string) => ((since = v), query),
          order: () => query,
          limit: () => query,
          then: (resolve: (value: unknown) => unknown) =>
            Promise.resolve(
              fail
                ? { data: null, error: { code: "XX000" } }
                : {
                    data: rows
                      .filter((r) => r.status === status && r.status_at >= since)
                      .sort((a, b) => b.status_at.localeCompare(a.status_at)),
                    error: null,
                  },
            ).then(resolve),
        };
        return query;
      },
    },
  };
}

describe("the pause rule", () => {
  it("pauses for fifteen minutes after a refusal, then lets the next press try", () => {
    expect(SENDER_PAUSE_MS).toBe(15 * 60_000);
    expect(senderPaused(NOW - 1, NOW)).toBe(true);
    expect(senderPaused(NOW - SENDER_PAUSE_MS + 1, NOW)).toBe(true);
    expect(senderPaused(NOW - SENDER_PAUSE_MS, NOW)).toBe(false);
    expect(senderPaused(null, NOW)).toBe(false);
    expect(senderPaused(Number.NaN, NOW)).toBe(false);
  });

  it("counts a refusal stamped a little in the future (clocks that disagree) as a refusal now", () => {
    expect(senderPaused(NOW + 5_000, NOW)).toBe(true);
    expect(senderPaused(NOW + 5_000, NOW + 5_000 + SENDER_PAUSE_MS)).toBe(false);
  });

  it("is ready only with settings in place and no pause", () => {
    expect(senderReady({ configured: true, lastRefusalMs: null, nowMs: NOW })).toBe(true);
    expect(senderReady({ configured: false, lastRefusalMs: null, nowMs: NOW })).toBe(false);
    expect(senderReady({ configured: true, lastRefusalMs: NOW - 60_000, nowMs: NOW })).toBe(false);
  });
});

describe("the sender remembers a refusal", () => {
  it("a refused send pauses this copy of the server", async () => {
    expect(await senderRefusedRecently(null)).toBe(false);
    const refusal = async () =>
      new Response(JSON.stringify({ code: "SMSSenderNotApproved" }), { status: 422 });
    expect(
      await sendText(
        CONFIG,
        { to: "+12065550142", text: "hi", idempotencyKey: "k" },
        refusal as unknown as typeof fetch,
      ),
    ).toMatchObject({ outcome: "refused" });
    expect(await senderRefusedRecently(null)).toBe(true);
    expect(await readyTextConfig(null, new Date(), ENV)).toBeNull();
  });

  it("an accepted send, an opt-out or a network failure does not pause it", async () => {
    const replies = [
      async () => new Response(JSON.stringify({ id: "sms_0123456789" }), { status: 202 }),
      async () => new Response("SMSRecipientSuppressed", { status: 422 }),
      async () => new Response("down", { status: 503 }),
      async () => {
        throw new Error("offline");
      },
    ];
    for (const reply of replies)
      await sendText(
        CONFIG,
        { to: "+12065550142", text: "hi", idempotencyKey: "k" },
        reply as unknown as typeof fetch,
      );
    expect(await senderRefusedRecently(null)).toBe(false);
    expect(await readyTextConfig(null, new Date(), ENV)).toEqual(CONFIG);
  });

  it("another copy of the server learns of a refusal from the asks table", async () => {
    const now = new Date(NOW);
    const recent = db([{ status: "rejected", status_at: new Date(NOW - 60_000).toISOString() }]);
    expect(await senderRefusedRecently(recent.client as never, now)).toBe(true);
    expect(recent.calls).toEqual(["proposal_texts"]);
    resetSenderRefusal();
    const old = db([
      { status: "rejected", status_at: new Date(NOW - SENDER_PAUSE_MS - 1).toISOString() },
      { status: "delivered", status_at: new Date(NOW).toISOString() },
    ]);
    expect(await senderRefusedRecently(old.client as never, now)).toBe(false);
  });

  it("a table it cannot read counts as no refusal, so a press still tries", async () => {
    expect(await senderRefusedRecently(db([], true).client as never, new Date(NOW))).toBe(false);
  });

  it("is not ready without settings, whatever the table says", async () => {
    expect(await readyTextConfig(db([]).client as never, new Date(NOW), {})).toBeNull();
  });
});

describe("the words while texts have not started", () => {
  it("are Liam's words for a press, and never name the sending service", () => {
    expect(TEXTS_NOT_STARTED_COPY.nothingSent).toBe(
      "Texts start once our number is approved. Nothing was sent.",
    );
    for (const line of Object.values(TEXTS_NOT_STARTED_COPY)) {
      expect(line).not.toMatch(/bird/i);
      expect(line).not.toMatch(/[–—]/);
    }
  });

  it("are what the ask, the sheet and the won text say, with the old 'not connected' words gone", () => {
    for (const file of ["src/lib/lead-ask-shared.ts", "src/lib/won-text-shared.ts"]) {
      expect(readFileSync(file, "utf8")).not.toMatch(/Texting is not connected in this app yet/);
      expect(readFileSync(file, "utf8")).not.toMatch(/awaiting carrier approval/);
    }
  });
});

describe("past work beside a name on the lead sheet", () => {
  const CLIENTS = new Map([
    ["c1", "Larkspur Senior Living"],
    ["c2", "Harrow Water District"],
  ]);
  const row = (over: Record<string, unknown>) => ({
    status: "won",
    lead_contact_id: "p1",
    archived_at: null,
    decided_at: "2026-10-01T00:00:00Z",
    client_id: "c1",
    title: "Workforce plan",
    ...over,
  });

  it("lists the won proposals each person led, newest first, three at most", () => {
    const out = pastWorkByLead(
      [
        row({ decided_at: "2026-09-01T00:00:00Z", title: "Old" }),
        row({ decided_at: "2026-11-01T00:00:00Z", client_id: "c2", title: "Rate study" }),
        row({ decided_at: "2026-10-01T00:00:00Z" }),
        row({ decided_at: "2026-08-01T00:00:00Z", title: "Oldest" }),
        row({ lead_contact_id: "p2", title: "Someone else's" }),
      ],
      CLIENTS,
    );
    expect(out["p1"]).toEqual([
      { client: "Harrow Water District", title: "Rate study" },
      { client: "Larkspur Senior Living", title: "Workforce plan" },
      { client: "Larkspur Senior Living", title: "Old" },
    ]);
    expect(out["p2"]).toEqual([{ client: "Larkspur Senior Living", title: "Someone else's" }]);
  });

  it("leaves out open, lost and archived proposals, and ones with no lead", () => {
    expect(
      pastWorkByLead(
        [
          row({ status: "open" }),
          row({ status: "lost" }),
          row({ archived_at: "2026-11-02T00:00:00Z" }),
          row({ lead_contact_id: null }),
        ],
        CLIENTS,
      ),
    ).toEqual({});
  });

  it("carries no fee, count or score, only who it was for and what it was", () => {
    const out = pastWorkByLead([row({})], CLIENTS);
    expect(Object.keys(out["p1"]![0]!)).toEqual(["client", "title"]);
  });
});
