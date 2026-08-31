import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { fileFormatGlyph, resolveFileFormat, FILE_FORMATS } from "@/lib/file-format";
import { ARCHIVE_PLACEHOLDER } from "@/lib/archive-search-shared";

const CHANGED_FILES = [
  "src/lib/file-format.ts",
  "src/components/work/FileFormatIcon.tsx",
  "src/components/firm/ShippedWorkCard.tsx",
  "src/components/archive/PastWorkSearch.tsx",
  "src/components/archive/ArchiveChat.tsx",
  "src/lib/archive-search-shared.ts",
  "src/lib/past-work-shared.ts",
  "src/pages/ArchivePage.tsx",
];

describe("pass 140: file format resolution", () => {
  it("accepts exactly the agreed format values", () => {
    expect([...FILE_FORMATS]).toEqual([
      "word",
      "google_docs",
      "google_slides",
      "powerpoint",
      "google_sheets",
      "excel",
      "pdf",
      "text",
      "other",
    ]);
  });

  it("explicit meta.file_format wins over mime and extension", () => {
    expect(
      resolveFileFormat({
        meta: { file_format: "google_slides" },
        source_meta: { mime_type: "application/pdf", filename: "deck.pptx" },
        title: "deck.pptx",
      }),
    ).toBe("google_slides");
  });

  it("mime wins over the extension", () => {
    expect(
      resolveFileFormat({
        source_meta: {
          mime_type:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          filename: "roadmap.pdf",
        },
      }),
    ).toBe("word");
  });

  it("reads the google mimes", () => {
    expect(
      resolveFileFormat({ source_meta: { mime_type: "application/vnd.google-apps.document" } }),
    ).toBe("google_docs");
    expect(
      resolveFileFormat({ source_meta: { mime_type: "application/vnd.google-apps.presentation" } }),
    ).toBe("google_slides");
    expect(
      resolveFileFormat({ source_meta: { mime_type: "application/vnd.google-apps.spreadsheet" } }),
    ).toBe("google_sheets");
    expect(
      resolveFileFormat({
        source_meta: {
          mime_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
      }),
    ).toBe("excel");
    expect(resolveFileFormat({ source_meta: { mime_type: "application/pdf" } })).toBe("pdf");
  });

  it("falls back to the file name extension, then to other", () => {
    expect(resolveFileFormat({ title: "HFB01-ROADMAP.PDF" })).toBe("pdf");
    expect(resolveFileFormat({ title: "pricing.pptx" })).toBe("powerpoint");
    expect(resolveFileFormat({ title: "model.xlsx" })).toBe("excel");
    expect(resolveFileFormat({ title: "notes.md" })).toBe("text");
    expect(resolveFileFormat({ title: "CS Program Recommendation" })).toBe("other");
    expect(resolveFileFormat(null)).toBe("other");
  });

  it("pdf, text and other draw the neutral graphite document", () => {
    expect(fileFormatGlyph("pdf")).toBe("document");
    expect(fileFormatGlyph("text")).toBe("document");
    expect(fileFormatGlyph("other")).toBe("document");
    expect(fileFormatGlyph("word")).toBe("word");
    expect(fileFormatGlyph("powerpoint")).toBe("powerpoint");
  });
});

describe("pass 140: chat bar", () => {
  it("pins the placeholder", () => {
    expect(ARCHIVE_PLACEHOLDER).toBe('Ask past work: "How do people build pricing decks here?"');
  });

  it("has no AI label left in the chat bar", () => {
    const source = readFileSync("src/components/archive/ArchiveChat.tsx", "utf8");
    expect(source).not.toContain("archive-chat-assistant");
    expect(source).not.toMatch(/>\s*AI\s*</);
  });
});

describe("pass 140: language laws", () => {
  const banned =
    /\b(monitor|monitoring|track|tracking|surveillance|oversight|governance|compliance|integrity|fluency|deficiencies)\b/i;

  for (const file of CHANGED_FILES) {
    it(`${file} keeps the language laws`, () => {
      const source = readFileSync(file, "utf8");
      expect(source).not.toMatch(banned);
      expect(source).not.toContain("\u2014");
    });
  }
});
