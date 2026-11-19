// 18 Nov 2026: the PostHog copy carries the events row's id as its uuid and retries once when the first try cannot
// land (no answer, a timeout, a 429 or a 5xx). A burst of Ask the firm calls had lost about one copy in ten to a single
// 3s try; PostHog keeps one event per uuid, so the retry can never count twice. The copy never throws.
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/environment.server", () => ({ resolveEnvironment: () => "preview" }));
vi.mock("../environment.server", () => ({ resolveEnvironment: () => "preview" }));

import { MIRROR_ATTEMPTS, mirrorToPostHog } from "../telemetry.server";

const context = { environment: "production", workspace_type: "company", affiliated: false, partner: "none", uuid: "6f1c2a8e-2b1d-4c1e-9a3b-0c9d8e7f6a5b" };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function stub(...answers: (Response | Error)[]) {
  const fetchMock = vi.fn();
  for (const answer of answers) {
    if (answer instanceof Error) fetchMock.mockRejectedValueOnce(answer);
    else fetchMock.mockResolvedValueOnce(answer);
  }
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => {});
  return fetchMock;
}

const bodyOf = (call: unknown[]) => JSON.parse((call[1] as RequestInit).body as string);

describe("PostHog copy", () => {
  it("sends the events row's id as PostHog's uuid, once when it lands", async () => {
    const fetchMock = stub(new Response("ok"));
    await mirrorToPostHog("ai.usage", "actor", "tenant", { surface: "firm_ask_answer" }, context);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(bodyOf(fetchMock.mock.calls[0]!).uuid).toBe(context.uuid);
  });

  it("never copies a question's topic to PostHog, and still copies the other dims", async () => {
    const fetchMock = stub(new Response("ok"));
    await mirrorToPostHog("firm_ask.asked", "actor", "tenant", { result: "answered", starter: "none", topic: "pricing" } as never, context);
    const properties = bodyOf(fetchMock.mock.calls[0]!).properties;
    expect(properties.topic).toBeUndefined();
    expect(JSON.stringify(properties)).not.toContain("pricing");
    expect(properties.result).toBe("answered");
    expect(properties.starter).toBe("none");
  });

  it("retries once, with the same body, after a timeout", async () => {
    const fetchMock = stub(new DOMException("The operation timed out.", "TimeoutError"), new Response("ok"));
    await mirrorToPostHog("ai.usage", "actor", "tenant", { surface: "firm_ask_answer" }, context);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(bodyOf(fetchMock.mock.calls[1]!)).toEqual(bodyOf(fetchMock.mock.calls[0]!));
  });

  it("retries once after a 5xx or a 429", async () => {
    for (const status of [500, 503, 429]) {
      const fetchMock = stub(new Response("busy", { status }), new Response("ok"));
      await mirrorToPostHog("ai.usage", "actor", "tenant", {}, context);
      expect(fetchMock, String(status)).toHaveBeenCalledTimes(2);
    }
  });

  it("does not retry a 4xx it cannot fix, and says so", async () => {
    const fetchMock = stub(new Response("bad key", { status: 401 }));
    await mirrorToPostHog("ai.usage", "actor", "tenant", {}, context);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("mirror failed for ai.usage: 401"));
  });

  it("gives up after the retry without throwing, and says so", async () => {
    const fetchMock = stub(new Error("network down"), new Error("network down"));
    await expect(mirrorToPostHog("ai.usage", "actor", "tenant", {}, context)).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(MIRROR_ATTEMPTS.length);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("mirror threw for ai.usage"), "network down");
  });

  it("sends no uuid when the caller has none, as the anonymous path does", async () => {
    const fetchMock = stub(new Response("ok"));
    const { uuid: _uuid, ...withoutUuid } = context;
    await mirrorToPostHog("landing.viewed" as never, "actor", "tenant", {}, withoutUuid);
    expect(bodyOf(fetchMock.mock.calls[0]!)).not.toHaveProperty("uuid");
  });
});
