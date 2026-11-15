// Phase 4 PR5: signed-out pages may follow ?brand=charlotte on preview and local hosts only; production stays Lasso.
import { describe, expect, it } from "vitest";

import { BRANDS, brandCopyDeep, makerLine } from "@/design/brand/brand";
import { isPreviewHost, resolveSkin } from "@/lib/skin";
import { COPY as TRUST_COPY } from "@/routes/trust";

const PREVIEW = "id-preview--57cd51ce-f7b4-4cd0-a7d0-761453b5935b.lovable.app";

describe("who sees Charlotte", () => {
  it("lets a signed-out visitor preview Charlotte on local and preview hosts", () => {
    for (const host of ["localhost", "127.0.0.1", PREVIEW]) {
      expect(resolveSkin({ current: "lasso", requested: "charlotte", email: null, host })).toBe("charlotte");
      expect(resolveSkin({ current: "charlotte", requested: null, email: null, host })).toBe("charlotte");
      expect(resolveSkin({ current: "charlotte", requested: "lasso", email: null, host })).toBe("lasso");
    }
  });

  it("keeps production and the published address Lasso for signed-out visitors", () => {
    for (const host of ["lasso.charlotte-labs.com", "lasso-by-charlotte-labs.lovable.app", "evil-preview--x.lovable.app.example.com", null, undefined]) {
      expect(resolveSkin({ current: "charlotte", requested: "charlotte", email: null, host })).toBe("lasso");
    }
  });

  it("still holds the D1 allow-list for signed-in accounts, on any host", () => {
    expect(resolveSkin({ current: "lasso", requested: "charlotte", email: "pilot@example.com", host: PREVIEW })).toBe("lasso");
    expect(resolveSkin({ current: "lasso", requested: "charlotte", email: "someone@charlotte-labs.com", host: "lasso.charlotte-labs.com" })).toBe("charlotte");
  });

  it("recognises only exact preview hosts", () => {
    expect(isPreviewHost(PREVIEW)).toBe(true);
    expect(isPreviewHost("preview--abc.lovable.app")).toBe(true);
    expect(isPreviewHost("LOCALHOST")).toBe(true);
    expect(isPreviewHost("lasso.charlotte-labs.com")).toBe(false);
    expect(isPreviewHost("abc.lovable.app")).toBe(false);
    expect(isPreviewHost("")).toBe(false);
  });
});

describe("signed-out copy tables", () => {
  it("returns the same table for Lasso", () => {
    expect(brandCopyDeep(BRANDS.lasso, TRUST_COPY)).toBe(TRUST_COPY);
  });

  it("names Charlotte, and never Lasso, under Charlotte, keeping the company's name", () => {
    const trust = JSON.stringify(brandCopyDeep(BRANDS.charlotte, TRUST_COPY));
    expect(trust).not.toMatch(/Lasso/);
    expect(trust).toContain("How Charlotte handles your work");
    expect(trust).toContain("Charlotte Labs");
    expect(trust).toContain("← Back to Charlotte");
  });

  it("drops the doubled name in the maker line", () => {
    expect(makerLine(BRANDS.lasso)).toBe("Lasso by Charlotte Labs");
    expect(makerLine(BRANDS.charlotte)).toBe("Charlotte Labs");
  });
});
