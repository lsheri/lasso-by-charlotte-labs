// 19 Nov, Proposal Desk, first live slice: "Text the lead" on a won proposal board. The words, the one sender
// function, and every rule of a press: each role, each workspace, a direct call that skips the screen, the daily
// limit, a recording fault, an opt-out, and that the number never appears anywhere but the send itself.
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

import { launchBrand } from "@/design/brand/brand";
import { EVENT_DIM_KEYS, guardServerEventDims } from "@/lib/event-dim-allowlist";
import { KESTREL_BAY_ORG_ID } from "@/lib/firm-story-shared";
import { sendText, textConfig, type TextConfig, type TextSendResult } from "@/lib/text-sender.server";
import { isE164, plainForSms, SMS_ONE_SEGMENT, WON_TEXT_COPY, WON_TEXT_DAILY_CAP, WON_TEXT_OUTCOMES, WON_TEXT_PROBLEMS, wonTextBoardInput, wonTextBody, wonTextSendInput } from "@/lib/won-text-shared";
import { sendWonText, startOfUtcDay, TEXT_WORKSPACES, wonTextStatus, type WonTextCaller, type WonTextDeps } from "@/lib/won-text.server";

const BOARD = "0000000b-0000-4000-8000-000000000001";
const PRESS = "0000000c-0000-4000-8000-000000000001";
const NUMBER = "+15005550006";
const CONFIG: TextConfig = { apiKey: "bk_us1_testkey12345", from: "+15005550001", host: "https://us1.platform.bird.com" };

type World = {
  role: string;
  orgId: string;
  board: { archived: boolean; won: boolean } | null;
  recipient: string | null;
  config: TextConfig | null;
  presses: number;
  recordWorks: boolean;
  countWorks: boolean;
  send: TextSendResult;
  firm: string;
};

function world(over: Partial<World> = {}) {
  const w: World = { role: "admin", orgId: KESTREL_BAY_ORG_ID, board: { archived: false, won: true }, recipient: NUMBER, config: CONFIG, presses: 0, recordWorks: true, countWorks: true, send: { outcome: "accepted" }, firm: "Kestrel Bay", ...over };
  const sends: { to: string; text: string; idempotencyKey: string }[] = [];
  const results: string[] = [];
  const caller: WonTextCaller = { profileId: "p1", orgId: w.orgId, role: w.role, userId: "u1" };
  const deps: WonTextDeps = {
    caller: async () => caller,
    board: async (orgId) => (orgId === w.orgId ? w.board : null),
    firmName: async () => w.firm,
    brandName: () => "Lasso",
    recipient: () => w.recipient,
    config: () => w.config,
    recordPress: async () => {
      if (w.recordWorks) w.presses += 1;
    },
    recordResult: async (_who, outcome) => {
      results.push(outcome);
    },
    pressesToday: async () => (w.countWorks ? w.presses : null),
    send: async (_config, message) => {
      sends.push(message);
      return w.send;
    },
  };
  return { w, deps, sends, results };
}

const input = { engagement_id: BOARD, profile_id: null, press_id: PRESS };
const status = async (work: Promise<unknown>): Promise<number | "ok"> => {
  try {
    await work;
    return "ok";
  } catch (thrown) {
    if (thrown instanceof Response) return thrown.status;
    throw thrown;
  }
};

