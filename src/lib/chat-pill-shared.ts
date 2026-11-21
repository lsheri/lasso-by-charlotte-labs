/**
 * 20 Nov 2026, chat pill PR 1a (Liam, D-97: "that is what I want to be real. that is perfect"). The pure rules of the
 * chat pill: one element, on every signed-in page, that morphs from a small pill into a helper panel and, dragged on,
 * into a full screen chat. The prototype is https://claude.ai/artifact/6jSZqC7hHZnzV8HSGVxcsQ (version 2); the numbers
 * here are its numbers.
 *
 * Nothing here reads a fee, a person's words or anything about a person. Question words never go to analytics.
 */

import { focusBlurAt } from "./focus-blur-shared";
import {
  canAskTheFirm,
  FIRM_ASK_QUESTION_MAX,
  FIRM_ASK_STARTER_COPY,
  startersFor,
  type FirmAskStarter,
} from "./firm-ask-shared";

/** Shut (the pill), open (the helper panel) and full (a full screen chat). A drag moves through them in this order. */
export const PILL_MODES = ["shut", "open", "full"] as const;
export type PillMode = (typeof PILL_MODES)[number];

/** 21 Nov 2026, click path cards: the one way into the chat from a step card ("Ask Lasso about this"). */
export const PILL_OPEN_EVENT = "lasso:chat-pill-open";

/**
 * Where a step card sent the person from: the step's name, as the card shows it, and the way back to that step. Only
 * the step's own title travels; nothing typed on the card goes into the chat.
 */
export type PillCardContext = { label: string; reopen: () => void };

/**
 * Opens the chat pill, as if it were pressed. From a step card it carries the step it came from, so the chat can
 * offer the way back. The card has already closed (keeping what was typed), so the chat is fully usable.
 */
export function openChatPill(context?: PillCardContext): void {
  globalThis.window?.dispatchEvent(new CustomEvent<PillCardContext | null>(PILL_OPEN_EVENT, { detail: context ?? null }));
}

/** The line a step card leaves in the chat, and its way back. */
export const PILL_CARD_COPY = {
  from: (label: string) => `You came from ${label}. What you typed there is kept.`,
  back: "Back to the card",
} as const;

/** One morph, open or shut, in ms. */
export const PILL_MORPH_MS = 600;
/** The panel's own fade follows the morph by this much, so the shape leads and the words follow. */
export const PILL_PANEL_DELAY_MS = 180;
/** A line the chat says before it tucks itself away is held this long, so it can be read (Liam: captions 1.5 to 1.8s). */
export const PILL_NOTE_HOLD_MS = 1500;
/** A drag starts after this many pixels, so a tap is still a tap. */
export const PILL_DRAG_SLOP = 7;
/** How far a flick carries: velocity (progress per ms) times this many ms. */
export const PILL_FLICK_MS = 180;
/** Phones get the bottom sheet and the full screen chat edge to edge. */
export const PILL_PHONE_MAX = 767;

export type Viewport = {
  width: number;
  height: number;
  phone: boolean;
  /** The menu rail's width on a laptop: the full screen chat leaves it in view. */
  railWidth: number;
  /** The shut pill's natural width, measured from its label. */
  shutWidth: number;
  /** Space kept clear at the bottom of a phone for the tab bar. */
  bottomClear: number;
};

export type PillGeometry = {
  left: number;
  top: number;
  width: number;
  height: number;
  radius: string;
};

/* Sizes in px, as the prototype draws them. */
const PILL_HEIGHT = 44;
const OPEN_WIDTH = 420;
const OPEN_HEIGHT = 700;
const EDGE = 24;
const PHONE_EDGE = 16;
const FULL_EDGE = 16;
const PHONE_SHEET_SHARE = 0.86;

