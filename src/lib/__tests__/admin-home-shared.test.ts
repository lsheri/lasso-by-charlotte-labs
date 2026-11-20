import { describe, expect, it } from "vitest";

import {
  ADMIN_HOME_COPY,
  ADMIN_HOME_TODAY_ROWS,
  arrivedIds,
  buildAdminFeed,
  feedTime,
  nearlyOver,
  openCount,
  proposalName,
  startOfToday,
  type FeedItem,
} from "@/lib/admin-home-shared";
import type { NotificationRow } from "@/lib/notifications-shared";
import type { DeskList, DeskProposal } from "@/lib/proposal-desk-shared";
import type { RosterContact } from "@/lib/roster-shared";

/**
 * 21 Nov 2026, D-82: the admin's Home lists, built only from what the app records. Each rule, the order, the floors
 * (no person timed or ranked, no phone number, no fee) and the edges: empty, partial and malformed sources.
 */

// Mid afternoon, so "today" has room on both sides in any time zone the test runs in.
const NOW = new Date(2026, 10, 21, 15, 0, 0);
const hoursAgo = (n: number) => new Date(NOW.getTime() - n * 3_600_000).toISOString();

const proposal = (over: Partial<DeskProposal> = {}): DeskProposal => ({
  id: "p1",
  title: "Network redesign",
  clientName: "Pellham",
  ownerName: "Harper Quinn",
  mine: false,
  status: "open",
  receivedAt: hoursAgo(30),
  sentAt: null,
  decidedAt: null,
  engagementId: null,
  contextCount: 1,
  canAct: true,
  canClose: true,
  canArchive: true,
  leadContactId: "c1",
  leadName: "Christy Johnson",
  ask: null,
  ...over,
});
const desk = (proposals: DeskProposal[], goalHours = 72): DeskList => ({ goalHours, canSetGoal: true, canPickLead: true, canAddClient: true, texts: { demo: false, connected: true }, proposals });
const ask = (over: Partial<NonNullable<DeskProposal["ask"]>> = {}) => ({ name: "Christy Johnson", status: "delivered" as const, reply: null, practice: false, waiting: false, ...over });
const note = (over: Partial<NotificationRow>): NotificationRow => ({ id: "n1", org_id: "o", kind: "invite_needs_approval", section: "needs_you", subject_type: "board_invite", subject_id: "i1", payload: { by: "Ana", email: "a@b.co", board: "Pricing" }, created_at: hoursAgo(1), read_at: null, acted_at: null, engagement_id: null, ...over });
const person = (name: string, needsDetails: boolean) => ({ id: name, name, needsDetails, phoneMasked: needsDetails ? null : "•••• 4421" }) as unknown as RosterContact;

const kinds = (items: FeedItem[]) => items.map((item) => item.kind);
const words = (items: FeedItem[]) => items.flatMap((item) => [item.title, item.detail, item.next.label, item.next.why]).join(" ");

