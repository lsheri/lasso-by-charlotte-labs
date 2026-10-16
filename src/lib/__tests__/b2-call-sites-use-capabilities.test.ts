import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// B2: call sites moved onto workspace-capabilities must not reintroduce literal type checks.
const FILES = [
  "src/components/layout/OrgSwitcher.tsx",
  "src/components/layout/SidebarNav.tsx",
  "src/hooks/use-partner-shared-boards.ts",
  "src/lib/partner-guard.ts",
  "src/lib/firm-view.server.ts",
  "src/components/invites/InviteDialog.tsx",
  "src/lib/org-segments.ts",
  "src/lib/coach-note-scope.ts",
];

describe("B2 call sites use capability predicates", () => {
  for (const file of FILES) {
    it(`${file} has no literal business or partner type comparison`, () => {
      const src = readFileSync(resolve(process.cwd(), file), "utf8");
      expect(src).not.toContain('org_type === "company" || ');
      expect(src).not.toContain('=== "partner"');
      expect(src).toContain("@/lib/workspace-capabilities");
    });
  }
});
