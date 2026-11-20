/**
 * The demo firm's proposals and the people it works with, as data (20 Nov 2026, chat pill build, Phase 2). Before
 * this they came from a pasted backfill (backfill-kestrel.sql, 19 Nov) and two proposals made by hand in the app, so
 * a reset and reseed lost them. Now the seed writes them, the same rows the backfill wrote, so a reseed brings them
 * back. Every person and client is invented. No phone number, no email, no text agreement and no ask is seeded.
 */

/** A person the firm works with who has no login (roster_contacts). Name, role and firm only. */
export type DemoContact = { key: string; name: string; role: string | null; firm: string | null };

export const DEMO_CONTACTS: readonly DemoContact[] = [
  { key: "nwosu", name: "Adaeze Nwosu", role: "Healthcare operations", firm: null },
  { key: "rafferty", name: "Colm Rafferty", role: "Commercial diligence", firm: null },
  { key: "villareal", name: "Hana Villareal", role: "Workforce and education", firm: null },
  { key: "edvardsen", name: "Jonas Edvardsen", role: "Operating model design", firm: null },
  { key: "mokoena", name: "Thandiwe Mokoena", role: "Nonprofit revenue strategy", firm: null },
  { key: "quintero", name: "Rafael Quintero", role: "Pricing and market entry", firm: null },
  { key: "lambrecht", name: "Odette Lambrecht", role: "Partner, integration", firm: "Alder Row Partners" },
  { key: "thibodeaux", name: "Marcus Thibodeaux", role: "Principal", firm: "Alder Row Partners" },
  { key: "farouk", name: "Yusra Farouk", role: "Research director", firm: "Tessel and Finch Research" },
  { key: "ashcombe", name: "Gideon Ashcombe", role: "Managing director", firm: "Pennywhistle Advisory" },
  // The two people the buyer script asks by text (Larkspur's lead is Christy).
  { key: "stanton", name: "Ben Stanton", role: null, firm: null },
  { key: "johnson", name: "Christy Johnson", role: null, firm: null },
];

/**
 * The won proposal each older board came from, as Record the win leaves it: title, client, owner and notes are the
 * board's own; decided the moment before the board was made (board.start at 09:00 UTC). Times are UTC.
 * sentAt null: it was never marked as sent.
 */
export type DemoWonProposal = { board: string; receivedAt: string; sentAt: string | null; lead: string };

