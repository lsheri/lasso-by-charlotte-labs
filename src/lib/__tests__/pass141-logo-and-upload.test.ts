import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { CARD_FILE_FORMAT_ICON_SIZE } from "@/components/work/FileFormatIcon";
import { buildUploadSourceMeta } from "@/lib/upload-payload";

describe("pass 141: file format logos at 2x", () => {
  it("pins the card logo at twice the old 14px mark", () => {
    expect(CARD_FILE_FORMAT_ICON_SIZE).toBe(28);
  });

  it("both card surfaces render the logo at that size", () => {
    // Pass 142: both card styles render the logo through the shared tile.
    for (const file of ["src/components/firm/CardMetaTile.tsx"]) {
      const source = readFileSync(file, "utf8");
      expect(source).toContain("CARD_FILE_FORMAT_ICON_SIZE");
      expect(source).not.toContain("size={14}");
    }
  });
});

describe("pass 141: upload mime stamping", () => {
  it("records the browser mime type when the file has one", () => {
    expect(buildUploadSourceMeta({ name: "roadmap.pdf", type: "application/pdf" })).toEqual({
      filename: "roadmap.pdf",
      mime_type: "application/pdf",
    });
  });

  it("omits the key when the browser gives nothing", () => {
    expect(buildUploadSourceMeta({ name: "export", type: "" })).toEqual({ filename: "export" });
    expect(buildUploadSourceMeta({ name: "export" })).toEqual({ filename: "export" });
    expect(
      Object.keys(buildUploadSourceMeta({ name: "export", type: "   " })),
    ).toEqual(["filename"]);
  });

  it("the upload capture path uses the builder", () => {
    const source = readFileSync("src/components/work/UploadFilesButton.tsx", "utf8");
    expect(source).toContain("buildUploadSourceMeta(file)");
  });
});
