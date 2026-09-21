import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { EVENT_DIM_KEYS } from "../event-dim-allowlist";
import { ENVIRONMENTS, environmentFromHost } from "../environment-shared";
import { WORKBOARD_EVENT_DIMS } from "../workboard-event-allowlist";

const HOSTS = [
  "lasso.charlotte-labs.com",
  "LASSO.Charlotte-Labs.com",
  "lasso.charlotte-labs.com.attacker.example",
  "lasso.charlotte-labs.com:443",
  "project--x.lovable.app",
  "notlovable.app",
  "lovable.app",
  "localhost",
  "localhost:8080",
  "127.0.0.1",
  "127.0.0.1:5173",
  "",
  "   ",
  "%%%",
  null,
  undefined,
];

describe("the environment resolver", () => {
  it("only ever returns a value the constant allows", () => {
    for (const host of HOSTS) {
      expect(ENVIRONMENTS).toContain(environmentFromHost(host));
    }
  });

  it("recognises the exact production host and nothing built on top of it", () => {
    expect(environmentFromHost("lasso.charlotte-labs.com")).toBe(
      environmentFromHost("LASSO.Charlotte-Labs.com"),
    );
    expect(environmentFromHost("lasso.charlotte-labs.com:443")).toBe(
      environmentFromHost("lasso.charlotte-labs.com"),
    );
    expect(environmentFromHost("lasso.charlotte-labs.com.attacker.example")).not.toBe(
      environmentFromHost("lasso.charlotte-labs.com"),
    );
  });

  it("recognises a preview host only on a dot boundary", () => {
    const preview = environmentFromHost("project--x.lovable.app");
    expect(environmentFromHost("lovable.app")).toBe(preview);
    expect(environmentFromHost("notlovable.app")).not.toBe(preview);
    expect(preview).not.toBe(environmentFromHost("lasso.charlotte-labs.com"));
  });

  it("recognises the machine it is built on, with or without a port", () => {
    const local = environmentFromHost("localhost");
    expect(environmentFromHost("localhost:8080")).toBe(local);
    expect(environmentFromHost("127.0.0.1")).toBe(local);
    expect(environmentFromHost("127.0.0.1:5173")).toBe(local);
    expect(local).not.toBe(environmentFromHost("project--x.lovable.app"));
  });

  it("falls back when it has nothing it recognises", () => {
    const fallback = environmentFromHost(null);
    for (const host of [undefined, "", "   ", "%%%", "notlovable.app"]) {
      expect(environmentFromHost(host)).toBe(fallback);
    }
    for (const known of ["lasso.charlotte-labs.com", "x.lovable.app", "localhost"]) {
      expect(environmentFromHost(known)).not.toBe(fallback);
    }
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

describe("nothing outside the server supplies it", () => {
  it("keeps it out of both dim allowlists", () => {
    for (const keys of Object.values(EVENT_DIM_KEYS)) {
      expect(keys).not.toContain("environment");
    }
    for (const keys of Object.values(WORKBOARD_EVENT_DIMS)) {
      expect(keys).not.toContain("environment");
    }
  });

  it("keeps it out of every screen", () => {
    const offenders = [...walk("src/components"), ...walk("src/pages")].filter((file) =>
      /environment\s*[:=]/.test(readFileSync(file, "utf8")),
    );
    expect(offenders).toEqual([]);
  });
});

describe("the landing page keeps its own type", () => {
  it("shares no type class with the app", () => {
    const source = readFileSync("src/components/marketing/B2BLanding.tsx", "utf8");
    expect(source).not.toContain("nb-type-small");
  });
});