describe("waiting on you", () => {
  it("names the one thing each open proposal needs most", () => {
    const feed = buildAdminFeed({
      now: NOW,
      desk: desk([
        proposal({ id: "arrive", ask: ask({ status: "failed" }) }),
        proposal({ id: "no", ask: ask({ reply: "no" }) }),
        proposal({ id: "stop", ask: ask({ reply: "stop", status: "opted_out" }) }),
        proposal({ id: "nolead", leadContactId: null, leadName: null }),
        proposal({ id: "over", receivedAt: hoursAgo(80) }),
        proposal({ id: "soon", receivedAt: hoursAgo(62) }),
        proposal({ id: "fine", receivedAt: hoursAgo(10) }),
      ]),
    });
    expect(feed.waiting.map((item) => [item.id, item.kind])).toEqual([
      ["wait:arrive", "not_arrived"],
      ["wait:no", "said_no"],
      ["wait:stop", "opted_out"],
      ["wait:over", "over"],
      ["wait:nolead", "no_lead"],
      ["wait:soon", "nearly_over"],
    ]);
  });

  it("sends each to its next step: the lead sheet, People, or the proposal", () => {
    const feed = buildAdminFeed({ now: NOW, desk: desk([proposal({ id: "a", ask: ask({ status: "undelivered" }) }), proposal({ id: "b", leadContactId: null, leadName: null }), proposal({ id: "c", receivedAt: hoursAgo(90) })]) });
    const step = (id: string) => feed.waiting.find((item) => item.id === id)?.next;
    expect(step("wait:a")).toMatchObject({ label: ADMIN_HOME_COPY.steps.checkNumber, step: { to: "/proposals", search: { tab: "people" } } });
    expect(step("wait:b")).toMatchObject({ label: ADMIN_HOME_COPY.steps.pickLead, step: { to: "/proposals", search: { lead: "b" } } });
    expect(step("wait:c")).toMatchObject({ label: ADMIN_HOME_COPY.steps.openProposal, step: { to: "/proposals", search: { proposal: "c" } } });
    for (const item of feed.waiting) expect(item.next.why.length).toBeGreaterThan(10);
  });

  it("asks nothing of a proposal that went out, was decided, or is fine on its clock", () => {
    const feed = buildAdminFeed({
      now: NOW,
      desk: desk([
        proposal({ id: "sent", receivedAt: hoursAgo(90), sentAt: hoursAgo(50) }),
        proposal({ id: "won", status: "won", receivedAt: hoursAgo(200), decidedAt: hoursAgo(100) }),
        proposal({ id: "lost", status: "lost", leadName: null, leadContactId: null, decidedAt: hoursAgo(100) }),
        proposal({ id: "fine", receivedAt: hoursAgo(5), ask: ask({ reply: "yes" }) }),
      ]),
    });
    expect(feed.waiting).toEqual([]);
  });

  it("drops a no once a different lead is picked", () => {
    const feed = buildAdminFeed({ now: NOW, desk: desk([proposal({ leadName: "Tiago Pereira", ask: ask({ name: "Christy Johnson", reply: "no" }), receivedAt: hoursAgo(5) })]) });
    expect(feed.waiting).toEqual([]);
  });

  it("does not call a practice ask undelivered", () => {
    const feed = buildAdminFeed({ now: NOW, desk: desk([proposal({ receivedAt: hoursAgo(5), ask: ask({ status: "practice", practice: true }) })]) });
    expect(feed.waiting).toEqual([]);
  });

  it("lists invites waiting for approval and seats over, and nothing the admin already acted on", () => {
    const feed = buildAdminFeed({
      now: NOW,
      notifications: [
        note({ id: "i1" }),
        note({ id: "i2", acted_at: hoursAgo(0.5) }),
        note({ id: "s1", kind: "seat_over_count", section: "updates", payload: { seats: 5, filled: 7 } }),
        note({ id: "s2", kind: "seat_over_count", section: "updates", payload: { seats: 5, filled: 6 }, read_at: hoursAgo(0.2) }),
        note({ id: "m1", kind: "mention_received", section: "updates" }),
      ],
    });
    expect(feed.waiting.map((item) => item.id)).toEqual(["invite:i1", "seats:s1"]);
    expect(feed.waiting[0]?.detail).toBe("Ana wants to invite a@b.co to Pricing.");
    expect(feed.waiting[0]?.next.step).toEqual({ to: "notifications" });
    expect(feed.waiting[1]?.next.step).toEqual({ to: "/settings" });
  });

  it("counts the people missing a number or email, names two, and never shows a number", () => {
    const roster = [person("Dana West", true), person("Ola Brandt", true), person("Ines Moreau", true), person("Kai Lund", false)];
    const feed = buildAdminFeed({ now: NOW, roster });
    expect(feed.waiting).toHaveLength(1);
    expect(feed.waiting[0]).toMatchObject({ kind: "people", title: "3 people are missing a number or email", detail: "Dana West, Ola Brandt and 1 more", next: { step: { to: "/proposals", search: { tab: "people" } } } });
    expect(words(feed.waiting)).not.toMatch(/4421|•|\d{4}/);
    expect(buildAdminFeed({ now: NOW, roster: [person("Dana West", true)] }).waiting[0]?.title).toBe("1 person is missing a number or email");
    expect(buildAdminFeed({ now: NOW, roster: [person("Kai Lund", false)] }).waiting).toEqual([]);
  });
});

