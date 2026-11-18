import type { DemoBoard } from "../types";

/**
 * Proposal demo, brief 3 (18 Nov 2026): a growth equity firm wants commercial diligence on a clinical staffing
 * business. Not shared with the firm. b26 is the one close precedent, and the draft must say so honestly. b28 is the
 * same kind of work for another client but is not shared, so it must never appear in any form (check P3).
 */
export const b33: DemoBoard = {
  key: "b33",
  practice: "Transactions",
  client: { name: "Tarnhollow Capital", type: "growth equity firm, healthcare services and software" },
  title: "Commercial diligence on a clinical staffing business (proposal)",
  pattern: "Commercial due diligence",
  shape: "diligence",
  start: "2026-11-18",
  weeks: 4,
  fee: "To be agreed",
  status: "active",
  sharedWithFirm: false,
  situation: "deal_diligence",
  pursuit: true,
  brief:
    "Tarnhollow Capital is in exclusivity to invest in Corvane Health Staffing, which places travel nurses and allied health staff with hospitals. The deal partner wants commercial diligence before the investment committee. Harper owns the proposal; Tobi is the partner and Sami the likely lead.",
  team: ["quinn", "okafor", "haddad"],
  sections: ["Intake", "Proposal"],
  items: [
    {
      key: "intake-call",
      title: "Intake call: Tarnhollow deal partner",
      type: "call",
      method: ["stakeholder_interviews"],
      role: "investment_partner",
      vendor: "granola",
      author: "okafor",
      section: "Intake",
      date: "2026-11-18",
      body: `# Intake call: Deal partner, Tarnhollow Capital
Attendees: Tobi Okafor (Kestrel Bay), Deal partner, Vice President

**Tobi:** What is the deal?
**Deal partner:** A growth investment in Corvane Health Staffing. They place travel nurses and allied health staff with hospitals in about fifteen states. We are in exclusivity.
**Tobi:** What do you need to believe?
**Deal partner:** That demand holds now that hospitals are cutting travel staff, that their bill rates are not about to fall, and that the hospital clients stay.
**Vice President:** Management says repeat orders are high. We want that tested with the hospitals themselves.
**Tobi:** Timing?
**Deal partner:** Investment committee is in four weeks. We need a red flags readout in two.
**Tobi:** Who decides?
**Deal partner:** The investment committee. I sponsor the work.`,
      summary:
        "Intake call with Tarnhollow's deal partner. Growth investment in Corvane Health Staffing, which places travel nurses and allied health staff with hospitals in about fifteen states; in exclusivity. Key questions: demand as hospitals cut travel staff, bill rate pressure, and hospital client retention, tested with hospitals directly. Investment committee in four weeks, red flags readout in two. Deal partner sponsors.",
      decisions: "Kestrel Bay to send a proposal",
      entities: "Tarnhollow Capital, Corvane Health Staffing, deal partner, travel nurses, bill rates, investment committee",
    },
    {
      key: "client-email",
      title: "Email: Tarnhollow scope",
      type: "email",
      vendor: "upload",
      author: "okafor",
      section: "Intake",
      date: "2026-11-18",
      body: `**From:** Deal partner, Tarnhollow Capital
**To:** Tobi Okafor
**Subject:** Corvane commercial diligence

Tobi,

Scope as discussed:

1. Market demand for travel and allied staffing by segment, and where it is heading.
2. Bill rate and margin trends against the main competitors.
3. Interviews with hospital buyers on why they use Corvane and whether they will keep doing so.
4. A red flags readout in week two and a final report for the investment committee in week four.

Please include the team and the interview count you would plan.

Thanks`,
      summary:
        "Tarnhollow confirms the diligence scope: market demand by segment, bill rate and margin trends against competitors, hospital buyer interviews on retention, a red flags readout in week two and a final investment committee report in week four. Wants the team and interview count stated.",
      entities: "Tarnhollow Capital, Corvane Health Staffing, demand, bill rates, hospital interviews, investment committee",
    },
    {
      key: "owner-notes",
      title: "Harper's notes: Tarnhollow proposal",
      type: "document",
      vendor: "google_docs",
      author: "quinn",
      section: "Proposal",
      date: "2026-11-18",
      body: `# Tarnhollow proposal: working notes

- Due to the client by Friday 21 November.
- Partner: Tobi. Likely lead: Sami.
- Four weeks is tight. Check how our last diligence ran and what slowed it.
- Open: interview count, whether we need an expert network budget, how the red flags readout is run.
- Tobi wants the usual structure.`,
      summary:
        "Proposal owner's notes for Tarnhollow: due 21 November, Tobi is partner and Sami the likely lead. Four weeks is tight; look at how the last diligence ran. Open: interview count, expert network budget, red flags readout format. Usual structure.",
      entities: "Tarnhollow Capital, proposal, Tobi Okafor, Sami Haddad",
    },
  ],
};
