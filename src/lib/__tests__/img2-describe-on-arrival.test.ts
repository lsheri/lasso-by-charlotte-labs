import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const ai = vi.hoisted(() => ({ text: "A slide titled Q3 plan.\nRevenue up 12%", throws: false, calls: [] as unknown[] }));
vi.mock("../ai.server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../ai.server")>();
  return {
    ...actual,
    chatComplete: vi.fn(async (messages: unknown, options: unknown) => {
      ai.calls.push({ messages, options });
      if (ai.throws) throw new Error("model_error");
      return { text: ai.text };
    }),
  };
});

import { buildBody } from "../ai.server";
import { toAnthropicBody } from "../anthropic.server";
import { describeBoardImage, IMAGE_DESCRIBE_MAX_BYTES, mediaTypeForPath } from "../image-describe.server";

type Row = Record<string, unknown>;
function fakeDb(node: Row | null, file: { size: number; bytes?: Uint8Array } | null) {
  const updates: Row[] = [];
  const db = {
    updates,
    from(table: string) {
      const chain = {
        select: () => chain,
        eq: () => chain,
        update: (values: Row) => { updates.push(values); return chain; },
        maybeSingle: async () => ({ data: table === "workboards" ? { org_id: "org-1" } : node }),
        then: (resolve: (value: { error: null }) => void) => resolve({ error: null }),
      };
      return chain;
    },
    storage: {
      from: () => ({
        download: async () => (file
          ? { data: { size: file.size, arrayBuffer: async () => (file.bytes ?? new Uint8Array([1, 2, 3])).buffer }, error: null }
          : { data: null, error: { message: "missing" } }),
      }),
    },
  };
  return db;
}

const imageNode = (path: string, extra: Row = {}): Row => ({
  id: "n1", kind: "image", body: JSON.stringify({ path, naturalWidth: 800, naturalHeight: 600 }),
  workboard_id: "b1", author_profile_id: "p1", image_text_status: null, deleted_at: null, ...extra,
});

beforeEach(() => { ai.text = "A slide titled Q3 plan.\nRevenue up 12%"; ai.throws = false; ai.calls = []; });

describe("IMG-2 the model call carries images", () => {
  it("Anthropic: image blocks first, then the instruction", () => {
    const body = toAnthropicBody([{ role: "user", content: "Read this image.", images: [{ mediaType: "image/png", data: "AAA" }] }], "claude-haiku-5-5", {}, false);
    const content = (body["messages"] as { content: unknown[] }[])[0]!.content;
    expect(content).toEqual([
      { type: "image", source: { type: "base64", media_type: "image/png", data: "AAA" } },
      { type: "text", text: "Read this image." },
    ]);
  });
  it("OpenAI: image_url data URL part, then the text", () => {
    const body = buildBody([{ role: "user", content: "Read this image.", images: [{ mediaType: "image/jpeg", data: "BBB" }] }], "gpt-4.1-mini", {}, false);
    const message = (body["messages"] as { content: unknown; images?: unknown }[])[0]!;
    expect(message.content).toEqual([
      { type: "image_url", image_url: { url: "data:image/jpeg;base64,BBB" } },
      { type: "text", text: "Read this image." },
    ]);
    expect(message.images).toBeUndefined();
  });
  it("a message without images is sent exactly as before on both paths", () => {
    const plain = [{ role: "user" as const, content: "hello" }];
    expect((toAnthropicBody(plain, "claude-haiku-5-5", {}, false)["messages"] as unknown[])[0]).toEqual({ role: "user", content: "hello" });
    expect((buildBody(plain, "gpt-4.1-mini", {}, false)["messages"] as unknown[])[0]).toEqual({ role: "user", content: "hello" });
  });
});

