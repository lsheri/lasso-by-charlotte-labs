import type { TelemetryEvent } from "./telemetry-shared";

/**
 * No new event for the checklist. When someone acts on a step we remember it
 * for the next real destination event, which then carries entry: "checklist".
 * Content free, single flat string, consumed once.
 */
const DESTINATION_EVENTS: ReadonlySet<string> = new Set<TelemetryEvent>([
  "connector.enabled",
  "mcp.push",
  "workitem.captured",
  "import.completed",
  "workitem.mapped",
  "analysis.started",
  "analysis.completed",
  "coach.invite_created",
  "note.created",
  "oneonone.prepared",
]);

let pending = false;

export function markChecklistEntry(): void {
  pending = true;
}

/** Returns the extra dim for this event, and consumes the marker when used. */
export function consumeEntryDim(eventType: string): { entry: string } | null {
  if (!pending || !DESTINATION_EVENTS.has(eventType)) return null;
  pending = false;
  return { entry: "checklist" };
}
