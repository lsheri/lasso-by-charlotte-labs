/**
 * 20 Nov 2026, chat pill PR 3a (Liam, D-111): reading a pasted brief. The model proposes the client, what they asked
 * for and the due date; code keeps only what it can find in the paste word for word, and works the date out itself.
 * Nothing here trusts a model: a client the paste never names, an ask the paste never says, or a date phrase that is
 * not in the paste is dropped, and the card asks the person instead.
 *
 * The pure rules: matching, dates, the checked reading and the words. No fee, no person and no score is read here.
 */

/** The most a paste may be: the proposal's own notes limit, since the whole paste becomes its notes. */
export const BRIEF_READ_MAX = 8000;
/** The shortest paste worth reading. */
export const BRIEF_READ_MIN = 12;
/** What they asked for, as a proposal title. */
export const BRIEF_ASK_MAX = 160;
/** A client's name. */
export const BRIEF_CLIENT_MAX = 120;

/** Text as it is compared: one case, one kind of quote and dash, single spaces. */
export function normalise(text: string): string {
  return (
    text
      .normalize("NFKC")
      .replace(/[‘’‛]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/[‐-―]/g, "-")
      .replace(/\s+/g, " ")
      // QA L of PR 295: "St Brigid" and "St. Brigid" are the same name; a full stop before a space or the end is dropped.
      .replace(/\.(?= |$)/g, "")
      .trim()
      .toLocaleLowerCase()
  );
}

/** Whether a phrase appears in the paste word for word (case, quotes, dashes and spacing aside). */
export function appearsIn(paste: string, phrase: string): boolean {
  const needle = normalise(phrase);
  if (needle.length < 2) return false;
  const hay = normalise(paste);
  // Whole words only: "Lark" is not in "Larkspur". Every place it appears is tried (QA L of PR 295: "Larkspurs and
  // Larkspur" has Larkspur in it).
  for (let at = hay.indexOf(needle); at >= 0; at = hay.indexOf(needle, at + 1)) {
    const before = at === 0 ? "" : hay[at - 1]!;
    const after = hay[at + needle.length] ?? "";
    if (!/[\p{L}\p{N}]/u.test(before) && !/[\p{L}\p{N}]/u.test(after)) return true;
  }
  return false;
}

/* ---------------------------------------------------------------------------------------------------------------
 * Due dates, worked out in code from the words the paste uses
 * ------------------------------------------------------------------------------------------------------------- */

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

function validDay(y: number, m: number, d: number): boolean {
  if (m < 0 || m > 11 || d < 1) return false;
  return d <= new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
}

function monthIndex(word: string): number {
  const w = word.toLowerCase().replace(/\.$/, "");
  if (w.length < 3) return -1;
  return MONTHS.findIndex((m) => m.startsWith(w) && (w.length >= 3 || m === w));
}

/** The next date for a month and day: this year, or next year once it has passed. */
function upcoming(
  today: { y: number; m: number; d: number },
  m: number,
  d: number,
  year?: number,
): string | null {
  const todayAt = Date.UTC(today.y, today.m, today.d);
  if (year !== undefined) {
    // QA L of PR 295: a due date already past is not a due date; the person fills it in.
    if (!validDay(year, m, d) || Date.UTC(year, m, d) < todayAt) return null;
    return iso(year, m, d);
  }
  const passed = m < today.m || (m === today.m && d < today.d);
  // A date passed within the last two months is most likely a late paste, not next year: left for the person.
  if (passed && validDay(today.y, m, d) && todayAt - Date.UTC(today.y, m, d) <= 62 * 86_400_000)
    return null;
  if (
    m >= 10 &&
    today.m <= 1 &&
    m > today.m &&
    todayAt - Date.UTC(today.y - 1, m, d) <= 62 * 86_400_000
  )
    return null;
  const y = passed ? today.y + 1 : today.y;
  return validDay(y, m, d) ? iso(y, m, d) : null;
}

/**
 * The date a due phrase means, as YYYY-MM-DD in the firm's day (UTC here), or null when it cannot be told for sure.
 * Reads: today, tomorrow, a weekday ("Friday", "this Friday", "next Friday"), a month and day ("Dec 3", "3 December",
 * "December 3rd, 2026"), an ISO date, a US date ("12/3", "12/3/2026"), "end of week", "end of month", "in 5 days",
 * "in two weeks". Anything else is left for the person.
 */
