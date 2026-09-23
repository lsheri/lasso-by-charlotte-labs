import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { coerceJsonArg, coercePushArgs } from "../mcp-args";
import { placementLine, suggestionCaution, mcpVocabFor, type McpPlace } from "../mcp-vocab";

describe("coerceJsonArg", () => {
  it("parses a JSON array string", () => expect(coerceJsonArg('[{"a":1}]')).toEqual([{ a: 1 }]));
  it("parses a JSON object string", () => expect(coerceJsonArg('{"from":1,"total":3}')).toEqual({ from: 1, total: 3 }));
  it("leaves a non-JSON string unchanged", () => {
    expect(coerceJsonArg("hello")).toBe("hello");
    expect(coerceJsonArg("[broken")).toBe("[broken");
  });
  it("leaves non-strings unchanged", () => {
    const arr = [1];
    expect(coerceJsonArg(arr)).toBe(arr);
    expect(coerceJsonArg(7)).toBe(7);
    expect(coerceJsonArg(undefined)).toBeUndefined();
  });
  it("coerces nested covers and file_ref", () => {
    const out = coercePushArgs({
      messages: [{ role: "user", content: "x", covers: '{"from":1,"to":2}' }],
      attachments: '[{"kind":"file_ref","file_ref":"{\\"filename\\":\\"a.pptx\\"}"}]',
    });
    expect((out["messages"] as { covers: unknown }[])[0]!.covers).toEqual({ from: 1, to: 2 });
    expect((out["attachments"] as { file_ref: unknown }[])[0]!.file_ref).toEqual({ filename: "a.pptx" });
  });
});

describe("shrink guard keeps placement", () => {
  it("the kept_stored branch joins attachmentIds", () => {
    const src = readFileSync("src/lib/mcp-handler.server.ts", "utf8");
    const i = src.indexOf('outcome: "kept_stored"');
    const branch = src.slice(i, src.indexOf("continue;", i));
    expect(branch).toContain("attachmentIds.push(match.id);");
  });
});

describe("suggestionCaution", () => {
  const place: McpPlace = { ref: "AC-1 · Research", containerName: "Acme", code: "AC-1", boardTitle: "Acme diligence", workstreamName: "Research" };
  it("cautions when precedent picked a place the project name does not match", () => {
    expect(
      suggestionCaution({ places: [place], conversationRef: place.ref, projectName: "Globex pitch" }, { ref: place.ref, reason: "" }),
    ).toBe(true);
  });
  it("does not caution on a name match", () => {
    expect(
      suggestionCaution({ places: [place], projectRef: place.ref, projectName: "Acme" }, { ref: place.ref, reason: "" }),
    ).toBe(false);
  });
  it("placementLine adds the inbox default only for shared workspaces", () => {
    const shared = placementLine({ ...mcpVocabFor("company" as never), shared: true });
    const solo = placementLine({ ...mcpVocabFor("company" as never), shared: false });
    expect(shared).toContain("default to the inbox");
    expect(solo).not.toContain("default to the inbox");
  });
});
