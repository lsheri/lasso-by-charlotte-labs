import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const FILES = [
  "src/lib/mcp-vocab.ts",
  "src/components/work/InboxFixedCard.tsx",
  "src/lib/sign-in-link.ts",
  "src/lib/motion-scenes.ts",
] as const;

// Exact identifier literals only. Prose must never be added here.
const IDENTIFIER_ALLOWLIST: Record<string, readonly string[]> = {
  "src/lib/mcp-vocab.ts": ["inbox"], // placementTarget data value
  "src/components/work/InboxFixedCard.tsx": [
    "inbox-fixed-card", // stable test selector
    "inbox-fixed-card relative min-w-0 w-full cursor-default select-text", // CSS class
  ],
};

describe("MN-4: readable copy uses All work and No board", () => {
  for (const file of FILES) {
    it(`${file} has no readable inbox literal`, () => {
      const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
      const found: string[] = [];
      function visit(node: ts.Node) {
        if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node) || ts.isJsxText(node)) {
          const text = node.text;
          if (/inbox/i.test(text) && !IDENTIFIER_ALLOWLIST[file]?.includes(text)) {
            const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
            found.push(`${file}:${line + 1}: ${text}`);
          }
        }
        ts.forEachChild(node, visit);
      }
      visit(source);
      expect(found).toEqual([]);
    });
  }

  it("pins the replacement text without changing placement data values", () => {
    expect(readFileSync(FILES[0], "utf8")).toContain("Leave it out to keep the item in All work with no board.");
    expect(readFileSync(FILES[0], "utf8")).toContain(': "inbox";');
    const pin = readFileSync(FILES[1], "utf8");
    expect(pin).toContain('aria-label="Fixed in All work"');
    expect(pin).toContain('title="Fixed in All work"');
    const signIn = readFileSync(FILES[2], "utf8");
    expect(signIn).toContain('sentTitle: "Check your email"');
    expect(signIn).toContain("We already sent one. Check your email, or ask again in a minute.");
    expect(readFileSync(FILES[3], "utf8")).toContain("src/pages/WorkPage.tsx, All work, behind the page");
  });
});