describe("earlier today", () => {
  it("lists what happened today, newest first, and nothing from before today", () => {
    const feed = buildAdminFeed({
      now: NOW,
      desk: desk([
        proposal({ id: "brief", receivedAt: hoursAgo(1), leadName: null, leadContactId: null }),
        proposal({ id: "sent", receivedAt: hoursAgo(40), sentAt: hoursAgo(3) }),
        proposal({ id: "won", status: "won", receivedAt: hoursAgo(90), sentAt: hoursAgo(50), decidedAt: hoursAgo(2), engagementId: "b1" }),
        proposal({ id: "lost", status: "lost", receivedAt: hoursAgo(90), decidedAt: hoursAgo(4) }),
        proposal({ id: "old", status: "won", receivedAt: hoursAgo(90), decidedAt: hoursAgo(30), engagementId: "b2" }),
      ]),
    });
    expect(feed.today.map((item) => item.id)).toEqual(["brief:brief", "won:won", "sent:sent", "lost:lost"]);
    expect(feed.today.find((item) => item.kind === "won")?.next.step).toEqual({ to: "/engagements/$id/canvas-lab", params: { id: "b1" } });
    expect(feed.today.find((item) => item.kind === "lost")?.next.step).toEqual({ to: "/proposals", search: { view: "lost", proposal: "lost" } });
    expect(feed.today.find((item) => item.kind === "brief")?.next.step).toEqual({ to: "/proposals", search: { lead: "brief" } });
  });

  it("lists a lead's yes only when the server flagged it as today, with no time of its own", () => {
    const flagged = buildAdminFeed({ now: NOW, desk: desk([proposal({ ask: ask({ reply: "yes", recent: true }) })]) });
    expect(flagged.today).toHaveLength(1);
    expect(flagged.today[0]).toMatchObject({ kind: "said_yes", title: "Christy Johnson said yes", at: "" });
    expect(buildAdminFeed({ now: NOW, desk: desk([proposal({ ask: ask({ reply: "yes" }) })]) }).today).toEqual([]);
  });

  it("keeps the list short and says how many more there are", () => {
    const many = Array.from({ length: ADMIN_HOME_TODAY_ROWS + 3 }, (_, index) => proposal({ id: `p${index}`, receivedAt: hoursAgo(0.1 + index * 0.2) }));
    const feed = buildAdminFeed({ now: NOW, desk: desk(many) });
    expect(feed.today).toHaveLength(ADMIN_HOME_TODAY_ROWS);
    expect(feed.todayMore).toBe(3);
  });
});

