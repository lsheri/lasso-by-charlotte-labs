import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { EVENT_DIM_KEYS, guardEventDims } from "@/lib/event-dim-allowlist";
import { renditionsReadBucket } from "@/lib/reference-rendition-shared";

describe("R3a rendition telemetry", () => {
  it("work.rendition_viewed keeps only closed dims", () => {
    expect(
      guardEventDims("work.rendition_viewed", { method: "extracted_by_script", match: "yes", filename: "x.pptx" }).dims,
    ).toEqual({ method: "extracted_by_script", match: "yes" });
  });
  it("reflect.message_sent carries renditions_read", () => {
    expect(EVENT_DIM_KEYS["reflect.message_sent"]).toContain("renditions_read");
  });
  it("RenditionPane logs without content", () => {
    const src = readFileSync("src/components/peek/RenditionPane.tsx", "utf8");
    expect(src).toContain('"work.rendition_viewed"');
    const call = src.slice(src.indexOf('logEvent("work.rendition_viewed"'));
    const dims = call.slice(0, call.indexOf(");"));
    expect(dims).not.toContain("filename:");
  });
  it("buckets", () => {
    expect(renditionsReadBucket(0)).toBe("0");
    expect(renditionsReadBucket(1)).toBe("1");
    expect(renditionsReadBucket(2)).toBe("2+");
    expect(renditionsReadBucket(7)).toBe("2+");
  });
});
