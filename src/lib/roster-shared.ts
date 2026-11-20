/**
 * 19 Nov 2026, Proposal Desk: the roster. The people a firm works with who have no login: independent consultants
 * and people at other firms who help with proposals and projects. The pure rules of the roster panel and of the
 * server functions behind it. Nothing here reads or writes anything.
 *
 * Who: admins and the firm's own leads add and edit (Liam, D-37). Nobody else sees the roster.
 * Privacy floor: a roster entry holds a name, a role and a firm. It never holds a mobile number or an email. Whether
 * a person agreed to texts is worked out on the server from message_consents and arrives here as one word.
 */
import { cleanName, cleanWorkspace } from "@/lib/text-consent-shared";

export const ROSTER_TEXT_MAX = 120;
/** A workspace's roster is a list a person reads, not a database of contacts. */
export const ROSTER_MAX_CONTACTS = 500;

export const ROSTER_AFFILIATIONS = ["independent", "firm"] as const;
export type RosterAffiliation = (typeof ROSTER_AFFILIATIONS)[number];

/** agreed: a live agreement. stopped: they agreed once and opted out. none: no agreement. unknown: could not be read. */
export type RosterTexts = "agreed" | "stopped" | "none" | "unknown";

export type RosterContact = {
  id: string;
  name: string;
  role: string | null;
  affiliation: RosterAffiliation;
  firm: string | null;
  texts: RosterTexts;
  /** The day they agreed, YYYY-MM-DD, when texts is "agreed". */
  agreedOn: string | null;
  /** The day they stopped, when texts is "stopped". */
  stoppedOn: string | null;
  /** True once a message has arrived from their number. Agreeing on the page alone never sets it. */
  confirmed: boolean;
  /** The day their link stops accepting a new number, when an admin or lead has asked for one. */
  changeUntil: string | null;
  /** The path of this person's own text agreement link. The page puts its own address in front. */
  linkPath: string;
};

export type RosterList = { allowed: false } | { allowed: true; contacts: RosterContact[] };

export type RosterProblem = "name" | "role" | "affiliation" | "firm";
export type RosterFields = {
  name: string;
  role: string | null;
  affiliation: RosterAffiliation;
  firm: string | null;
};
export type RosterCheck =
  { ok: true; fields: RosterFields } | { ok: false; problems: RosterProblem[] };

export type RosterSaveInput = {
  profile_id: string | null;
  /** Null adds a person; an id corrects that person. */
  id: string | null;
  name: string;
  role: string;
  affiliation: string;
  firm: string;
};
export type RosterSaveResult =
  | { ok: true; contact: RosterContact }
  | { ok: false; reason: "invalid"; problems: RosterProblem[] }
  | { ok: false; reason: "missing" | "full" | "unavailable" };

export type RosterChangeInput = { profile_id: string | null; id: string | null };
export type RosterChangeResult =
  | { ok: true; contact: RosterContact }
  | { ok: false; reason: "missing" | "not_agreed" | "unavailable" };

/** Admins and the firm's own leads. The same two roles that manage members. */
export function canManageRoster(role: string | null | undefined): boolean {
  return role === "admin" || role === "lead";
}

