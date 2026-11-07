import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ host: "" as string | undefined }));
vi.mock("@tanstack/react-start/server", () => ({ getRequestHeader: () => mocks.host }));

import { resolveV2Environment } from "../telemetry-v2.server";

/**
 * AUDIT-1b (7 Nov 2026), A2 F6: the v2 path stamped environment from the
 * email domain and defaulted to production, so all 50 preview questions this
 * week were "production" in events_v2 and in PostHog. It now reads the host
 * like the v1 path. The QA probe override stays.
 */
describe("AUDIT-1b: events_v2 environment comes from the host", () => {
  beforeEach(() => {
    delete process.env["LASSO_ENVIRONMENT"];
  });

  it("a preview host is preview, not production", () => {
    mocks.host = "id-preview--x.lovable.app";
    expect(resolveV2Environment("p@example.test", "Some Firm")).toBe("preview");
  });

  it("the production host is production", () => {
    mocks.host = "lasso.charlotte-labs.com";
    expect(resolveV2Environment("p@example.test", "Some Firm")).toBe("production");
  });

  it("no host is unknown, never production by default", () => {
    mocks.host = undefined;
    expect(resolveV2Environment(null, null)).toBe("unknown");
  });

  it("the QA probe still wins", () => {
    mocks.host = "lasso.charlotte-labs.com";
    expect(resolveV2Environment("probe@qaprobe.test", null)).toBe("qa");
    expect(resolveV2Environment("p@example.test", "QA Probe Firm")).toBe("qa");
  });

  it("a configured staging value still wins over the host", () => {
    process.env["LASSO_ENVIRONMENT"] = "staging";
    mocks.host = "lasso.charlotte-labs.com";
    expect(resolveV2Environment("p@example.test", null)).toBe("staging");
  });
});
