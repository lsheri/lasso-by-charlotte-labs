/**
 * 21 Nov 2026, D-82 (Liam): an admin's Home is only the operating picture. Two lists: what waits on the admin, then
 * what happened in the last day ("Earlier"). The pure rules and the words live here; the page only draws what this file returns.
 *
 * Every item is built from something the app records today: a proposal and its clock, its lead and the latest ask by
 * text, when it went out, when it was won or lost, the people on the roster with no number or email, and the admin's
 * own notifications (an invite waiting for approval, more people than seats). "The client changed what they asked
 * for" is not recorded yet, so it is not here.
 *
 * Floors: nothing here rates, ranks or times a person, no item says how long anyone took to reply, no phone number
 * appears in any form, and no fee or value is read or written.
 */

import { ASK_COPY } from "./lead-ask-shared";
import { notificationSentence, type NotificationRow } from "./notifications-shared";
import { timeLeft, timeLeftLine, type DeskList, type DeskProposal } from "./proposal-desk-shared";
import type { RosterContact } from "./roster-shared";

/** D-85: Home reads again when the window comes back into focus, and once a minute while it is open. No realtime. */
export const ADMIN_HOME_REFRESH_MS = 60_000;

/** How many "Earlier" items Home shows before it points to Proposals for the rest. */
export const ADMIN_HOME_TODAY_ROWS = 8;

/** Texts that did not reach the phone, as the delivery report names them. */
const NOT_ARRIVED = new Set(["undelivered", "failed", "rejected", "expired"]);

/** Where an item's next step goes. Paths only: the page turns them into links. */
export type NextStep =
  | { to: "/proposals"; search: { proposal?: string; lead?: string; tab?: "people"; view?: "won" | "lost" } }
  | { to: "/engagements/$id/canvas-lab"; params: { id: string } }
  | { to: "/settings" }
  | { to: "notifications" };

export type FeedKind =
  | "not_arrived"
  | "said_no"
  | "opted_out"
  | "no_lead"
  | "over"
  | "nearly_over"
  | "said_yes"
  | "brief"
  | "sent"
  | "won"
  | "lost"
  | "invite"
  | "seats"
  | "people"
  /** 21 Nov 2026, Phase 5: a Lead sent the final for approval. */
  | "approval";

export type FeedItem = {
  /** Stable across reads, so a new item can be told from one already shown. */
  id: string;
  kind: FeedKind;
  /**
   * When it happened, for ordering and the time of day beside it. Empty for a lead's reply: the server never sends
   * when a person answered, only that they did today.
   */
  at: string;
  /** The one line a person reads first. */
  title: string;
  /** The line under it: the client, the clock, the lead. */
  detail: string;
  /** A practice ask's answer: nobody really replied (QA N3). */
  practice?: true;
  /** What pressing the item opens, said on the item once it is pressed. */
  next: { label: string; why: string; step: NextStep };
};

export type AdminFeed = { waiting: FeedItem[]; today: FeedItem[]; todayMore: number };