export const DEMO_WON_PROPOSALS: readonly DemoWonProposal[] = [
  { board: "b12", receivedAt: "2022-12-16T15:12:00Z", sentAt: "2022-12-18T10:30:00Z", lead: "edvardsen" },
  { board: "b29", receivedAt: "2024-01-18T14:40:00Z", sentAt: "2024-01-19T21:09:00Z", lead: "rafferty" },
  { board: "b1", receivedAt: "2024-01-09T17:05:00Z", sentAt: "2024-01-11T20:45:00Z", lead: "villareal" },
  { board: "b17", receivedAt: "2024-01-02T16:22:00Z", sentAt: "2024-01-05T23:13:00Z", lead: "quintero" },
  { board: "b10", receivedAt: "2023-12-26T19:48:00Z", sentAt: "2023-12-27T21:00:00Z", lead: "edvardsen" },
  { board: "b21", receivedAt: "2024-03-19T15:30:00Z", sentAt: null, lead: "mokoena" },
  { board: "b25", receivedAt: "2024-03-28T13:55:00Z", sentAt: "2024-03-29T07:29:00Z", lead: "ashcombe" },
  { board: "b15", receivedAt: "2024-03-14T18:10:00Z", sentAt: "2024-03-17T05:55:00Z", lead: "farouk" },
  { board: "b6", receivedAt: "2024-04-05T14:15:00Z", sentAt: "2024-04-07T13:11:00Z", lead: "nwosu" },
  { board: "b19", receivedAt: "2024-07-26T20:02:00Z", sentAt: "2024-07-30T19:19:00Z", lead: "villareal" },
  { board: "b2", receivedAt: "2024-08-02T16:45:00Z", sentAt: "2024-08-04T07:13:00Z", lead: "villareal" },
  { board: "b22", receivedAt: "2025-01-06T15:20:00Z", sentAt: "2025-01-09T10:59:00Z", lead: "mokoena" },
  { board: "b5", receivedAt: "2025-02-10T17:38:00Z", sentAt: "2025-02-13T00:28:00Z", lead: "nwosu" },
  { board: "b13", receivedAt: "2025-02-06T19:06:00Z", sentAt: "2025-02-07T16:17:00Z", lead: "edvardsen" },
  { board: "b8", receivedAt: "2025-03-24T14:50:00Z", sentAt: "2025-03-27T12:12:00Z", lead: "nwosu" },
  { board: "b18", receivedAt: "2025-03-14T16:33:00Z", sentAt: "2025-03-16T04:06:00Z", lead: "quintero" },
  { board: "b3", receivedAt: "2025-03-03T18:25:00Z", sentAt: null, lead: "villareal" },
  { board: "b23", receivedAt: "2025-05-15T15:08:00Z", sentAt: "2025-05-17T16:03:00Z", lead: "mokoena" },
  { board: "b9", receivedAt: "2025-07-25T13:42:00Z", sentAt: "2025-07-28T04:58:00Z", lead: "lambrecht" },
  { board: "b16", receivedAt: "2025-08-12T17:55:00Z", sentAt: "2025-08-16T09:22:00Z", lead: "farouk" },
  { board: "b11", receivedAt: "2025-07-31T14:28:00Z", sentAt: "2025-08-01T18:06:00Z", lead: "edvardsen" },
  { board: "b28", receivedAt: "2025-09-02T16:05:00Z", sentAt: null, lead: "rafferty" },
  { board: "b26", receivedAt: "2025-08-29T19:30:00Z", sentAt: "2025-08-30T18:40:00Z", lead: "rafferty" },
  { board: "b27", receivedAt: "2026-05-19T15:47:00Z", sentAt: "2026-05-22T01:08:00Z", lead: "thibodeaux" },
  { board: "b14", receivedAt: "2026-09-10T18:40:00Z", sentAt: "2026-09-15T18:12:00Z", lead: "villareal" },
  { board: "b20", receivedAt: "2026-09-04T14:05:00Z", sentAt: "2026-09-06T06:48:00Z", lead: "quintero" },
  { board: "b4", receivedAt: "2026-09-29T16:52:00Z", sentAt: "2026-10-02T10:46:00Z", lead: "villareal" },
  { board: "b24", receivedAt: "2026-10-02T13:18:00Z", sentAt: "2026-10-03T21:33:00Z", lead: "mokoena" },
  { board: "b30", receivedAt: "2026-10-14T17:12:00Z", sentAt: "2026-10-17T21:38:00Z", lead: "ashcombe" },
  { board: "b7", receivedAt: "2026-10-07T15:36:00Z", sentAt: "2026-10-09T12:13:00Z", lead: "nwosu" },
];

/** Proposals the firm lost, for clients it has. No board. The client is a board's client, named by its board key. */
export type DemoLostProposal = {
  key: string;
  clientOf: string;
  owner: string;
  title: string;
  notes: string;
  receivedAt: string;
  sentAt: string | null;
  decidedAt: string;
  lead: string | null;
};

