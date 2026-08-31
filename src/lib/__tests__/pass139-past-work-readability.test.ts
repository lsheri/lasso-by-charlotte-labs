/**
 * Pass 139: Past work page readability. The page leads with a real "Past work"
 * h1 and a matching tab title, every shipped card wears a deliverable-kind
 * glyph, and the metadata line is a tag plus filename plus client and code.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  DELIVERABLE_KINDS,
  deliverableGlyph,
  type DeliverableGlyph,
} from "@/lib/deliverable-kinds";
import { PAST_WORK_GROUP_LABEL, PAST_WORK_NAV_LABEL } from "@/lib/past-work-shared";

const root = resolve(__dirname, "../..");
const read = (rel: string) => readFileSync(resolve(root, rel), "utf8");

describe("pass 139: the page is named Past work", () => {
  const page = read("pages/ArchivePage.tsx");
  const route = read("routes/_authenticated/archive.tsx");

  it('leads with the FIRM micro-label and a "Past work" page-title h1', () => {
    expect(page).toContain(`{PAST_WORK_GROUP_LABEL}`);
    expect(page).toContain(`{PAST_WORK_NAV_LABEL}`);
    expect(page).toMatch(/<h1 className="page-title[^"]*">\{PAST_WORK_NAV_LABEL\}<\/h1>/);
    expect(PAST_WORK_GROUP_LABEL).toBe("Firm");
    expect(PAST_WORK_NAV_LABEL).toBe("Past work");
  });

  it('the old "The archive" heading is gone from the page', () => {
    expect(page).not.toContain("ARCHIVE_TITLE");
    expect(page).not.toContain("The archive");
  });

  it('the browser tab title is "Past work | Lasso"', () => {
    expect(route).toContain('{ title: "Past work | Lasso" }');
    expect(route).toContain('{ property: "og:title", content: "Past work | Lasso" }');
    expect(route).not.toContain("The archive");
  });
});

describe("pass 139: kind to glyph mapping", () => {
  it.each<[string, DeliverableGlyph]>([
    ["proposal", "document"],
    ["memo_or_report", "document"],
    ["deck", "deck"],
    ["model_or_budget", "sheet"],
    ["email_or_comms", "envelope"],
    ["code", "code"],
    ["creative_or_design", "pen"],
    ["other", "document"],
  ])("kind %s maps to glyph %s", (kind, glyph) => {
    expect(deliverableGlyph({ deliverable_kind: kind }, null)).toBe(glyph);
  });

  it("falls back on the work item type when no kind was chosen", () => {
    expect(deliverableGlyph(null, "document")).toBe("document");
    expect(deliverableGlyph(null, "deck")).toBe("deck");
    expect(deliverableGlyph(null, "sheet")).toBe("sheet");
    expect(deliverableGlyph(null, "email")).toBe("envelope");
    expect(deliverableGlyph({}, "unknown-thing")).toBe("document");
  });

  it("an unknown stored kind falls back safely", () => {
    expect(deliverableGlyph({ deliverable_kind: "hologram" }, "deck")).toBe("deck");
    expect(deliverableGlyph({ deliverable_kind: "hologram" }, null)).toBe("document");
  });

  it("every declared kind has a glyph", () => {
    for (const kind of DELIVERABLE_KINDS) {
      expect(deliverableGlyph({ deliverable_kind: kind }, null)).toBeTruthy();
    }
  });
});

describe("pass 139: every card carries the kind icon", () => {
  it("the shipped card renders KindIcon left of the title", () => {
    const card = read("components/firm/ShippedWorkCard.tsx");
    expect(card).toContain('import { KindIcon } from "@/components/work/KindIcon"');
    const iconAt = card.indexOf("<KindIcon");
    const headlineAt = card.indexOf("{headline}");
    expect(iconAt).toBeGreaterThan(-1);
    expect(headlineAt).toBeGreaterThan(iconAt);
  });

  it("the search result card renders KindIcon too", () => {
    const search = read("components/archive/PastWorkSearch.tsx");
    expect(search).toContain('import { KindIcon } from "@/components/work/KindIcon"');
    expect(search).toContain("<KindIcon");
  });

  it("the glyph set covers the required shapes", () => {
    const icon = read("components/work/KindIcon.tsx");
    for (const glyph of ["document", "deck", "sheet", "envelope", "code", "pen"]) {
      expect(icon).toContain(`${glyph}:`);
    }
  });
});

describe("pass 139: metadata line hierarchy", () => {
  const card = read("components/firm/ShippedWorkCard.tsx");
  const search = read("components/archive/PastWorkSearch.tsx");

  it("the kind tag uses the grey wash, graphite text, mono 10px uppercase", () => {
    for (const source of [card, search]) {
      expect(source).toContain("bg-[var(--nb-grey-1)]");
      expect(source).toContain("text-[10px] uppercase");
      expect(source).toContain("text-[var(--nb-graphite)]");
    }
  });

  it("the filename is mono ink at 500 weight on the card", () => {
    expect(card).toContain("font-mono text-[11px] font-medium uppercase");
    expect(card).toContain("text-[var(--nb-ink)]");
  });

  it("the engagement code is green at 600 weight on both card styles", () => {
    for (const source of [card, search]) {
      expect(source).toContain("font-semibold text-[var(--nb-green)]");
    }
  });

  it("the brief and the shipped-by line sit at --nb-mid", () => {
    expect(card).toContain("line-clamp-2 text-xs text-[var(--nb-mid)]");
    expect(card).toContain("mt-1 block text-xs text-[var(--nb-mid)]");
  });

  it("no new colors and never red", () => {
    for (const source of [card, search, read("components/work/KindIcon.tsx")]) {
      expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}/);
      expect(source.toLowerCase()).not.toContain("red");
    }
  });
});

describe("pass 139: language laws", () => {
  it("no banned words in the touched copy", () => {
    const sources = [
      read("pages/ArchivePage.tsx"),
      read("components/firm/ShippedWorkCard.tsx"),
      read("components/archive/PastWorkSearch.tsx"),
    ].join("\n");
    expect(sources).not.toMatch(/—/);
    expect(sources.toLowerCase()).not.toMatch(
      /\b(score|monitor|track|surveillance|oversight|governance|compliance|integrity|fluency|gaps|deficiencies|caught)\b/,
    );
  });
});
