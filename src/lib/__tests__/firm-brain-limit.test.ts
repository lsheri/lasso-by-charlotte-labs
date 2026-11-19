// 19 Nov (Liam, D-19): the daily spend limit on firm brain model calls. USD 5 a person, USD 25 a workspace, per UTC
// day, added up from the usage ledger. Refused before any model is called. Nothing new is stored.
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { FIRM_BRAIN_LIMIT_COPY, FIRM_BRAIN_PERSON_DAILY_USD, FIRM_BRAIN_SURFACES, FIRM_BRAIN_WORKSPACE_DAILY_USD, firmBrainLimitReached, isFirmBrainLimit, isFirmBrainSurface, startOfUtcDay } from "@/lib/firm-brain-limit-shared";
import { assertWithinFirmBrainLimit } from "@/lib/firm-brain-limit.server";
import { KESTREL_BAY_ORG_ID } from "@/lib/firm-story-shared";

const ORG = "org-a";
const row = (profile_id: string | null, cost_usd: number | null) => ({ profile_id, cost_usd });
const deps = (rows: ReturnType<typeof row>[]) => ({ now: () => new Date("2026-11-20T15:30:00Z"), spendSince: vi.fn(async () => rows) });
const refused = async (run: Promise<void>) => run.then(() => null, (error: unknown) => error as Response);

describe("the figures", () => {
  it("are USD 5 a person and USD 25 a workspace", () => {
    expect(FIRM_BRAIN_PERSON_DAILY_USD).toBe(5);
    expect(FIRM_BRAIN_WORKSPACE_DAILY_USD).toBe(25);
  });

  it("the day starts at midnight UTC", () => {
    expect(startOfUtcDay(new Date("2026-11-20T23:59:59Z"))).toBe("2026-11-20T00:00:00.000Z");
    expect(startOfUtcDay(new Date("2026-11-20T00:00:00Z"))).toBe("2026-11-20T00:00:00.000Z");
  });
});

describe("adding up the day", () => {
  it("is under the limit below both figures", () => {
    expect(firmBrainLimitReached([row("p1", 4.99), row("p2", 4.99), row("p3", 4.99)], "p1")).toBeNull();
    expect(firmBrainLimitReached([], "p1")).toBeNull();
  });

  it("reaches the person's limit at USD 5 of their own spend, whatever colleagues spent", () => {
    expect(firmBrainLimitReached([row("p1", 2.5), row("p1", 2.5)], "p1")).toBe("person");
    expect(firmBrainLimitReached([row("p2", 4.5), row("p1", 0.4)], "p1")).toBeNull();
  });

  it("reaches the workspace's limit at USD 25 across everyone, for a person who spent little", () => {
    const others = ["p2", "p3", "p4", "p5", "p6"].map((id) => row(id, 4.99));
    expect(firmBrainLimitReached([...others, row("p1", 0.05)], "p1")).toBe("workspace");
    expect(firmBrainLimitReached(others, "p1")).toBeNull();
  });

  it("counts calls with no person towards the workspace only, and ignores odd costs", () => {
    expect(firmBrainLimitReached([row(null, 25)], "p1")).toBe("workspace");
    expect(firmBrainLimitReached([row("p1", null), row("p1", Number.NaN), row("p1", -9), row("p1", 1)], "p1")).toBeNull();
  });
});