describe("the words", () => {
  it("is one plain segment that names the firm, the product and how to stop", () => {
    const body = wonTextBody({ brandName: "Lasso", firmName: "Kestrel Bay" });
    expect(body).toBe("Lasso for Kestrel Bay: the proposal you helped with has been won, and the team board is ready. Reply STOP to opt out.");
    expect(body.length).toBeLessThanOrEqual(SMS_ONE_SEGMENT);
  });

  it("with today's brand, these are the words Liam approved (D-40)", () => {
    expect(wonTextBody({ brandName: launchBrand().name, firmName: "Kestrel Bay" })).toBe("Lasso for Kestrel Bay: the proposal you helped with has been won, and the team board is ready. Reply STOP to opt out.");
  });

  it("takes the product name it is given, so the brand module decides it", () => {
    expect(wonTextBody({ brandName: "Charlotte", firmName: "Kestrel Bay" }).startsWith("Charlotte for Kestrel Bay: ")).toBe(true);
  });

  it.each(["", "   ", "\u{1F680}"])("still reads well with no usable firm name (%j)", (firmName) => {
    expect(wonTextBody({ brandName: "Lasso", firmName })).toBe("Lasso: the proposal you helped with has been won, and the team board is ready. Reply STOP to opt out.");
  });

  it("folds accents, drops what a plain text cannot carry and never grows past one segment", () => {
    expect(plainForSms("Société Générale \u2014 Zürich \u201cQ\u201d")).toBe('Societe Generale - Zurich "Q"');
    expect(plainForSms("<b>Bay</b> \u{1F600}")).toBe("<b>Bay</b>");
    for (const firmName of ["x".repeat(400), "St. Brigid's & Sons, Müller-Lüdenscheidt Partnership of Greater Northumberland and the Borders LLP"]) {
      const body = wonTextBody({ brandName: "Lasso", firmName });
      expect(body.length).toBeLessThanOrEqual(SMS_ONE_SEGMENT);
      expect(body.endsWith("Reply STOP to opt out.")).toBe(true);
      expect(/^[\x20-\x7e]+$/.test(body)).toBe(true);
    }
  });

  it("has no long dash anywhere in its copy", () => {
    for (const line of [...Object.values(WON_TEXT_COPY), ...Object.values(WON_TEXT_PROBLEMS)]) expect(line).not.toMatch(/[\u2013\u2014]/);
  });
});

describe("inputs", () => {
  it("accepts a board and a press id and nothing that could be a phone number", () => {
    const parsed = wonTextSendInput({ engagement_id: BOARD, press_id: PRESS, profile_id: "nope", to: "+15551234567", phone: "+15551234567" } as never);
    expect(parsed).toEqual({ engagement_id: BOARD, profile_id: null, press_id: PRESS });
  });

  it.each([undefined, null, {}, { engagement_id: "x" }, { engagement_id: 7 }])("refuses a bad board (%j)", (bad) => {
    expect(() => wonTextBoardInput(bad as never)).toThrow("Unknown board.");
  });

  it("refuses a missing or made-up press id", () => {
    expect(() => wonTextSendInput({ engagement_id: BOARD, press_id: "today" })).toThrow("Unknown press.");
  });

  it.each([
    ["+14155550100", true],
    ["+447700900123", true],
    ["4155550100", false],
    ["+0155550100", false],
    ["+1 415 555 0100", false],
    ["+1415555010012345678", false],
    ["", false],
    [null, false],
  ])("isE164(%j) is %j", (value, expected) => {
    expect(isE164(value)).toBe(expected);
  });
});

describe("who has the button", () => {
  it("an admin of the demo workspace, on a won board, with someone to text", async () => {
    const { deps } = world();
    expect(await wonTextStatus(deps, input)).toEqual({ show: true, connected: true, preview: wonTextBody({ brandName: "Lasso", firmName: "Kestrel Bay" }) });
  });

  it.each([
    ["no sender is connected", { config: null }],
    ["nobody to text yet", { recipient: null }],
    ["the recipient is not a full number", { recipient: "4155550100" }],
    ["neither is set, as on the first day", { config: null, recipient: null }],
  ] as [string, Partial<World>][])("shows the words but not connected when %s", async (_name, over) => {
    const { deps, sends } = world(over);
    expect(await wonTextStatus(deps, input)).toEqual({ show: true, connected: false, preview: wonTextBody({ brandName: "Lasso", firmName: "Kestrel Bay" }) });
    expect(sends).toEqual([]);
  });

  it.each([
    ["a lead", { role: "lead" }],
    ["a manager", { role: "em" }],
    ["an analyst", { role: "analyst" }],
    ["a coach", { role: "coach" }],
    ["an admin of another workspace", { orgId: "11111111-1111-4111-8111-111111111111" }],
    ["a board that is not theirs", { board: null }],
    ["an archived board", { board: { archived: true, won: true } }],
    ["a board not won", { board: { archived: false, won: false } }],
  ] as [string, Partial<World>][])("nothing for %s", async (_name, over) => {
    const { deps, sends, results } = world(over);
    expect(await wonTextStatus(deps, input)).toEqual({ show: false });
    expect(sends).toEqual([]);
    expect(results).toEqual([]);
  });

  it("only the one workspace is listed", () => {
    expect(TEXT_WORKSPACES).toEqual([KESTREL_BAY_ORG_ID]);
  });

  it("never returns the number", async () => {
    const { deps } = world();
    expect(JSON.stringify(await wonTextStatus(deps, input))).not.toContain(NUMBER.slice(1));
  });
});

