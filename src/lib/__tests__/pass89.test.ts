import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { CONSENT_PURPOSES } from "@/lib/telemetry-v2-shared";
import { PURPOSE_COPY, PURPOSE_RANK } from "@/lib/consent-shared";

const checksLibrary = readFileSync("src/components/firm/ChecksLibrary.tsx", "utf8");
const firmChecksCard = readFileSync("src/components/coaching/FirmChecksCard.tsx", "utf8");
const hook = readFileSync("src/hooks/use-firm-checks.ts", "utf8");
const consentFns = readFileSync("src/lib/consent.functions.ts", "utf8");
const consentServer = readFileSync("src/lib/consent.server.ts", "utf8");
const dataUseCard = readFileSync("src/components/settings/DataUseCard.tsx", "utf8");
const checksServer = readFileSync("src/lib/firm-checks.server.ts", "utf8");

describe("pass 89 — firm check authoring on /firm", () => {
  it("shows a firm scoped composer to admins and leads", () => {
    expect(checksLibrary).toContain("New firm check");
    expect(checksLibrary).toContain('profile?.role === "admin" || profile?.role === "lead"');
    expect(checksLibrary).toContain("engagementId: null");
    expect(checksLibrary).toContain("subjectProfileId: null");
    expect(checksLibrary).toContain("authorProfileId: profile.id");
  });

  it("writes through the shared insert path, not a duplicated insert", () => {
    expect(checksLibrary).toContain("useWriteFirmCheck");
    expect(checksLibrary).not.toContain('from("firm_checks")');
    expect(hook).toContain("export async function insertFirmCheck");
    expect(hook).toContain(".select(COLUMNS)");
    expect(hook).toContain(".single()");
    expect(hook).toContain('queryKey: ["firm-check-library"]');
  });

  it("surfaces authoring failures inline and drops the false empty state copy", () => {
    expect(checksLibrary).toContain("That check could not be saved");
    expect(checksLibrary).toContain("text-destructive");
    expect(checksLibrary).not.toContain("New checks are written on an engagement");
  });

  it("offers the admin retire toggle for every scope, not only firm", () => {
    expect(checksLibrary).not.toContain('check.scope === "firm"');
    expect(checksLibrary).not.toContain("Managed where it was written");
    expect(checksLibrary).toContain("toggle(check.id, !check.active)");
  });

  it("surfaces the author-only deactivate failure in the coaching card", () => {
    expect(firmChecksCard).not.toContain("void deactivate.mutateAsync(check.id)");
    expect(firmChecksCard).toContain("That check could not be deactivated");
  });
});

describe("pass 89 — firm checks read honesty", () => {
  it("no longer flattens a read error to no checks", () => {
    expect(checksServer).not.toContain("if (error) return [];");
    expect(checksServer).toContain("[firm-checks] read failed");
    expect(checksServer).toContain("throw new Error");
    expect(checksServer).toContain("applicableFirmChecksForChat");
  });
});

describe("pass 89 — research consent", () => {
  it("research passes every purpose list the write path consults", () => {
    expect(CONSENT_PURPOSES).toContain("research");
    expect(PURPOSE_RANK["research"]).toBe(3);
    // Pass 158: the research switch copy is gone; the choice lives once, on
    // the personal "Your data" card.
    expect(PURPOSE_COPY.some((p) => p.purpose === "research")).toBe(false);
  });

  it("only operate is rejected by the validator", () => {
    expect(consentFns).toContain('input.purpose === "operate"');
    expect(consentFns).not.toContain('input.purpose === "research"');
  });

  it("reports which purpose failed instead of a generic message", () => {
    expect(consentFns).not.toContain('throw new Error("That could not be saved. Try again.")');
    expect(consentFns).toContain("[consent] ledger write failed");
    expect(consentFns).toContain("That could not be saved (${data.purpose})");
  });

  it("never silently no-ops the consent fact write", () => {
    expect(consentServer).toContain("TELEMETRY_SALT is not set");
    expect(consentServer).toContain("[consent] fact write failed");
    expect(consentServer).toContain("[consent] fact write threw");
  });

  it("shows data use errors inline, not toast only", () => {
    expect(dataUseCard).toContain("saveError");
    expect(dataUseCard).toContain("text-destructive");
  });
});

describe("pass 89 — no new telemetry event names", () => {
  it("keeps the existing consent events exactly", () => {
    const names = [...consentFns.matchAll(/eventName: "([a-z0-9_.]+)"/g)].map((m) => m[1]);
    const inline = [...consentFns.matchAll(/\("(consent\.[a-z]+)" as const\)/g)].map((m) => m[1]);
    for (const name of [...names, ...inline]) {
      expect([
        "consent.presented",
        "consent.granted",
        "consent.declined",
        "consent.withdrawn",
      ]).toContain(name);
    }
    expect(checksLibrary).not.toContain("logEvent");
    expect(checksLibrary).not.toContain("recordEvent");
  });
});
