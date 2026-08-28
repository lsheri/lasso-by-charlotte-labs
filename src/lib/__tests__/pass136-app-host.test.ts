import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  CANONICAL_HOST,
  CANONICAL_ORIGIN,
  PRODUCTION_HOSTS,
  REDIRECT_TO_CANONICAL,
  isProductionHost,
  maybeRedirectToCanonical,
} from "../app-host";

describe("the host module", () => {
  it("pins the canonical host and both production hosts", () => {
    expect(CANONICAL_HOST).toBe("lasso.charlotte-labs.com");
    expect(CANONICAL_ORIGIN).toBe("https://lasso.charlotte-labs.com");
    expect([...PRODUCTION_HOSTS]).toEqual([
      "lasso.charlotte-labs.com",
      "pilot-platform.charlotte-labs.dev",
    ]);
  });

  it("accepts both hosts during the transition", () => {
    expect(isProductionHost("lasso.charlotte-labs.com")).toBe(true);
    expect(isProductionHost("pilot-platform.charlotte-labs.dev")).toBe(true);
    expect(isProductionHost("LASSO.Charlotte-Labs.com")).toBe(true);
  });

  it("matches exactly, never by substring or suffix", () => {
    for (const bad of [
      "evil-pilot-platform.charlotte-labs.dev.attacker.com",
      "lasso.charlotte-labs.com.attacker.com",
      "attacker.com/lasso.charlotte-labs.com",
      "sub.lasso.charlotte-labs.com",
      "charlotte-labs.com",
      "localhost",
      "",
      null,
      undefined,
      123,
    ]) {
      expect(isProductionHost(bad as unknown)).toBe(false);
    }
  });

  it("ships the transition redirect disabled", () => {
    expect(REDIRECT_TO_CANONICAL).toBe(false);
  });
});

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

describe("no hostname is hardcoded anywhere else", () => {
  it("keeps the old host literal out of src", () => {
    const offenders = walk("src").filter((file) => {
      if (file.includes("__tests__")) return false;
      if (file.endsWith("app-host.ts")) return false;
      return readFileSync(file, "utf8").includes("pilot-platform");
    });
    expect(offenders).toEqual([]);
  });

  it("routes the analytics production gate through isProductionHost", () => {
    const source = readFileSync("src/lib/posthog-client.ts", "utf8");
    expect(source).toContain("isProductionHost(window.location.hostname)");
    expect(source).not.toContain("charlotte-labs");
  });

  it("states the canonical host on the MCP contract surface", () => {
    const source = readFileSync("src/lib/mcp-handler.server.ts", "utf8");
    expect(source).toContain("const SITE_URL = CANONICAL_ORIGIN;");
  });

  it("uses the canonical host in static meta", () => {
    const root = readFileSync("src/routes/__root.tsx", "utf8");
    expect(root).toContain("${CANONICAL_ORIGIN}/og-image.png");
    expect(root).not.toContain("pilot-platform");
  });
});