describe("the check before a model call", () => {
  it("reads nothing for a surface that is not the firm brain, or with no workspace", async () => {
    const d = deps([row("p1", 99)]);
    for (const surface of ["extract", "ask", "ask_prime", "analysis", undefined]) await assertWithinFirmBrainLimit({ surface, orgId: ORG, profileId: "p1" }, d);
    await assertWithinFirmBrainLimit({ surface: "firm_ask", orgId: null, profileId: "p1" }, d);
    await assertWithinFirmBrainLimit(undefined, d);
    expect(d.spendSince).not.toHaveBeenCalled();
  });

  it("lets every firm brain surface through under the limit, reading the workspace's day once", async () => {
    for (const surface of FIRM_BRAIN_SURFACES) {
      const d = deps([row("p1", 1)]);
      await assertWithinFirmBrainLimit({ surface, orgId: ORG, profileId: "p1" }, d);
      expect(d.spendSince).toHaveBeenCalledExactlyOnceWith(ORG, "2026-11-20T00:00:00.000Z");
    }
  });

  it("refuses with 429 and a plain line at the person's limit", async () => {
    const error = await refused(assertWithinFirmBrainLimit({ surface: "proposal_draft", orgId: ORG, profileId: "p1" }, deps([row("p1", 5)])));
    expect(error).toBeInstanceOf(Response);
    expect(error?.status).toBe(429);
    expect(await error?.text()).toBe(FIRM_BRAIN_LIMIT_COPY.person);
    expect(isFirmBrainLimit(error)).toBe(true);
  });

  it("refuses at the workspace's limit, also for a person who spent nothing", async () => {
    const error = await refused(assertWithinFirmBrainLimit({ surface: "firm_ask_answer", orgId: ORG, profileId: "p9" }, deps([row("p1", 13), row("p2", 12)])));
    expect(error?.status).toBe(429);
    expect(await error?.text()).toBe(FIRM_BRAIN_LIMIT_COPY.workspace);
  });

  it("never limits the demo firm, and reads nothing there", async () => {
    const d = deps([row("p1", 500)]);
    await assertWithinFirmBrainLimit({ surface: "firm_ask", orgId: KESTREL_BAY_ORG_ID, profileId: "p1" }, d);
    expect(d.spendSince).not.toHaveBeenCalled();
  });

  it("lets the call through when the day's spend cannot be read", async () => {
    const broken = { now: () => new Date(), spendSince: vi.fn(async () => { throw new Error("down"); }) };
    await expect(assertWithinFirmBrainLimit({ surface: "red_pen", orgId: ORG, profileId: "p1" }, broken)).resolves.toBeUndefined();
  });
});

describe("where it sits", () => {
  it("is called in the one place models are called, before any request is sent", () => {
    const ai = readFileSync("src/lib/ai.server.ts", "utf8");
    const routed = ai.slice(ai.indexOf("async function routedRequest("));
    expect(routed.indexOf("await assertWithinFirmBrainLimit(options.meta);")).toBeGreaterThan(0);
    expect(routed.indexOf("await assertWithinFirmBrainLimit(options.meta);")).toBeLessThan(routed.indexOf("await sendRequest("));
    expect(ai.match(/routedRequest\(options\.model, messages, options, (true|false)\)/g)?.length).toBe(2);
  });

  it("covers every surface name the firm brain files send, and tagging is left out on purpose", () => {
    const files = readdirSync("src/lib").filter((name) => /^(firm-|proposal|red-pen|sow-terms)/.test(name) && name.endsWith(".ts") && !name.includes("limit"));
    const sent = new Set<string>();
    for (const name of files) for (const match of readFileSync(`src/lib/${name}`, "utf8").matchAll(/surface: "([a-z_]+)"/g)) sent.add(match[1]!);
    sent.delete("extract");
    expect([...sent].filter((surface) => !isFirmBrainSurface(surface))).toEqual([]);
    expect(isFirmBrainSurface("extract")).toBe(false);
  });

  it("the three screens that call a model show the limit line: Ask the firm, Start a proposal, Red pen", () => {
    for (const path of ["src/components/firm-brain/AskTheFirm.tsx", "src/components/firm-brain/ProposalStartPanel.tsx", "src/components/canvas-lab/RedPenPanel.tsx"]) {
      const source = readFileSync(path, "utf8");
      expect(source, path).toContain("setLimited(isFirmBrainLimit(error));");
      expect(source, path).toContain("FIRM_BRAIN_LIMIT_COPY.shown");
    }
    const proposal = readFileSync("src/components/firm-brain/ProposalStartPanel.tsx", "utf8");
    expect(proposal.match(/setLimited\(isFirmBrainLimit\(error\)\);/g)?.length).toBe(3);
  });

  it("no em dash and no product name in the copy", () => {
    for (const line of Object.values(FIRM_BRAIN_LIMIT_COPY)) expect(line).not.toMatch(/\u2014|Lasso|Charlotte/);
  });
});
