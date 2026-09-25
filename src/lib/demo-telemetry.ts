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

const opened = new Map<string, number>();
const SAME_VIEW_MS = 1500;
/** Test seam. */
export function resetDemoTelemetry(): void {
  opened.clear();
  viewId = null;
}

/** Once per page view per surface and engagement: a remount inside the same view (strict mode, refetch) does not send it again. */
export function noteDemoOpened(surface: "home" | "board", engagement: string): void {
  const key = `${surface}:${engagement}`;
  const now = Date.now();
  const last = opened.get(key);
  if (last !== undefined && now - last < SAME_VIEW_MS) return;
  opened.set(key, now);
  void recordAnonymousEventFn({
    data: { event_type: "demo.opened", view_id: demoViewId(), dims: { surface, engagement: safe(engagement) } },
  }).catch(() => undefined);
}

export function noteDemoCardOpened(engagement: string, kind: string): void {
  void recordAnonymousEventFn({
    data: { event_type: "demo.card_opened", view_id: demoViewId(), dims: { engagement: safe(engagement), kind: safe(kind) } },
  }).catch(() => undefined);
}