describe("IMG-2 describeBoardImage", () => {
  it("reads png, jpeg, gif and webp; skips avif and svg", () => {
    expect(mediaTypeForPath("u/x/slide.PNG")).toBe("image/png");
    expect(mediaTypeForPath("u/x/photo.jpg")).toBe("image/jpeg");
    expect(mediaTypeForPath("u/x/a.webp")).toBe("image/webp");
    expect(mediaTypeForPath("u/x/a.avif")).toBeNull();
    expect(mediaTypeForPath("u/x/a.svg")).toBeNull();
  });
  it("describes once and stores ok with the text, as image_describe on the fast tier", async () => {
    const db = fakeDb(imageNode("u/x/slide.png"), { size: 1000 });
    expect(await describeBoardImage("n1", { db: db as never })).toBe("ok");
    expect(db.updates[0]).toMatchObject({ image_text: "A slide titled Q3 plan.\nRevenue up 12%", image_text_status: "ok" });
    const call = ai.calls[0] as { options: { tier: string; meta: { surface: string; orgId: string; profileId: string } } };
    expect(call.options.tier).toBe("fast");
    expect(call.options.meta).toMatchObject({ surface: "image_describe", orgId: "org-1", profileId: "p1" });
  });
  it("leaves an already described card alone unless forced", async () => {
    const db = fakeDb(imageNode("u/x/slide.png", { image_text_status: "ok" }), { size: 1000 });
    expect(await describeBoardImage("n1", { db: db as never })).toBe("already");
    expect(ai.calls).toHaveLength(0);
  });
  it("skips unreadable types and files over the provider limit without a model call", async () => {
    const svg = fakeDb(imageNode("u/x/logo.svg"), { size: 10 });
    expect(await describeBoardImage("n1", { db: svg as never })).toBe("skipped");
    const big = fakeDb(imageNode("u/x/huge.png"), { size: IMAGE_DESCRIBE_MAX_BYTES + 1 });
    expect(await describeBoardImage("n1", { db: big as never })).toBe("skipped");
    expect(ai.calls).toHaveLength(0);
    expect(svg.updates[0]).toMatchObject({ image_text: null, image_text_status: "skipped" });
  });
  it("records failed when the model errors, so the card is not retried forever", async () => {
    ai.throws = true;
    const db = fakeDb(imageNode("u/x/slide.png"), { size: 1000 });
    expect(await describeBoardImage("n1", { db: db as never })).toBe("failed");
    expect(db.updates[0]).toMatchObject({ image_text_status: "failed" });
  });
  it("ignores anything that is not a live image card", async () => {
    expect(await describeBoardImage("n1", { db: fakeDb({ ...imageNode("a.png"), kind: "sticky" }, null) as never })).toBe("not_found");
    expect(await describeBoardImage("n1", { db: fakeDb(null, null) as never })).toBe("not_found");
  });
});

describe("IMG-2b wiring", () => {
  it("node_create no longer relies on background work for images", () => {
    const server = readFileSync("src/lib/canvas-lab.server.ts", "utf8");
    expect(server).not.toMatch(/describeBoardImage\(|image-describe\.server/);
  });
  it("the board asks for a description after both image save paths", () => {
    const page = readFileSync("src/pages/CanvasLabPage.tsx", "utf8");
    expect(page.match(/requestImageDescription\(saved\.id\);/g)).toHaveLength(2);
    expect(page).toMatch(/void describeImage\(\{ data: \{ node_id: nodeId \} \}\)\.catch\(\(\) => undefined\)/);
  });
  it("the describe request checks the caller can see the card before the server-only writer runs", () => {
    const fns = readFileSync("src/lib/canvas-lab.functions.ts", "utf8");
    const body = fns.slice(fns.indexOf("export const describeBoardImageFn"));
    expect(body.indexOf('.from("workboard_nodes")')).toBeGreaterThan(-1);
    expect(body.indexOf('.from("workboard_nodes")')).toBeLessThan(body.indexOf("describeBoardImage(data.node_id)"));
    expect(body).toMatch(/requireSupabaseAuth/);
  });
});

describe("IMG-4 no ghosts", () => {
  it("an image file is removed only after its card is really archived", () => {
    const page = readFileSync("src/pages/CanvasLabPage.tsx", "utf8");
    expect(page).toMatch(/const archived = node\.durableId \? archiveDurable\(/);
    expect(page).toMatch(/void archived\.then\(\(version\) => \{\s*if \(!node\.durableId \|\| version !== null\) void removeBoardImageObject\(path\);/);
    expect(page).not.toMatch(/if \(node\.imagePath\) void removeBoardImageObject\(node\.imagePath\);/);
  });
  it("the migration keeps description writes out of versions and history, and clears on delete", () => {
    const sql = readFileSync("supabase/migrations/20261108140000_img4_describe_never_bumps_version_and_delete_clears.sql", "utf8");
    expect(sql).toMatch(/\(to_jsonb\(new\) - v_image_cols\) = \(to_jsonb\(old\) - v_image_cols\) then\s+return new;/);
    expect(sql).toMatch(/to_jsonb\(old\) - v_image_cols, 'after', to_jsonb\(new\) - v_image_cols/);
    expect(sql).toMatch(/old\.deleted_at is null and new\.deleted_at is not null then\s+new\.image_text := null;/);
  });
});
