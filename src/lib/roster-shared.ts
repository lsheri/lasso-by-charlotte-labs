/**
 * 19 Nov 2026, Proposal Desk: the roster. The people a firm works with who have no login: independent consultants
 * and people at other firms who help with proposals and projects. The pure rules of the roster panel and of the
 * server functions behind it. Nothing here reads or writes anything.
 *
 * Who: admins and the firm's own leads add and edit (Liam, D-37). Nobody else sees the roster.
 * Contact details (Liam, 20 Nov: "profiles cant be added from an admin without number and email. i'd like linkedin
 * as well"): an add needs a mobile number and an email; LinkedIn is optional. They are contact information only. A
 * number typed here is never an agreement to texts: texts go only to the number the person enters on their own link.
 * Privacy floor: the full number never reaches the browser again after it is typed. A contact carries it masked to
 * its last four digits. Email and LinkedIn are shown to the admins and leads who see this list, and to nobody else.
 * Whether a person agreed to texts is worked out on the server from message_consents and arrives here as one word.
 */
import { cleanName, cleanWorkspace, normalizePhone } from "@/lib/text-consent-shared";

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
  /** The number an admin or lead typed, masked to its last four digits. Never the full number. */
  phoneMasked: string | null;
  email: string | null;
  linkedin: string | null;
  /** True for a person added before details were asked for, who has no number and email on file. */
  needsDetails: boolean;
  /** True when the number they agreed with themselves is not the one on file. Texts use the agreed one. */
  numberDiffers: boolean;
  /** The day Lasso last emailed them their link, when it has. */
  invitedOn: string | null;
  /**
   * 21 Nov 2026, chat pill PR 4a (D-97): true when this person is a teammate with a login in this workspace. Set by
   * the server from roster_contacts.profile_id; the profile id itself never reaches the browser from the roster.
   */
  teammate?: boolean;
};

/**
 * 21 Nov 2026, chat pill PR 4a (D-97): a teammate with a login who is not on People yet, offered as a lead. Name and
 * role only. Picking one links their People row (the one whose email is their login's) or makes one.
 */
export type RosterTeammate = { profileId: string; name: string; role: "admin" | "lead" | "em" };

export type RosterList =
  | { allowed: false }
  | {
      allowed: true;
      contacts: RosterContact[];
      /** Teammates not yet on People. Absent from an older server. */
      teammates?: RosterTeammate[];
    };

export type TeammateLinkInput = { profile_id: string | null; teammate_id: string | null };
export type TeammateLinkResult =
  | { ok: true; contact: RosterContact }
  | { ok: false; reason: "missing" | "full" | "not_ready" | "unavailable" };

/** The roles a lead may have: Admin, Lead or Member. Never a Coach or a guest. */
export function canLeadAsTeammate(row: { role: string | null | undefined; is_guest?: boolean | null; deactivated_at?: string | null }): boolean {
  return (row.role === "admin" || row.role === "lead" || row.role === "em") && !row.is_guest && !row.deactivated_at;
}

/** Two email addresses are the same mailbox: compared trimmed and without case. */
export function sameEmail(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = typeof a === "string" ? a.trim().toLowerCase() : "";
  const right = typeof b === "string" ? b.trim().toLowerCase() : "";
  return left !== "" && left === right;
}

export type RosterProblem =
  | "name"
  | "role"
  | "affiliation"
  | "firm"
  | "phone"
  | "email"
  | "linkedin"
  /** A first set of details needs both a number and an email. */
  | "details";

/**
 * What a save does to the details. `phone: null` keeps the number already stored. `null` for the whole thing leaves
 * the details alone: only allowed for a person added before details were asked for.
 */
export type RosterDetails = { phone: string | null; email: string; linkedin: string | null };
export type RosterDetailsCheck =
  { ok: true; details: RosterDetails | null } | { ok: false; problems: RosterProblem[] };
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
  /** Empty on an edit keeps the number already stored. */
  phone: string;
  email: string;
  linkedin: string;
};
export type RosterSaveResult =
  | { ok: true; contact: RosterContact }
  | { ok: false; reason: "invalid"; problems: RosterProblem[] }
  | { ok: false; reason: "missing" | "full" | "unavailable" };

export type RosterInviteResult =
  | { ok: true; contact: RosterContact }
  | { ok: false; reason: "missing" | "no_email" | "recent" | "not_set_up" | "unavailable" };

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

export const EMAIL_MAX = 254;
export const LINKEDIN_MAX = 200;

/** An email address in the one stored form, lower case, or null. Shape only: nothing proves it is read. */
export function cleanEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (email.length < 3 || email.length > EMAIL_MAX) return null;
  // Invisible and control characters (a pasted zero-width space, say) look right on the page and never deliver.
  if (/[\p{Cc}\p{Cf}]/u.test(email)) return null;
  // An apostrophe is allowed before the @ only: O'Brien and D'Arcy are real addresses.
  return /^[^@\s<>",;:()]+@[^@\s<>"',;:()]+\.[a-z0-9-]{2,}$/.test(email) ? email : null;
}

/**
 * A LinkedIn address in the one stored form, https and no query, or null. Accepts what people paste:
 * linkedin.com/in/name, www.linkedin.com/in/name, with or without https. Any other site is refused.
 */
