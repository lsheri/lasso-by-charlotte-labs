/**
 * ASK-D1: preview-only gate for the floating Ask drafts. Production hosts
 * always resolve to null, whatever the query, so nobody outside a Lovable
 * preview or localhost ever sees a draft.
 */
export type AskDraft = "a" | "b";
export type AskDraftPosition = "bottom_centre" | "bottom_right" | "lock_left" | "lock_right" | "free";

const PREVIEW_LABEL = /^(?:id-preview(?:-[a-z0-9]+)?|preview(?:-[a-z0-9]+)?)--[a-z0-9-]+$/;
const PROJECT_DEV_LABEL = /^project--[0-9a-f-]{36}-dev$/;
const PROJECT_LABEL = /^project--[0-9a-f-]{36}(?:-dev)?$/;

export function isAskDraftHost(rawHost: string): boolean {
  const host = rawHost.toLowerCase().replace(/:\d+$/, "");
  if (host === "localhost" || host === "127.0.0.1") return true;
  const dot = host.indexOf(".");
  if (dot < 0) return false;
  const label = host.slice(0, dot);
  const suffix = host.slice(dot + 1);
  if (suffix === "lovable.app") return PREVIEW_LABEL.test(label) || PROJECT_DEV_LABEL.test(label);
  if (suffix === "lovableproject.com" || suffix === "lovableproject-dev.com") return PREVIEW_LABEL.test(label) || PROJECT_LABEL.test(label) || /^[0-9a-f-]{36}$/.test(label);
  return false;
}

/** Pure: the draft named in the query, only on a preview host. */
export function askDraftFromLocation(host: string, search: string): AskDraft | null {
  if (!isAskDraftHost(host)) return null;
  const value = new URLSearchParams(search).get("ask");
  return value === "a" || value === "b" ? value : null;
}

const STORE_KEY = "lasso.ask-draft";

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** The query wins; ask=off clears; otherwise the remembered choice for this host. */
export function resolveAskDraft(host: string, search: string, store: Store | null): AskDraft | null {
  if (!isAskDraftHost(host)) return null;
  const value = new URLSearchParams(search).get("ask");
  try {
    if (value === "off") { store?.removeItem(STORE_KEY); return null; }
    const fromQuery = askDraftFromLocation(host, search);
    if (fromQuery) { store?.setItem(STORE_KEY, fromQuery); return fromQuery; }
    const saved = store?.getItem(STORE_KEY);
    return saved === "a" || saved === "b" ? saved : null;
  } catch {
    return askDraftFromLocation(host, search);
  }
}

export type SavedAskPosition = { to: AskDraftPosition; x?: number; y?: number };

export function readAskPosition(draft: AskDraft, store: Store | null): SavedAskPosition {
  const fallback: SavedAskPosition = { to: draft === "a" ? "bottom_centre" : "bottom_right" };
  try {
    const raw = store?.getItem(`lasso.ask-draft.pos.${draft}`);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as SavedAskPosition;
    return ["bottom_centre", "bottom_right", "lock_left", "lock_right", "free"].includes(parsed.to) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function writeAskPosition(draft: AskDraft, pos: SavedAskPosition, store: Store | null): void {
  try { store?.setItem(`lasso.ask-draft.pos.${draft}`, JSON.stringify(pos)); } catch { /* storage unavailable */ }
}

export type Rect = { x: number; y: number; w: number; h: number };
export type DropTarget = Exclude<AskDraftPosition, "free">;

/** The four dashed drop targets inside a canvas of width w and height h. */
export function askDropTargets(w: number, h: number): Record<DropTarget, Rect> {
  const bandH = 96;
  const lockH = Math.max(80, h - 24 - bandH - 32);
  return {
    lock_left: { x: 12, y: 12, w: 120, h: lockH },
    lock_right: { x: w - 132, y: 12, w: 120, h: lockH },
    bottom_centre: { x: w / 2 - 150, y: h - 16 - bandH, w: 300, h: bandH },
    bottom_right: { x: w - 16 - 200, y: h - 16 - bandH, w: 200, h: bandH },
  };
}

/** Pure: which drop target a canvas-relative point lands on, or free. */
export function resolveAskDrop(px: number, py: number, w: number, h: number): AskDraftPosition {
  const targets = askDropTargets(w, h);
  for (const key of ["bottom_right", "bottom_centre", "lock_left", "lock_right"] as const) {
    const r = targets[key];
    if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return key;
  }
  return "free";
}

export const ASK_DRAFT_WIDTH: Record<AskDraftPosition, number> = {
  bottom_centre: 600,
  bottom_right: 430,
  lock_left: 380,
  lock_right: 380,
  free: 460,
};

/** Keep a free surface inside the canvas after a resize. */
export function clampFree(x: number, y: number, w: number, h: number, width = ASK_DRAFT_WIDTH.free, minVisible = 80): { x: number; y: number } {
  return {
    x: Math.min(Math.max(0, x), Math.max(0, w - Math.min(width, w))),
    y: Math.min(Math.max(0, y), Math.max(0, h - minVisible)),
  };
}
