import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/environment.server", () => ({ resolveEnvironment: () => "preview" }));
vi.mock("../environment.server", () => ({ resolveEnvironment: () => "preview" }));

import { captureServerException } from "../server-exceptions.server";

function sampleError(): Error {
  const e = new TypeError(
    "boom for jane.doe@example.com on 123e4567-e89b-12d3-a456-426614174000 ref 1234567890",
  );
  e.stack = [
    "TypeError: boom",
    "    at innerFn (/app/src/lib/newest.ts:10:5)",
    "    at middleFn (/app/node_modules/h3/dist/index.mjs:20:7)",
    "    at /app/src/server.ts:30:9",
  ].join("\n");
  return e;
}

async function capture(error: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(new Response("ok"));
  vi.stubGlobal("fetch", fetchMock);
  await captureServerException(error, "ssr_catch");
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  return { url, raw: init.body as string, body: JSON.parse(init.body as string) };
}

afterEach(() => vi.unstubAllGlobals());

describe("PH-S3a server exceptions", () => {
  it("sends the $exception payload shape", async () => {
    const { url, body } = await capture(sampleError());
    expect(url).toBe("https://us.i.posthog.com/i/v0/e/");
    expect(body.event).toBe("$exception");
    expect(body.distinct_id).toBe("lasso-server");
    expect(typeof body.api_key).toBe("string");
    const p = body.properties;
    expect(p.$process_person_profile).toBe(false);
    expect(p.$exception_source).toBe("server");
    expect(p.where).toBe("ssr_catch");
    expect(p.environment).toBe("preview");
    const ex = p.$exception_list[0];
    expect(ex.type).toBe("TypeError");
    expect(ex.mechanism).toEqual({ handled: false, synthetic: false });
    expect(ex.stacktrace.type).toBe("raw");
  });

  it("redacts email, uuid and long numbers", async () => {
    const { body } = await capture(sampleError());
    const value: string = body.properties.$exception_list[0].value;
    expect(value).toBe("boom for [email] on [id] ref [n]");
  });

  it("caps the message at 300 characters", async () => {
    const { body } = await capture(new Error("x".repeat(1000)));
    expect(body.properties.$exception_list[0].value).toHaveLength(300);
  });

  it("parses frames oldest first with in_app", async () => {
    const { body } = await capture(sampleError());
    const frames = body.properties.$exception_list[0].stacktrace.frames;
    expect(frames).toHaveLength(3);
    expect(frames[0]).toEqual({
      platform: "node:javascript",
      filename: "/app/src/server.ts",
      function: "?",
      lineno: 30,
      colno: 9,
      in_app: true,
    });
    expect(frames[1].in_app).toBe(false);
    expect(frames[2].function).toBe("innerFn");
  });

  it("caps frames at 50", async () => {
    const e = new Error("many");
    e.stack = ["Error: many", ...Array.from({ length: 80 }, (_, i) => `    at f${i} (/a.ts:${i + 1}:1)`)].join("\n");
    const { body } = await capture(e);
    expect(body.properties.$exception_list[0].stacktrace.frames).toHaveLength(50);
  });

  it("carries no url, path or header keys", async () => {
    const { raw } = await capture(sampleError());
    for (const key of ['"url"', '"path"', '"headers"', '"$current_url"', '"$pathname"', '"$ip"', '"user_id"']) {
      expect(raw).not.toContain(key);
    }
  });

  it("does not throw when fetch rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    await expect(captureServerException(new Error("x"), "ssr_swallowed")).resolves.toBeUndefined();
  });
});

describe("PH-S3b source maps", () => {
  it("vite.config.ts keeps sourcemap: true", () => {
    const src = readFileSync(resolve(__dirname, "../../../vite.config.ts"), "utf8");
    expect(src).toContain("sourcemap: true");
  });
});