describe("a press", () => {
  it("sends the previewed words to the one number, once, and records only channel and outcome", async () => {
    const { deps, sends, results, w } = world();
    expect(await sendWonText(deps, input)).toEqual({ ok: true });
    expect(sends).toEqual([{ to: NUMBER, text: wonTextBody({ brandName: "Lasso", firmName: "Kestrel Bay" }), idempotencyKey: `won-text/${BOARD}/${PRESS}` }]);
    expect(results).toEqual(["accepted"]);
    expect(w.presses).toBe(1);
  });

  it.each([
    ["a lead", { role: "lead" }, 403],
    ["an analyst", { role: "analyst" }, 403],
    ["an admin of another workspace", { orgId: "11111111-1111-4111-8111-111111111111" }, 403],
    ["a board in another workspace", { board: null }, 404],
  ] as [string, Partial<World>, number][])("a direct call by %s is refused before anything is sent or recorded", async (_name, over, code) => {
    const { deps, sends, results, w } = world(over);
    expect(await status(sendWonText(deps, input))).toBe(code);
    expect(sends).toEqual([]);
    expect(results).toEqual([]);
    expect(w.presses).toBe(0);
  });

  it.each([
    ["not won", { board: { archived: false, won: false } }, WON_TEXT_COPY.notWon],
    ["archived", { board: { archived: true, won: true } }, WON_TEXT_COPY.notConnected],
    ["nobody to text", { recipient: null }, WON_TEXT_COPY.notConnected],
    ["a recipient that is not a full number", { recipient: "4155550100" }, WON_TEXT_COPY.notConnected],
    ["neither set", { config: null, recipient: null }, WON_TEXT_COPY.notConnected],
    ["no sender connected", { config: null }, WON_TEXT_COPY.notConnected],
  ] as [string, Partial<World>, string][])("%s: a plain line, nothing sent, nothing recorded", async (_name, over, problem) => {
    const { deps, sends, results, w } = world(over);
    expect(await sendWonText(deps, input)).toEqual({ ok: false, problem });
    expect(sends).toEqual([]);
    expect(results).toEqual([]);
    expect(w.presses).toBe(0);
  });

  it("sends up to the daily limit and then stops", async () => {
    const { deps, sends, results } = world();
    for (let n = 0; n < WON_TEXT_DAILY_CAP; n += 1) expect(await sendWonText(deps, input)).toEqual({ ok: true });
    expect(await sendWonText(deps, input)).toEqual({ ok: false, problem: WON_TEXT_COPY.capped });
    expect(await sendWonText(deps, input)).toEqual({ ok: false, problem: WON_TEXT_COPY.capped });
    expect(sends).toHaveLength(WON_TEXT_DAILY_CAP);
    expect(results.slice(-2)).toEqual(["capped", "capped"]);
  });

  it("does not send when the press could not be recorded", async () => {
    const { deps, sends } = world({ recordWorks: false });
    expect(await sendWonText(deps, input)).toEqual({ ok: false, problem: WON_TEXT_COPY.notRecorded });
    expect(sends).toEqual([]);
  });

  it("does not send when today's count could not be read", async () => {
    const { deps, sends } = world({ countWorks: false });
    expect(await sendWonText(deps, input)).toEqual({ ok: false, problem: WON_TEXT_COPY.notRecorded });
    expect(sends).toEqual([]);
  });

  it.each([
    [{ outcome: "opted_out" }, "opted_out", WON_TEXT_COPY.optedOut],
    [{ outcome: "refused", status: 422, code: "SMSDestinationNotEnabled" }, "refused", WON_TEXT_COPY.refused],
    [{ outcome: "refused", status: 402, code: null }, "refused", WON_TEXT_COPY.refused],
    [{ outcome: "failed", status: 503 }, "failed", WON_TEXT_COPY.failed],
    [{ outcome: "failed", status: null }, "failed", WON_TEXT_COPY.failed],
  ] as [TextSendResult, string, string][])("%j is told plainly and recorded as %s, with no number in the log", async (send, outcome, problem) => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { deps, results } = world({ send });
    expect(await sendWonText(deps, input)).toEqual({ ok: false, problem });
    expect(results).toEqual([outcome]);
    for (const call of log.mock.calls) {
      const line = call.join(" ");
      expect(line).not.toContain(NUMBER.slice(1));
      expect(line).not.toContain(CONFIG.from.slice(1));
      expect(line).not.toContain(CONFIG.apiKey);
      expect(line).not.toContain("proposal you helped");
    }
    log.mockRestore();
  });

  it("every outcome a press can record has a plain line or is the success", () => {
    for (const outcome of WON_TEXT_OUTCOMES) if (outcome !== "accepted") expect(WON_TEXT_PROBLEMS[outcome]).toBeTruthy();
  });
});

