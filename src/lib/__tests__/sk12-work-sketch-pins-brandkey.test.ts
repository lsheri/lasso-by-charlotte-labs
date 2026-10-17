// @vitest-environment jsdom
/**
 * SKETCH-12: pins work-sketch.ts's displayBrandKey to SourceMark.tsx's
 * sourceBrandKey. work-sketch deliberately reimplements the precedence rather
 * than importing it (importing pulls React into a React-free lib), so this
 * test is the only enforcement of the keep-in-step comment.
 *
 * A disagreement between the two is a STOP for the dispatcher, not a test to
 * soften: the two resolvers answer "which tool made this" and must agree.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { sourceBrandKey } from "@/components/work/SourceMark";
import type { BrandKey } from "@/components/connectors/BrandLogo";
import type { WorkSource } from "@/design/reference/work-types";
import { sketchSource } from "@/lib/work-sketch";
import { vendorFromSource } from "@/lib/work-taxonomy";
import type { ToolVendor } from "@/lib/work-taxonomy";
import type { WorkItemRow } from "@/lib/work-types";

/**
 * The explicit translation between the two vocabularies. BrandKey is what a
 * mark can draw; WorkSource is the widened display vocabulary a sketch wears.
 * Keys absent here have no sketch face of their own and land on 'other'.
 */
const BRAND_TO_SOURCE: Partial<Record<BrandKey, WorkSource>> = {
  googleslides: "slides",
  googledocs: "docs",
  googlesheets: "sheets",
  claude: "claude",
  chatgpt: "chatgpt",
  gemini: "gemini",
  copilot: "copilot",
  granola: "granola",
  wispr: "wispr",
  // googledrive, gmail, googlecalendar, onedrive, sharepoint, notion, slack,
  // lovable, upload, thread, unknown: no face, fall through to 'other'.
};

/**
 * The vendor fallback work-sketch applies when no brand face exists. This is
 * the second layer of its resolution and part of the contract being pinned:
 * a vendor with no drawable mark (perplexity) still gets its own face.
 */
const VENDOR_TO_SOURCE: Partial<Record<ToolVendor, WorkSource>> = {
  claude: "claude",
  chatgpt: "chatgpt",
  gemini: "gemini",
  copilot: "copilot",
  perplexity: "perplexity",
  wispr: "wispr",
};

/** What sourceBrandKey says, said in the display vocabulary, with the vendor fallback. */
function expectedSource(item: Parameters<typeof sourceBrandKey>[0]): WorkSource {
  const brand = BRAND_TO_SOURCE[sourceBrandKey(item)];
  if (brand) return brand;
  return VENDOR_TO_SOURCE[vendorFromSource(item)] ?? "other";
}

/** Minimal row: sketchSource reads only the origin fields. */
function row(fields: Record<string, unknown>): WorkItemRow {
  return fields as unknown as WorkItemRow;
}

type Case = { name: string; item: WorkItemRow };

