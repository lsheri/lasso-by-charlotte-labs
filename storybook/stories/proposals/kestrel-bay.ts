// Made-up data shaped like the Kestrel Bay demo firm on 20 Nov 2026: 42 proposals (31 won, 9 lost, 2 open) and
// 12 people we work with. Every name here is invented. No phone number, fee or value appears anywhere.
import { leadAskBody, type AskPreview } from "@/lib/lead-ask-shared";
import type { DeskList, DeskProposal } from "@/lib/proposal-desk-shared";
import type { RosterContact } from "@/lib/roster-shared";
import { wonTextBody } from "@/lib/won-text-shared";

export const NOW = new Date("2026-11-20T15:00:00Z");
export const FIRM = "Kestrel Bay Advisory";

const person = (n: number, name: string, role: string | null, texts: RosterContact["texts"], firm: string | null = null): RosterContact => ({
  id: `c${n}`, name, role, affiliation: firm ? "firm" : "independent", firm, texts,
  agreedOn: texts === "agreed" ? "2026-11-19" : null, stoppedOn: texts === "stopped" ? "2026-11-18" : null,
  confirmed: false, changeUntil: null, linkPath: `/texts?w=o&c=c${n}`,
} as RosterContact);

export const PEOPLE: RosterContact[] = [
  person(1, "Corin Ashby", "Regulatory lead", "agreed"),
  person(2, "Mina Okafor", "Pricing partner", "none", "Okafor & Lane"),
  person(3, "Zoë D'Arcy-Núñez", "Health economics", "unknown"),
  person(4, "Tomasz Wieczorek", "Supply chain", "agreed"),
  person(5, "Priya Raghunathan", "Clinical operations", "agreed", "Northlight"),
  person(6, "Idris Bello", null, "none"),
  person(7, "Aoife Brennan", "Market access", "stopped"),
  person(8, "Lucien Marchetti-Vandenberghe", "Commercial due diligence and post-merger integration", "agreed"),
  person(9, "Sun-hee Park", "Data and analytics", "none"),
  person(10, "Rafael Monteiro", "Quality systems", "agreed"),
  person(11, "Hana Kobayashi", "Medical affairs", "none"),
  person(12, "Ottilie Grange", "Programme office", "agreed"),
];

const CLIENTS = ["Pellham", "Larkspur", "Marrowfield", "Quillbrook", "Tarnhollow", "Medrova", "St. Brigid", "Ostrander", "Vale & Finch", "Corrimony"];
const WORK = ["Market access review", "Operating model", "Pricing study", "Launch readiness", "Due diligence", "Supplier strategy", "Portfolio review"];

function made(n: number, status: DeskProposal["status"], over: Partial<DeskProposal> = {}): DeskProposal {
  const day = String(1 + (n % 27)).padStart(2, "0");
  return {
    id: `p${n}`, title: WORK[n % WORK.length] as string, clientName: CLIENTS[n % CLIENTS.length] as string,
    ownerName: n % 3 === 0 ? "Harper Quinn" : "Maren Hollis", mine: n % 3 !== 0, status,
    receivedAt: `2026-10-${day}T09:00:00Z`, sentAt: `2026-10-${day}T20:00:00Z`,
    decidedAt: status === "open" ? null : `2026-11-${String(1 + (n % 18)).padStart(2, "0")}T12:00:00Z`,
    engagementId: status === "won" ? `e${n}` : null, contextCount: n % 4, canAct: true, canClose: status === "open", canArchive: status !== "won",
    leadContactId: null, leadName: null, ask: null, ...over,
  } as DeskProposal;
}

export const PROPOSALS: DeskProposal[] = [
  made(0, "open", { receivedAt: "2026-11-20T12:00:00Z", sentAt: null, contextCount: 3, contextTitles: ["Pellham brief.pdf", "Call notes, 19 Nov", "Last year's review"] }),
  made(1, "open", { receivedAt: "2026-11-19T10:00:00Z", sentAt: "2026-11-19T10:40:00Z", leadContactId: "c1", leadName: "Corin Ashby", ask: { name: "Corin Ashby", status: "delivered", reply: null, practice: false, waiting: true } }),
  ...Array.from({ length: 31 }, (_, i) => made(i + 2, "won")),
  ...Array.from({ length: 9 }, (_, i) => made(i + 33, "lost")),
];

/** What each role is sent. An analyst sees only what they started, with no roster and no pick. */
export function desk(role: "admin" | "manager" | "analyst"): DeskList {
  const picks = role !== "analyst";
  const proposals = role === "analyst" ? PROPOSALS.filter((p) => p.mine).map((p) => ({ ...p, leadContactId: null, canArchive: false })) : PROPOSALS.map((p) => ({ ...p, canArchive: role === "admin" && p.canArchive }));
  return { goalHours: 72, canSetGoal: role === "admin", canPickLead: picks, canAddClient: role === "admin", texts: { demo: true, connected: true }, proposals };
}

/** The same words the sender builds, from the same functions. */
export const WON_WORDS = wonTextBody({ brandName: "Lasso", firmName: FIRM });
export const askPreview = (mode: "real" | "demo" | "practice", warning: string | null = null): AskPreview => ({
  ok: true, mode, warning, name: "Corin Ashby",
  words: leadAskBody({ brandName: "Lasso", firmName: FIRM, leadName: "Corin Ashby", askerName: "Maren Hollis" }),
});
