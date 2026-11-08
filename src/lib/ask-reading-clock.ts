/**
 * V2-3 (ask-v2): the clock and bookkeeping behind the board loops and the
 * light down the rope. Board rule 2 (PLAN-nov08): a live redraw must resume an
 * animation, never restart it, and the lift runs once per card per turn. So the
 * start time and the lifted set live outside React, keyed by the turn, and a
 * remounted component picks up the same phase.
 *
 * Decoration only: nothing here sets data-editing or touches liveBusy.
 */

export const READING_CYCLE_MS = 2600;
const KEEP_TURNS = 8;

const startedAt = new Map<string, number>();
const lifted = new Map<string, Set<string>>();

function trim<T>(map: Map<string, T>) {
  while (map.size > KEEP_TURNS) {
    const oldest = map.keys().next().value;
    if (oldest === undefined) return;
    map.delete(oldest);
  }
}

/** The first time a turn is seen fixes its start; every later call returns that same time. */
export function anchorStart(turnKey: string, now: number): number {
  const found = startedAt.get(turnKey);
  if (found !== undefined) return found;
  startedAt.set(turnKey, now);
  trim(startedAt);
  return now;
}

/** 0..1 through the current cycle, from the anchored start. Offset spreads several loops apart. */
export function phaseAt(turnKey: string, now: number, offset = 0, cycle = READING_CYCLE_MS): number {
  const start = anchorStart(turnKey, now);
  const raw = (now - start) / cycle + offset;
  return ((raw % 1) + 1) % 1;
}

/** For CSS animations: a negative delay that puts the animation where the clock says it is. */
export function anchoredDelayMs(turnKey: string, now: number, cycle = READING_CYCLE_MS): number {
  const start = anchorStart(turnKey, now);
  return -((now - start) % cycle);
}

/** True the first time a card is lifted in a turn, false after. */
export function takeLift(turnKey: string, nodeId: string): boolean {
  let set = lifted.get(turnKey);
  if (!set) {
    set = new Set();
    lifted.set(turnKey, set);
    trim(lifted);
  }
  if (set.has(nodeId)) return false;
  set.add(nodeId);
  return true;
}

/** Test seam. */
export function resetReadingClock(): void {
  startedAt.clear();
  lifted.clear();
}

export type StageBox = { left: number; top: number; right: number; bottom: number };

/** A loose hand-drawn loop around a card: a rounded rectangle that overshoots where it closes, like the mark. */
export function loopPath(box: StageBox, pad = 8): string {
  const l = box.left - pad;
  const t = box.top - pad;
  const r = box.right + pad;
  const b = box.bottom + pad;
  const rad = Math.max(6, Math.min(18, (r - l) / 6, (b - t) / 6));
  const f = (n: number) => Math.round(n * 10) / 10;
  return [
    `M${f(l + rad * 1.4)} ${f(t)}`,
    `H${f(r - rad)}`,
    `Q${f(r)} ${f(t)} ${f(r)} ${f(t + rad)}`,
    `V${f(b - rad)}`,
    `Q${f(r)} ${f(b)} ${f(r - rad)} ${f(b)}`,
    `H${f(l + rad)}`,
    `Q${f(l)} ${f(b)} ${f(l)} ${f(b - rad)}`,
    `V${f(t + rad)}`,
    `Q${f(l)} ${f(t)} ${f(l + rad)} ${f(t)}`,
    // The overshoot: the rope crosses itself where the loop closes.
    `L${f(l + rad * 2.4)} ${f(t + 3)}`,
  ].join(" ");
}

/** A card that does not touch the visible board is counted, not drawn. */
export function isOffStage(box: StageBox, stage: StageBox): boolean {
  return box.right < stage.left || box.left > stage.right || box.bottom < stage.top || box.top > stage.bottom;
}

export function offStageLine(count: number): string | null {
  if (count <= 0) return null;
  return `${count} more off screen`;
}

/** The mark: lime light only while working and online; ink after a failed or offline send. */
export type AskMarkState = "idle" | "live" | "ink";

export function askMarkState({ pending, error, online }: { pending: boolean; error: boolean; online: boolean }): AskMarkState {
  if (error || (!online && pending)) return "ink";
  if (pending) return "live";
  return "idle";
}

/** A real new send: clear any clock and lifts left by an earlier turn with the same key. */
export function beginTurn(turnKey: string, now: number): void {
  startedAt.set(turnKey, now);
  lifted.delete(turnKey);
  trim(startedAt);
}

/** The key a turn is known by: the question as sent. Stable across redraws and remounts of the board. */
export function turnKeyFor(asked: string | null | undefined): string {
  return `ask:${asked ?? ""}`;
}
