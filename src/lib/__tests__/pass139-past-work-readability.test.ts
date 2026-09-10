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
  deliverableTag,
  type DeliverableGlyph,
} from "@/lib/deliverable-kinds";
import { PAST_WORK_GROUP_LABEL, PAST_WORK_NAV_LABEL } from "@/lib/past-work-shared";

const root = resolve(__dirname, "../..");
const read = (rel: string) => readFileSync(resolve(root, rel), "utf8");

describe("pass 139: the page is named Past work", () => {
  const page = read("pages/ArchivePage.tsx");
  const route = read("routes/_authenticated/archive.tsx");

  // Updated for Figma 29:833. The frame leads with the title itself: the group
  // stamp that used to sit above it is the sidebar's own word for this page,
  // and saying it twice on one screen is noise. The nav labels are unchanged
  // and still checked here.
  it('leads with the shared "Past work" page header', () => {
    // "Past" + an italic "work" reads as "Past work". Passing the whole phrase
    // as the title printed the word twice.
    expect(page).toContain('<PageHeader title="Past" italicWord="work"');
    expect(page).toContain("subtitle={subtitle}");
    expect(page).not.toContain('className="micro-label"');
    expect(PAST_WORK_GROUP_LABEL).toBe("Your organization");
    expect(PAST_WORK_NAV_LABEL).toBe("Past work");
  });

  it("says how much is here and that none of it is deleted", () => {
    expect(page).toContain("closed engagement");
    expect(page).toContain("nothing here is deleted");
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

  it("the tag falls back on the work item type, never a default kind", () => {
    // Pass 139.1: the no-kind deck case and the no-kind document case.
    expect(deliverableTag(null, "deck")).toBe("Deck");
    expect(deliverableTag({}, "deck")).toBe("Deck");
    expect(deliverableTag(null, "document")).toBe("Document");
    expect(deliverableTag(null, "sheet")).toBe("Sheet");
    expect(deliverableTag(null, "email")).toBe("Email");
    expect(deliverableTag(null, "unknown-thing")).toBe("Document");
    expect(deliverableTag({ deliverable_kind: "memo_or_report" }, "deck")).toBe("Memo or report");
    expect(deliverableTag({ deliverable_kind: "deck" }, null)).toBe("Deck");
  });

  it("an unknown stored kind falls back safely", () => {
    expect(deliverableGlyph({ deliverable_kind: "hologram" }, "deck")).toBe("deck");
    expect(deliverableGlyph({ deliverable_kind: "hologram" }, null)).toBe("document");
    expect(deliverableTag({ deliverable_kind: "hologram" }, "deck")).toBe("Deck");
  });

  it("every declared kind has a glyph", () => {
    for (const kind of DELIVERABLE_KINDS) {
      expect(deliverableGlyph({ deliverable_kind: kind }, null)).toBeTruthy();
    }
  });
});

describe("pass 139.1: exactly one icon per card", () => {
  // Pass 142: the one icon now lives inside the metadata sub-card both card
  // styles share, and the headline sits above that tile.
  it("the shipped card renders only the format icon, never the legacy marks", () => {
    const card = read("components/firm/ShippedWorkCard.tsx");
    const tile = read("components/firm/CardMetaTile.tsx");
    expect(tile).toContain('FileFormatIcon } from "@/components/work/FileFormatIcon"');
    expect(card).toContain("<CardMetaTile");
    expect(card).not.toContain("SourceMark");
    expect(card).not.toContain("RobotMark");
    const tileAt = card.indexOf("<CardMetaTile");
    const headlineAt = card.indexOf("{headline}");
    expect(headlineAt).toBeGreaterThan(-1);
    expect(tileAt).toBeGreaterThan(headlineAt);
  });

  it("the search result card renders the format icon too", () => {
    const search = read("components/archive/PastWorkSearch.tsx");
    const tile = read("components/firm/CardMetaTile.tsx");
    expect(search).toContain("<CardMetaTile");
    expect(tile).toContain("<FileFormatIcon");
    expect(search).not.toContain("SourceMark");
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
  // Pass 142: the metadata rows moved into one shared tile.
  const tile = read("components/firm/CardMetaTile.tsx");

  it("the kind tag sits in the tile, mono 10px uppercase", () => {
    expect(tile).toContain("bg-[var(--nb-grey-1)]");
    expect(tile).toContain("text-[10px] uppercase");
    expect(tile).toContain("text-[var(--nb-graphite)]");
    for (const source of [card, search]) {
      expect(source).toContain("<CardMetaTile");
    }
  });

  it("the filename calms to graphite in the tile", () => {
    expect(tile).toContain("font-mono text-[11px] uppercase");
    expect(tile).toContain("text-[var(--nb-graphite)]");
  });

  it("the client name sits at --nb-soft", () => {
    expect(tile).toContain("text-[var(--nb-soft)]");
  });

  it("the engagement code is green at 600 weight", () => {
    expect(tile).toContain("font-semibold text-[var(--nb-green)]");
  });

  it("the brief and the shipped-by line sit at --nb-mid", () => {
    expect(card).toContain("line-clamp-2 text-xs text-[var(--nb-mid)]");
    expect(tile).toContain("text-xs leading-[1.35] text-[var(--nb-mid)]");
  });

  it("no new colors and never red", () => {
    for (const source of [card, search, read("components/work/KindIcon.tsx")]) {
      expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}/);
      expect(source).not.toMatch(/\bred\b/i);
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
