import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { displayName, nameMatches } from "@/lib/work-item-name";

describe("AL-1 displayName", () => {
  it("prefers the chosen name", () => {
    expect(displayName({ display_title: "Alias", title: "Original" })).toBe("Alias");
  });

  it("falls back to the original when the chosen name is null", () => {
    expect(displayName({ display_title: null, title: "Original" })).toBe("Original");
  });

  it("treats whitespace as no name", () => {
    expect(displayName({ display_title: "   ", title: "Original" })).toBe("Original");
  });
});

describe("AL-1 nameMatches", () => {
  const item = { display_title: "Alias", title: "Original" };

  it("matches the chosen name and the original, either spelling", () => {
    expect(nameMatches(item, "ali")).toBe(true);
    expect(nameMatches(item, "ORIG")).toBe(true);
  });

  it("rejects a term in neither name", () => {
    expect(nameMatches(item, "zzz")).toBe(false);
  });

  it("matches everything on an empty term", () => {
    expect(nameMatches(item, "   ")).toBe(true);
  });
});

describe("AL-1 the Add work dialog shows the chosen name", () => {
  it("no longer reads item.title for the row label", () => {
    const source = readFileSync(
      new URL("../../components/canvas-lab/AddWorkPanel.tsx", import.meta.url),
      "utf8",
    );
    expect(source).not.toContain('{item.title ?? "Untitled"}');
  });
});

describe("ALIAS-2 the All AI chats reader shows the chosen name", () => {
  it("names the selected chat through displayName", () => {
    const source = readFileSync(new URL("../../pages/AiRecordPage.tsx", import.meta.url), "utf8");
    expect(source).toContain("displayName(selected)");
    expect(source).not.toContain("{selected.title}");
  });
});
