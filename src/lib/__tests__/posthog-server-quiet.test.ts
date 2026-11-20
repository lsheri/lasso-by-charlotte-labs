// 20 Nov 2026 (Liam, Q-59): three things the server no longer sends to PostHog. A copy of an event made in local
// development; the harmless "aborted" message a closed page leaves behind; and any error from a local run. A real
// error is still sent, now labelled with where it happened.
import { readFileSync } from "node:fs";

import { afterEach, describe, expect, it, vi } from "vitest";

const where = vi.hoisted(() => ({ environment: "production" }));
vi.mock("@/lib/environment.server", () => ({ resolveEnvironment: () => where.environment, resolveHostClass: () => "none" }));
vi.mock("../environment.server", () => ({ resolveEnvironment: () => where.environment, resolveHostClass: () => "none" }));
vi.mock("@tanstack/react-start/server", () => ({ getRequestHeader: () => undefined }));

import { captureServerException, isHarmlessAbort } from "../server-exceptions.server";
import { aliasAnonymousVisitor, mirrorToPostHog } from "../telemetry.server";

function stubFetch() {
  const fetchMock = vi.fn().mockResolvedValue(new Response("ok"));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
const bodyOf = (call: unknown[]) => JSON.parse((call[1] as RequestInit).body as string);
const context = (environment: string) => ({ environment, workspace_type: "company", affiliated: false, partner: "none", account_stage: "demo" });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  where.environment = "production";
});

describe("the copy of an event", () => {
  it("is not sent from local development", async () => {
    const fetchMock = stubFetch();
    await mirrorToPostHog("proposal.created", "actor", "tenant", { client: "new" }, context("local"));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["production", "preview", "unknown"])("is still sent from %s, with its stage", async (environment) => {
    const fetchMock = stubFetch();
    await mirrorToPostHog("proposal.created", "actor", "tenant", { client: "new" }, context(environment));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(bodyOf(fetchMock.mock.calls[0]!).properties).toMatchObject({ environment, account_stage: "demo", client: "new" });
  });

  it("the sign-up join is not sent from local development either", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    where.environment = "local";
    const fetchMock = stubFetch();
    await expect(aliasAnonymousVisitor("visitor", "user")).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("the local check sits before anything is built or sent", () => {
    const source = readFileSync("src/lib/telemetry.server.ts", "utf8");
    const mirror = source.slice(source.indexOf("export async function mirrorToPostHog"));
    expect(mirror.indexOf('context?.environment === "local"')).toBeGreaterThan(0);
    expect(mirror.indexOf('context?.environment === "local"')).toBeLessThan(mirror.indexOf("fetch("));
  });
});

describe("server errors", () => {
  const named = (name: string, message: string) => Object.assign(new Error(message), { name });

  it.each([
    new Error("This operation was aborted"),
    new Error("The operation was aborted."),
    new Error("aborted"),
    new Error("  Aborted  "),
    named("AbortError", "anything at all"),
    "aborted",
  ])("a closed page is not an error: %s", async (error) => {
    const fetchMock = stubFetch();
    expect(isHarmlessAbort(error)).toBe(true);
    await captureServerException(error, "ssr_catch", "production");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    new Error("the upload was aborted by the storage host after 3 tries"),
    new Error("boom"),
    named("TimeoutError", "The operation was aborted due to timeout"),
    new TypeError("Cannot read properties of undefined"),
    "something else",
    null,
    { message: "aborted" },
  ])("a real failure is still sent: %s", async (error) => {
    const fetchMock = stubFetch();
    expect(isHarmlessAbort(error)).toBe(false);
    await captureServerException(error, "ssr_swallowed", "production");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(bodyOf(fetchMock.mock.calls[0]!).properties).toMatchObject({ environment: "production", where: "ssr_swallowed", $exception_source: "server" });
  });

  it("nothing is sent from local development, whether the caller says so or the request does", async () => {
    const fetchMock = stubFetch();
    await captureServerException(new Error("boom"), "ssr_catch", "local");
    where.environment = "local";
    await captureServerException(new Error("boom"), "ssr_catch");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("the caller's environment wins over a request that can no longer be read", async () => {
    where.environment = "unknown";
    const fetchMock = stubFetch();
    await captureServerException(new Error("boom"), "ssr_catch", "preview");
    expect(bodyOf(fetchMock.mock.calls[0]!).properties.environment).toBe("preview");
  });

  it("the server entry reads the environment from the request before the response goes", () => {
    const entry = readFileSync("src/server.ts", "utf8");
    expect(entry).toContain('environmentFromHost(request.headers.get("x-forwarded-host") ?? request.headers.get("host"))');
    expect(entry).toContain("captureServerException(error, where, environment)");
    expect(entry.match(/reportServerException\([a-z]+, "ssr_[a-z]+", request\)/g)).toHaveLength(2);
  });
});
