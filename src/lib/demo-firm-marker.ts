/**
 * The one spelling of the demo firm's marker (QA of PR 291, L2). The demo workspace is the one whose settings carry
 * demo_firm = "kestrel-bay"; it is found by this marker everywhere, never by a fixed id. Signed-in people cannot set
 * or change it (the orgs_guard_settings trigger refuses).
 */
export const DEMO_FIRM_MARKER = "kestrel-bay";

/** Whether a workspace's settings carry the demo firm's marker, exactly. */
export function isDemoFirmSettings(settings: unknown): boolean {
  return Boolean(settings) && typeof settings === "object" && !Array.isArray(settings) && (settings as Record<string, unknown>)["demo_firm"] === DEMO_FIRM_MARKER;
}
