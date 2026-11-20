// 19 Nov, Kestrel Bay demo story: the pure rules (who sees it, which window plays which beat, the one stored number)
// and the script file's own promises (a version, no product name, no em dash, nothing about pilots or pricing).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { FIRM_ASK_COPY } from "../firm-ask-shared";
import { FIRM_STORY_SCRIPT } from "../firm-story-script";
import {
  KESTREL_BAY_ORG_ID,
  STORY_BEATS,
  STORY_DONE,
  STORY_LAST_BEAT,
  FIRM_STORY_COPY,
  STORY_STORAGE_KEY,
  firstBeatFor,
  forgetOtherStoryBeats,
  invitedBySearch,
  isAtPlace,
  lastBeatFor,
  modeFromSearch,
  nextBeat,
  parseStoredBeat,
  placePath,
  previousBeat,
  readStoredBeat,
  storyAccess,
  storyView,
  storyStorageKey,
  storyWindowFor,
  withProduct,
  writeStoredBeat,
} from "../firm-story-shared";

const member = { orgId: KESTREL_BAY_ORG_ID, role: "em", isGuest: false, deactivated: false };

describe("who sees the story", () => {
  it("allows an active member of the demo firm and gives each role its window", () => {
    expect(storyAccess(member)).toEqual({ allowed: true, window: "lead" });
    expect(storyAccess({ ...member, role: "lead" })).toEqual({ allowed: true, window: "partner" });
    expect(storyAccess({ ...member, role: "admin" })).toEqual({ allowed: true, window: "partner" });
  });

  it("refuses every other workspace, guests, coaches, deactivated people and nobody", () => {
    expect(storyAccess({ ...member, orgId: "15db4d78-eed3-4443-b9ef-437a67ad1b79" })).toEqual({ allowed: false });
    expect(storyAccess({ ...member, orgId: null })).toEqual({ allowed: false });
    expect(storyAccess({ ...member, isGuest: true })).toEqual({ allowed: false });
    expect(storyAccess({ ...member, role: "coach" })).toEqual({ allowed: false });
    expect(storyAccess({ ...member, role: null })).toEqual({ allowed: false });
    expect(storyAccess({ ...member, deactivated: true })).toEqual({ allowed: false });
    expect(storyAccess(null)).toEqual({ allowed: false });
  });

  it("makes admins and leads the Partner and everyone else the Engagement lead", () => {
    expect(storyWindowFor("lead")).toBe("partner");
    expect(storyWindowFor("admin")).toBe("partner");
    expect(storyWindowFor("em")).toBe("lead");
    expect(storyWindowFor(undefined)).toBe("lead");
  });
});