describe("QA of PR 285", () => {
  it("M1: says a practice ask's answer is practice, never a real yes, no or opt out", () => {
    const feed = buildAdminFeed({
      now: NOW,
      desk: desk([
        proposal({ id: "y", ask: ask({ status: "practice", practice: true, reply: "yes", recent: true }) }),
        proposal({ id: "n", ask: ask({ status: "practice", practice: true, reply: "no" }) }),
        proposal({ id: "s", ask: ask({ status: "practice", practice: true, reply: "stop" }) }),
      ]),
    });
    const titles = [...feed.waiting, ...feed.today].map((item) => item.title);
    expect(titles).toEqual(expect.arrayContaining(["Practice ask: Christy Johnson said no", "Practice ask: Christy Johnson opted out of texts", "Practice ask: Christy Johnson said yes"]));
    for (const item of [...feed.waiting, ...feed.today]) {
      expect(item.title.startsWith("Practice ask: ")).toBe(true);
      expect(item.next.why).toBe(ADMIN_HOME_COPY.whys.practice);
    }
  });

  it("M2: opens a decided proposal in Won or Lost with its row named, and an open one in the default view", () => {
    const feed = buildAdminFeed({
      now: NOW,
      desk: desk([
        proposal({ id: "w", status: "won", receivedAt: hoursAgo(1), sentAt: hoursAgo(0.8), decidedAt: hoursAgo(0.5), engagementId: null }),
        proposal({ id: "l", status: "lost", receivedAt: hoursAgo(1), sentAt: hoursAgo(0.9), decidedAt: hoursAgo(0.4), leadName: null, leadContactId: null }),
        proposal({ id: "o", receivedAt: hoursAgo(1), sentAt: hoursAgo(0.7) }),
      ]),
    });
    const step = (id: string) => feed.today.find((item) => item.id === id)?.next;
    expect(step("won:w")?.step).toEqual({ to: "/proposals", search: { view: "won", proposal: "w" } });
    expect(step("sent:w")?.step).toEqual({ to: "/proposals", search: { view: "won", proposal: "w" } });
    expect(step("brief:w")?.step).toEqual({ to: "/proposals", search: { view: "won", proposal: "w" } });
    expect(step("lost:l")?.step).toEqual({ to: "/proposals", search: { view: "lost", proposal: "l" } });
    expect(step("brief:l")?.step).toEqual({ to: "/proposals", search: { view: "lost", proposal: "l" } });
    expect(step("sent:o")?.step).toEqual({ to: "/proposals", search: { proposal: "o" } });
  });

  it("M2: says only what is true for a win with no board, and a brief already decided", () => {
    const feed = buildAdminFeed({
      now: NOW,
      desk: desk([
        proposal({ id: "w", status: "won", decidedAt: hoursAgo(0.5), engagementId: null }),
        proposal({ id: "l", status: "lost", receivedAt: hoursAgo(1), decidedAt: hoursAgo(0.4), leadName: null, leadContactId: null }),
      ]),
    });
    expect(feed.today.find((item) => item.id === "won:w")?.next.why).toBe(ADMIN_HOME_COPY.whys.wonNoBoard);
    expect(feed.today.find((item) => item.id === "brief:l")?.next.why).toBe(ADMIN_HOME_COPY.whys.briefDecided);
    expect(words(feed.today)).not.toContain("The team board was made");
    expect(words(feed.today)).not.toContain("Its lead is picked");
  });
});

describe("QA recheck of PR 285", () => {
  it("N1: Earlier is the last 24 hours, so a yesterday-evening item stays and a 25 hour old one goes", () => {
    const feed = buildAdminFeed({ now: NOW, desk: desk([proposal({ id: "a", receivedAt: hoursAgo(20), leadName: "X" }), proposal({ id: "b", receivedAt: hoursAgo(25) })]) });
    expect(feed.today.map((item) => item.id)).toEqual(["brief:a"]);
    expect(ADMIN_HOME_COPY.today).toBe("Earlier");
  });

  it("N1: says Yesterday on a time before the admin's own midnight", () => {
    expect(feedTime(hoursAgo(20), NOW)).toMatch(/^Yesterday \d/);
    expect(feedTime(hoursAgo(2), NOW)).toMatch(/^\d/);
  });

  it("N2: a proposal that went out and was then decided does not ask to be recorded", () => {
    const feed = buildAdminFeed({ now: NOW, desk: desk([proposal({ id: "l", status: "lost", receivedAt: hoursAgo(40), sentAt: hoursAgo(3), decidedAt: hoursAgo(1) })]) });
    expect(feed.today.find((item) => item.id === "sent:l")?.next.why).toBe(ADMIN_HOME_COPY.whys.sentDecided);
  });

  it("N3: a practice no waits behind every real item", () => {
    const feed = buildAdminFeed({
      now: NOW,
      desk: desk([
        proposal({ id: "p", ask: ask({ status: "practice", practice: true, reply: "no" }) }),
        proposal({ id: "n", leadContactId: null, leadName: null }),
        proposal({ id: "s", receivedAt: hoursAgo(62) }),
      ]),
      roster: [person("Dana West", true)],
    });
    expect(feed.waiting.map((item) => item.id)).toEqual(["wait:n", "wait:s", "people:missing", "wait:p"]);
    expect(feed.waiting.at(-1)?.practice).toBe(true);
  });
});

