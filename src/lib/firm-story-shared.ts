/**
 * The Kestrel Bay demo story (19 Nov 2026): the pure rules behind the guided story that runs over the real signed-in
 * surfaces of the demo firm. Words live in firm-story-script.ts; this file decides who sees the story, which window
 * plays which beat, and how a beat number is kept.
 *
 * The story writes no product rows. The only thing kept is the beat number, in session storage, under a key that
 * names the profile so the next person to sign in on the same tab starts clean. Presenter or self-guided, and
 * "exploring on my own", live in memory and are gone on reload.
 *
 * The entry is opt-in: nobody sees a start button unless the address carries `?tour` or they already started in
 * this tab, so an ordinary demo of the firm shows no trace of the story.
 *
 * Two characters, two browser windows: the Partner's and the Engagement lead's, each signed in as its own person.
 * There is no "switch person" control. When the next beat belongs to the other window, this window shows a handoff
 * card and waits there until the presenter comes back.
 */

import { FIRM_ASK_COPY } from "./firm-ask-shared";
import { FIRM_STORY_SCRIPT, type StoryBeat, type StoryPlace, type StoryWindow } from "./firm-story-script";

/** The demo firm's workspace. The story exists nowhere else; the server checks this, the browser only mirrors it. */
export const KESTREL_BAY_ORG_ID = "2fd479d1-64da-4971-993b-279bed821179";

/** The proposal board the story is told on. */
export const STORY_BOARD_ID = "4a4abc70-32af-4cdb-8772-3850f9d673bc";

export const STORY_MODES = ["self", "presenter"] as const;
export type StoryMode = (typeof STORY_MODES)[number];

export const STORY_REACTIONS = ["this_is_us", "not_a_problem"] as const;
export type StoryReaction = (typeof STORY_REACTIONS)[number];

export const FIRM_STORY_COPY = {
  start: "Start the tour",
  resume: "Resume tour",
  explore: "Explore on my own",
  end: "End tour",
  close: "Close",
  next: "Next",
  back: "Back",
  finish: "Finish",
  youAre: "You are",
  presenterNotes: "Presenter notes",
  askViewer: "Ask the viewer",
  say: "Say and do",
  /** The product's own name for the surface, so this label cannot drift from it. */
  askThis: FIRM_ASK_COPY.title,
  reactions: { this_is_us: "This is us", not_a_problem: "Not a problem for us" } satisfies Record<StoryReaction, string>,
  reactionsLabel: "How close is this to your firm?",
  beatOf: (n: number, last: number) => `Beat ${n} of ${last}`,
  handoffTitle: (who: string) => `Hand over to the ${who}`,
  handoffBody: (who: string) => `The next part happens in the other browser window, signed in as the ${who}. Come back to this window when it is done.`,
  handoffBack: "Back in this window: continue",
  otherWindowDone: "The rest of the tour happens in the other browser window.",
  open: { home: "Open Home", firm: "Open the firm view", board: "Open the proposal board" } satisfies Record<StoryPlace, string>,
  label: "Guided tour of the demo firm",
} as const;

export const STORY_BEATS: readonly StoryBeat[] = FIRM_STORY_SCRIPT.beats;
export const STORY_LAST_BEAT = STORY_BEATS.length - 1;
/** One past the last beat: the closing line has been shown and the story has stopped talking. */
export const STORY_DONE = STORY_BEATS.length;

/** Which window a person plays: admins and leads are the Partner, everyone else the Engagement lead. */
export function storyWindowFor(role: string | null | undefined): StoryWindow {
  return role === "admin" || role === "lead" ? "partner" : "lead";
}

export type StoryAccess = { allowed: false } | { allowed: true; window: StoryWindow };

/**
 * Who sees the story: an active member of the Kestrel Bay workspace who is not a coach or a guest. Everyone else,
 * in every other workspace, gets `allowed: false` and no hint that the story exists.
 */
export function storyAccess(person: { orgId: string | null | undefined; role: string | null | undefined; isGuest: boolean; deactivated: boolean } | null): StoryAccess {
  if (!person || person.orgId !== KESTREL_BAY_ORG_ID) return { allowed: false };
  if (person.isGuest || person.deactivated || !person.role || person.role === "coach") return { allowed: false };
  return { allowed: true, window: storyWindowFor(person.role) };
}

export function beatAt(n: number): StoryBeat | null {
  return STORY_BEATS[n] ?? null;
}

/** The first beat this window plays: the title card for the Partner, the handoff beat for the Engagement lead. */
export function firstBeatFor(window: StoryWindow): number {
  return STORY_BEATS.find((beat) => beat.window === window)?.n ?? 0;
}

/** The last beat this window plays. */
export function lastBeatFor(window: StoryWindow): number {
  return [...STORY_BEATS].reverse().find((beat) => beat.window === window)?.n ?? STORY_LAST_BEAT;
}

/** A stored value as a beat number this window may sit on, or null when it is anything else. */
export function parseStoredBeat(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined || !/^\d{1,2}$/.test(raw)) return null;
  const n = Number(raw);
  return n >= 0 && n <= STORY_DONE ? n : null;
}