export function dueDateFor(phrase: string, now: Date): string | null {
  const p = normalise(phrase)
    .replace(/^(?:due|by|on|before|no later than)\s+/, "")
    .replace(/[.,!]+$/, "");
  const today = { y: now.getUTCFullYear(), m: now.getUTCMonth(), d: now.getUTCDate() };
  const shift = (days: number) => {
    const t = new Date(Date.UTC(today.y, today.m, today.d + days));
    return iso(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate());
  };
  if (p === "today" || p === "end of day" || p === "eod") return shift(0);
  if (p === "tomorrow") return shift(1);
  // QA H1 of PR 295: real weekday names and their short forms only, never any word that starts like one ("monitoring").
  const day =
    /^(this |next )?(sunday|sun|monday|mon|tuesday|tues|tue|wednesday|wed|thursday|thurs|thur|thu|friday|fri|saturday|sat)$/.exec(
      p,
    );
  if (day) {
    const index = WEEKDAYS.findIndex((w) => w.startsWith(day[2]!.slice(0, 3)));
    const raw = (index - now.getUTCDay() + 7) % 7;
    // "this Friday" said on a Friday is today; a bare "Friday" on a Friday is next week's.
    if (day[1] === "this ") return shift(raw);
    const ahead = raw || 7;
    return shift(day[1] === "next " ? (ahead === 7 ? 7 : ahead + 7) : ahead);
  }
  if (p === "end of week" || p === "end of the week")
    return shift((5 - now.getUTCDay() + 7) % 7 || 0);
  if (p === "end of month" || p === "end of the month") {
    const last = new Date(Date.UTC(today.y, today.m + 1, 0));
    return iso(last.getUTCFullYear(), last.getUTCMonth(), last.getUTCDate());
  }
  const words: Record<string, number> = {
    a: 1,
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    ten: 10,
    fourteen: 14,
  };
  const inN =
    /^in (\d{1,2}|a|one|two|three|four|five|six|seven|ten|fourteen) (day|days|week|weeks)$/.exec(p);
  if (inN) {
    const n = /^\d+$/.test(inN[1]!) ? Number(inN[1]) : (words[inN[1]!] ?? 0);
    return n > 0 ? shift(inN[2]!.startsWith("week") ? n * 7 : n) : null;
  }
  const isoDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(p);
  if (isoDate) {
    const [y, m, d] = [Number(isoDate[1]), Number(isoDate[2]) - 1, Number(isoDate[3])];
    return validDay(y, m, d) ? iso(y, m, d) : null;
  }
  const us = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?$/.exec(p);
  if (us) {
    const year = us[3] ? (us[3].length === 2 ? 2000 + Number(us[3]) : Number(us[3])) : undefined;
    return upcoming(today, Number(us[1]) - 1, Number(us[2]), year);
  }
  const monthFirst = /^([a-z]+\.?) (\d{1,2})(?:st|nd|rd|th)?(?:,? (\d{4}))?$/.exec(p);
  if (monthFirst) {
    const m = monthIndex(monthFirst[1]!);
    return m < 0
      ? null
      : upcoming(
          today,
          m,
          Number(monthFirst[2]),
          monthFirst[3] ? Number(monthFirst[3]) : undefined,
        );
  }
  const dayFirst = /^(\d{1,2})(?:st|nd|rd|th)? (?:of )?([a-z]+\.?)(?:,? (\d{4}))?$/.exec(p);
  if (dayFirst) {
    const m = monthIndex(dayFirst[2]!);
    return m < 0
      ? null
      : upcoming(today, m, Number(dayFirst[1]), dayFirst[3] ? Number(dayFirst[3]) : undefined);
  }
  return null;
}