/** An optional line of text: tidied like a name, null when empty, and "too long" kept apart from "empty". */
function optionalLine(value: unknown): { ok: true; value: string | null } | { ok: false } {
  if (value === null || value === undefined) return { ok: true, value: null };
  if (typeof value !== "string") return { ok: false };
  const tidy = value
    .replace(/\p{Cc}/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (tidy.length === 0) return { ok: true, value: null };
  return tidy.length <= ROSTER_TEXT_MAX ? { ok: true, value: tidy } : { ok: false };
}

/** Every rule for one roster entry, used by the dialog before it sends and by the server before it stores. */
export function checkRosterContact(
  input: Partial<Record<"name" | "role" | "affiliation" | "firm", unknown>> | null | undefined,
): RosterCheck {
  const problems: RosterProblem[] = [];
  const name = cleanName(input?.name);
  if (!name) problems.push("name");
  const role = optionalLine(input?.role);
  if (!role.ok) problems.push("role");
  const affiliation = (ROSTER_AFFILIATIONS as readonly unknown[]).includes(input?.affiliation)
    ? (input?.affiliation as RosterAffiliation)
    : null;
  if (!affiliation) problems.push("affiliation");
  const firm = optionalLine(input?.firm);
  // Someone with a firm needs its name; someone independent has none, whatever was left in the box.
  if (!firm.ok || (affiliation === "firm" && firm.value === null)) problems.push("firm");
  if (!name || !role.ok || !affiliation || !firm.ok || problems.length > 0)
    return { ok: false, problems };
  return {
    ok: true,
    fields: {
      name,
      role: role.value,
      affiliation,
      firm: affiliation === "firm" ? firm.value : null,
    },
  };
}

export type ConsentMark = {
  agreed_at: string | null;
  revoked_at: string | null;
  /** Set only when a message arrived from the number. Absent before that column exists. */
  confirmed_at?: string | null;
};

const day = (value: string | null | undefined): string | null =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : null;

export type TextsStatus = Pick<RosterContact, "texts" | "agreedOn" | "stoppedOn" | "confirmed">;

/**
 * One word for a person's agreements. A live one wins, whatever came before. Only stopped ones means stopped.
 * `null` rows means the read failed: say so, never guess "none". `confirmed` is true only when a message has
 * arrived from the number on the live agreement.
 */
export function textsStatus(rows: readonly ConsentMark[] | null): TextsStatus {
  const nothing = { agreedOn: null, stoppedOn: null, confirmed: false };
  if (rows === null) return { texts: "unknown", ...nothing };
  const live = rows.filter((row) => row.revoked_at === null);
  if (live.length > 0) {
    const first = [...live].sort((a, b) => (a.agreed_at ?? "").localeCompare(b.agreed_at ?? ""))[0];
    return {
      texts: "agreed",
      agreedOn: day(first?.agreed_at),
      stoppedOn: null,
      confirmed: live.some((row) => day(row.confirmed_at) !== null),
    };
  }
  if (rows.length === 0) return { texts: "none", ...nothing };
  const last = rows
    .map((row) => row.revoked_at ?? "")
    .sort()
    .at(-1);
  return { texts: "stopped", agreedOn: null, stoppedOn: day(last), confirmed: false };
}

/** How long a person has to enter a new number once an admin or lead asks for one. */
export const NUMBER_CHANGE_DAYS = 7;

/** The day a number-change window closes, or null when none is open at `now`. */
export function changeOpenUntil(
  until: string | null | undefined,
  now: Date = new Date(),
): string | null {
  if (typeof until !== "string") return null;
  const at = Date.parse(until);
  return Number.isFinite(at) && at > now.getTime() ? day(new Date(at).toISOString()) : null;
}

/** People whose name, role or firm contains every word typed, in any order, ignoring case and accents. */
export function filterRoster<T extends Pick<RosterContact, "name" | "role" | "firm">>(
  contacts: readonly T[],
  query: string,
): T[] {
  const fold = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...contacts];
  return contacts.filter((contact) => {
    const hay = fold([contact.name, contact.role ?? "", contact.firm ?? ""].join(" "));
    return words.every((word) => hay.includes(word));
  });
}

/** The search box appears once the list is longer than a screen reads at a glance. */
export const ROSTER_SEARCH_FROM = 8;

/** This person's own agreement link. Both ids are checked on the server when the link is used. */
export function rosterLinkPath(orgId: string, contactId: string): string {
  return `/texts?w=${encodeURIComponent(orgId)}&c=${encodeURIComponent(contactId)}`;
}

const text = (value: unknown, max: number): string =>
  typeof value === "string" ? value.slice(0, max) : "";

export function rosterListInput(input: unknown): { profile_id: string | null } {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  return { profile_id: cleanWorkspace(raw["profile_id"]) };
}

