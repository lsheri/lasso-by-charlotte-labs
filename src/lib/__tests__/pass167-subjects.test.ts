import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { entityKey, splitEntities } from "../entity-key";
import {
  CHAIN_METHODS,
  matchableSubjects,
  sortSubjects,
  type Subject,
} from "../subjects-shared";

const subject = (over: Partial<Subject>): Subject => ({
  entity_key: "charlotte",
  entity_raw: "Charlotte",
  source: "extract",
  merged_into: null,
  ...over,
});

describe("the normalisation rule", () => {
  it("trims, collapses and lowercases, and nothing else", () => {
    expect(entityKey("  Charlotte   Labs  ")).toBe("charlotte labs");
    expect(entityKey("“Acme, Inc.”")).toBe("acme, inc");
    expect(entityKey("(Beta)")).toBe("beta");
    expect(entityKey("")).toBe("");
    expect(entityKey("   ")).toBe("");
    expect(entityKey("A\n B")).toBe("a b");
  });

  it("keeps two similar names apart", () => {
    expect(entityKey("charlotte")).not.toBe(entityKey("charlotte labs"));
  });

  it("splits the comma separated extract without duplicates", () => {
    expect(splitEntities("Charlotte, charlotte , Acme Inc.")).toEqual(["Charlotte", "Acme Inc"]);
    expect(splitEntities(null)).toEqual([]);
  });
});

describe("what a person settled", () => {
  it("excludes set aside subjects from matching, forever", () => {
    const rows = [subject({}), subject({ entity_key: "acme", source: "rejected" })];
    expect(matchableSubjects(rows).map((s) => s.entity_key)).toEqual(["charlotte"]);
  });

  it("excludes a folded subject and leaves the target alone", () => {
    const folded = subject({ entity_key: "cl", merged_into: "charlotte" });
    const target = subject({});
    const rows = matchableSubjects([folded, target]);
    expect(rows).toEqual([target]);
    expect(target.merged_into).toBeNull();
    expect(target.source).toBe("extract");
  });

  it("is reversible by clearing the fold", () => {
    const folded = subject({ entity_key: "cl", merged_into: "charlotte" });
    const undone = { ...folded, merged_into: null };
    expect(matchableSubjects([undone])).toHaveLength(1);
  });

  it("shows subjects alphabetically, never ranked", () => {
    const rows = [subject({ entity_key: "zeta" }), subject({ entity_key: "alpha" })];
    expect(sortSubjects(rows).map((s) => s.entity_key)).toEqual(["alpha", "zeta"]);
  });
});

describe("chain links are facts", () => {
  const chain = readFileSync("src/lib/chain-links.server.ts", "utf8");

  it("only knows three ways of knowing", () => {
    expect([...CHAIN_METHODS]).toEqual(["same_conversation", "explicit_reference", "user_linked"]);
  });

  it("never reads prose, titles or timing", () => {
    for (const forbidden of ["handoff", "title", "summary", "captured_at", "similar"]) {
      expect(chain.toLowerCase()).not.toContain(`.${forbidden}`);
    }
    expect(chain).not.toContain("work_item_extracts");
  });

  it("writes nothing twice", () => {
    expect(chain).toContain("seen.has");
  });
});

describe("the curated event", () => {
  const fns = readFileSync("src/lib/subjects.functions.ts", "utf8");

  it("carries an action and a boolean only", () => {
    expect(fns).toContain('eventType: "entity.curated"');
    expect(fns).toContain("dims: { action: data.action, had_merge_target:");
    expect(fns).not.toContain("entity_raw: data");
  });

  it("never sends a subject name or a count in dims", () => {
    const dims = fns.slice(fns.indexOf("dims: { action:"), fns.indexOf("dims: { action:") + 120);
    expect(dims).not.toContain("entity_key");
    expect(dims).not.toContain("count");
  });

  it("populates through the unique index, so a repeat adds nothing", () => {
    expect(fns).toContain('onConflict: "work_item_id,entity_key", ignoreDuplicates: true');
  });
});

describe("language", () => {
  const panel = readFileSync("src/components/work/SubjectsPanel.tsx", "utf8");
  it("stays inside the laws and says subjects", () => {
    for (const banned of ["monitor", "track", "score", "coverage", "gaps", "activity", "—"]) {
      expect(panel.toLowerCase()).not.toContain(banned);
    }
    expect(panel).toContain("Nothing has been linked to this yet");
    expect(panel).toContain("Subjects in your work");
  });
});