/** A due phrase found by code alone, for when the model gives none: "due Friday", "by Dec 3", "deadline: 12/3". */
export function findDuePhrase(paste: string, now: Date): { phrase: string; date: string } | null {
  // QA H1 of PR 295: numbers end where they end ("June 2027" is not June 20), and a bare "by" never takes a slashed
  // number (it is "by 1/3", a fraction, far more often than a date); slashed dates need due, deadline or submit by.
  const pattern =
    /\b(due|by|deadline:?|submit by|no later than)\s+((?:this |next )?[A-Za-z]+\.?(?: \d{1,2}(?:st|nd|rd|th)?(?!\d)(?:,? \d{4}(?!\d))?)?|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?(?![\d/])|\d{4}-\d{2}-\d{2}(?!\d)|\d{1,2}(?:st|nd|rd|th)? (?:of )?[A-Za-z]+\.?(?:,? \d{4}(?!\d))?|end of (?:the )?(?:week|month)|in \w+ (?:days?|weeks?))/gi;
  for (const match of paste.matchAll(pattern)) {
    if (match[1]!.toLowerCase() === "by" && /^\d{1,2}\//.test(match[2]!)) continue;
    // A full stop or comma after the date ends the sentence; it is not part of the date.
    const phrase = match[2]!.trim().replace(/[.,]+$/, "");
    const date = dueDateFor(phrase, now);
    if (date) return { phrase, date };
  }
  return null;
}

/* ---------------------------------------------------------------------------------------------------------------
 * The checked reading
 * ------------------------------------------------------------------------------------------------------------- */

export type BriefClient = { id: string; name: string };

export type BriefReading = {
  /** The client, when the paste names one: an existing client by id, or a new name an admin may add. */
  client: { name: string; id: string | null } | null;
  /** What they asked for, in the paste's own words. Null when it does not say it plainly enough. */
  ask: string | null;
  /** The due date: the paste's words and the date code worked out from them. */
  due: { phrase: string; date: string } | null;
  /** The whole paste, kept as the proposal's notes. */
  notes: string;
  /** Who read it: the model with code's checks, or code alone when the model could not be used. */
  readBy: "model" | "code";
};

const str = (value: unknown, max: number): string | null => {
  if (typeof value !== "string") return null;
  const clean = value.replace(/\s+/g, " ").trim();
  return clean && clean.length <= max ? clean : null;
};

/** An existing client the paste names, longest name first so "Larkspur Senior Living" wins over "Larkspur". */
export function clientNamedIn(paste: string, clients: readonly BriefClient[]): BriefClient | null {
  return (
    [...clients]
      .sort((a, b) => b.name.length - a.name.length)
      .find((client) => appearsIn(paste, client.name)) ?? null
  );
}

/**
 * The reading code keeps from what the model proposed. Every field the model offers must appear in the paste word for
 * word; a client is matched to an existing one by name; the date is worked out from the phrase by code. A model
 * reply that is not an object, or proposes nothing usable, leaves code's own reading of the paste.
 */
export function checkReading(
  raw: unknown,
  paste: string,
  clients: readonly BriefClient[],
  now: Date,
): BriefReading {
  const notes = paste.trim().slice(0, BRIEF_READ_MAX);
  const loose =
    raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
  const proposedClient = str(loose?.["client"], BRIEF_CLIENT_MAX);
  const proposedAsk = str(loose?.["ask"], BRIEF_ASK_MAX);
  const proposedDue = str(loose?.["due"], 60);

  // The client: an existing client the paste names wins; then the model's name, only if the paste says it.
  // QA M1 of PR 295: when the model's client is an existing client the paste names, it wins ("St. Brigid would like
  // what we did for Larkspur" is for St. Brigid). The longest named client is used only when the model gives none.
  const modelKnown =
    proposedClient && appearsIn(notes, proposedClient)
      ? clients.find((c) => normalise(c.name) === normalise(proposedClient))
      : undefined;
  const known =
    modelKnown ??
    (proposedClient && appearsIn(notes, proposedClient)
      ? undefined
      : clientNamedIn(notes, clients));
  let client: BriefReading["client"] = known ? { name: known.name, id: known.id } : null;
  if (!client && proposedClient && appearsIn(notes, proposedClient)) {
    const same = clients.find((c) => normalise(c.name) === normalise(proposedClient));
    client = { name: same?.name ?? proposedClient, id: same?.id ?? null };
  }

  const ask =
    proposedAsk &&
    proposedAsk.length >= 3 &&
    appearsIn(notes, proposedAsk) &&
    (!client || normalise(proposedAsk) !== normalise(client.name))
      ? proposedAsk
      : null;

  let due: BriefReading["due"] = null;
  if (proposedDue && appearsIn(notes, proposedDue)) {
    const date = dueDateFor(proposedDue, now);
    if (date) due = { phrase: proposedDue, date };
  }
  due ??= findDuePhrase(notes, now);

  return { client, ask, due, notes, readBy: loose ? "model" : "code" };
}

/** How many of the three fields the reading found: a count, for the event; never the words. */
export function fieldsFound(reading: BriefReading): "0" | "1" | "2" | "3" {
  return String([reading.client, reading.ask, reading.due].filter(Boolean).length) as
    "0" | "1" | "2" | "3";
}

export const BRIEF_READ_COPY = {
  tooShort: "Paste a little more of the brief, so there is something to read.",
  tooLong: `That brief is longer than ${BRIEF_READ_MAX.toLocaleString("en-US")} characters. Paste the part that says who it is for, what they want and when.`,
  failed: "The brief could not be read just now. Nothing was saved. Try again in a moment.",
} as const;

export type BriefReadInput = { profile_id: string | null; text: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The server function's validator: a profile id or none, and a paste of a readable length. */
export function briefReadInput(raw: {
  profile_id?: string | null | undefined;
  text?: unknown;
}): BriefReadInput {
  const text = typeof raw?.text === "string" ? raw.text.trim() : "";
  if (text.length < BRIEF_READ_MIN) throw new Error(BRIEF_READ_COPY.tooShort);
  if (text.length > BRIEF_READ_MAX) throw new Error(BRIEF_READ_COPY.tooLong);
  const profile =
    typeof raw?.profile_id === "string" && UUID.test(raw.profile_id.trim())
      ? raw.profile_id.trim()
      : null;
  return { profile_id: profile, text };
}

/** A due date as the proposal stores it: YYYY-MM-DD, or null. Anything else is refused as no date. */
export function dueOnOrNull(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number) as [number, number, number];
  return validDay(y, m - 1, d) ? value : null;
}