describe("the script file", () => {
  it("has a whole-number version and beats 0 to 8 in order", () => {
    expect(Number.isInteger(FIRM_STORY_SCRIPT.version)).toBe(true);
    expect(STORY_BEATS.map((beat) => beat.n)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(STORY_LAST_BEAT).toBe(8);
    expect(STORY_DONE).toBe(9);
  });

  it("gives the two characters the beats the script says", () => {
    expect(STORY_BEATS.filter((beat) => beat.window === "lead").map((beat) => beat.n)).toEqual([4, 6]);
    expect(STORY_BEATS.filter((beat) => beat.youAre === "Partner").map((beat) => beat.n)).toEqual([1, 2, 3, 5, 7]);
    expect(STORY_BEATS.filter((beat) => beat.youAre === "Engagement lead").map((beat) => beat.n)).toEqual([4, 6]);
  });

  it("asks the same question in beats 1 and 7", () => {
    expect(STORY_BEATS[1]?.ask).toBeTruthy();
    expect(STORY_BEATS[7]?.ask).toBe(STORY_BEATS[1]?.ask);
  });

  it("gives every beat a caption, presenter notes and a viewer question", () => {
    for (const beat of STORY_BEATS) {
      expect(beat.caption.length, `beat ${beat.n} caption`).toBeGreaterThan(10);
      expect(beat.notes.length, `beat ${beat.n} notes`).toBeGreaterThan(10);
      expect(beat.question.endsWith("?"), `beat ${beat.n} question`).toBe(true);
      expect(beat.caption.length, `beat ${beat.n}: the self-guided caption is the short one`).toBeLessThanOrEqual(beat.notes.length + beat.question.length);
    }
  });

  it("never names the product, uses an em dash, or mentions pilots, pricing or next steps", () => {
    const words = JSON.stringify(FIRM_STORY_SCRIPT);
    expect(words).not.toMatch(/Charlotte|Lasso/);
    expect(words).not.toMatch(/—|–/);
    expect(words).not.toMatch(/\bpilots?\b|\bpricing plan|\bnext steps?\b|\bsign up\b|\bbook a\b|\bfree trial\b/i);
    expect(words).toContain("{product}");
    expect(words).toContain("fictional");
  });

  it("fills the product name from the brand", () => {
    expect(withProduct("Work arrives in {product}. {product} keeps it.", "Lasso")).toBe("Work arrives in Lasso. Lasso keeps it.");
    for (const beat of STORY_BEATS) expect(withProduct(`${beat.caption} ${beat.notes}`, "X")).not.toContain("{product}");
  });
});

describe("which window plays which beat", () => {
  it("starts the Partner on the title card and the Engagement lead on the handoff beat", () => {
    expect(firstBeatFor("partner")).toBe(0);
    expect(firstBeatFor("lead")).toBe(4);
    expect(lastBeatFor("partner")).toBe(8);
    expect(lastBeatFor("lead")).toBe(6);
  });

  it("shows a beat in its own window and a handoff in the other", () => {
    expect(storyView("partner", null)).toEqual({ kind: "idle" });
    expect(storyView("partner", 0)).toMatchObject({ kind: "beat", isFirst: true, isLast: false });
    expect(storyView("partner", 8)).toMatchObject({ kind: "beat", isLast: true });
    expect(storyView("partner", 4)).toMatchObject({ kind: "handoff", resumeAt: 5 });
    expect(storyView("partner", 6)).toMatchObject({ kind: "handoff", resumeAt: 7 });
    expect(storyView("lead", 4)).toMatchObject({ kind: "beat", isFirst: true });
    expect(storyView("lead", 5)).toMatchObject({ kind: "handoff", resumeAt: 6 });
    expect(storyView("lead", 7)).toMatchObject({ kind: "handoff", resumeAt: null });
    expect(storyView("partner", STORY_DONE)).toEqual({ kind: "done" });
  });

  it("walks the Partner through every beat with two handoffs and ends on done", () => {
    const seen: string[] = [];
    let at = firstBeatFor("partner");
    for (let guard = 0; guard < 30; guard += 1) {
      const view = storyView("partner", at);
      seen.push(view.kind === "beat" ? `b${view.beat.n}` : view.kind === "handoff" ? `h${view.to.n}` : view.kind);
      if (view.kind === "done") break;
      at = view.kind === "handoff" && view.resumeAt !== null ? view.resumeAt : nextBeat(at);
    }
    expect(seen).toEqual(["b0", "b1", "b2", "b3", "h4", "b5", "h6", "b7", "b8", "done"]);
  });

  it("goes back only to beats this window plays, and never past its first", () => {
    expect(previousBeat("partner", 5)).toBe(3);
    expect(previousBeat("partner", 0)).toBe(0);
    expect(previousBeat("lead", 6)).toBe(4);
    expect(previousBeat("lead", 4)).toBe(4);
    expect(nextBeat(8)).toBe(STORY_DONE);
    expect(nextBeat(STORY_DONE)).toBe(STORY_DONE);
  });

  it("knows where each beat happens", () => {
    expect(placePath("home")).toBe("/home");
    expect(placePath("firm")).toBe("/firm");
    expect(placePath("board")).toMatch(/^\/engagements\/[0-9a-f-]{36}\/canvas-lab$/);
    expect(placePath(null)).toBeNull();
    expect(isAtPlace("home", "/home")).toBe(true);
    expect(isAtPlace("home", "/firm")).toBe(false);
    expect(isAtPlace("home", "/homework")).toBe(false);
    expect(isAtPlace(null, "/anything")).toBe(true);
  });

  it("reads presenter mode only from tour=presenter", () => {
    expect(modeFromSearch("?tour=presenter")).toBe("presenter");
    expect(modeFromSearch("?tour=PRESENTER")).toBe("self");
    expect(modeFromSearch("?tour=1")).toBe("self");
    expect(modeFromSearch("")).toBe("self");
  });
});

describe("the one stored value", () => {
  function fakeStore(initial: Record<string, string> = {}) {
    const data = new Map(Object.entries(initial));
    return {
      data,
      get length() {
        return data.size;
      },
      key: (index: number) => [...data.keys()][index] ?? null,
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => void data.set(key, value),
      removeItem: (key: string) => void data.delete(key),
    };
  }
  const mine = `${STORY_STORAGE_KEY}.p1`;

  it("accepts only a beat number", () => {
    expect(parseStoredBeat("0")).toBe(0);
    expect(parseStoredBeat("9")).toBe(9);
    for (const junk of [null, undefined, "", "10", "-1", "1.5", "4 ", "presenter", "{\"beat\":4}", "0x4", "999999999999"]) {
      expect(parseStoredBeat(junk), String(junk)).toBeNull();
    }
  });

  it("names the person in the key and nothing else, and refuses an id that is not safe in a key", () => {
    expect(storyStorageKey("p1")).toBe(mine);
    expect(storyStorageKey("cc538a6b-3a0a-4dcc-b200-23fc1dced467")).toBe(`${STORY_STORAGE_KEY}.cc538a6b-3a0a-4dcc-b200-23fc1dced467`);
    for (const bad of [null, undefined, "", "a b", "a.b", "<script>", "x".repeat(65)]) expect(storyStorageKey(bad), String(bad)).toBeNull();
  });

  it("stores the beat as digits under this person's key, and removes it", () => {
    const store = fakeStore();
    writeStoredBeat("p1", 5, store);
    expect([...store.data.entries()]).toEqual([[mine, "5"]]);
    expect(readStoredBeat("p1", store)).toBe(5);
    writeStoredBeat("p1", null, store);
    expect(store.data.size).toBe(0);
  });

  it("never returns another person's beat, and removes it and the first build's bare key", () => {
    const store = fakeStore({ [`${STORY_STORAGE_KEY}.other`]: "5", [STORY_STORAGE_KEY]: "3", "lasso.active_profile_id": "keep", "lasso.firm-story.beat.v10": "keep" });
    expect(readStoredBeat("p1", store)).toBeNull();
    expect(store.data.size).toBe(4); // reading changes nothing
    forgetOtherStoryBeats("p1", store);
    expect([...store.data.keys()].sort()).toEqual(["lasso.active_profile_id", "lasso.firm-story.beat.v10"]);
  });

  it("forgets every story beat when the person's id cannot be a key, and survives blocked storage", () => {
    const store = fakeStore({ [mine]: "6", [STORY_STORAGE_KEY]: "3", other: "keep" });
    forgetOtherStoryBeats("a b", store);
    expect([...store.data.keys()]).toEqual(["other"]);
    const blocked = { length: 1, key: () => { throw new Error("blocked"); }, getItem: () => null, setItem: () => undefined, removeItem: () => undefined };
    expect(() => forgetOtherStoryBeats("p1", blocked)).not.toThrow();
    expect(() => forgetOtherStoryBeats("p1", null)).not.toThrow();
  });

  it("keeps this person's own beat while clearing the others", () => {
    const store = fakeStore({ [mine]: "6", [`${STORY_STORAGE_KEY}.other`]: "2" });
    forgetOtherStoryBeats("p1", store);
    expect(readStoredBeat("p1", store)).toBe(6);
    expect([...store.data.keys()]).toEqual([mine]);
  });

  it("reads and writes nothing without a usable profile id", () => {
    const store = fakeStore({ [mine]: "6" });
    expect(readStoredBeat(null, store)).toBeNull();
    writeStoredBeat("a b", 3, store);
    expect([...store.data.entries()]).toEqual([[mine, "6"]]);
  });

  it("treats blocked or tampered storage as not started, without throwing", () => {
    const blocked = {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); },
      removeItem: () => { throw new Error("blocked"); },
    };
    expect(readStoredBeat("p1", blocked)).toBeNull();
    expect(() => writeStoredBeat("p1", 3, blocked)).not.toThrow();
    expect(() => writeStoredBeat("p1", null, blocked)).not.toThrow();
    expect(readStoredBeat("p1", fakeStore({ [mine]: "<script>" }))).toBeNull();
    expect(readStoredBeat("p1", null)).toBeNull();
  });
});

