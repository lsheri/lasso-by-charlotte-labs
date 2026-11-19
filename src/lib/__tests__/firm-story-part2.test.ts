// 19 Nov, Kestrel Bay demo story, part 2: recorded answers (server-gated) and the tour logins' daily spend cap.
import { readFileSync } from "node:fs";

import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ resolveProfile: vi.fn() }));
vi.mock("@/lib/profile-resolve", () => ({ resolveProfile: (...a: unknown[]) => m.resolveProfile(...a) }));

import { EVENT_DIM_KEYS } from "../event-dim-allowlist";
import {
  TOUR_CAP_MESSAGE,
  TOUR_DAILY_CAP_USD,
  TOUR_LOGIN_EMAILS,
  TourCapReached,
  assertWithinTourCap,
  isTourLoginEmail,
  overCap,
  startOfUtcDay,
  type TourCapDeps,
} from "../firm-story-cap.server";
import { FIRM_STORY_RECORDINGS, recordingFor } from "../firm-story-recordings.server";
import { FIRM_STORY_SCRIPT } from "../firm-story-script";
import { KESTREL_BAY_ORG_ID, STORY_BEATS, STORY_RECORDED_BEATS, hasRecording } from "../firm-story-shared";
import { firmStoryRecordingCall } from "../firm-story.server";

function db(row: { is_guest: boolean; deactivated_at: string | null } | null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: row, error: null });
  const from = vi.fn(() => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }));
  return { supabase: { from } as never, userId: "u1", from };
}
const member = (role: string) => m.resolveProfile.mockResolvedValue({ id: "p1", org_id: KESTREL_BAY_ORG_ID, role });

beforeEach(() => m.resolveProfile.mockReset());

describe("recorded answers: what is kept", () => {
  it("the list the browser knows equals what the server holds", () => {
    const held = Object.fromEntries(FIRM_STORY_RECORDINGS.map((recording) => [recording.beat, recording.window]));
    expect(STORY_RECORDED_BEATS).toEqual(held);
    expect(hasRecording(1, "partner")).toBe(true);
    expect(hasRecording(1, "lead")).toBe(false);
    expect(hasRecording(3, "partner")).toBe(false);
  });

  it("each recording answers the question its beat asks, in the window that plays the beat", () => {
    for (const recording of FIRM_STORY_RECORDINGS) {
      const beat = STORY_BEATS.find((candidate) => candidate.n === recording.beat);
      expect(beat?.ask, `beat ${recording.beat}`).toBe(recording.question);
      expect(beat?.window).toBe(recording.window);
      expect(recording.paragraphs.length).toBeGreaterThan(0);
      expect(recording.recordedOn).toMatch(/^\d{1,2} [A-Z][a-z]{2} \d{4}$/);
      expect(recording.build).toMatch(/^[0-9a-f]{8}$/);
    }
  });

  it("never carries money, a product name or an em dash", () => {
    const text = JSON.stringify(FIRM_STORY_RECORDINGS);
    expect(text).not.toMatch(/[$£€]|\b(USD|GBP|EUR)\b|\b\d[\d,]*\s?(k|m|million|thousand)\b/i);
    expect(text).not.toMatch(/\b(Charlotte|Lasso)\b/);
    expect(text).not.toContain("\u2014");
  });

  it("has none for the fees beat, whose figures are drawn by code for admins and leads only", () => {
    const fees = STORY_BEATS.find((beat) => /charged/i.test(beat.notes) && beat.n === 3);
    expect(fees).toBeTruthy();
    expect(FIRM_STORY_RECORDINGS.some((recording) => recording.beat === 3)).toBe(false);
  });

  it("is server-only: no browser file imports the recordings, and the script file does not hold them", () => {
    for (const file of ["src/components/firm-story/FirmStory.tsx", "src/components/firm-story/FirmStoryCard.tsx", "src/lib/firm-story-shared.ts", "src/lib/firm-story-script.ts"]) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(/firm-story-recordings\.server"/);
    }
    expect(readFileSync("src/lib/firm-story.functions.ts", "utf8")).not.toMatch(/^import .*firm-story-recordings/m);
    expect(JSON.stringify(FIRM_STORY_SCRIPT)).not.toContain("Cedarmere Regional Health, we recommended");
  });
});

