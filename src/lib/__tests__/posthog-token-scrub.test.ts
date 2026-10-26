// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BeforeSendFn, CaptureResult } from "posthog-js";

const sdk = vi.hoisted(() => ({ init: vi.fn() }));
vi.mock("posthog-js", () => ({ default: sdk }));
import { initPostHog, resetPostHogGuard, scrubShareTokens } from "../posthog-client";

beforeEach(() => { sdk.init.mockClear(); resetPostHogGuard(); });

describe("share token scrubbing", () => {
  it.each([
    ["/memo/live-secret", "/memo/:token"],
    ["https://lasso.charlotte-labs.com/shared-board/live-secret?view=paper", "https://lasso.charlotte-labs.com/shared-board/:token?view=paper"],
    ["/share/live-secret#comments", "/share/:token#comments"],
    ["https://example.com/?referrer=https://lasso.charlotte-labs.com/memo/live-secret#back=/shared-board/other-secret", "https://example.com/?referrer=https://lasso.charlotte-labs.com/memo/:token#back=/shared-board/:token"],
    ["https://example.com/work?view=paper#comments", "https://example.com/work?view=paper#comments"],
    ["https://example.com/?referrer=https%3A%2F%2Flasso.charlotte-labs.com%2Fmemo%2Flive-secret%3Fview%3Dpaper%23comments", "https://example.com/?referrer=https%3A%2F%2Flasso.charlotte-labs.com%2Fmemo%2F:token%3Fview%3Dpaper%23comments"],
  ])("scrubs %s while retaining the remaining URL", (input, expected) => {
    expect(scrubShareTokens(input)).toBe(expected);
  });

  it.each(["$autocapture", "$pageview"])("the installed init hook scrubs %s properties", (eventName) => {
    initPostHog();
    const call = sdk.init.mock.calls[0];
    if (!call) throw new Error("PostHog was not initialised");
    const config = call[1] as { before_send: BeforeSendFn; person_profiles: string; capture_pageview: boolean };
    const event: CaptureResult = {
      uuid: "test-event", event: eventName,
      properties: {
        $current_url: "https://example.com/memo/secret?view=paper",
        $pathname: "/shared-board/secret",
        $referrer: "https://example.com/share/secret#memo",
        $initial_referrer: "https://example.com/memo/secret",
        $initial_current_url: "https://example.com/shared-board/secret",
        custom: "back=/memo/secret", unchanged: "Delivery decisions", number: 3,
        nested: [{ href: "/memo/secret" }],
      },
      $set_once: { $initial_referrer: "https://example.com/memo/secret" },
    };
    const original = structuredClone(event);
    expect(config.before_send(event)).toEqual({
      ...event,
      properties: {
        $current_url: "https://example.com/memo/:token?view=paper",
        $pathname: "/shared-board/:token",
        $referrer: "https://example.com/share/:token#memo",
        $initial_referrer: "https://example.com/memo/:token",
        $initial_current_url: "https://example.com/shared-board/:token",
        custom: "back=/memo/:token", unchanged: "Delivery decisions", number: 3,
        nested: [{ href: "/memo/:token" }],
      },
      $set_once: { $initial_referrer: "https://example.com/memo/:token" },
    });
    expect(event).toEqual(original);
    expect(config.before_send(null)).toBeNull();
    expect(config.person_profiles).toBe("identified_only");
    expect(config.capture_pageview).toBe(false);
  });
});