describe("the tour link", () => {
  it("is ?tour with any value or none, and nothing else", () => {
    for (const yes of ["?tour", "?tour=", "?tour=1", "?tour=presenter", "?brand=charlotte&tour=x"]) expect(invitedBySearch(yes), yes).toBe(true);
    for (const no of ["", "?", "?detour=1", "?tourist=1", "?Tour=1", "?q=tour", "#tour"]) expect(invitedBySearch(no), no).toBe(false);
  });
});

describe("the words the story borrows from the product", () => {
  // Presenter notes tell a person to press controls by name. If a control is renamed, its note must change too.
  const NAMED_CONTROLS: Record<string, string> = {
    "Ask the firm": "src/lib/firm-ask-shared.ts",
    "What it read": "src/lib/firm-ask-shared.ts",
    "What we charged": "src/lib/firm-ask-shared.ts",
    "More tools": "src/components/canvas-lab/BoardToolbarSurface.tsx",
    "Start a proposal": "src/lib/proposal-shared.ts",
    "Red pen": "src/lib/red-pen-shared.ts",
    "Share with firm": "src/lib/firm-share-copy.ts",
  };

  it("takes the Ask the firm label from the product's own copy", () => {
    expect(FIRM_STORY_COPY.askThis).toBe(FIRM_ASK_COPY.title);
    expect(readFileSync("src/lib/firm-story-shared.ts", "utf8")).toContain("askThis: FIRM_ASK_COPY.title");
  });

  it("names only controls that still carry that label in the product", () => {
    const notes = STORY_BEATS.map((beat) => beat.notes).join(" ");
    for (const [label, file] of Object.entries(NAMED_CONTROLS)) {
      expect(notes, `the notes no longer name "${label}": drop it from this list`).toContain(label);
      expect(readFileSync(file, "utf8"), `"${label}" is no longer in ${file}: the control was renamed, so fix the script`).toContain(`"${label}"`);
    }
  });

  it("lists every control the notes tell the presenter to open, use, run or turn on", () => {
    const told = [...STORY_BEATS.map((beat) => beat.notes).join(" ").matchAll(/(?:Open|Use|Run|turn on|into|then) ((?:[A-Z][a-z]+)(?: [a-z]+){0,3}?)(?= in | on |[.:,]| and )/g)].map((match) => match[1]!);
    const listed = Object.keys(NAMED_CONTROLS);
    const unlisted = told.filter((label) => !listed.includes(label) && !["Share", "Then"].includes(label));
    expect(unlisted).toEqual([]);
  });
});

