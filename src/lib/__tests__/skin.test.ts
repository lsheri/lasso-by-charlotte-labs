// @vitest-environment jsdom
// Phase 3 PR1: the skin switch is off by default, and only allowed accounts can turn Charlotte on.
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";

import {
  canUseCharlotte,
  parseSkin,
  readSkinCookie,
  resolveSkin,
  skinFromBrandParam,
  writeSkinCookie,
} from "@/lib/skin";

afterEach(() => {
  document.cookie = "skin=; Path=/; Max-Age=0";
});

describe("skin switch", () => {
  it("defaults to Lasso for a missing or unknown value", () => {
    expect(parseSkin(undefined)).toBe("lasso");
    expect(parseSkin("")).toBe("lasso");
    expect(parseSkin("CHARLOTTE")).toBe("lasso");
    expect(parseSkin("charlotte")).toBe("charlotte");
  });

  it("reads ?brand=charlotte and ?brand=lasso, and ignores anything else", () => {
    expect(skinFromBrandParam("?brand=charlotte")).toBe("charlotte");
    expect(skinFromBrandParam("?x=1&brand=lasso")).toBe("lasso");
    expect(skinFromBrandParam("?brand=other")).toBeNull();
    expect(skinFromBrandParam("")).toBeNull();
  });

  it("lets only QA accounts and the Charlotte Labs team use Charlotte", () => {
    expect(canUseCharlotte("someone@qaprobe.test")).toBe(true);
    expect(canUseCharlotte("Someone@Charlotte-Labs.com")).toBe(true);
    expect(canUseCharlotte("someone@gmail.com")).toBe(false);
    expect(canUseCharlotte("qaprobe.test@gmail.com")).toBe(false);
    expect(canUseCharlotte("someone@charlotte-labs.com.evil.test")).toBe(false);
    expect(canUseCharlotte(null)).toBe(false);
    expect(canUseCharlotte(undefined)).toBe(false);
  });

  it("turns Charlotte on only for an allowed account that asks for it", () => {
    const qa = "a@qaprobe.test";
    expect(resolveSkin({ current: "lasso", requested: "charlotte", email: qa })).toBe("charlotte");
    expect(resolveSkin({ current: "lasso", requested: "charlotte", email: "a@gmail.com" })).toBe(
      "lasso",
    );
    expect(resolveSkin({ current: "lasso", requested: "charlotte", email: null })).toBe("lasso");
    expect(resolveSkin({ current: "lasso", requested: null, email: qa })).toBe("lasso");
  });

  it("keeps Charlotte for an allowed account, and drops it for anyone else or on ?brand=lasso", () => {
    expect(resolveSkin({ current: "charlotte", requested: null, email: "a@qaprobe.test" })).toBe(
      "charlotte",
    );
    expect(resolveSkin({ current: "charlotte", requested: null, email: "a@gmail.com" })).toBe(
      "lasso",
    );
    expect(resolveSkin({ current: "charlotte", requested: null, email: null })).toBe("lasso");
    expect(resolveSkin({ current: "charlotte", requested: "lasso", email: "a@qaprobe.test" })).toBe(
      "lasso",
    );
  });

  it("writes the cookie for Charlotte and clears it for Lasso", () => {
    writeSkinCookie("charlotte");
    expect(readSkinCookie()).toBe("charlotte");
    writeSkinCookie("lasso");
    expect(readSkinCookie()).toBe("lasso");
    expect(document.cookie).not.toContain("skin=charlotte");
  });

  it("puts no data-skin on <html> for Lasso, so the default page is unchanged", () => {
    const root = readFileSync("src/routes/__root.tsx", "utf8");
    expect(root).toContain('data-skin={skin === "lasso" ? undefined : skin}');
    expect(root).toContain("<SkinProvider initial={skin}>");
  });
});
