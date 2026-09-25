import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

import type { SharedSeedWork } from "../board-share-shared";
import { EVENT_DIM_KEYS, guardEventDims } from "../event-dim-allowlist";

const SERVER = readFileSync("src/lib/demo-board.server.ts", "utf8");
const SHARE = readFileSync("src/lib/board-share-open.server.ts", "utf8");

describe("demo field allowlist", () => {
  it("strips source_meta, meta, content_ref and the real conversation id", async () => {
    const { publicSafeWork: demoSafeWork } = await import("../public-work-allowlist");
    const item = {
      id: "w1",
      title: "Deck",
      type: "deck",
      content_ref: "org/abc/file.pdf",
      orig_conversation_id: "conv-real",
      source_meta: { url: "https://drive.google.com/x", drive_file_id: "d1", gmail_id: "g1", notes: "n" },
      meta: { storage_key: "k" },
      taskIds: ["t"],
    } as unknown as SharedSeedWork;
    const twin = { ...item, id: "w2" } as SharedSeedWork;
    const [out, out2] = demoSafeWork([item, twin]);
    const text = JSON.stringify(out);
    expect(out).not.toHaveProperty("meta");
    expect(out!.content_ref).toBeNull();
    expect(text).not.toMatch(/drive|gmail|storage_key|conv-real|org\/abc/);
    expect(out!.orig_conversation_id).toBe("group-1");
    expect(out2!.orig_conversation_id).toBe("group-1");
  });
});

describe("demo org resolution", () => {
  it("resolves the org only through is_demo and never takes an id", () => {
    expect(SERVER).toContain('.eq("is_demo", true)');
    expect(SERVER).toMatch(/export async function openDemoBoard\(code: string\)/);
    expect(SERVER).toMatch(/export async function openDemoHome\(\)/);
  });

  it("returns not_found for a code outside the demo org", async () => {
    const builder: Record<string, unknown> = {};
    const chain = () => builder;
    Object.assign(builder, {
      select: chain,
      eq: chain,
      order: chain,
      limit: () => Promise.resolve({ data: [{ id: "demo-org" }] }),
      maybeSingle: () => Promise.resolve({ data: null }),
    });
    vi.doMock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: () => builder } }));
    vi.resetModules();
    const { openDemoBoard } = await import("../demo-board.server");
    expect(await openDemoBoard("REAL-CLIENT-CODE")).toEqual({ status: "not_found" });
    expect(await openDemoBoard("../bad code")).toEqual({ status: "not_found" });
    vi.doUnmock("@/integrations/supabase/client.server");
  });

  it("the share link still reads as its maker; the demo reads as nobody", () => {
    expect(SHARE).toContain("readBoard(supabaseAdmin, link.workboard_id, link, link.created_by)");
    expect(SERVER).toMatch(/readBoard\(db, wb\.id, \{[^}]*\}, null\)/);
  });
});

describe("demo routes and events", () => {
  it("routes are public and noindex", () => {
    for (const path of ["src/routes/demo.index.tsx", "src/routes/demo.$code.tsx"]) {
      const src = readFileSync(path, "utf8");
      expect(src).toContain("noindex, nofollow");
      expect(src).not.toContain("beforeLoad");
    }
  });

  it("demo board page renders the shared read-only view and no write controls", () => {
    const page = readFileSync("src/pages/DemoPages.tsx", "utf8");
    expect(page).toContain("<SharedBoardView");
    expect(page).toContain("A demo workspace. Every figure is invented.");
    expect(page).not.toMatch(/useMutation|\.insert\(|\.update\(|\.delete\(/);
  });

  it("registers the two anonymous events with closed dims", () => {
    expect(EVENT_DIM_KEYS["demo.opened"]).toEqual(["surface", "engagement"]);
    expect(EVENT_DIM_KEYS["demo.card_opened"]).toEqual(["engagement", "kind"]);
    expect(guardEventDims("demo.opened", { surface: "home", engagement: "none", title: "x" }).dims).toEqual({
      surface: "home",
      engagement: "none",
    });
  });
});

describe("Unit 1.5 polish", () => {
  it("demo.opened goes once per view per surface and engagement", async () => {
    const calls: unknown[] = [];
    vi.doMock("../telemetry.functions", () => ({ recordAnonymousEventFn: (arg: unknown) => { calls.push(arg); return Promise.resolve(); } }));
    vi.resetModules();
    const { noteDemoOpened, resetDemoTelemetry } = await import("../demo-telemetry");
    resetDemoTelemetry();
    noteDemoOpened("board", "abc");
    noteDemoOpened("board", "abc");
    noteDemoOpened("home", "none");
    noteDemoOpened("home", "none");
    expect(calls).toHaveLength(2);
    vi.doUnmock("../telemetry.functions");
  });

  it("the read-only reader draws no comments or highlights rail", () => {
    const overlay = readFileSync("src/components/canvas-lab/FocusOverlay.tsx", "utf8");
    expect(overlay).toContain('{readOnly ? null : <aside className="focus-paper-aside');
  });

  it("home thumbnails come from the seeded board layout", () => {
    expect(SERVER).toContain("buildSharedBoardModel(dto)");
  });
});