describe("floors and edges", () => {
  it("never words anything as a score, a ranking, a reply speed, a fee or a phone number", () => {
    const feed = buildAdminFeed({
      now: NOW,
      desk: desk([proposal({ id: "a", ask: ask({ reply: "no" }) }), proposal({ id: "b", receivedAt: hoursAgo(1), status: "won", decidedAt: hoursAgo(0.5), engagementId: "e" }), proposal({ id: "c", receivedAt: hoursAgo(90) })]),
      roster: [person("Dana West", true)],
      notifications: [note({}), note({ id: "s", kind: "seat_over_count", payload: { seats: 5, filled: 7 } })],
    });
    const all = words([...feed.waiting, ...feed.today]);
    expect(all).not.toMatch(/[$£€]|\bfee|\bvalue|score|rank|fastest|slowest|quickest|reply time|took \d|minutes to|\+?\d[\d\s().-]{8,}\d/i);
    expect(all).not.toMatch(/[—–]/);
  });

  it("builds from whatever arrived: no sources is two empty lists, and one missing source never empties the rest", () => {
    expect(buildAdminFeed({ now: NOW })).toEqual({ waiting: [], today: [], todayMore: 0 });
    const onlyNotes = buildAdminFeed({ now: NOW, notifications: [note({})] });
    expect(kinds(onlyNotes.waiting)).toEqual(["invite"]);
    const onlyDesk = buildAdminFeed({ now: NOW, desk: desk([proposal({ receivedAt: hoursAgo(90) })]) });
    expect(kinds(onlyDesk.waiting)).toEqual(["over"]);
  });

  it("names a proposal by client and title, or whichever is there", () => {
    expect(proposalName({ clientName: "Pellham", title: "Network redesign" })).toBe("Pellham: Network redesign");
    expect(proposalName({ clientName: " ", title: "Network redesign" })).toBe("Network redesign");
    expect(proposalName({ clientName: "Pellham", title: "" })).toBe("Pellham");
    expect(proposalName({ clientName: "", title: "" })).toBe("A proposal");
  });

  it("does not call a dateless or future-dated proposal late or new today", () => {
    const feed = buildAdminFeed({ now: NOW, desk: desk([proposal({ id: "junk", receivedAt: "not a date" }), proposal({ id: "future", receivedAt: new Date(NOW.getTime() + 86_400_000).toISOString() })]) });
    expect(kinds(feed.waiting)).toEqual([]);
    expect(feed.today).toEqual([]);
  });

  it("treats the last fifth of the goal (at least four hours) as about to run over", () => {
    expect(nearlyOver(14, 72)).toBe(true);
    expect(nearlyOver(15, 72)).toBe(false);
    expect(nearlyOver(4, 10)).toBe(true);
    expect(nearlyOver(5, 10)).toBe(false);
  });

  it("starts today at local midnight", () => {
    const start = startOfToday(NOW);
    expect([start.getHours(), start.getMinutes(), start.getDate()]).toEqual([0, 0, NOW.getDate()]);
  });

  it("counts open proposals for the one tap into Proposals", () => {
    expect(openCount(desk([proposal({}), proposal({ id: "w", status: "won" })]))).toBe(1);
    expect(openCount(undefined)).toBe(0);
  });
});

describe("what counts as new", () => {
  const item = (id: string): FeedItem => ({ id, kind: "brief", at: hoursAgo(1), title: "t", detail: "d", next: { label: "l", why: "w", step: { to: "/settings" } } });
  it("marks nothing on the first read, then only the items that were not there before", () => {
    expect(arrivedIds(null, [item("a"), item("b")]).size).toBe(0);
    expect([...arrivedIds(new Set(["a"]), [item("a"), item("b")])]).toEqual(["b"]);
    expect(arrivedIds(new Set(["a", "b"]), [item("a")]).size).toBe(0);
  });
});
