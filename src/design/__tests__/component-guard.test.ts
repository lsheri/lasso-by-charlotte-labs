// 18 Nov 2026, design component guard: the three new counts catch a raw select, a hand-built mono pill and a Lucide
// import in feature code, and leave the primitives in src/components/ui alone. See docs/design/components.md.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

import { measure } from "../design-health";

const root = mkdtempSync(path.join(tmpdir(), "guard-"));
const write = (rel: string, text: string) => {
  const file = path.join(root, rel);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, text);
};

write("src/components/ui/native-select.tsx", `export const S = () => <select className="rounded-full font-mono uppercase" />;`);
write(
  "src/components/feature/Picker.tsx",
  [
    `import { X } from "lucide-react";`,
    `export const P = () => <select aria-label="Size"><option>a</option></select>;`,
    `export const Pill = () => <span className="rounded-full px-2 font-mono text-(length:--type-label) uppercase">tag</span>;`,
    `export const Round = () => <span className="rounded-full bg-muted">not a mono pill</span>;`,
  ].join("\n"),
);
write("src/components/feature/Clean.tsx", `import { cn } from "@/lib/utils";\nexport const C = () => <span className={cn("x")} />;`);

afterAll(() => rmSync(root, { recursive: true, force: true }));

describe("component guard counts", () => {
  const counts = measure(path.join(root, "src"));

  it("counts a raw select in feature code, not in the primitive", () => {
    expect(counts.nativeSelect).toBe(1);
  });

  it("counts a hand-built mono pill, not a plain rounded element or the primitive", () => {
    expect(counts.handPills).toBe(1);
  });

  it("counts each file that imports Lucide once", () => {
    expect(counts.lucideFiles).toBe(1);
  });
});
