// V2-0: the ask-v2 flag (default off) and the additive read frame on the Ask stream.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getSession: async () => ({ data: { session: { access_token: "t" } } }) } } }));
vi.mock("@/lib/posthog-client", () => ({ readFeatureFlag: () => undefined }));

import { streamChatRequest } from "@/lib/stream-client";
import { FEATURE_FLAGS, flagEnabled } from "@/lib/feature-flags";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");
function respondWith(lines: object[]) {
  const body = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new TextEncoder().encode(lines.map((l) => JSON.stringify(l)).join("\n") + "\n")); c.close(); } });
  vi.stubGlobal("fetch", vi.fn(async () => new Response(body, { status: 200 })));
}

describe("V2-0 flag and read frame", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("ask-v2 exists and is off by default, so today's panel is the code default", () => {
    expect(FEATURE_FLAGS["ask-v2"].default).toBe(false);
    expect(flagEnabled("ask-v2")).toBe(false);
  });

  it("hands the read frame to onRead and still returns the done payload", async () => {
    respondWith([{ t: "read", manifest: { items: [1] } }, { t: "delta", v: "Hi" }, { t: "done", payload: { ok: true } }]);
    const onRead = vi.fn();
    const deltas: string[] = [];
    const result = await streamChatRequest<{ ok: boolean }>("/api/reflect/stream", {}, (d) => deltas.push(d), onRead);
    expect(onRead).toHaveBeenCalledWith({ items: [1] });
    expect(deltas).toEqual(["Hi"]);
    expect(result).toEqual({ ok: true });
  });

  it("an older caller with no onRead ignores the frame, and a stream with no done frame still fails", async () => {
    respondWith([{ t: "read", manifest: {} }, { t: "delta", v: "x" }]);
    await expect(streamChatRequest("/api/reflect/stream", {}, () => {})).rejects.toThrow("stopped before it finished");
  });

  it("the server tells the stream what it reads before building the model conversation", () => {
    const run = read("src/lib/reflect-run.server.ts");
    expect(run.indexOf("onRead?.(assembled.manifest)")).toBeGreaterThan(0);
    expect(run.indexOf("onRead?.(assembled.manifest)")).toBeLessThan(run.indexOf("buildReflectConversation({"));
    expect(read("src/routes/api/reflect.stream.ts")).toContain('(manifest) => emit({ t: "read", manifest })');
  });

  it("the client reads it early only behind ask-v2, and event names and the warm-up stay untouched", () => {
    const hook = read("src/components/reflect/use-ask-lasso.ts");
    expect(hook).toContain('flagEnabled("ask-v2") ? (manifest) => setLiveManifest(manifest as ContextManifest) : undefined');
    expect(hook).toMatch(/shouldPrimeForDraft\(/);
  });
});