describe("the one sender function", () => {
  afterEach(() => vi.restoreAllMocks());

  it("is not connected without a well-shaped key and sender", () => {
    expect(textConfig({})).toBeNull();
    expect(textConfig({ BIRD_API_KEY: "bk_us1_testkey12345" })).toBeNull();
    expect(textConfig({ BIRD_API_KEY: "sk_live_something", BIRD_SMS_FROM: "+15005550001" })).toBeNull();
    expect(textConfig({ BIRD_API_KEY: "bk_xx9_testkey12345", BIRD_SMS_FROM: "+15005550001" })).toBeNull();
    expect(textConfig({ BIRD_API_KEY: "bk_us1_testkey12345", BIRD_SMS_FROM: "https://evil.example" })).toBeNull();
  });

  it("takes the region from the key and nothing else", () => {
    expect(textConfig({ BIRD_API_KEY: " bk_us1_testkey12345 ", BIRD_SMS_FROM: "+15005550001" })).toEqual(CONFIG);
    expect(textConfig({ BIRD_API_KEY: "bk_eu1_testkey12345", BIRD_SMS_FROM: "Lasso" })?.host).toBe("https://eu1.platform.bird.com");
  });

  it("posts one message in the documented shape", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ id: "sms_1", status: "accepted" }), { status: 202 }));
    expect(await sendText(CONFIG, { to: NUMBER, text: "hello", idempotencyKey: "k1" }, fetchImpl as never)).toEqual({ outcome: "accepted" });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://us1.platform.bird.com/v1/sms/messages");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ Authorization: `Bearer ${CONFIG.apiKey}`, "Content-Type": "application/json", "Idempotency-Key": "k1" });
    expect(JSON.parse(String(init.body))).toEqual({ to: NUMBER, from: CONFIG.from, text: "hello", category: "transactional", options: { smart_encoding: true }, tags: [{ name: "kind", value: "won_text" }] });
  });

  it.each([
    [422, { code: "E12077", name: "SMSRecipientSuppressed", message: `suppressed ${NUMBER}` }, { outcome: "opted_out" }],
    [422, { error: { code: "E25000", name: "PreferenceRevoked" } }, { outcome: "opted_out" }],
    [422, { code: "SMSDestinationNotEnabled", message: `to ${NUMBER}` }, { outcome: "refused", status: 422, code: "SMSDestinationNotEnabled" }],
    [402, { message: "wallet" }, { outcome: "refused", status: 402, code: null }],
    [401, "nope", { outcome: "refused", status: 401, code: null }],
    [422, { code: `bad ${NUMBER}` }, { outcome: "refused", status: 422, code: null }],
    [422, { code: NUMBER.slice(1) }, { outcome: "refused", status: 422, code: null }],
    [422, { code: `E${NUMBER.slice(1)}` }, { outcome: "refused", status: 422, code: null }],
    [500, { code: "X" }, { outcome: "failed", status: 500 }],
  ] as [number, unknown, TextSendResult][])("a %i reply becomes an outcome that carries no number", async (code, body, expected) => {
    const fetchImpl = vi.fn(async () => new Response(typeof body === "string" ? body : JSON.stringify(body), { status: code }));
    const result = await sendText(CONFIG, { to: NUMBER, text: "hello", idempotencyKey: "k1" }, fetchImpl as never);
    expect(result).toEqual(expected);
    expect(JSON.stringify(result)).not.toContain(NUMBER.slice(1));
  });

  it("a network error is a failure, never a throw", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error(`connect failed for ${NUMBER}`);
    });
    expect(await sendText(CONFIG, { to: NUMBER, text: "hello", idempotencyKey: "k1" }, fetchImpl as never)).toEqual({ outcome: "failed", status: null });
  });
});