const CASES: Case[] = [
  // --- direct vendor field, brand present ---
  { name: "source_vendor claude", item: row({ source_vendor: "claude" }) },
  { name: "source_vendor chatgpt", item: row({ source_vendor: "chatgpt" }) },
  { name: "source_vendor gemini", item: row({ source_vendor: "gemini" }) },
  { name: "source_vendor copilot", item: row({ source_vendor: "copilot" }) },
  { name: "source_vendor wispr", item: row({ source_vendor: "wispr" }) },
  { name: "source_vendor granola", item: row({ source_vendor: "granola" }) },
  // --- source_meta.vendor when source_vendor absent ---
  { name: "source_meta.vendor claude", item: row({ source_meta: { vendor: "claude" } }) },
  // --- direct vendor wins over source prefix ---
  {
    name: "vendor beats source prefix",
    item: row({ source_vendor: "gemini", source: "mcp:chatgpt" }),
  },
  // --- source prefixes ---
  { name: "connector:claude", item: row({ source: "connector:claude" }) },
  { name: "mcp:chatgpt", item: row({ source: "mcp:chatgpt" }) },
  { name: "import:gemini", item: row({ source: "import:gemini" }) },
  { name: "mcp:push resolves nothing", item: row({ source: "mcp:push" }) },
  { name: "connector:other resolves nothing", item: row({ source: "connector:other" }) },
  // --- bare sources, excluded and kept ---
  { name: "manual resolves nothing", item: row({ source: "manual" }) },
  { name: "paste resolves nothing", item: row({ source: "paste" }) },
  { name: "bare claude source", item: row({ source: "claude" }) },
  // --- upload with no evidence ---
  { name: "upload with no vendor", item: row({ source: "upload" }) },
  // --- nothing resolvable at all ---
  { name: "empty row", item: row({}) },
  // --- 'other' vendor falls through to source, then unknown ---
  { name: "source_vendor other, no source", item: row({ source_vendor: "other" }) },
  { name: "source_vendor other, mcp:wispr source", item: row({ source_vendor: "other", source: "mcp:wispr" }) },
  // --- Drive evidence: mime, link, type, plain ---
  {
    name: "drive mime presentation",
    item: row({ source: "connector:googledrive", source_meta: { mime: "application/vnd.google-apps.presentation" } }),
  },
  {
    name: "drive mime spreadsheet",
    item: row({ source: "connector:googledrive", source_meta: { mime: "application/vnd.google-apps.spreadsheet" } }),
  },
  {
    name: "drive mime document",
    item: row({ source: "connector:googledrive", meta: { source_mime: "application/vnd.google-apps.document" } }),
  },
  {
    name: "drive link presentation",
    item: row({ source: "connector:gdrive", meta: { web_view_link: "https://docs.google.com/presentation/d/x" } }),
  },
  {
    name: "drive type deck",
    item: row({ source: "connector:googledrive", type: "deck" }),
  },
  {
    name: "drive type sheet",
    item: row({ source: "google drive", type: "sheet" }),
  },
  { name: "plain drive", item: row({ source: "connector:googledrive", type: "document" }) },
  // --- toolkit variants with no sketch face ---
  { name: "gmail toolkit", item: row({ source: "connector:gmail" }) },
  { name: "notion toolkit", item: row({ source: "connector:notion" }) },
  { name: "slack toolkit", item: row({ source: "connector:slack" }) },
  { name: "googlecalendar toolkit", item: row({ source: "connector:google_calendar" }) },
  { name: "lovable toolkit", item: row({ source: "connector:lovable" }) },
  // --- toolkit aliases for faced brands ---
  { name: "anthropic alias", item: row({ source_vendor: "anthropic" }) },
  { name: "openai alias", item: row({ source_vendor: "openai" }) },
  { name: "microsoftcopilot alias", item: row({ source: "connector:Microsoft Copilot" }) },
  // --- unresolvable key with vendor fallback: brand unknown, vendor known ---
  { name: "perplexity vendor, no brand", item: row({ source_vendor: "perplexity" }) },
  { name: "perplexity via source", item: row({ source: "mcp:perplexity" }) },
  // --- unknown key, unknown vendor ---
  { name: "unnameable toolkit", item: row({ source: "connector:figma" }) },
];

describe("sketchSource agrees with sourceBrandKey", () => {
  it.each(CASES)("$name", ({ item }) => {
    expect(sketchSource(item)).toBe(expectedSource(item));
  });

  it("covers every WorkSource the display vocabulary carries", () => {
    const seen = new Set(CASES.map((c) => sketchSource(c.item)));
    const ALL: WorkSource[] = [
      "slides", "docs", "sheets", "claude", "chatgpt", "granola",
      "gemini", "copilot", "perplexity", "wispr", "other",
    ];
    for (const source of ALL) {
      expect(seen, `no row lands on ${source}`).toContain(source);
    }
  });

  it("a row with nothing resolvable lands on other", () => {
    expect(sketchSource(row({}))).toBe("other");
    expect(sourceBrandKey(row({}))).toBe("unknown");
  });
});

describe("the keep-in-step comment still stands", () => {
  it("work-sketch.ts still names the two paths it mirrors", () => {
    const source = readFileSync(resolve(process.cwd(), "src/lib/work-sketch.ts"), "utf8");
    expect(source).toContain("Mirrors sourceVendorKey/sourceBrandKey");
    expect(source).toContain("The two paths must be kept in step.");
  });
});
