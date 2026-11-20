// 20 Nov, D-85: everyone in the firm sees the map, and fees reach admins and leads only. These tests call the real
// server path behind getFirmMap (firmMapFor) with the Kestrel Bay demo corpus and inspect exactly what it would send to the browser, for a
// manager, an analyst, an admin and a lead. A manager's or analyst's response must hold no fee and no money figure
// anywhere, not just a hidden one.
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DEMO_BOARDS } from "@/lib/demo-firm";
import { hasMoney, type FirmCanvasData } from "@/lib/firm-canvas-shared";
import { corpusOf, demoRows } from "@/lib/__tests__/helpers/demo-firm-rows";

const h = vi.hoisted(() => ({
  role: "em" as string,
  refuse: false,
  corpus: null as unknown,
  gate: vi.fn(),
}));

vi.mock("@/lib/firm-corpus.server", async (original) => ({
  ...(await original<object>()),
  requireFirmMember: async (...args: unknown[]) => {
    h.gate(...args);
    if (h.refuse) throw new Response("Forbidden", { status: 403 });
    return { profile: { id: "p-1", org_id: "org-kestrel", role: h.role }, supabaseAdmin: {} };
  },
  readFirmCorpus: async () => h.corpus,
}));

import { readFileSync } from "node:fs";
import path from "node:path";

import { firmMapFor } from "@/lib/firm-map.server";

const call = (): Promise<FirmCanvasData> =>
  firmMapFor({ supabase: {} as never, userId: "u-1" }, { profile_id: "p-1" });

/** Every string anywhere in a value, keys included. */
function strings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) value.forEach((entry) => strings(entry, out));
  else if (value && typeof value === "object")
    for (const [key, entry] of Object.entries(value)) {
      out.push(key);
      strings(entry, out);
    }
  return out;
}

/** The fee texts the seed writes onto each shared board's SOW. */
const FEES = DEMO_BOARDS.filter((board) => board.sharedWithFirm && board.fee).map(
  (board) => board.fee,
);

beforeEach(() => {
  h.role = "em";
  h.refuse = false;
  h.corpus = corpusOf(demoRows());
  h.gate.mockClear();
});

describe("getFirmMap for someone who does not see fees", () => {
  it("sends a manager and an analyst the whole map with no fee record and no money figure anywhere", async () => {
    // Managers and analysts are both "em" in the database; each is checked as its own call.
    for (const who of ["manager", "analyst"]) {
      h.role = "em";
      const data = await call();
      expect(data.fees, who).toBeNull();
      expect(data.threads.length, who).toBeGreaterThan(20);
      const text = strings(data);
      for (const fee of FEES)
        expect(
          text.some((entry) => entry.includes(fee)),
          `${who}: ${fee}`,
        ).toBe(false);
      expect(text.filter(hasMoney), who).toEqual([]);
      expect(JSON.stringify(data), who).not.toMatch(/fee_text|sow_facts|"\$/);
    }
  });

  it("takes a money figure out of a title or client name before it is sent", async () => {
    const corpus = corpusOf(demoRows());
    corpus.boards[0] = {
      ...corpus.boards[0]!,
      title: "Retainer at $45k/month for growth",
      client: "Acme (GBP 1.2m)",
    };
    h.corpus = corpus;
    const data = await call();
    const thread = data.threads.find((entry) => entry.id === corpus.boards[0]!.id)!;
    expect(thread.title).toBe("Retainer at for growth");
    expect(thread.client).toBe("Acme");
    expect(strings(data).filter(hasMoney)).toEqual([]);
  });

  it("never sends lesson text, to anyone", async () => {
    for (const role of ["em", "admin"]) {
      h.role = role;
      const data = await call();
      const lessons = data.threads.flatMap((thread) =>
        thread.stops.filter((stop) => stop.kind === "lesson"),
      );
      expect(lessons.length).toBeGreaterThan(0);
      expect(lessons.every((stop) => stop.kind === "lesson" && stop.text === "")).toBe(true);
    }
  });
});

describe("getFirmMap for admins and leads", () => {
  it("sends each engagement's fee, written by code from its SOW facts", async () => {
    for (const role of ["admin", "lead"]) {
      h.role = role;
      const data = await call();
      expect(data.fees).not.toBeNull();
      const sent = Object.values(data.fees!);
      expect(sent.length).toBeGreaterThan(10);
      for (const fee of sent) expect(FEES).toContain(fee);
      // Only boards that are on the map carry a fee.
      for (const id of Object.keys(data.fees!))
        expect(data.threads.some((thread) => thread.id === id)).toBe(true);
    }
  });
});

describe("getFirmMap's wiring", () => {
  it("is signed-in only and hands every call to firmMapFor, which is what these tests run", () => {
    const source = readFileSync(path.resolve(__dirname, "../firm-map.functions.ts"), "utf8");
    expect(source).toContain(".middleware([requireSupabaseAuth])");
    expect(source).toContain('(await import("./firm-map.server")).firmMapFor(context, data)');
    expect(source).not.toMatch(/supabaseAdmin|\.from\(|canvasDataFor/);
  });
});

describe("getFirmMap's gate", () => {
  it("checks firm membership before anything is read, and a refusal sends nothing", async () => {
    h.refuse = true;
    await expect(call()).rejects.toBeInstanceOf(Response);
    expect(h.gate).toHaveBeenCalledTimes(1);
  });
});
