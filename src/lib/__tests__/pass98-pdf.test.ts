import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { decode } from "@/lib/item-text.server";

/**
 * The production manifest showed every pdf decode dying on "Setting up fake
 * worker failed". This pins that a real pdf now yields real text in this
 * runtime, with no worker file resolution.
 */
describe("pdf extraction", () => {
  it("reads text out of a small pdf", async () => {
    const bytes = new Uint8Array(
      readFileSync(join(__dirname, "fixtures", "sample.pdf")),
    );
    const result = await decode("pdf", bytes);
    expect(result.status).toBe("ok");
    expect((result.text ?? "").length).toBeGreaterThan(20);
  }, 30_000);
});
