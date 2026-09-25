import { recordAnonymousEventFn } from "./telemetry.functions";

/** Anonymous, content-free demo events. Signed-in visitors see the same public demo. */
let viewId: string | null = null;
function demoViewId(): string {
  if (!viewId) {
    viewId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
  return viewId;
}

const SAFE = /^[a-z0-9_.:-]{1,40}$/i;
const safe = (value: string) => (SAFE.test(value) ? value.toLowerCase() : "other");

const opened = new Set<string>();
/** Test seam. */
export function resetDemoTelemetry(): void {
  opened.clear();
  viewId = null;
}

/** Once per page view per surface and engagement, however often React mounts. */
export function noteDemoOpened(surface: "home" | "board", engagement: string): void {
  const key = `${surface}:${engagement}`;
  if (opened.has(key)) return;
  opened.add(key);
  void recordAnonymousEventFn({
    data: { event_type: "demo.opened", view_id: demoViewId(), dims: { surface, engagement: safe(engagement) } },
  }).catch(() => undefined);
}

export function noteDemoCardOpened(engagement: string, kind: string): void {
  void recordAnonymousEventFn({
    data: { event_type: "demo.card_opened", view_id: demoViewId(), dims: { engagement: safe(engagement), kind: safe(kind) } },
  }).catch(() => undefined);
}
