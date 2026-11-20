// @vitest-environment jsdom
// @vitest-environment-options { "url": "http://localhost:3198/proposals" }
// 20 Nov 2026 (Liam, Q-59): local development never writes to the live PostHog project. In the browser every event
// PostHog's script makes passes through before_send last, and on this machine's own address that hook drops it.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BeforeSendFn, CaptureResult } from "posthog-js";

const sdk = vi.hoisted(() => ({ init: vi.fn() }));
vi.mock("posthog-js", () => ({ default: sdk }));
import { initPostHog, resetPostHogGuard } from "../posthog-client";

beforeEach(() => { sdk.init.mockClear(); resetPostHogGuard(); });

describe("the browser on a local address", () => {
  it.each(["$autocapture", "$rageclick", "$exception", "$identify", "$groupidentify", "$pageview", "$feature_flag_called", "$set", "anything.else"])("drops %s before it is sent", (event) => {
    initPostHog();
    const config = sdk.init.mock.calls[0]![1] as { before_send: BeforeSendFn; disable_session_recording: boolean };
    expect(config.before_send({ uuid: "t", event, properties: { $current_url: "http://localhost:3198/proposals" } } as CaptureResult)).toBeNull();
    expect(config.disable_session_recording).toBe(true);
  });
});