export const DEMO_LOST_PROPOSALS: readonly DemoLostProposal[] = [
  {
    key: "l1",
    clientOf: "b17",
    owner: "whitfield",
    title: "Loyalty program redesign",
    notes: "Follow-on to the Canada work. Evergreen wanted its loyalty program redesigned before the holiday season. They gave it to the agency that already runs their email program.",
    receivedAt: "2024-09-17T15:20:00Z",
    sentAt: "2024-09-19T16:38:00Z",
    decidedAt: "2024-10-22T17:33:00Z",
    lead: "quintero",
  },
  {
    key: "l2",
    clientOf: "b10",
    owner: "sorensen",
    title: "Underwriting workflow review",
    notes: "Asked for a review of the underwriting workflow, modelled on the claims work. A new chief underwriting officer decided to do it in house.",
    receivedAt: "2024-11-05T17:45:00Z",
    sentAt: "2024-11-08T11:14:00Z",
    decidedAt: "2024-12-09T20:11:00Z",
    lead: "edvardsen",
  },
  {
    key: "l3",
    clientOf: "b25",
    owner: "brennan",
    title: "Portfolio operations playbook",
    notes: "A playbook for the first 100 days at each new portfolio company. Went to a firm with a bench of former operators.",
    receivedAt: "2025-01-14T14:10:00Z",
    sentAt: "2025-01-15T19:50:00Z",
    decidedAt: "2025-02-11T16:49:00Z",
    lead: null,
  },
  {
    key: "l4",
    clientOf: "b19",
    owner: "castellano",
    title: "Seasonal workforce planning",
    notes: "Staffing plan for the summer season across all parks. They chose a workforce analytics vendor instead of an advisory project.",
    receivedAt: "2025-03-18T16:30:00Z",
    sentAt: "2025-03-22T05:21:00Z",
    decidedAt: "2025-04-29T19:22:00Z",
    lead: "villareal",
  },
  {
    key: "l5",
    clientOf: "b6",
    owner: "tanaka",
    title: "Telehealth expansion business case",
    notes: "Business case for extending telehealth to the rural clinics. Capital spending was frozen for the fiscal year and nothing was awarded.",
    receivedAt: "2025-06-10T15:05:00Z",
    sentAt: "2025-06-12T10:17:00Z",
    decidedAt: "2025-07-16T17:10:00Z",
    lead: "nwosu",
  },
  {
    key: "l6",
    clientOf: "b16",
    owner: "kowalski",
    title: "Customer churn diagnostic",
    notes: "Diagnostic on rising churn in the prepaid base. They needed a team on site within two weeks and we could not staff it in time.",
    receivedAt: "2025-11-11T18:15:00Z",
    sentAt: "2025-11-14T03:38:00Z",
    decidedAt: "2025-12-16T20:33:00Z",
    lead: null,
  },
  {
    key: "l7",
    clientOf: "b11",
    owner: "lindqvist",
    title: "Branch network strategy",
    notes: "Which branches to keep, merge or close over three years. Three firms were asked and the work went to the bank's incumbent adviser.",
    receivedAt: "2026-02-10T14:40:00Z",
    sentAt: "2026-02-12T04:14:00Z",
    decidedAt: "2026-03-17T17:11:00Z",
    lead: "edvardsen",
  },
  {
    key: "l8",
    clientOf: "b29",
    owner: "haddad",
    title: "Second platform diligence",
    notes: "Commercial diligence on a second distribution platform. The seller withdrew before Wexcombe chose an adviser.",
    receivedAt: "2026-04-21T13:25:00Z",
    sentAt: "2026-04-22T13:10:00Z",
    decidedAt: "2026-05-12T16:09:00Z",
    lead: "rafferty",
  },
  {
    key: "l9",
    clientOf: "b2",
    owner: "hollis",
    title: "Enrollment forecasting model",
    notes: "A five-year enrollment forecast by program. The college moved the work to its own institutional research office before we sent a proposal.",
    receivedAt: "2026-08-18T16:00:00Z",
    sentAt: null,
    decidedAt: "2026-08-27T18:57:00Z",
    lead: null,
  },
];

/**
 * The open proposals the buyer script starts from, dated from the moment of the seed so their clocks read the same
 * after any reseed. New clients, made by the seed. Larkspur is sent and led by Christy; Pellham waits for a lead.
 */
export type DemoOpenProposal = {
  key: string;
  client: string;
  owner: string;
  title: string;
  notes: string;
  /** Hours before the seed ran that the brief came in. */
  receivedHoursAgo: number;
  /** Hours after it came in that it was marked as sent, or null. */
  sentAfterHours: number | null;
  lead: string | null;
};

export const DEMO_OPEN_PROPOSALS: readonly DemoOpenProposal[] = [
  {
    key: "o1",
    client: "Larkspur Senior Living",
    owner: "hollis",
    title: "Staffing model review",
    notes: "Six assisted living communities. Agency staff cover close to a third of care shifts and the cost has doubled in eighteen months. They want options for shift patterns, ratios and pay bands, with the cost and risk of each, and a recommendation they can act on this fiscal year. Findings wanted in eight weeks.",
    receivedHoursAgo: 20,
    sentAfterHours: 18,
    lead: "johnson",
  },
  {
    key: "o2",
    client: "Pellham County Public Health",
    owner: "hollis",
    title: "Community health needs assessment",
    notes: "The county must finish a community health needs assessment before the end of next fiscal year. Grant funding is confirmed. They want better reach into the rural east of the county and among residents who do not speak English at home. Three phases over about six months: plan and data, survey and listening sessions, analysis and report.",
    receivedHoursAgo: 6,
    sentAfterHours: null,
    lead: null,
  },
];