/** Where and how big the pill is in each mode. */
export function pillGeometry(mode: PillMode, vp: Viewport): PillGeometry {
  const { width: W, height: H } = vp;
  if (mode === "full") {
    if (vp.phone) return { left: 0, top: 0, width: W, height: H, radius: "0px" };
    return {
      left: vp.railWidth + FULL_EDGE,
      top: FULL_EDGE,
      width: Math.max(0, W - vp.railWidth - FULL_EDGE * 2),
      height: Math.max(0, H - FULL_EDGE * 2),
      radius: "18px",
    };
  }
  if (mode === "open") {
    if (vp.phone) {
      const h = Math.round(H * PHONE_SHEET_SHARE);
      return { left: 0, top: H - h, width: W, height: h, radius: "20px 20px 0 0" };
    }
    const w = Math.min(OPEN_WIDTH, W - EDGE * 2);
    const h = Math.min(OPEN_HEIGHT, H - EDGE * 2);
    return { left: W - w - EDGE, top: H - h - EDGE, width: w, height: h, radius: "18px" };
  }
  const w = Math.max(120, Math.round(vp.shutWidth));
  if (vp.phone)
    return {
      left: Math.round((W - w) / 2),
      top: H - PILL_HEIGHT - PHONE_EDGE - vp.bottomClear,
      width: w,
      height: PILL_HEIGHT,
      radius: "22px",
    };
  return {
    left: W - w - EDGE,
    top: H - PILL_HEIGHT - EDGE,
    width: w,
    height: PILL_HEIGHT,
    radius: "22px",
  };
}

const clamp = (value: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, value));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** A radius written as one to four lengths, as four numbers. */
export function corners(radius: string): [number, number, number, number] {
  const parts = String(radius)
    .trim()
    .split(/\s+/)
    .map((part) => Number.parseFloat(part))
    .map((n) => (Number.isFinite(n) ? n : 0));
  const a = parts[0] ?? 0;
  const b = parts[1] ?? a;
  const c = parts[2] ?? a;
  const d = parts[3] ?? b;
  return [a, b, c, d];
}

/**
 * The shape at a point of a drag: progress 0 is the pill, 1 the panel, 2 the full screen chat. Between two modes,
 * every edge and every corner moves together, so the pill becomes the panel as one object.
 */
export function geometryAt(progress: number, vp: Viewport): PillGeometry {
  const shapes = PILL_MODES.map((mode) => pillGeometry(mode, vp));
  const p = clamp(progress, 0, 2);
  const i = p < 1 ? 0 : 1;
  const t = clamp(p - i, 0, 1);
  const a = shapes[i]!;
  const b = shapes[i + 1]!;
  const ca = corners(a.radius);
  const cb = corners(b.radius);
  return {
    left: lerp(a.left, b.left, t),
    top: lerp(a.top, b.top, t),
    width: lerp(a.width, b.width, t),
    height: lerp(a.height, b.height, t),
    radius: ca.map((c, k) => `${lerp(c, cb[k]!, t).toFixed(1)}px`).join(" "),
  };
}

/** The progress a height stands for, so a drag follows the finger exactly. */
export function progressForHeight(height: number, vp: Viewport): number {
  const [shut, open, full] = PILL_MODES.map((mode) => pillGeometry(mode, vp).height) as [
    number,
    number,
    number,
  ];
  if (height <= open) return clamp((height - shut) / Math.max(1, open - shut), 0, 1);
  return clamp(1 + (height - open) / Math.max(1, full - open), 1, 2);
}

/**
 * How far a drag has pulled, in px of height. Up grows it; on a laptop, pulling it out to the left grows it too,
 * a little faster, because the panel is wider than it is tall.
 */
export function dragPull(dx: number, dy: number, phone: boolean): number {
  if (phone) return -dy;
  return Math.abs(dx) > Math.abs(dy) && dx < 0 ? -dx * 1.3 : -dy;
}

/** Where a drag settles when the finger lifts: the nearest mode after a flick carries it on. */
export function settleMode(progress: number, velocityPerMs: number): PillMode {
  const index = Math.round(clamp(progress + velocityPerMs * PILL_FLICK_MS, 0, 2));
  return PILL_MODES[index]!;
}

/**
 * How the page behind trails the drag into the full screen chat: the shared focus blur (focus-blur-shared.ts),
 * scrubbed with the drag. 21 Nov 2026: harder, so nothing behind can be read (26px, a 58 percent wash, 25 percent
 * less colour), as in the prototype's v9.
 */
export function behindAt(amount: number): { filter: string; opacity: number; transform: string } {
  return focusBlurAt(clamp(amount, 0, 1));
}