export const ADMIN_HOME_COPY = {
  title: "What changed",
  waiting: "Waiting on you",
  /** QA N1: the last 24 hours, the same window for every item, so nothing drops off at someone else's midnight. */
  today: "Earlier",
  nothingWaiting: "Nothing waits on you right now.",
  nothingToday: "Nothing has happened in the last day.",
  /** QA M3: a source could not be read, so an empty list cannot be called empty. */
  notCheckedWaiting: "Could not check everything that may be waiting on you.",
  notCheckedToday: "Could not check everything from the last day.",
  loading: "Loading what changed",
  /** One source could not be read; the rest still show. */
  partFailed: "Some of this could not be loaded, so the lists may be short. Try again in a moment.",
  retry: "Try again",
  upNext: "Up next in Proposals",
  openCount: (count: number) => (count === 1 ? "1 open proposal" : `${count} open proposals`),
  noneOpen: "No open proposals",
  more: (count: number) => (count === 1 ? "1 more in Proposals" : `${count} more in Proposals`),
  yesterday: (time: string) => `Yesterday ${time}`,
  next: "Next",
  why: "Why",
  close: "Not now",
  /** Said once, quietly, beside the list title: Home reads again on its own. */
  refreshes: "Updates every minute",
  arrived: "New",
  /** The titles, by kind. A proposal is named by its client and what they asked for. */
  titles: {
    /** QA M1: a practice ask's answer is never shown as a real one. */
    practice: (title: string) => `Practice ask: ${title}`,
    notArrived: (lead: string) => `The text to ${lead || "the lead"} did not arrive`,
    saidNo: (lead: string) => ASK_COPY.saidNo(lead),
    optedOut: (lead: string) => ASK_COPY.stopped(lead),
    noLead: "No lead yet",
    over: "Past your turnaround goal",
    nearlyOver: "About to run over",
    saidYes: (lead: string) => ASK_COPY.saidYes(lead),
    brief: "New brief came in",
    sent: "Proposal went out",
    won: "Won",
    lost: "Lost",
    invite: "An invite waits for your approval",
    seats: "More people than seats",
    people: (count: number) => (count === 1 ? "1 person is missing a number or email" : `${count} people are missing a number or email`),
    approval: (lead: string) => `${lead || "The lead"} sent the final for approval`,
  },
  steps: {
    openProposal: "Open the proposal",
    pickLead: "Pick the lead",
    pickAnother: "Pick another lead",
    checkNumber: "Check their details in People",
    openBoard: "Open the team board",
    seeLost: "See it in Lost",
    approve: "Approve or decline",
    seats: "Open Settings",
    people: "Add them in People",
    review: "Review the final",
  },
  whys: {
    approval: "The lead chose the final version. Approve it and it goes to the client, or ask for changes with a short note.",
    notArrived: "Their phone did not get the text, so they cannot answer it. Check the details on file, then ask again.",
    saidNo: "They will not lead this one. Pick someone else from People we work with.",
    optedOut: "They asked for no more texts. Pick someone else, or reach them another way.",
    noLead: "Nobody leads it yet. Picking a lead sends nothing until you press Send.",
    over: "The brief came in longer ago than your firm's goal. Mark it as sent once it goes out.",
    nearlyOver: "It is close to your firm's goal and has not gone out yet.",
    saidYes: "Their past work, the documents and the clock are on the proposal. Mark it as sent when it goes out.",
    brief: "A new proposal starts with picking its lead.",
    briefLed: "Its lead is picked. The clock, the documents and matching past work are on the proposal.",
    briefDecided: "It came in within the last day and has already been decided.",
    sentDecided: "It went out, and has since been decided.",
    wonNoBoard: "It was recorded as won. It has no team board yet.",
    practice: "This was a practice ask, so nothing went to anyone's phone and no one really answered.",
    sent: "It is with the client. Record the win or close it as lost when you hear back.",
    won: "The team board was made from the proposal. Add the people who will do the work.",
    lost: "Add what you learned, so the next proposal starts from it.",
    invite: "A teammate asked to invite someone to a board. Nothing is sent until you approve.",
    seats: "Nobody is locked out. Add seats in Settings when you are ready.",
    people: "Texts and emails can only reach people with details on file.",
  },
} as const;

export type FeedSources = {
  desk?: DeskList | undefined;
  roster?: RosterContact[] | undefined;
  notifications?: NotificationRow[] | undefined;
  now: Date;
};

/** The start of the day the admin is in, in their own time zone. */
export function startOfToday(now: Date): Date {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return start;
}

/** QA N1: within the last 24 hours, the same window the server uses for a lead's reply. */
function isToday(iso: string | null | undefined, now: Date): boolean {
  if (!iso) return false;
  const at = Date.parse(iso);
  return Number.isFinite(at) && at >= now.getTime() - 86_400_000 && at <= now.getTime() + 60_000;
}

/** "Pellham: Network redesign", or whichever of the two is there. */
export function proposalName(proposal: Pick<DeskProposal, "clientName" | "title">): string {
  const client = proposal.clientName.trim();
  const title = proposal.title.trim();
  return client && title ? `${client}: ${title}` : client || title || "A proposal";
}

/** Within the last fifth of the goal (at least four hours of it), still to go out. */
export function nearlyOver(hoursLeft: number, goalHours: number): boolean {
  return hoursLeft <= Math.max(4, Math.round(goalHours * 0.2));
}

/** QA M2: a decided proposal is only listed under Won or Lost, so the link opens that view with the row in it. */
const toProposal = (proposal: Pick<DeskProposal, "id" | "status">): NextStep => ({
  to: "/proposals",
  search: proposal.status === "won" || proposal.status === "lost" ? { view: proposal.status, proposal: proposal.id } : { proposal: proposal.id },
});
const toLead = (id: string): NextStep => ({ to: "/proposals", search: { lead: id } });
const toPeople: NextStep = { to: "/proposals", search: { tab: "people" } };

