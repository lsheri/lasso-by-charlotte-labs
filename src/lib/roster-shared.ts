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

export type ConsentMark = { agreed_at: string | null; revoked_at: string | null };

/**
 * One word for a person's agreements. A live one wins, whatever came before. Only stopped ones means stopped.
 * `null` rows means the read failed: say so, never guess "none".
 */
export function textsStatus(rows: readonly ConsentMark[] | null): {
  texts: RosterTexts;
  agreedOn: string | null;
} {
  if (rows === null) return { texts: "unknown", agreedOn: null };
  const live = rows.filter((row) => row.revoked_at === null);
  if (live.length > 0) {
    const first = live.map((row) => row.agreed_at ?? "").sort()[0] ?? "";
    return {
      texts: "agreed",
      agreedOn: /^\d{4}-\d{2}-\d{2}/.test(first) ? first.slice(0, 10) : null,
    };
  }
  return { texts: rows.length > 0 ? "stopped" : "none", agreedOn: null };
}

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