describe("what is recorded", () => {
  it("the two events carry channel and outcome only", () => {
    expect(EVENT_DIM_KEYS["proposal_text.pressed"]).toEqual(["channel"]);
    expect(EVENT_DIM_KEYS["proposal_text.result"]).toEqual(["channel", "outcome"]);
    const guarded = guardServerEventDims("proposal_text.result", { channel: "sms", outcome: "accepted", to: NUMBER, phone: NUMBER, text: "words", engagement_id: BOARD });
    expect(guarded.dims).toEqual({ channel: "sms", outcome: "accepted" });
  });

  it("the day starts at midnight UTC", () => {
    expect(startOfUtcDay(new Date("2026-11-20T23:59:59.000Z"))).toBe("2026-11-20T00:00:00.000Z");
    expect(startOfUtcDay(new Date("2026-11-20T00:00:00.000Z"))).toBe("2026-11-20T00:00:00.000Z");
  });
});

describe("wiring", () => {
  const read = (path: string) => readFileSync(path, "utf8");

  it.each([
    ["wonTextStatus", "wonTextBoardInput", "status"],
    ["sendWonText", "wonTextSendInput", "send"],
  ])("%s is auth, then its tested validator and handler", (name, validator, handler) => {
    const source = read("src/lib/won-text.functions.ts");
    const start = source.indexOf(`export const ${name} = createServerFn`);
    expect(start).toBeGreaterThan(-1);
    const next = source.indexOf("export const ", start + 1);
    const body = source.slice(start, next === -1 ? undefined : next);
    expect(body).toContain(".middleware([requireSupabaseAuth])");
    expect(body).toContain(`.inputValidator(${validator})`);
    expect(body).toContain(`(await import("./won-text.server")).wonTextHandlers.${handler}(context, data)`);
  });

  it("the real wiring starts with the firm member check, reads the number only from the secret and records before it counts", () => {
    const source = read("src/lib/won-text.server.ts");
    expect(source).toContain("await requireFirmMember(context.supabase, context.userId, profileId)");
    expect(source.match(/PROPOSAL_TEXT_TO/g)?.length).toBe(2); // the header comment and the one read
    expect(source.indexOf("await deps.recordPress(state.caller)")).toBeLessThan(source.indexOf("await deps.pressesToday(state.caller.orgId)"));
    expect(source.indexOf("await deps.pressesToday(state.caller.orgId)")).toBeLessThan(source.indexOf("await deps.send(config"));
    expect(source).not.toMatch(/console\.(log|error|warn)\([^)]*(state\.to|message\.to|config\.from|preview)/);
  });

  it("no flag and no phone field sit in the screen", () => {
    const screen = read("src/components/firm-brain/WonTextButton.tsx");
    expect(screen).not.toMatch(/posthog|featureFlag|useFlag/i);
    expect(screen).not.toMatch(/type="tel"|phone_number|\bto:/);
  });
});