export function cleanLinkedin(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const typed = value.trim();
  if (typed.length === 0 || typed.length > 400 || /\s/.test(typed)) return null;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(typed) ? typed : `https://${typed}`);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  if (host !== "linkedin.com" && !/^[a-z0-9-]+\.linkedin\.com$/.test(host)) return null;
  if (url.username || url.password || url.port) return null;
  const path = url.pathname.replace(/\/+$/, "");
  if (path.length < 2) return null;
  const clean = `https://${host === "linkedin.com" ? "www.linkedin.com" : host}${path}`;
  return clean.length <= LINKEDIN_MAX ? clean : null;
}

/** A stored number with everything but its last four digits hidden, for the people who may see the list. */
export function maskPhone(e164: unknown): string | null {
  return typeof e164 === "string" && /^\+1\d{10}$/.test(e164)
    ? `(•••) •••-${e164.slice(-4)}`
    : null;
}

/**
 * The rules for the details on one save. An add needs a number and an email. A person who has details keeps their
 * number when the box is left empty, and always has an email. A person from before details were asked for may be
 * saved with all three left empty, and stays marked as needing them.
 */
export function checkRosterDetails(
  input: Partial<Record<"phone" | "email" | "linkedin", unknown>> | null | undefined,
  person: { adding: boolean; hasDetails: boolean },
): RosterDetailsCheck {
  const blank = (value: unknown) => typeof value !== "string" || value.trim() === "";
  const noPhone = blank(input?.phone);
  const noEmail = blank(input?.email);
  const noLinkedin = blank(input?.linkedin);
  if (!person.adding && !person.hasDetails && noPhone && noEmail && noLinkedin)
    return { ok: true, details: null };
  const problems: RosterProblem[] = [];
  const phone = noPhone ? null : normalizePhone(input?.phone);
  // The stored number is kept only for a person who has one.
  if (noPhone ? !person.hasDetails : !phone) problems.push("phone");
  const email = cleanEmail(input?.email);
  if (!email) problems.push("email");
  const linkedin = noLinkedin ? null : cleanLinkedin(input?.linkedin);
  if (!noLinkedin && !linkedin) problems.push("linkedin");
  if (!email || problems.length > 0) return { ok: false, problems };
  return { ok: true, details: { phone, email, linkedin } };
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
    phone: text(raw["phone"], 64),
    email: text(raw["email"], 400),
    linkedin: text(raw["linkedin"], 400),
  };
}

export function teammateLinkInput(input: unknown): TeammateLinkInput {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  return { profile_id: cleanWorkspace(raw["profile_id"]), teammate_id: cleanWorkspace(raw["teammate_id"]) };
}

export function rosterChangeInput(input: unknown): RosterChangeInput {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  return { profile_id: cleanWorkspace(raw["profile_id"]), id: cleanWorkspace(raw["id"]) };
}

export const ROSTER_COPY = {
  heading: "People we work with",
  intro:
    "Independent consultants and people at other firms who help with proposals and projects, and teammates picked to lead one. Only admins and leads see this list and the contact details on it.",
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
  email: "Email the link",
  emailLabel: (name: string) => `Email the text agreement link to ${name}`,
  emailing: "Sending",
  emailed: (address: string) => `Emailed to ${address}. They still open it and enter their own number; nothing is agreed until they do.`,
  emailedOn: (day: string) => `Link emailed ${day}`,
  emailFailures: {
    missing: "That person is no longer on the list. Reload the page.",
    no_email: "There is no email on file for them. Open Edit to add one.",
    recent: "Their link was emailed in the last ten minutes. Give it a little time.",
    not_set_up: "Email is not set up yet, so nothing was sent. Copy the link and send it yourself.",
    unavailable: "The email did not go. Nothing was sent. Try again in a moment.",
  },
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
  teammate: "Teammate",
  teammateTitle: "Has a login in this workspace",
  needsDetails: "Needs a number and email",
  needsDetailsCount: (count: number) =>
    `${count} ${count === 1 ? "person needs" : "people need"} a mobile number and email. Open Edit to add them.`,
  numberDiffers:
    "Agreed with a different number than the one on file. Texts use the one they agreed with.",
  phoneOnFile: (masked: string) => `Mobile ${masked}`,
  linkedin: "LinkedIn",
  linkedinLabel: (name: string) => `LinkedIn page for ${name}`,
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
      "Name, what they do, where they work and how to reach them. A mobile number and an email are needed to add someone. The number here is for contact only: Lasso texts a person only after they agree on their own link.",
    editDescription:
      "Their name, what they do, where they work and how to reach them. The number here is for contact only: Lasso texts a person only after they agree on their own link.",
    phone: "Mobile number",
    phoneHint: "United States or Canada. For example (206) 555-0142.",
    phoneKeep: (masked: string) => `On file: ${masked}. Leave empty to keep it, or type a new one.`,
    email: "Email",
    emailHint: "For reaching them.",
    linkedin: "LinkedIn address (optional)",
    linkedinHint: "For example linkedin.com/in/their-name.",
    legacy:
      "This person was added before contact details were asked for. Add a mobile number and an email.",
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
    phone: "Enter their mobile number with its area code. United States or Canada only.",
    email: "Enter their email address, like name@example.com.",
    linkedin: "Enter a LinkedIn address, like linkedin.com/in/their-name, or leave it empty.",
    details: "A mobile number and an email are both needed.",
  } satisfies Record<RosterProblem, string>,
  failures: {
    invalid: "Check the fields, then save again.",
    missing: "That person is no longer on the list. Close this and reload.",
    full: "The list is full at 500 people.",
    unavailable: "That did not save. Nothing was changed. Try again in a moment.",
    forbidden: "Only admins and leads can change this list.",
  },
} as const;