/** Shape and size only. The rules are checkRosterContact, which the handler runs. */
export function rosterSaveInput(input: unknown): RosterSaveInput {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  return {
    profile_id: cleanWorkspace(raw["profile_id"]),
    id: cleanWorkspace(raw["id"]),
    name: text(raw["name"], 400),
    role: text(raw["role"], 400),
    affiliation: text(raw["affiliation"], 20),
    firm: text(raw["firm"], 400),
  };
}

export function rosterChangeInput(input: unknown): RosterChangeInput {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  return { profile_id: cleanWorkspace(raw["profile_id"]), id: cleanWorkspace(raw["id"]) };
}

export const ROSTER_COPY = {
  heading: "People we work with",
  intro:
    "Independent consultants and people at other firms who help with proposals and projects. They have no login. Only admins and leads see this list.",
  add: "Add a person",
  empty: "Nobody yet. Add the people you bring in on proposals.",
  loading: "Loading the list",
  loadFailed: "The list did not load. Try again in a moment.",
  retry: "Try again",
  edit: "Edit",
  editLabel: (name: string) => `Edit ${name}`,
  copy: "Copy text agreement link",
  copyLabel: (name: string) => `Copy the text agreement link for ${name}`,
  copied: "Link copied. Send it to them yourself; nothing was sent.",
  copyFailed: "Could not copy. Select the link below and copy it.",
  linkLabel: (name: string) => `Text agreement link for ${name}`,
  independent: "Independent",
  search: "Search people",
  searchHint: "Name, role or firm",
  noMatch: "Nobody matches that. Clear the search to see everyone.",
  clearSearch: "Clear search",
  count: (shown: number, total: number, agreed: number) =>
    `${shown === total ? total : `${shown} of ${total}`} ${total === 1 ? "person" : "people"}, ${agreed} agreed to texts`,
  stoppedOn: (day: string) => `Stopped ${day}`,
  confirmed: "Number confirmed by a reply",
  notConfirmed: "Number not confirmed yet",
  newNumber: "Ask for a new number",
  newNumberLabel: (name: string) => `Ask ${name} for a new number`,
  newNumberDone: (day: string) =>
    `Link copied. Until ${day} it takes one new number from them and ends the old one. Send it to them yourself; nothing was sent.`,
  newNumberNoCopy: (day: string) =>
    `Until ${day} their link takes one new number and ends the old one. Could not copy; select the link below and send it to them.`,
  changeOpen: (day: string) => `Waiting for a new number until ${day}`,
  changeFailures: {
    missing: "That person is no longer on the list. Reload the page.",
    not_agreed: "They have no live text agreement to change. Send them their link to agree.",
    unavailable: "That did not go through. Nothing was changed. Try again in a moment.",
  },
  texts: {
    agreed: "Agreed to texts",
    stopped: "Stopped texts",
    none: "No text agreement",
    unknown: "Text agreement not known",
  } satisfies Record<RosterTexts, string>,
  agreedOn: (day: string) => `Agreed ${day}`,
  dialog: {
    addTitle: "Add a person",
    editTitle: "Edit this person",
    description:
      "Name, what they do, and where they work. No phone number or email is kept here: they enter their own number when they agree to texts.",
    name: "Name",
    role: "Role or specialty",
    roleHint: "For example: pricing, health economics, bid writer.",
    affiliation: "Works",
    affiliationIndependent: "Independently",
    affiliationFirm: "At a firm",
    firm: "Firm name",
    save: "Save",
    saving: "Saving",
    cancel: "Cancel",
  },
  problems: {
    name: "Enter their name, up to 120 characters.",
    role: "Keep the role or specialty to 120 characters.",
    affiliation: "Choose whether they work independently or at a firm.",
    firm: "Enter the firm's name, up to 120 characters.",
  } satisfies Record<RosterProblem, string>,
  failures: {
    invalid: "Check the fields, then save again.",
    missing: "That person is no longer on the list. Close this and reload.",
    full: "The list is full at 500 people.",
    unavailable: "That did not save. Nothing was changed. Try again in a moment.",
    forbidden: "Only admins and leads can change this list.",
  },
} as const;
