import type { FeatureFlag } from "./feature-flags";

/**
 * Which flags a workspace switches on by its own row. Pure and free of PostHog, so the profile loader can use it
 * anywhere. The why and the rules are beside flagEnabled in feature-flags.ts.
 */
export function workspaceFlagsFor(settings: unknown): FeatureFlag[] {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return [];
  const record = settings as Record<string, unknown>;
  const demoFirm = typeof record["demo_firm"] === "string" && record["demo_firm"].trim().length > 0;
  return demoFirm || record["firm_brain"] === true ? ["company-brain"] : [];
}