/** The one thing a waiting open proposal needs most, or null when it needs nothing from the admin now. */
function waitingFor(proposal: DeskProposal, goalHours: number, now: Date): FeedItem | null {
  // Phase 5: a request for approval comes first; it is what the admin is waited on for.
  if (proposal.status === "open" && proposal.approval?.state === "waiting") {
    const C = ADMIN_HOME_COPY;
    return {
      id: `approval:${proposal.id}`,
      kind: "approval",
      at: proposal.approval.requestedAt,
      title: C.titles.approval(proposal.approval.requestedBy || proposal.leadName || ""),
      detail: proposalName(proposal),
      next: { label: C.steps.review, why: C.whys.approval, step: toProposal(proposal) },
    };
  }
  if (proposal.status !== "open" || proposal.sentAt) return null;
  const left = timeLeft({ receivedAt: proposal.receivedAt, sentAt: null, goalHours, now });
  const clock = timeLeftLine(left, goalHours);
  const name = proposalName(proposal);
  const lead = proposal.leadName ?? proposal.ask?.name ?? "";
  // The latest ask counts only while it is about the lead on the proposal now: after a no, picking someone else ends it.
  const ask = proposal.ask && (!proposal.leadName || !proposal.ask.name || proposal.ask.name === proposal.leadName) ? proposal.ask : null;
  const base = (kind: FeedKind, title: string, label: string, why: string, step: NextStep, at: string): FeedItem => ({
    id: `wait:${proposal.id}`,
    kind,
    at,
    title,
    detail: `${name} · ${clock}`,
    next: { label, why, step },
  });
  const C = ADMIN_HOME_COPY;
  if (ask && !ask.practice && NOT_ARRIVED.has(ask.status)) {
    return base("not_arrived", C.titles.notArrived(lead), C.steps.checkNumber, C.whys.notArrived, toPeople, proposal.receivedAt);
  }
  const practice = Boolean(ask?.practice);
  const title = (words: string) => (practice ? C.titles.practice(words) : words);
  const mark = (item: FeedItem): FeedItem => (practice ? { ...item, practice: true } : item);
  if (ask?.reply === "no") return mark(base("said_no", title(C.titles.saidNo(lead)), C.steps.pickAnother, practice ? C.whys.practice : C.whys.saidNo, toLead(proposal.id), proposal.receivedAt));
  if (ask?.reply === "stop" || (ask && ask.status === "opted_out")) {
    return mark(base("opted_out", title(C.titles.optedOut(lead)), C.steps.pickAnother, practice ? C.whys.practice : C.whys.optedOut, toLead(proposal.id), proposal.receivedAt));
  }
  if (!proposal.leadContactId && !proposal.leadName) {
    return base("no_lead", C.titles.noLead, C.steps.pickLead, C.whys.noLead, toLead(proposal.id), proposal.receivedAt);
  }
  if (left.state === "over") return base("over", C.titles.over, C.steps.openProposal, C.whys.over, toProposal(proposal), proposal.receivedAt);
  if (left.state === "running" && nearlyOver(left.hoursLeft, goalHours)) {
    return base("nearly_over", C.titles.nearlyOver, C.steps.openProposal, C.whys.nearlyOver, toProposal(proposal), proposal.receivedAt);
  }
  return null;
}

/** What happened to a proposal today, newest first. Never the time between two of them. */
function todayFor(proposal: DeskProposal, now: Date): FeedItem[] {
  const C = ADMIN_HOME_COPY;
  const name = proposalName(proposal);
  const items: FeedItem[] = [];
  const lead = proposal.leadName ?? proposal.ask?.name ?? "";
  if (proposal.status === "won" && isToday(proposal.decidedAt, now)) {
    items.push({
      id: `won:${proposal.id}`,
      kind: "won",
      at: proposal.decidedAt as string,
      title: C.titles.won,
      detail: name,
      next: proposal.engagementId
        ? { label: C.steps.openBoard, why: C.whys.won, step: { to: "/engagements/$id/canvas-lab", params: { id: proposal.engagementId } } }
        : { label: C.steps.openProposal, why: C.whys.wonNoBoard, step: toProposal(proposal) },
    });
  }
  if (proposal.status === "lost" && isToday(proposal.decidedAt, now)) {
    items.push({ id: `lost:${proposal.id}`, kind: "lost", at: proposal.decidedAt as string, title: C.titles.lost, detail: name, next: { label: C.steps.seeLost, why: C.whys.lost, step: toProposal(proposal) } });
  }
  if (proposal.sentAt && isToday(proposal.sentAt, now)) {
    items.push({ id: `sent:${proposal.id}`, kind: "sent", at: proposal.sentAt, title: C.titles.sent, detail: name, next: { label: C.steps.openProposal, why: proposal.status === "open" ? C.whys.sent : C.whys.sentDecided, step: toProposal(proposal) } });
  }
  const ask = proposal.ask;
  // The server says only that the yes came today, never when, so it carries no time of its own and is listed first.
  if (ask?.reply === "yes" && ask.recent) {
    items.push({
      id: `yes:${proposal.id}`,
      kind: "said_yes",
      at: "",
      title: ask.practice ? C.titles.practice(C.titles.saidYes(lead)) : C.titles.saidYes(lead),
      detail: name,
      next: { label: C.steps.openProposal, why: ask.practice ? C.whys.practice : C.whys.saidYes, step: toProposal(proposal) },
    });
  }
  if (isToday(proposal.receivedAt, now)) {
    const led = Boolean(proposal.leadContactId || proposal.leadName);
    items.push({
      id: `brief:${proposal.id}`,
      kind: "brief",
      at: proposal.receivedAt,
      title: C.titles.brief,
      detail: name,
      next:
        proposal.status !== "open"
          ? { label: C.steps.openProposal, why: C.whys.briefDecided, step: toProposal(proposal) }
          : led
            ? { label: C.steps.openProposal, why: C.whys.briefLed, step: toProposal(proposal) }
            : { label: C.steps.pickLead, why: C.whys.brief, step: toLead(proposal.id) },
    });
  }
  return items;
}

