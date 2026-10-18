import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start/server", () => ({
  getRequestHeader: () => undefined,
}));

import { deviceTypeFromUserAgent } from "../telemetry.server";

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const ANDROID_PHONE =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";
const ANDROID_TABLET =
  "Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const IPAD_SAFARI =
  "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const MACOS_CHROME =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const WINDOWS_CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const NODE_FETCH = "node-fetch/1.0 (+https://github.com/bitinn/node-fetch)";

describe("DEV-1: $device_type derivation matches PostHog's vocabulary", () => {
  it("iPhone Safari is Mobile", () => {
    expect(deviceTypeFromUserAgent(IPHONE_SAFARI)).toBe("Mobile");
  });

  it("an Android phone carrying both Android and Mobile is Mobile", () => {
    expect(deviceTypeFromUserAgent(ANDROID_PHONE)).toBe("Mobile");
  });

  it("an Android tablet carrying Android without Mobile is Tablet", () => {
    expect(deviceTypeFromUserAgent(ANDROID_TABLET)).toBe("Tablet");
  });

  it("iPad is Tablet", () => {
    expect(deviceTypeFromUserAgent(IPAD_SAFARI)).toBe("Tablet");
  });

  it("macOS Chrome is Desktop", () => {
    expect(deviceTypeFromUserAgent(MACOS_CHROME)).toBe("Desktop");
  });

  it("Windows Chrome is Desktop", () => {
    expect(deviceTypeFromUserAgent(WINDOWS_CHROME)).toBe("Desktop");
  });

  it("a bare node-fetch user agent is Desktop", () => {
    expect(deviceTypeFromUserAgent(NODE_FETCH)).toBe("Desktop");
  });

  it("the function's whole range is exactly the three PostHog values", () => {
    const samples = [
      IPHONE_SAFARI,
      ANDROID_PHONE,
      ANDROID_TABLET,
      IPAD_SAFARI,
      MACOS_CHROME,
      WINDOWS_CHROME,
      NODE_FETCH,
    ];
    const seen = new Set(samples.map(deviceTypeFromUserAgent));
    expect([...seen].sort()).toEqual(["Desktop", "Mobile", "Tablet"]);
  });
});