/** Every problem with the proposals data, in plain words. Empty means it is ready to seed. */
export function proposalDataProblems(
  boards: readonly { key: string; title: string; start: string; team: string[]; client: { name: string }; pursuit?: boolean | undefined }[],
  people: readonly { key: string; role: string }[],
): string[] {
  const problems: string[] = [];
  const boardByKey = new Map(boards.map((board) => [board.key, board]));
  const contacts = new Set(DEMO_CONTACTS.map((contact) => contact.key));
  const owners = new Set(people.filter((person) => person.role !== "coach").map((person) => person.key));
  const at = (iso: string | null) => (iso === null ? NaN : Date.parse(iso));
  if (contacts.size !== DEMO_CONTACTS.length) problems.push("two people we work with share a key");
  if (new Set(DEMO_CONTACTS.map((contact) => contact.name)).size !== DEMO_CONTACTS.length) problems.push("two people we work with share a name");
  const wonBoards = new Set<string>();
  for (const won of DEMO_WON_PROPOSALS) {
    const board = boardByKey.get(won.board);
    if (!board) {
      problems.push(`won: no board ${won.board}`);
      continue;
    }
    if (board.pursuit) problems.push(`won: ${won.board} is a pursuit, not a won board`);
    if (wonBoards.has(won.board)) problems.push(`won: ${won.board} has two proposals`);
    wonBoards.add(won.board);
    if (!contacts.has(won.lead)) problems.push(`won ${won.board}: lead ${won.lead} is not in the list`);
    if (!owners.has(board.team[0]!)) problems.push(`won ${won.board}: owner ${board.team[0]} cannot own a proposal`);
    const decided = Date.parse(`${board.start}T09:00:00Z`);
    if (!(at(won.receivedAt) < decided)) problems.push(`won ${won.board}: the brief must come before the board`);
    if (won.sentAt !== null && !(at(won.sentAt) >= at(won.receivedAt) && at(won.sentAt) < decided)) problems.push(`won ${won.board}: sent must sit between the brief and the win`);
  }
  const titles = new Set<string>();
  for (const lost of DEMO_LOST_PROPOSALS) {
    if (!boardByKey.has(lost.clientOf)) problems.push(`lost ${lost.key}: no board ${lost.clientOf} for its client`);
    if (!owners.has(lost.owner)) problems.push(`lost ${lost.key}: owner ${lost.owner} is not a demo person who can own one`);
    if (lost.lead !== null && !contacts.has(lost.lead)) problems.push(`lost ${lost.key}: lead ${lost.lead} is not in the list`);
    if (!(at(lost.decidedAt) > at(lost.receivedAt))) problems.push(`lost ${lost.key}: decided must come after the brief`);
    if (lost.sentAt !== null && !(at(lost.sentAt) >= at(lost.receivedAt) && at(lost.sentAt) <= at(lost.decidedAt))) problems.push(`lost ${lost.key}: sent must sit between the brief and the decision`);
    if (titles.has(lost.title)) problems.push(`lost ${lost.key}: title used twice`);
    titles.add(lost.title);
  }
  for (const open of DEMO_OPEN_PROPOSALS) {
    if (!owners.has(open.owner)) problems.push(`open ${open.key}: owner ${open.owner} cannot own a proposal`);
    if (open.lead !== null && !contacts.has(open.lead)) problems.push(`open ${open.key}: lead ${open.lead} is not in the list`);
    if (open.sentAfterHours !== null && !(open.sentAfterHours >= 0 && open.sentAfterHours <= open.receivedHoursAgo)) problems.push(`open ${open.key}: sent must sit between the brief and now`);
  }
  for (const text of [...DEMO_LOST_PROPOSALS.map((p) => p.notes + p.title), ...DEMO_OPEN_PROPOSALS.map((p) => p.notes + p.title)])
    if (/—|\$|£|€|\d{3}[-. ]\d{4}/.test(text)) problems.push(`no fees, phone numbers or em dashes in proposal text: "${text.slice(0, 40)}"`);
  return problems;
}