describe("recorded answers: who is given one", () => {
  it("gives the Partner window its beat 1 recording", async () => {
    member("lead");
    const call = db({ is_guest: false, deactivated_at: null });
    const got = await firmStoryRecordingCall(call, { profile_id: "p1", beat: 1 });
    expect(got?.beat).toBe(1);
    expect(got).toEqual(recordingFor(1, "partner"));
  });

  it("gives the Engagement lead window nothing for the Partner's beat", async () => {
    member("em");
    expect(await firmStoryRecordingCall(db({ is_guest: false, deactivated_at: null }), { profile_id: "p1", beat: 1 })).toBeNull();
  });

  it("gives nothing to a person outside the demo firm, a guest, a coach or a deactivated person", async () => {
    m.resolveProfile.mockResolvedValue(null);
    expect(await firmStoryRecordingCall(db(null), { profile_id: "x", beat: 1 })).toBeNull();
    member("lead");
    expect(await firmStoryRecordingCall(db({ is_guest: true, deactivated_at: null }), { profile_id: "p1", beat: 1 })).toBeNull();
    expect(await firmStoryRecordingCall(db({ is_guest: false, deactivated_at: "2026-11-01" }), { profile_id: "p1", beat: 1 })).toBeNull();
    member("coach");
    expect(await firmStoryRecordingCall(db({ is_guest: false, deactivated_at: null }), { profile_id: "p1", beat: 1 })).toBeNull();
  });

  it("gives nothing for a beat with no recording or a beat that is not a beat", async () => {
    member("lead");
    for (const beat of [0, 2, 3, 7, -1, 99, 1.5]) {
      expect(await firmStoryRecordingCall(db({ is_guest: false, deactivated_at: null }), { profile_id: "p1", beat }), String(beat)).toBeNull();
    }
  });

  it("asks only for the caller's own profile in the demo firm", async () => {
    member("lead");
    await firmStoryRecordingCall(db({ is_guest: false, deactivated_at: null }), { profile_id: "p1", beat: 1 });
    expect(m.resolveProfile.mock.calls[0]?.slice(1)).toEqual(["u1", "p1", KESTREL_BAY_ORG_ID]);
  });

  it("the server function is signed-in only and makes no model call", () => {
    const source = readFileSync("src/lib/firm-story.functions.ts", "utf8").replace(/\s+/g, " ");
    expect(source).toMatch(/export const firmStoryRecordingFn = createServerFn\(\{ method: "POST" \}\) \.middleware\(\[requireSupabaseAuth\]\)/);
    for (const file of ["src/lib/firm-story.server.ts", "src/lib/firm-story-recordings.server.ts"]) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(/chatComplete|streamChat|\.insert\(|\.update\(|\.delete\(|\.upsert\(/);
    }
  });
});

describe("the new event", () => {
  it("carries the beat, the mode and the script version, and nothing else", () => {
    expect(EVENT_DIM_KEYS["firm_story.fallback_shown"]).toEqual(["beat", "mode", "script_version"]);
  });
});

describe("the tour logins' daily cap", () => {
  const TOUR = { orgId: KESTREL_BAY_ORG_ID, profileId: "tour-profile" };
  function deps(over: Partial<TourCapDeps> = {}): TourCapDeps & { emailOfProfile: ReturnType<typeof vi.fn>; costsSince: ReturnType<typeof vi.fn> } {
    return {
      emailOfProfile: vi.fn().mockResolvedValue("tour-partner@kestrelbay.test"),
      costsSince: vi.fn().mockResolvedValue([0.5, 0.25]),
      now: () => new Date("2026-11-20T15:30:00Z"),
      ...over,
    } as never;
  }

  it("is USD 2 a day, for exactly the two tour logins", () => {
    expect(TOUR_DAILY_CAP_USD).toBe(2);
    expect(TOUR_LOGIN_EMAILS).toEqual(["tour-partner@kestrelbay.test", "tour-lead@kestrelbay.test"]);
    expect(isTourLoginEmail(" Tour-Partner@KestrelBay.test ")).toBe(true);
    for (const other of ["quinn@kestrelbay.test", "hollis@kestrelbay.test", "tour-partner@kestrelbay.test.evil.com", "xtour-lead@kestrelbay.test", "", null, undefined]) {
      expect(isTourLoginEmail(other), String(other)).toBe(false);
    }
  });

  it("adds up the day's spend and stops at the cap, not after it", () => {
    expect(overCap([])).toBe(false);
    expect(overCap([1.2, 0.79])).toBe(false);
    expect(overCap([1.2, 0.8])).toBe(true);
    expect(overCap([2.5])).toBe(true);
    expect(overCap([null, undefined, Number.NaN, -5, 1.99])).toBe(false);
  });

  it("counts the day from midnight UTC", () => {
    expect(startOfUtcDay(new Date("2026-11-20T15:30:00Z"))).toBe("2026-11-20T00:00:00.000Z");
    expect(startOfUtcDay(new Date("2026-11-20T23:59:59-08:00"))).toBe("2026-11-21T00:00:00.000Z");
  });

  it("lets a tour login through under the cap, reading its own spend since midnight", async () => {
    const d = deps();
    await expect(assertWithinTourCap(TOUR, d)).resolves.toBeUndefined();
    expect(d.costsSince).toHaveBeenCalledWith("tour-profile", "2026-11-20T00:00:00.000Z");
  });

  it("refuses a tour login at the cap, with a plain message", async () => {
    await expect(assertWithinTourCap(TOUR, deps({ costsSince: vi.fn().mockResolvedValue([1.5, 0.5]) }))).rejects.toBeInstanceOf(TourCapReached);
    await expect(assertWithinTourCap(TOUR, deps({ costsSince: vi.fn().mockResolvedValue([3]) }))).rejects.toThrow(TOUR_CAP_MESSAGE);
    expect(TOUR_CAP_MESSAGE).not.toMatch(/Charlotte|Lasso|\u2014/);
  });

  it("never caps another demo person, and never reads their spend", async () => {
    const d = deps({ emailOfProfile: vi.fn().mockResolvedValue("quinn@kestrelbay.test"), costsSince: vi.fn().mockResolvedValue([50]) });
    await expect(assertWithinTourCap(TOUR, d)).resolves.toBeUndefined();
    expect(d.costsSince).not.toHaveBeenCalled();
  });

  it("does nothing at all outside the demo firm's workspace, or without a profile", async () => {
    const d = deps({ costsSince: vi.fn().mockResolvedValue([50]) });
    for (const meta of [undefined, {}, { orgId: "another-org", profileId: "p" }, { orgId: KESTREL_BAY_ORG_ID }, { orgId: KESTREL_BAY_ORG_ID, profileId: null }, { profileId: "tour-profile" }]) {
      await expect(assertWithinTourCap(meta, d)).resolves.toBeUndefined();
    }
    expect(d.emailOfProfile).not.toHaveBeenCalled();
    expect(d.costsSince).not.toHaveBeenCalled();
  });

  it("lets the call through when it cannot tell who the person is", async () => {
    const d = deps({ emailOfProfile: vi.fn().mockRejectedValue(new Error("down")), costsSince: vi.fn().mockResolvedValue([50]) });
    await expect(assertWithinTourCap(TOUR, d)).resolves.toBeUndefined();
    await expect(assertWithinTourCap(TOUR, deps({ emailOfProfile: vi.fn().mockResolvedValue(null) }))).resolves.toBeUndefined();
  });

  it("refuses a known tour login when its spend cannot be read", async () => {
    await expect(assertWithinTourCap(TOUR, deps({ costsSince: vi.fn().mockRejectedValue(new Error("down")) }))).rejects.toBeInstanceOf(TourCapReached);
  });

  it("is checked once, before any model request, in the one place models are called", () => {
    const gateway = readFileSync("src/lib/ai.server.ts", "utf8");
    expect(gateway.match(/assertWithinTourCap\(options\.meta\)/g)).toHaveLength(1);
    const routed = gateway.slice(gateway.indexOf("async function routedRequest("));
    expect(routed.indexOf("assertWithinTourCap(options.meta)")).toBeGreaterThan(0);
    expect(routed.indexOf("assertWithinTourCap(options.meta)")).toBeLessThan(routed.indexOf("await sendRequest("));
    // Both entry points go through it.
    expect(gateway.match(/await routedRequest\(/g)?.length).toBeGreaterThanOrEqual(2);
    // Only a reached cap stops a call; a fault in the cap never does.
    expect(gateway).toContain('if (error instanceof TourCapReached) throw new AiError(error.message, "rate_limit");');
  });

  it("writes nothing", () => {
    expect(readFileSync("src/lib/firm-story-cap.server.ts", "utf8")).not.toMatch(/\.insert\(|\.update\(|\.delete\(|\.upsert\(|\.rpc\(/);
  });
});
