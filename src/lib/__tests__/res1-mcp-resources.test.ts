import { describe, expect, it } from "vitest";
import { parseResourceUri, resourceItemsBand } from "@/lib/mcp-handler.server";

const uuid = "6d3262dc-32c2-4910-b951-ccee79d82135";

describe("RES-1 resource URI parsing", () => {
  it.each(["board", "work"] as const)("accepts a %s UUID resource", (kind) => {
    expect(parseResourceUri(`lasso://${kind}/${uuid}`)).toEqual({ kind, id: uuid });
  });
  it.each(["lasso://board/notauuid", `lasso://other/${uuid}`, uuid, ""])("rejects unknown URI %s", (uri) => {
    expect(parseResourceUri(uri)).toBeNull();
  });
});

describe("RES-1 resource item bands", () => {
  it.each([
    [0, "0"], [1, "1-2"], [2, "1-2"], [3, "3-9"], [9, "3-9"],
    [10, "10-29"], [29, "10-29"], [30, "30+"], [400, "30+"],
  ] as const)("bands %i items as %s", (count, band) => {
    expect(resourceItemsBand(count)).toBe(band);
  });
});