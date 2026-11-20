// G7 (17 Nov 2026): the mono pill button lives in one place, src/components/ui/chip.ts, instead of 15 hand-written copies.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { chipVariants } from "@/components/ui/chip";
import { tagVariants } from "@/components/ui/tag";

function tsx(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory())
      return entry === "__tests__" || entry === "reference" ? [] : tsx(path);
    return path.endsWith(".tsx") ? [path] : [];
  });
}

describe("chip button", () => {
  it("keeps the shared shape, in plain sentence-case type (20 Nov: mono capitals are for numbers only)", () => {
    for (const tone of ["quiet", "accent"] as const) {
      const classes = chipVariants({ tone });
      for (const part of [
        "rounded-full",
        "font-sans",
        "text-(length:--type-small)",
        "font-medium",
        "border",
      ])
        expect(classes, tone).toContain(part);
      expect(classes, tone).not.toMatch(/font-mono|uppercase|tracking-/);
    }
  });

  it("is not written out by hand again", () => {
    const copies = tsx("src").filter((path) =>
      /rounded-full[^"`]*px-3 py-1 font-mono text-\(length:--type-label\) uppercase tracking-\[0\.08em\]/.test(
        readFileSync(path, "utf8"),
      ),
    );
    expect(copies).toEqual([]);
  });

  it("keeps the tag (the label pill, not a control) in one place too", () => {
    for (const tone of ["neutral", "accent", "muted", "outline"] as const)
      for (const part of [
        "rounded-full",
        "px-2",
        "py-0.5",
        "font-sans",
        "text-(length:--type-small)",
        "font-medium",
      ])
        expect(tagVariants({ tone }), tone).toContain(part);
    for (const tone of ["neutral", "accent", "muted", "outline"] as const)
      expect(tagVariants({ tone }), tone).not.toMatch(/font-mono|uppercase|tracking-/);
    const copies = tsx("src").filter((path) =>
      /rounded-full[^"`]*px-2 py-0\.5 font-mono text-\(length:--type-label\) uppercase tracking-\[0\.0[68]em\][^"`]*(bg-secondary|bg-accent-soft|bg-muted)/.test(
        readFileSync(path, "utf8"),
      ),
    );
    expect(copies).toEqual([]);
  });
});
