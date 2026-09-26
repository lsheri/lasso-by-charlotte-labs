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
  presetOpened.clear();
  tourEvents.clear();
  viewId = null;
}

/** Once per page view per surface and engagement: a remount inside the same view (strict mode, refetch) does not send it again. */
export function noteDemoOpened(surface: "home" | "board" | "landing" | "conversations" | "sources" | "playground", engagement: string): void {
  const key = `${surface}:${engagement}`;
  const now = Date.now();
  const last = opened.get(key);
  if (last !== undefined && now - last < SAME_VIEW_MS) return;
  opened.set(key, now);
  void recordAnonymousEventFn({
    data: { event_type: "demo.opened", view_id: demoViewId(), dims: { surface, engagement: safe(engagement) } },
  }).catch(() => undefined);
}

export type DemoPlayAction = "drag_card" | "drag_group" | "sticky_added" | "sticky_edited" | "reset_auto" | "reset_manual" | "preset_opened" | "proof_link_opened";

export function noteDemoPlayInteracted(action: DemoPlayAction, surface: "desktop" | "phone"): void {
  void recordAnonymousEventFn({
    data: { event_type: "demo.play_interacted", view_id: demoViewId(), dims: { action, surface } },
  }).catch(() => undefined);
}

export function noteDemoCardOpened(engagement: string, kind: string): void {
  void recordAnonymousEventFn({
    data: { event_type: "demo.card_opened", view_id: demoViewId(), dims: { engagement: safe(engagement), kind: safe(kind) } },
  }).catch(() => undefined);
}

const presetOpened = new Map<string, number>();

/** Unit 2: a saved answer opened. Same 1.5s dedupe per code and position. */
export function noteDemoPresetOpened(code: string, position: number): void {
  const key = `${code}:${position}`;
  const now = Date.now();
  const last = presetOpened.get(key);
  if (last !== undefined && now - last < SAME_VIEW_MS) return;
  presetOpened.set(key, now);
  void recordAnonymousEventFn({
    data: { event_type: "demo.preset_opened", view_id: demoViewId(), dims: { code: safe(code), position } },
  }).catch(() => undefined);
}

export function noteDemoTurnOpened(code: string, position: number): void {
  void recordAnonymousEventFn({
    data: { event_type: "demo.turn_opened", view_id: demoViewId(), dims: { code: safe(code), position } },
  }).catch(() => undefined);
}

const tourEvents = new Map<string, number>();

function noteTourEvent(eventType: "demo.step_completed" | "demo.tour_skipped", step: number, engagement?: string): void {
  const key = `${eventType}:${step}:${engagement ?? ""}`;
  const now = Date.now();
  const last = tourEvents.get(key);
  if (last !== undefined && now - last < SAME_VIEW_MS) return;
  tourEvents.set(key, now);
  void recordAnonymousEventFn({
    data: {
      event_type: eventType,
      view_id: demoViewId(),
      dims: eventType === "demo.step_completed" ? { step, engagement: safe(engagement ?? "home") } : { step },
    },
  }).catch(() => undefined);
}

export function noteDemoStepCompleted(step: number, engagement: string): void {
  noteTourEvent("demo.step_completed", step, engagement);
}

export function noteDemoTourSkipped(step: number): void {
  noteTourEvent("demo.tour_skipped", step);
}

const DEMO_TOOLS = new Set(["all", "claude", "chatgpt", "gemini", "document"]);

/** Unit 4: a tool chip on /demo/conversations. Closed tool word only. */
export function noteDemoFilterChanged(tool: string): void {
  void recordAnonymousEventFn({
    data: { event_type: "demo.filter_changed", view_id: demoViewId(), dims: { tool: DEMO_TOOLS.has(tool) ? tool : "other" } },
  }).catch(() => undefined);
}
