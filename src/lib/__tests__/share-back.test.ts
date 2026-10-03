import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const onboarding = readFileSync(join(process.cwd(), "src/routes/onboarding.tsx"), "utf8");
const requests = readFileSync(join(process.cwd(), "src/pages/KeyRequestsPage.tsx"), "utf8");

describe("share back", () => {
  it("renders the exact card strings", () => {
    for (const s of [
      "sponsored your workspace`",
      "Do you want to share work with them?",
      "You choose what you share, one piece at a time. They see nothing until you send it.",
      "`Yes, share with ${shareBack.name}`",
      "No thanks",
      "We will not ask again.",
    ]) expect(onboarding).toContain(s);
  });

  it("partner section is titled and claims", () => {
    expect(requests).toContain('title="Shared with you"');
    expect(requests).toContain("claim_coaching_links");
    expect(requests).toContain("Claimed");
  });

  it("the three events carry empty payloads", () => {
    expect(onboarding).toContain('logEvent("share_back.offered", shareBack.orgId, {})');
    expect(onboarding).toContain('logEvent("share_back.declined", shareBack.orgId, {})');
    expect(requests).toContain('logEvent("share_back.claimed", orgId, {})');
  });

  it("no em dash in either surface", () => {
    expect(onboarding).not.toContain("\u2014");
    expect(requests).not.toContain("\u2014");
  });
});