export type StoryView =
  /** Not started in this window. */
  | { kind: "idle" }
  /** A beat this window plays. */
  | { kind: "beat"; beat: StoryBeat; isFirst: boolean; isLast: boolean }
  /** The beat belongs to the other window: wait here, then continue with `resumeAt`, or stop when there is none. */
  | { kind: "handoff"; to: StoryBeat; resumeAt: number | null }
  /** The closing line was shown; the story has stopped talking. */
  | { kind: "done" };

/** What this window shows for a stored beat number. */
export function storyView(window: StoryWindow, stored: number | null): StoryView {
  if (stored === null) return { kind: "idle" };
  if (stored >= STORY_DONE) return { kind: "done" };
  const beat = beatAt(stored);
  if (!beat) return { kind: "idle" };
  if (beat.window === window) {
    return { kind: "beat", beat, isFirst: beat.n === firstBeatFor(window), isLast: beat.n === STORY_LAST_BEAT };
  }
  const resume = STORY_BEATS.find((candidate) => candidate.n > beat.n && candidate.window === window);
  return { kind: "handoff", to: beat, resumeAt: resume?.n ?? null };
}

/** The number to store after Next. The beat after the last one is "done". */
export function nextBeat(current: number): number {
  return Math.min(current + 1, STORY_DONE);
}

/** The number to store after Back: the previous beat this window plays, or the same beat when there is none. */
export function previousBeat(window: StoryWindow, current: number): number {
  const before = [...STORY_BEATS].reverse().find((beat) => beat.n < current && beat.window === window);
  return before?.n ?? current;
}

/** Where a beat happens, as a path, or null for a card with no product screen. */
export function placePath(place: StoryPlace | null): string | null {
  if (place === "home") return "/home";
  if (place === "firm") return "/firm";
  if (place === "board") return `/engagements/${STORY_BOARD_ID}/canvas-lab`;
  return null;
}

/** Whether the person is already where the beat happens. */
export function isAtPlace(place: StoryPlace | null, pathname: string): boolean {
  const path = placePath(place);
  if (!path) return true;
  return pathname === path || pathname.startsWith(`${path}/`);
}

/** The script's words with the product's name filled in from the current brand. */
export function withProduct(text: string, product: string): string {
  return text.replaceAll("{product}", product);
}

/** The tour link: the address carries `?tour`, with any value or none. Nothing else in the address counts. */
export function invitedBySearch(search: string): boolean {
  try {
    return new URLSearchParams(search).has("tour");
  } catch {
    return false;
  }
}

/** Presenter mode from the address bar: `?tour=presenter`. Anything else is self-guided. */
export function modeFromSearch(search: string): StoryMode {
  try {
    return new URLSearchParams(search).get("tour") === "presenter" ? "presenter" : "self";
  } catch {
    return "self";
  }
}

/* ---------- the one stored value ---------- */

/** The stem of every key the story has ever used. The bare stem was the key of the first build. */
export const STORY_STORAGE_KEY = "lasso.firm-story.beat.v1";

type BeatStore = Pick<Storage, "getItem" | "setItem" | "removeItem"> & Partial<Pick<Storage, "length" | "key">>;

/** This person's key, or null when the profile id is not something safe to put in a key. */
export function storyStorageKey(profileId: string | null | undefined): string | null {
  return profileId && /^[A-Za-z0-9-]{1,64}$/.test(profileId) ? `${STORY_STORAGE_KEY}.${profileId}` : null;
}

function store(): BeatStore | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

/** Removes every story key that is not this person's, so a beat never waits in the tab for someone else. */
function forgetOtherPeople(own: string, storage: BeatStore): void {
  if (typeof storage.length !== "number" || typeof storage.key !== "function") return;
  const stale: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key && key !== own && (key === STORY_STORAGE_KEY || key.startsWith(`${STORY_STORAGE_KEY}.`))) stale.push(key);
  }
  for (const key of stale) storage.removeItem(key);
}

/**
 * Forgets every story beat in this tab that is not this person's. Called for whoever is signed in, in any workspace,
 * so a demo person's beat never waits in the tab for the next person. With no profile it forgets them all.
 */
export function forgetOtherStoryBeats(profileId: string | null | undefined, storage: BeatStore | null = store()): void {
  if (!storage) return;
  try {
    forgetOtherPeople(storyStorageKey(profileId) ?? "", storage);
  } catch {
    // Storage is blocked. There is nothing to forget.
  }
}

/**
 * This person's stored beat, or null. Blocked or broken storage reads as "not started". The key names the person, so
 * a beat left by someone else on the same tab is never returned. Reading changes nothing.
 */
export function readStoredBeat(profileId: string | null | undefined, storage: BeatStore | null = store()): number | null {
  const key = storyStorageKey(profileId);
  if (!key || !storage) return null;
  try {
    return parseStoredBeat(storage.getItem(key));
  } catch {
    return null;
  }
}

/** Keeps the beat number and nothing else; null forgets it. A failed write is not the person's problem. */
export function writeStoredBeat(profileId: string | null | undefined, beat: number | null, storage: BeatStore | null = store()): void {
  const key = storyStorageKey(profileId);
  if (!key || !storage) return;
  try {
    if (beat === null) storage.removeItem(key);
    else storage.setItem(key, String(beat));
  } catch {
    // Storage is blocked. The story still works for this page.
  }
}
