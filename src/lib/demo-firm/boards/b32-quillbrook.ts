import type { DemoBoard } from "../types";

/**
 * Proposal demo, brief 2 (18 Nov 2026): a software company integrating its first acquisition. Not shared with the
 * firm. Its close precedents are b09 and b27, and nothing else is close, so a padded third is a failure (check P2).
 */
export const b32: DemoBoard = {
  key: "b32",
  practice: "Transactions",
  client: { name: "Quillbrook Analytics", type: "B2B analytics software, about 240 staff, founder-led" },
  title: "Integration of a first acquisition (proposal)",
  pattern: "Post-merger integration",
  shape: "sprint",
  start: "2026-11-17",
  weeks: 10,
  fee: "To be agreed",
  status: "active",
  sharedWithFirm: false,
  situation: "integration",
  pursuit: true,
  brief:
    "Quillbrook Analytics has signed to buy a smaller reporting tool company, its first acquisition, closing in January. The founder and CEO wants help planning the first hundred days. Harper owns the proposal; Tobi is the partner and Sami the likely lead.",
  team: ["quinn", "okafor", "haddad"],
  sections: ["Intake", "Proposal"],
  items: [
    {
      key: "intake-call",
      title: "Intake call: Quillbrook CEO",
      type: "call",
      method: ["stakeholder_interviews"],
      role: "chief_executive_officer",
      vendor: "granola",
      author: "okafor",
      section: "Intake",
      date: "2026-11-17",
      body: `# Intake call: CEO and CFO, Quillbrook Analytics
Attendees: Tobi Okafor (Kestrel Bay), Founder and CEO, CFO

**Tobi:** What prompted the call?
**CEO:** We signed to buy a reporting tool company of about 60 people. It closes in January. We have never integrated anyone.
**Tobi:** What worries you most?
**CEO:** Losing their two senior engineers and confusing their customers. About a third of their revenue comes from twelve accounts.
**CFO:** And we have two billing systems and two support desks. I want one of each by the end of the year.
**Tobi:** What would success look like at day one hundred?
**CEO:** Customers told before they hear it elsewhere, the engineers staying, one product roadmap, and a clear plan for billing and support.
**Tobi:** Who decides?
**CEO:** I do, with the CFO on anything that touches money.
**Tobi:** Timing?
**CEO:** We would like you working with us from the week the deal closes.`,
      summary:
        "Intake call with Quillbrook's CEO and CFO. First acquisition, a 60-person reporting tool company, closes in January. Worries: losing two senior engineers and confusing customers; a third of the target's revenue sits in twelve accounts. CFO wants one billing system and one support desk by year end. Success at day 100: customers told first, engineers retained, one roadmap, a billing and support plan. CEO decides, CFO on money. Start the week the deal closes.",
      decisions: "Kestrel Bay to send a proposal",
      entities: "Quillbrook Analytics, CEO, CFO, acquisition, first hundred days, billing, support",
    },
    {
      key: "client-email",
      title: "Email: Quillbrook proposal request",
      type: "email",
      vendor: "upload",
      author: "okafor",
      section: "Intake",
      date: "2026-11-18",
      body: `**From:** Founder and CEO, Quillbrook Analytics
**To:** Tobi Okafor
**Subject:** Proposal for integration support

Tobi,

Thanks for the call. What we would like in the proposal:

1. A day-one plan: what customers, staff and partners hear, and from whom.
2. A retention plan for the target's key engineers and account managers.
3. A plan to bring the two products onto one roadmap.
4. A sequence for moving to one billing system and one support desk.

We close in the second week of January. Please show the team and how you would work with our leadership team each week.

Thanks`,
      summary:
        "Quillbrook's CEO confirms the ask: a day-one communications plan, retention for key engineers and account managers, one product roadmap, and a sequence to one billing system and one support desk. Close is the second week of January; wants the team and weekly working rhythm stated.",
      entities: "Quillbrook Analytics, CEO, day-one plan, retention, roadmap, billing, support",
    },
    {
      key: "owner-notes",
      title: "Harper's notes: Quillbrook proposal",
      type: "document",
      vendor: "google_docs",
      author: "quinn",
      section: "Proposal",
      date: "2026-11-18",
      body: `# Quillbrook proposal: working notes

- Due to the client by Tuesday 25 November.
- Partner: Tobi. Likely lead: Sami.
- We have done integrations for software companies before; check what went wrong on those.
- Open: how many weeks after close, whether billing migration is in scope or a plan only, how often we join their leadership meeting.
- Tobi wants the usual structure.`,
      summary:
        "Proposal owner's notes for Quillbrook: due 25 November, Tobi is partner and Sami the likely lead. Look at past software integrations and their lessons. Open: weeks after close, billing migration scope, leadership meeting rhythm. Usual structure.",
      entities: "Quillbrook Analytics, proposal, Tobi Okafor, Sami Haddad",
    },
  ],
};
