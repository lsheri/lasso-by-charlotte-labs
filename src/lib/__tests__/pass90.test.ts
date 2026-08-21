import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { MAX_CHECK_DRAFTS, parseCheckRules, titleFromFileName } from "@/lib/check-rules";
import { groupEngagementsByClient, type NavEngagement } from "@/lib/nav-groups";

const read = (path: string) => readFileSync(path, "utf8");

describe("90.1 chat history shelf", () => {
  const source = read("src/components/reflect/AskSurface.tsx");

  it("shows two chats by default", () => {
    expect(source).toContain("HISTORY_DEFAULT_SHOWN = 2");
    expect(source).toContain("sessions.slice(0, HISTORY_DEFAULT_SHOWN)");
  });

  it("reveals the rest behind an expandable row that is not the green primary", () => {
    expect(source).toContain("Show all ${sessions.length} chats");
    expect(source).toContain("Show fewer chats");
    expect(source).toContain('aria-expanded={expanded}');
  });

  it("keeps the new session button", () => {
    expect(source).toContain("New session");
  });
});

describe("90.2 analyses move into Ask", () => {
  const page = read("src/pages/EngagementPage.tsx");
  const surface = read("src/components/reflect/AskSurface.tsx");

  it("removes the analyse pill and its state from the engagement page", () => {
    expect(page).not.toContain("Analyse this engagement");
    expect(page).not.toContain("analyseOpen");
    expect(page).not.toContain("AnalysisLens");
  });

  // Pass 94 removed the embedded lens tab: analyses live in the selection
  // driven Analyses tab, and the itemCount thread went with it.
  it("keeps analyses inside the Ask surface, selection driven", () => {
    expect(surface).toContain("SelectionAnalysisChips");
    expect(surface).not.toContain("AnalysisLens");
  });
});

describe("90.3 header regroup", () => {
  const page = read("src/pages/EngagementPage.tsx");

  it("has a coaching section holding every coaching affordance", () => {
    expect(page).toContain(">Coaching<");
    expect(page).toContain("Share with a coach");
    expect(page).toContain("Prepare a 1:1");
    expect(page).toContain("Invite a coach");
    expect(page).toContain("#shared-with");
  });

  it("keeps the existing gates", () => {
    expect(page).toContain("INVITE_ADMIN_ONLY_LINE");
    expect(page).toContain("isQuickFolder");
    expect(page).toContain('profile.role === "admin"');
  });

  it("merges About into a details section with the edit dialog", () => {
    expect(page).toContain(">Details<");
    expect(page).toContain("EditEngagementDialog");
    expect(page).not.toContain("About this engagement");
    expect(page).not.toContain("aboutOpen");
  });
});

describe("90.4 check rules parsing", () => {
  it("splits markdown headings into one draft each", () => {
    const parsed = parseCheckRules("rules.md", "# One\nbody one\n## Two\nbody two\n### Three\nbody three");
    expect(parsed.drafts).toHaveLength(3);
    expect(parsed.drafts[0]).toEqual({ title: "One", body: "body one" });
    expect(parsed.drafts[2]?.title).toBe("Three");
    expect(parsed.truncated).toBe(false);
  });

  it("turns a heading free file into one draft named after the file", () => {
    const parsed = parseCheckRules("firm-rules.txt", "- always cite\n- show the brief");
    expect(parsed.drafts).toHaveLength(1);
    expect(parsed.drafts[0]?.title).toBe("firm-rules");
    expect(parsed.drafts[0]?.body).toContain("always cite");
  });

  it("caps drafts at twenty and says so", () => {
    const text = Array.from({ length: 25 }, (_, i) => `# H${i}\nbody ${i}`).join("\n");
    const parsed = parseCheckRules("many.md", text);
    expect(parsed.drafts).toHaveLength(MAX_CHECK_DRAFTS);
    expect(parsed.truncated).toBe(true);
    expect(parsed.total).toBe(25);
  });

  it("returns nothing for an empty file", () => {
    expect(parseCheckRules("empty.md", "   ").drafts).toHaveLength(0);
  });

  it("keeps preamble text above the first heading as the first draft", () => {
    const parsed = parseCheckRules("firm-rules.md", "always cite\n\n# One\nbody one");
    expect(parsed.drafts).toHaveLength(2);
    expect(parsed.drafts[0]).toEqual({ title: "firm-rules", body: "always cite" });
    expect(parsed.drafts[1]?.title).toBe("One");
    expect(parsed.total).toBe(2);
  });

  it("counts the preamble toward the cap", () => {
    const text = `intro\n${Array.from({ length: 25 }, (_, i) => `# H${i}\nbody ${i}`).join("\n")}`;
    const parsed = parseCheckRules("many.md", text);
    expect(parsed.drafts[0]?.title).toBe("many");
    expect(parsed.drafts).toHaveLength(MAX_CHECK_DRAFTS);
    expect(parsed.total).toBe(26);
    expect(parsed.truncated).toBe(true);
  });

  it("saving uploaded drafts refreshes the library lists", () => {
    const source = read("src/components/firm/ChecksLibrary.tsx");
    expect(source).toContain("useQueryClient");
    expect(source).toContain('invalidateQueries({ queryKey: ["firm-check-library"] })');
  });


  it("strips the extension for the fallback title", () => {
    expect(titleFromFileName("a/b/checks.markdown")).toBe("checks");
  });

  it("wires the upload affordance into the composer without storage", () => {
    const source = read("src/components/firm/ChecksLibrary.tsx");
    expect(source).toContain("Upload rules (.txt or .md)");
    expect(source).toContain('accept=".txt,.md,text/plain,text/markdown"');
    expect(source).toContain("file.text()");
    expect(source).toContain("UPLOAD_HONESTY_LINE");
    expect(read("src/lib/check-rules.ts")).toContain(
      "nothing is saved until you save each check",
    );
    expect(source).not.toContain("storage.from");
  });
});

describe("90.5 sidebar grouping", () => {
  const client = (id: string, name: string) => ({ id, name, quick_folder: false });
  const rows: NavEngagement[] = [
    { id: "e2", code: "SF-002", title: "Two", clients: client("c1", "Acme") },
    { id: "e1", code: "SF-001", title: "One", clients: client("c1", "Acme") },
    { id: "e3", code: "QF-001", title: "Quick", clients: { id: "q", name: "Quick", quick_folder: true } },
    { id: "e4", code: "SF-004", title: "Loose", clients: null },
    { id: "e5", code: "SF-005", title: "Label only", client_label: "Old Co" },
  ];

  it("groups by client id and sorts rows by code", () => {
    const { groups } = groupEngagementsByClient(rows);
    // Pass 93: real client shelves first, then Internal, then Unmapped.
    expect(groups).toHaveLength(3);
    expect(groups[0]?.name).toBe("Acme");
    expect(groups[0]?.engagements.map((e) => e.code)).toEqual(["SF-001", "SF-002"]);
    expect(groups.map((g) => g.name)).toEqual(["Acme", "Internal", "Unmapped"]);
  });

  it("shelves quick folders under Unmapped and collects the rest under Internal", () => {
    const { groups, flat } = groupEngagementsByClient(rows);
    expect(flat).toEqual([]);
    expect(groups[1]?.engagements.map((e) => e.id).sort()).toEqual(["e4", "e5"]);
    expect(groups[2]?.engagements.map((e) => e.id)).toEqual(["e3"]);
  });


  it("renders nested rows with an indented variant", () => {
    expect(read("src/components/layout/SidebarNav.tsx")).toContain("nb-nav-item-nested");
    expect(read("src/styles.css")).toContain(".nb-nav-item-nested");
  });
});