/** Waiting items first by how much they need the admin, then the oldest first. */
const URGENCY: Record<FeedKind, number> = {
  approval: 0,
  not_arrived: 0,
  said_no: 1,
  opted_out: 1,
  over: 2,
  invite: 3,
  no_lead: 4,
  nearly_over: 5,
  seats: 6,
  people: 7,
  said_yes: 8,
  brief: 8,
  sent: 8,
  won: 8,
  lost: 8,
};

/** An item with no time of its own (a lead's yes) counts as the newest. */
const stamp = (item: FeedItem) => (item.at ? Date.parse(item.at) : Number.POSITIVE_INFINITY);
const byTime = (a: FeedItem, b: FeedItem) => stamp(a) - stamp(b) || a.id.localeCompare(b.id);

/** The two lists, from whatever sources arrived. A source that is missing adds nothing; it never empties the rest. */
export function buildAdminFeed({ desk, roster, notifications, now }: FeedSources): AdminFeed {
  const C = ADMIN_HOME_COPY;
  const waiting: FeedItem[] = [];
  const today: FeedItem[] = [];
  for (const proposal of desk?.proposals ?? []) {
    const wait = waitingFor(proposal, desk?.goalHours ?? 72, now);
    if (wait) waiting.push(wait);
    today.push(...todayFor(proposal, now));
  }
  for (const row of notifications ?? []) {
    if (row.acted_at) continue;
    if (row.kind === "invite_needs_approval" && row.section === "needs_you") {
      waiting.push({ id: `invite:${row.id}`, kind: "invite", at: row.created_at, title: C.titles.invite, detail: notificationSentence(row), next: { label: C.steps.approve, why: C.whys.invite, step: { to: "notifications" } } });
    } else if (row.kind === "seat_over_count" && !row.read_at) {
      waiting.push({ id: `seats:${row.id}`, kind: "seats", at: row.created_at, title: C.titles.seats, detail: notificationSentence(row), next: { label: C.steps.seats, why: C.whys.seats, step: { to: "/settings" } } });
    }
  }
  const missing = (roster ?? []).filter((person) => person.needsDetails);
  if (missing.length) {
    const names = missing.slice(0, 2).map((person) => person.name.trim()).filter(Boolean);
    const rest = missing.length - names.length;
    const detail = rest > 0 ? `${names.join(", ")} and ${rest} more` : names.join(" and ");
    waiting.push({ id: "people:missing", kind: "people", at: now.toISOString(), title: C.titles.people(missing.length), detail, next: { label: C.steps.people, why: C.whys.people, step: toPeople } });
  }
  // QA N3: a practice answer is labelled as such and needs no one, so it waits behind every real item.
  const rank = (item: FeedItem) => (item.practice ? 100 : URGENCY[item.kind]);
  waiting.sort((a, b) => rank(a) - rank(b) || byTime(a, b));
  today.sort((a, b) => byTime(b, a));
  return { waiting, today: today.slice(0, ADMIN_HOME_TODAY_ROWS), todayMore: Math.max(0, today.length - ADMIN_HOME_TODAY_ROWS) };
}

/** The ids on screen that were not on it after the last read. The first read marks nothing as new. */
export function arrivedIds(previous: ReadonlySet<string> | null, items: readonly FeedItem[]): Set<string> {
  if (!previous) return new Set();
  return new Set(items.filter((item) => !previous.has(item.id)).map((item) => item.id));
}

/** "09:42", or "Yesterday 16:20" before the admin's own midnight. Only a time of day, never a duration. */
export function feedTime(iso: string, now: Date = new Date(), locale?: string): string {
  const at = new Date(iso);
  if (!Number.isFinite(at.getTime())) return "";
  const time = at.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  return at.getTime() < startOfToday(now).getTime() ? ADMIN_HOME_COPY.yesterday(time) : time;
}

/** How many proposals are open, for the one-tap way into Proposals. */
export function openCount(desk: DeskList | undefined): number {
  return (desk?.proposals ?? []).filter((proposal) => proposal.status === "open").length;
}