describe("the server function", () => {
  it("is signed-in only: the auth middleware is on it", () => {
    const source = readFileSync("src/lib/firm-story.functions.ts", "utf8").replace(/\s+/g, " ");
    expect(source).toMatch(/export const firmStoryAccessFn = createServerFn\(\{ method: "POST" \}\) \.middleware\(\[requireSupabaseAuth\]\)/);
    expect(source).toContain('import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware"');
  });
});

describe("where the story's events and storage live", () => {
  function sources(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return name === "__tests__" || name === "node_modules" ? [] : sources(path);
      return /\.(ts|tsx)$/.test(name) && !/\.test\./.test(name) ? [path] : [];
    });
  }
  const files = sources("src").map((path) => ({ path, text: readFileSync(path, "utf8") }));

  it("emits firm_story events only from FirmStory, and FirmStory emits no tour.* event", () => {
    const emitters = files.filter((file) => /logEvent\(|emit\(/.test(file.text) && /"firm_story\./.test(file.text)).map((file) => file.path);
    expect(emitters).toEqual(["src/components/firm-story/FirmStory.tsx"]);
    const story = files.filter((file) => file.path.includes("firm-story"));
    expect(story.length).toBeGreaterThanOrEqual(6);
    for (const file of story) expect(file.text, file.path).not.toMatch(/"tour\.[a-z_]+"/);
  });

  it("keeps the story out of local storage and writes session storage only through the one guarded helper", () => {
    for (const file of files.filter((entry) => entry.path.includes("firm-story"))) {
      expect(file.text, file.path).not.toMatch(/localStorage/);
      if (!file.path.endsWith("firm-story-shared.ts")) expect(file.text, file.path).not.toMatch(/sessionStorage/);
    }
  });

  it("makes no Supabase write anywhere in the story, and uses the admin client only to read for the spend cap", () => {
    for (const file of files.filter((entry) => entry.path.includes("firm-story"))) {
      expect(file.text, file.path).not.toMatch(/\.(insert|update|upsert|delete)\(|\.rpc\(/);
      // Part 2: the tour logins' cap reads a sign-in email and the usage ledger, which only the admin client can.
      if (!file.path.endsWith("firm-story-cap.server.ts")) expect(file.text, file.path).not.toMatch(/supabaseAdmin/);
    }
  });
});
