import { describe, expect, it, vi } from "vitest";

import { toAnthropicBody } from "../anthropic.server";
import { BOARD_IMAGE_MAX_PER_TURN, loadBoardImageParts, mediaTypeForPath, type BoardImageDb } from "../board-images.server";

function fakeDb(rows: { id: string; kind: string; body: string | null; workboard_id: string }[], files: Record<string, Blob | null>): BoardImageDb & { downloads: string[] } {
  const downloads: string[] = [];
  return {
    downloads,
    from: () => ({ select: () => ({ in: (_c: "id", ids: string[]) => ({ is: async () => ({ data: rows.filter((r) => ids.includes(r.id)), error: null }) }) }) }),
    storage: { from: () => ({ download: async (path: string) => { downloads.push(path); const blob = files[path]; return blob ? { data: blob, error: null } : { data: null, error: new Error("missing") }; } }) },
  };
}

const body = (path: string) => JSON.stringify({ path, naturalWidth: 10, naturalHeight: 10 });

describe("KEY-3 board images", () => {
  it("maps file extensions to the four supported media types", () => {
    expect(mediaTypeForPath("a/b/slide.PNG")).toBe("image/png");
    expect(mediaTypeForPath("x.jpeg")).toBe("image/jpeg");
    expect(mediaTypeForPath("x.webp")).toBe("image/webp");
    expect(mediaTypeForPath("x.svg")).toBeNull();
  });

  it("loads picked images from this board only, base64, with the node id for the manifest", async () => {
    const db = fakeDb(
      [
        { id: "n1", kind: "image", body: body("org/n1.png"), workboard_id: "board" },
        { id: "n2", kind: "image", body: body("org/n2.png"), workboard_id: "other-board" },
        { id: "n3", kind: "sticky", body: null, workboard_id: "board" },
      ],
      { "org/n1.png": new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" }) },
    );
    const result = await loadBoardImageParts(db, ["n1", "n2", "n3", "n4"], "board");
    expect(result.parts).toEqual([{ type: "image", mediaType: "image/png", data: Buffer.from([1, 2, 3]).toString("base64"), nodeId: "n1" }]);
    expect(result.skipped).toEqual([
      { nodeId: "n2", reason: "not_found" },
      { nodeId: "n3", reason: "not_found" },
      { nodeId: "n4", reason: "not_found" },
    ]);
    expect(db.downloads).toEqual(["org/n1.png"]);
  });

  it("stops at the per-turn cap and reports oversized and missing files", async () => {
    const rows = Array.from({ length: BOARD_IMAGE_MAX_PER_TURN + 3 }, (_, i) => ({ id: `n${i}`, kind: "image", body: body(`p/${i}.png`), workboard_id: "board" }));
    const files: Record<string, Blob | null> = {};
    for (let i = 0; i < rows.length; i += 1) files[`p/${i}.png`] = new Blob([new Uint8Array([i])]);
    files["p/1.png"] = new Blob([new Uint8Array(5 * 1024 * 1024 + 1)]);
    files["p/2.png"] = null;
    const result = await loadBoardImageParts(fakeDb(rows, files), rows.map((r) => r.id), "board");
    expect(result.parts.map((p) => p.nodeId)).toEqual(["n0", "n3", "n4", "n5", "n6", "n7"]);
    expect(result.skipped).toEqual([
      { nodeId: "n1", reason: "too_large" },
      { nodeId: "n2", reason: "unreadable" },
      { nodeId: "n8", reason: "over_cap" },
    ]);
  });

  it("puts images before the words on the Anthropic wire and nowhere else", () => {
    const wire = toAnthropicBody(
      [
        { role: "system", content: "s" },
        { role: "assistant", content: "earlier", images: [{ type: "image", mediaType: "image/png", data: "zz" }] },
        { role: "user", content: "what does the chart say", images: [{ type: "image", mediaType: "image/png", data: "QUJD", nodeId: "n1" }] },
      ],
      "m",
      {},
      false,
    );
    const messages = wire["messages"] as { role: string; content: unknown }[];
    expect(messages[0]?.content).toBe("earlier");
    expect(messages[1]?.content).toEqual([
      { type: "image", source: { type: "base64", media_type: "image/png", data: "QUJD" } },
      { type: "text", text: "what does the chart say" },
    ]);
    expect(JSON.stringify(wire)).not.toContain("nodeId");
  });

  it("keeps the OpenAI wire shape for text turns and adds image_url parts for image turns", async () => {
    process.env["AI_PROVIDER"] = "openai";
    vi.resetModules();
    const { chatComplete } = await import("../ai.server");
    let sent: { messages: { content: unknown }[] } | null = null;
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
      sent = JSON.parse(String(init.body));
      return Response.json({ model: "gpt-5", choices: [{ message: { content: "ok" }, finish_reason: "stop" }], usage: { prompt_tokens: 1, completion_tokens: 1 } });
    }));
    vi.doMock("../ai-key", () => ({ openAiKeyFor: () => ({ key: "k", source: "default" }), anthropicKeyFor: () => null }));
    vi.doMock("../org-type.server", () => ({ orgTypeOf: async () => "company", workspaceStamp: async () => ({ workspace_type: "company", affiliated: false }), accountStageOf: async () => null }));
    vi.doMock("../health.server", () => ({ logHealth: async () => undefined }));
    vi.doMock("../egress.server", () => ({ scheduleEgress: () => {} }));
    vi.doMock("@tanstack/react-start/server", () => ({ getRequestHeader: () => undefined }));
    vi.doMock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: () => ({ select: () => ({ eq: async () => ({ data: [] }) }), insert: async () => ({ error: null }) }), auth: { admin: { getUserById: async () => ({ data: { user: null }, error: null }) } } } }));
    const { chatComplete: fresh } = await import("../ai.server");
    void chatComplete;
    await fresh([{ role: "user", content: "plain" }, { role: "user", content: "look", images: [{ type: "image", mediaType: "image/jpeg", data: "QUJD" }] }], { meta: { surface: "ask_dock", orgId: "o" } });
    expect(sent!.messages[0]!.content).toBe("plain");
    expect(sent!.messages[1]!.content).toEqual([
      { type: "image_url", image_url: { url: "data:image/jpeg;base64,QUJD" } },
      { type: "text", text: "look" },
    ]);
    vi.unstubAllGlobals();
    delete process.env["AI_PROVIDER"];
  });
});
