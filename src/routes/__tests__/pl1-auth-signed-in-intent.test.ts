import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// PL-1: a signed-in person with a plan intent and no workspace must be sent
// to /onboarding with that intent, before the generic /home fallback.
describe("PL-1 auth signed-in intent", () => {
  const source = readFileSync(resolve(__dirname, "../auth.tsx"), "utf8");
  const beforeLoad = source.slice(
    source.indexOf("beforeLoad"),
    source.indexOf("head:"),
  );

  it("redirects to /onboarding carrying the intent", () => {
    expect(beforeLoad).toContain(
      'throw redirect({ to: "/onboarding", search: { intent: search.intent }, replace: true })',
    );
  });

  it("places the onboarding redirect before the /home fallback", () => {
    const onboardingIdx = beforeLoad.indexOf('to: "/onboarding"');
    const homeIdx = beforeLoad.lastIndexOf('redirect({ to: "/home" })');
    expect(onboardingIdx).toBeGreaterThan(-1);
    expect(onboardingIdx).toBeLessThan(homeIdx);
  });
});
