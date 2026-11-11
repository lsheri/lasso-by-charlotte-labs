// V2-0: the additive read frame on the Ask stream. FLAGS-1 (10 Nov): the ask-v2 flag is retired; the
// redesign is the Ask panel for everyone.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getSession: async () => ({ data: { session: { access_token: "t" } } }) } } }));
vi.mock("@/lib/posthog-client", () => ({ readFeatureFlag: () => undefined }));

import { streamChatRequest } from "@/lib/stream-client";
import { FEATURE_FLAGS } from "@/lib/feature-flags";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");
function respondWith(lines: object[]) {
  const body = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new TextEncoder().encode(lines.map((l) => JSON.stringify(l)).join("\n") + "\n")); c.close(); } });
  vi.stubGlobal("fetch", vi.fn(async () => new Response(body, { status: 200 })));
}

describe("V2-0 flag and read frame", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("FLAGS-1: ask-v2 is no longer a flag; the redesign is on for everyone and nothing reads PostHog for it", () => {
    expect(Object.keys(FEATURE_FLAGS)).not.toContain("ask-v2");
    for (const file of [
      "src/components/reflect/AskSurface.tsx",
      "src/components/reflect/use-ask-lasso.ts",
      "src/components/canvas-lab/LabAnswerCard.tsx",
      "src/components/canvas-lab/ask-draft/AskDraftSurface.tsx",
    ])
      expect(read(file)).not.toContain('flagEnabled("ask-v2")');
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
    expect(hook).toContain('(manifest) => setLiveManifest(manifest as ContextManifest),');
    expect(hook).toMatch(/shouldPrimeForDraft\(/);
  });
});