/* ---------------------------------------------------------------------------------------------------------------
 * Where the person is, and what the pill offers there
 * ------------------------------------------------------------------------------------------------------------- */

export type PillPlace = "home" | "proposals" | "firm" | "board" | "work" | "other";

/** The page, read from the path. */
export function pillPlace(pathname: string): PillPlace {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/home" || path === "/") return "home";
  if (path.startsWith("/proposals")) return "proposals";
  if (path.startsWith("/firm-brain")) return "firm";
  if (/^\/engagements\/[^/]+/.test(path)) return "board";
  if (path.startsWith("/work")) return "work";
  return "other";
}

const PLACE_NAMES: Record<PillPlace, string> = {
  home: "Home",
  proposals: "Proposals",
  firm: "Firm brain",
  board: "this board",
  work: "All work",
  other: "",
};

/** What the pill can do for this person. "firm": ask the firm. "none": a coach, a guest, or not a company workspace. */
export function pillAccess(
  profile:
    | {
        role?: string | null;
        is_guest?: boolean | null;
        has_firm_view?: boolean | null;
        org_type?: string | null;
      }
    | null
    | undefined,
): "firm" | "none" {
  if (!profile || profile.is_guest === true) return "none";
  return canAskTheFirm(profile) ? "firm" : "none";
}

export const PILL_COPY = {
  /** The pill's own label is the brand's Ask label ("Ask Lasso"), from the brand module, never typed here. */
  open: (brand: string) => `Open the ${brand} helper`,
  panel: (brand: string) => `${brand} helper`,
  close: "Tuck the chat away",
  grow: "Make the chat full screen",
  shrink: "Make the chat smaller",
  dragHint: "Drag up to make the chat bigger, down to tuck it away",
  where: (place: PillPlace) => (place === "other" ? "" : `On ${PLACE_NAMES[place]}`),
  hello: (first: string) => (first ? `Hi ${first}.` : "Hi."),
  welcomeFirm:
    "I can see what you're looking at. Ask the firm anything: I'll look across the past work shared with the firm, with a source for every line.",
  welcomeBoard:
    "I can see what you're looking at. On a board, I answer from that board's own work.",
  welcomeNone: "Open a board and I'll answer from its work.",
  openBoardChat: "Ask about this board",
  placeholder: "Ask the firm anything",
  /** 20 Nov 2026, PR 3b: where a brief can be pasted too. */
  placeholderBrief: "Ask, or paste a brief",
  label: "Question for the firm",
  send: "Ask",
  footer: "Question words never go to analytics.",
  /** Said in the chat as the question goes to the Firm brain canvas. */
  /** Said above an answer as it builds. */
  looking:
    "Looking across the past work shared with the firm. Each line links to the engagement it came from.",
  openOnCanvas: "Open on the canvas",
  /** The toast as an answer lands on the canvas (the prototype's words). */
  movedToCorner: "We moved the chat to the corner so you can see the threads.",
  tooShort: "Ask a little more, so there is something to look for.",
  failed: "That did not go through. Nothing was asked. Try again in a moment.",
} as const;

/** The question as it can be sent: trimmed, at least three letters, and cut at the firm's own question limit. */
export function pillQuestion(text: string, max: number): string | null {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length < 3) return null;
  return clean.slice(0, max);
}

/** How long a card flies, by distance: the prototype's 600 to 1200ms, a little longer the further it goes. */
export function flightMs(distancePx: number): number {
  return clamp(Math.abs(distancePx) / 0.85, 600, 1200);
}

export type PillStarter = { text: string; starter: FirmAskStarter };

/**
 * The pill's starters: Ask the firm's own starters for this role ("What we charged" for admins and leads only), made
 * from the person's latest board, each carrying its starter key (QA L4 of PR 290). None without a board.
 */
export function pillStarters(
  role: string | null | undefined,
  recentBoard: string | null | undefined,
): PillStarter[] {
  const board = (recentBoard ?? "").trim();
  if (!board) return [];
  return startersFor(role).map((starter) => ({
    text: `${FIRM_ASK_STARTER_COPY[starter].stem}${board}?`.slice(0, FIRM_ASK_QUESTION_MAX),
    starter,
  }));
}
