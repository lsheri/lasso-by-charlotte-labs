import { PLACEMENT_CARD, placeAddedCards } from "@/lib/workboard-placement";
/**
 * ASK-D1: the floating Ask drafts. Until 7 Nov production hosts always resolved
 * to null. GATE-LIFT: production now resolves to draft b (see resolveAskDraft);
 * isAskDraftHost still decides who may pick draft a or use ?ask=a|b.
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

/**
 * The query wins; ask=off is remembered as off; otherwise the remembered choice, or draft b.
 *
 * GATE-LIFT (7 Nov, Liam): draft b ships on every host, production included. Production gets
 * only b, plus ask=off as the escape hatch back to the docked panel; choosing draft a, and the
 * ?ask=a|b switch, stay preview-only because they are the experiment, not the product.
 * Future flags belong in PostHog (Liam, 7 Nov); this host rule is the last of its kind.
 */
export function resolveAskDraft(host: string, search: string, store: Store | null): AskDraft | null {
  if (!isAskDraftHost(host)) {
    const asked = new URLSearchParams(search).get("ask");
    try {
      if (asked === "off") { store?.setItem(STORE_KEY, "off"); return null; }
      if (asked === "on") { store?.removeItem(STORE_KEY); return "b"; }
      return store?.getItem(STORE_KEY) === "off" ? null : "b";
    } catch {
      return asked === "off" ? null : "b";
    }
  }
  const value = new URLSearchParams(search).get("ask");
  try {
    if (value === "off") { store?.setItem(STORE_KEY, "off"); return null; }
    const fromQuery = askDraftFromLocation(host, search);
    if (fromQuery) { store?.setItem(STORE_KEY, fromQuery); return fromQuery; }
    const saved = store?.getItem(STORE_KEY);
    if (saved === "off") return null;
    // ASK-B1: draft b is the default floating surface on preview hosts.
    return saved === "a" || saved === "b" ? saved : "b";
  } catch {
    return askDraftFromLocation(host, search);
  }
}

export type SavedAskPosition = { to: AskDraftPosition; x?: number; y?: number; h?: number };

export function readAskPosition(draft: AskDraft, store: Store | null): SavedAskPosition {
  const fallback: SavedAskPosition = { to: draft === "a" ? "bottom_centre" : readAskHome(store) };
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
/** ASK-D2: an automatic pin sits 40 board pixels right of the picked cards, top aligned, clear of other cards. */
export function autoPinPoint(picked: Rect[] | { x: number; y: number; width: number; height: number }[], taken: { x: number; y: number; width: number; height: number }[]): { x: number; y: number } | null {
  const rects = picked.map((r) => ("w" in r ? { x: r.x, y: r.y, width: r.w, height: r.h } : r));
  if (rects.length === 0) return null;
  const right = Math.max(...rects.map((r) => r.x + r.width));
  const top = Math.min(...rects.map((r) => r.y));
  const anchor = { x: right + 40, y: top };
  const clear = taken.every((r) => anchor.x >= r.x + r.width || anchor.x + PLACEMENT_CARD.width <= r.x || anchor.y >= r.y + r.height || anchor.y + PLACEMENT_CARD.height <= r.y);
  return clear ? anchor : placeAddedCards(anchor, taken, 1)[0] ?? anchor;
}

/** ASK-D2: the smallest pan that brings a board point (and a card-sized box) into the visible canvas. */
export function revealPan(at: { x: number; y: number }, pan: { x: number; y: number }, zoom: number, view: { width: number; height: number }, card = { width: 280, height: 160 }, margin = 16): { x: number; y: number } | null {
  if (view.width <= 0 || view.height <= 0) return null;
  const sx = at.x * zoom + pan.x;
  const sy = at.y * zoom + pan.y;
  const w = card.width * zoom;
  const h = card.height * zoom;
  let dx = 0;
  let dy = 0;
  if (sx + w > view.width - margin) dx = view.width - margin - (sx + w);
  if (sx + dx < margin) dx = margin - sx;
  if (sy + h > view.height - margin) dy = view.height - margin - (sy + h);
  if (sy + dy < margin) dy = margin - sy;
  return dx === 0 && dy === 0 ? null : { x: pan.x + dx, y: pan.y + dy };
}

// ASK-D2 DRAFT PLUMBING ONLY. The node to chat link lives in this browser's
// storage so the founder can feel pinning. The real build needs a column on
// the node, and a decision about who may read the chat behind a pinned answer.
const PINS_KEY = "lasso.ask-draft.pins";

export function readAskPins(store: Store | null): Record<string, string> {
  try {
    const raw = store?.getItem(PINS_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : {};
    return parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function writeAskPin(nodeId: string, sessionId: string, store: Store | null): void {
  try {
    const pins = readAskPins(store);
    pins[nodeId] = sessionId;
    store?.setItem(PINS_KEY, JSON.stringify(pins));
  } catch { /* storage unavailable */ }
}

export function removeAskPin(nodeId: string, store: Store | null): void {
  try {
    const pins = readAskPins(store);
    delete pins[nodeId];
    store?.setItem(PINS_KEY, JSON.stringify(pins));
  } catch { /* storage unavailable */ }
}

// PIN-1: chats taken off the board, so the header and the past list can say "Was pinned". This browser only.
const UNPINNED_KEY = "lasso.ask-draft.unpinned";

export function readUnpinned(store: Store | null): Record<string, string> {
  try {
    const raw = store?.getItem(UNPINNED_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : {};
    return parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function writeUnpinned(sessionId: string, engagementId: string, store: Store | null): void {
  try {
    const unpinned = readUnpinned(store);
    unpinned[sessionId] = engagementId;
    store?.setItem(UNPINNED_KEY, JSON.stringify(unpinned));
  } catch { /* storage unavailable */ }
}

export function clearUnpinned(sessionId: string, store: Store | null): void {
  try {
    const unpinned = readUnpinned(store);
    delete unpinned[sessionId];
    store?.setItem(UNPINNED_KEY, JSON.stringify(unpinned));
  } catch { /* storage unavailable */ }
}

export const ASK_DRAFT_OPEN_SESSION_EVENT = "lasso:ask-draft-open-session";

/** SET-1: where a new Ask chat opens, per person, browser-local. */
export type AskHome = "bottom_right" | "bottom_centre" | "lock_left" | "lock_right";
export const ASK_HOMES: { id: AskHome; label: string }[] = [
  { id: "bottom_right", label: "Bottom right" },
  { id: "bottom_centre", label: "Bottom centre" },
  { id: "lock_left", label: "Locked left" },
  { id: "lock_right", label: "Locked right" },
];
const ASK_HOME_KEY = "lasso.ask-draft.home";

export function readAskHome(store: Store | null): AskHome {
  try {
    const raw = store?.getItem(ASK_HOME_KEY);
    return ASK_HOMES.some((home) => home.id === raw) ? (raw as AskHome) : "bottom_right";
  } catch {
    return "bottom_right";
  }
}

export function writeAskHome(home: AskHome, store: Store | null): void {
  try { store?.setItem(ASK_HOME_KEY, home); } catch { /* storage unavailable */ }
}
