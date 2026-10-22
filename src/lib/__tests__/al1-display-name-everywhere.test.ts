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

describe("ALIAS-3 the brief lists show the chosen name", () => {
  it("reads briefs with the chosen name selected", () => {
    const source = readFileSync(new URL("../../hooks/use-briefs.ts", import.meta.url), "utf8");
    expect(source).toContain("display_title");
  });

  it("reads the files that came with the brief with the chosen name selected", () => {
    const source = readFileSync(
      new URL("../../hooks/use-brief-files.ts", import.meta.url),
      "utf8",
    );
    expect(source).toContain("display_title");
  });

  it("names no work item on the brief screen by its original title", () => {
    const source = readFileSync(
      new URL("../../components/engagements/EngagementBriefSection.tsx", import.meta.url),
      "utf8",
    );
    expect(source).not.toContain("{item.title}");
    expect(source).not.toContain("{brief.title}");
  });
});
