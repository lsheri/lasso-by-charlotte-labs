// The Proposals page as the live Kestrel Bay demo firm reads on 20 Nov 2026: Pellham with no lead yet, Larkspur sent
// with Christy Johnson as lead and her latest test ask refused by the carrier, and the won and lost proposals that name
// a lead, so past work shows beside each name. Read once from the demo firm (names, titles and dates only). No phone
// number, fee or value appears anywhere.
import type { DeskList, DeskProposal } from "@/lib/proposal-desk-shared";
import type { RosterContact } from "@/lib/roster-shared";

export const LIVE_NOW = new Date("2026-11-20T15:00:00Z");

const person = (id: string, name: string, role: string | null, firm: string | null = null): RosterContact =>
  ({
    id, name, role, affiliation: firm ? "firm" : "independent", firm, texts: "none",
    agreedOn: null, stoppedOn: null, confirmed: false, changeUntil: null, linkPath: `/texts?w=o&c=${id}`,
  }) as RosterContact;

export const LIVE_PEOPLE: RosterContact[] = [
  person("r01", "Adaeze Nwosu", "Healthcare operations"),
  person("r12", "Ben Stanton", null),
  person("r13", "Christy Johnson", null),
  person("r02", "Colm Rafferty", "Commercial diligence"),
  person("r10", "Gideon Ashcombe", "Managing director", "Pennywhistle Advisory"),
  person("r03", "Hana Villareal", "Workforce and education"),
  person("r04", "Jonas Edvardsen", "Operating model design"),
  person("r08", "Marcus Thibodeaux", "Principal", "Alder Row Partners"),
  person("r07", "Odette Lambrecht", "Partner, integration", "Alder Row Partners"),
  person("r06", "Rafael Quintero", "Pricing and market entry"),
  person("r05", "Thandiwe Mokoena", "Nonprofit revenue strategy"),
  person("r09", "Yusra Farouk", "Research director", "Tessel and Finch Research"),
];

const name = (id: string) => LIVE_PEOPLE.find((p) => p.id === id)?.name ?? null;

function decided(n: number, status: "won" | "lost", client: string, title: string, lead: string, at: string, owner: string): DeskProposal {
  return {
    id: `d${n}`, title, clientName: client, ownerName: owner, mine: false, status, receivedAt: at, sentAt: at, decidedAt: at,
    engagementId: status === "won" ? `e${n}` : null, contextCount: 0, canAct: true, canClose: false, canArchive: status !== "won",
    leadContactId: lead, leadName: name(lead), ask: null,
  };
}

const DECIDED: DeskProposal[] = [
  decided(29, "won", "Ashbury Peak Partners", "Fund II LP materials", "r10", "2026-10-17T21:38:00Z", "Cormac Brennan"),
  decided(30, "won", "Willowmere Community Health", "Cardiometabolic service line opportunity", "r01", "2026-10-09T12:13:00Z", "Mei Tanaka"),
  decided(28, "won", "Harborlight Arts Council", "Corporate partnership strategy", "r05", "2026-10-03T21:33:00Z", "Ayanda Mbeki"),
  decided(27, "won", "Pinecrest Teaching Collaborative", "Teacher apprenticeship demand and funding model", "r03", "2026-10-02T10:46:00Z", "Folake Adeyemi"),
  decided(25, "won", "Hollisford Engineering", "Community-led technical learning", "r03", "2026-09-15T18:12:00Z", "Erik Sorensen"),
  decided(26, "won", "Copperline Utilities", "Fleet electrification offering", "r06", "2026-09-06T06:48:00Z", "Piotr Kowalski"),
  decided(24, "won", "Freightlark Software", "Second acquisition integration", "r08", "2026-05-22T01:08:00Z", "Sami Haddad"),
  decided(108, "lost", "Wexcombe Holdings", "Second platform diligence", "r02", "2026-04-22T13:10:00Z", "Sami Haddad"),
  decided(107, "lost", "Fairhaven Bank", "Branch network strategy", "r04", "2026-02-12T04:14:00Z", "Signe Lindqvist"),
  decided(23, "won", "Ironwillow Partners", "Commercial diligence on an HVAC services roll-up", "r02", "2025-08-30T18:40:00Z", "Sami Haddad"),
  decided(20, "won", "Saltmarsh Telecom", "Brand tracker and KPI rationalization", "r09", "2025-08-16T09:22:00Z", "Piotr Kowalski"),
  decided(21, "won", "Fairhaven Bank", "Digital product operating model", "r04", "2025-08-01T18:06:00Z", "Anika Voss"),
  decided(19, "won", "Medrova Software", "Integration of a first acquisition", "r07", "2025-07-28T04:58:00Z", "Tiago Pereira"),
  decided(13, "won", "St. Brigid Health", "Comprehensive weight management service line", "r01", "2025-02-13T00:28:00Z", "Tiago Pereira"),
];

export const LIVE_PROPOSALS: DeskProposal[] = [
  {
    id: "pellham", title: "Community health needs assessment", clientName: "Pellham County Public Health", ownerName: "Maren Hollis", mine: true,
    status: "open", receivedAt: "2026-11-20T01:08:40Z", sentAt: null, decidedAt: null, engagementId: null, contextCount: 2,
    contextTitles: ["Pellham kickoff email.docx", "Pellham assessment scope notes.docx"], canAct: true, canClose: true, canArchive: true,
    leadContactId: null, leadName: null, ask: null,
  },
  {
    id: "larkspur", title: "Staffing model review", clientName: "Larkspur Senior Living", ownerName: "Maren Hollis", mine: true,
    status: "open", receivedAt: "2026-11-20T01:08:18Z", sentAt: "2026-11-20T01:08:52Z", decidedAt: null, engagementId: null, contextCount: 1,
    contextTitles: ["Larkspur staffing brief.docx"], canAct: true, canClose: true, canArchive: true,
    leadContactId: "r13", leadName: "Christy Johnson",
    // The latest ask went to the demo number and the carrier refused it.
    ask: { name: "Christy Johnson", status: "rejected", reply: null, practice: false, waiting: false },
  },
  {
    id: "series-a", title: "Series A readiness", clientName: "Lasso", ownerName: "Maren Hollis", mine: true,
    status: "open", receivedAt: "2026-11-20T08:02:52Z", sentAt: null, decidedAt: null, engagementId: null, contextCount: 0,
    canAct: true, canClose: true, canArchive: true, leadContactId: "r12", leadName: "Ben Stanton",
    // Live: the latest ask is a practice ask answered yes.
    ask: { name: "Ben Stanton", status: "practice", reply: "yes", practice: true, waiting: false },
  },
  ...DECIDED,
];

/** Maren Hollis, admin: everything. Harper Quinn, lead: everything, no archive. Elif Yilmaz, member: only her own (none open). */
export function liveDesk(role: "admin" | "manager" | "analyst"): DeskList {
  const proposals =
    role === "analyst"
      ? []
      : LIVE_PROPOSALS.map((p) => ({ ...p, mine: role === "admin" && p.mine, canArchive: role === "admin" && p.canArchive }));
  return { goalHours: 72, canSetGoal: role === "admin", canPickLead: role !== "analyst", canAddClient: role === "admin", texts: { demo: true, connected: true }, proposals };
}
