import type { DemoBoard } from "../types";

/**
 * Proposal demo (17 Nov 2026): an incoming opportunity the proposal owner drafts from. Not shared with the firm, so it
 * never feeds the brain itself; its closest precedents are b05 and b06, with b07 as a looser match.
 */
export const b31: DemoBoard = {
  key: "b31",
  practice: "Health",
  client: { name: "Marrowfield Regional Health", type: "regional health system, 3 hospitals, 24 primary care clinics" },
  title: "Diabetes prevention service line (proposal)",
  pattern: "Service line design",
  shape: "sprint",
  start: "2026-11-16",
  weeks: 12,
  fee: "To be agreed",
  status: "active",
  sharedWithFirm: false,
  pursuit: true,
  brief:
    "Marrowfield Regional Health wants a diabetes prevention service line for adults with prediabetes, built around its primary care clinics and two large employers. The Chief Strategy Officer asked for a proposal after an intake call on 16 November. Harper owns the proposal; Maren is the partner and Tiago is the likely lead.",
  team: ["quinn", "hollis", "pereira"],
  sections: ["Intake", "Proposal"],
  items: [
    {
      key: "intake-call",
      title: "Intake call: Marrowfield Chief Strategy Officer",
      type: "call",
      vendor: "granola",
      author: "hollis",
      section: "Intake",
      date: "2026-11-16",
      body: `# Intake call: Chief Strategy Officer, Marrowfield Regional Health
Attendees: Maren Hollis (Kestrel Bay), Chief Strategy Officer, Director of Population Health

**Maren:** What prompted the call?
**CSO:** About one in three of our primary care adults has prediabetes on paper, and almost nobody is in a program. Our two biggest employers are asking what we offer before their renewals in July.
**Maren:** What exists today?
**Director of Population Health:** A diabetes education class at one hospital, and a lifestyle program pilot in three clinics that ran out of funding last year.
**Maren:** What would success look like in a year?
**CSO:** A service line the board approves in the spring, a front door in primary care, and an employer offer we can price.
**Maren:** Who decides?
**CSO:** I sponsor it. The CFO has to sign off on the employer pricing, and the CMO owns the clinical model.
**Maren:** Timing?
**CSO:** We would like to start in early January and have something for the April board.
**Director of Population Health:** We do not want another pilot that disappears when a grant ends.
**Maren:** Understood. We will send a proposal.`,
      summary:
        "Intake call with Marrowfield's Chief Strategy Officer. About a third of primary care adults have prediabetes and few are in a program; two large employers want an offer before July renewals. Wants a board-approved service line in the spring, a primary care front door and a priced employer offer. CFO signs off pricing, CMO owns the clinical model. Start early January, April board.",
      decisions: "Kestrel Bay to send a proposal",
      entities: "Marrowfield Regional Health, Chief Strategy Officer, Director of Population Health, prediabetes, employers, CFO, CMO",
    },
    {
      key: "client-email",
      title: "Email: Marrowfield proposal request",
      type: "email",
      vendor: "upload",
      author: "hollis",
      section: "Intake",
      date: "2026-11-17",
      body: `**From:** Chief Strategy Officer, Marrowfield Regional Health
**To:** Maren Hollis
**Subject:** Proposal for diabetes prevention service line

Maren,

Thank you for the time yesterday. To confirm what we would like to see in the proposal:

1. A diagnostic of where adults with prediabetes are today across our 24 clinics, and what happens after a high A1c result.
2. A care model with a primary care front door, including how the lifestyle program and medication fit together.
3. An employer offer our two largest employers could contract for, with pricing the CFO can review.
4. A launch plan for the April board.

We would prefer a start in the first week of January. Please include the team and how often you would be on site.

Best regards`,
      summary:
        "Marrowfield's CSO confirms the proposal ask: a prediabetes diagnostic across 24 clinics, a primary care front door care model, an employer offer with pricing for the CFO, and a launch plan for the April board. Wants a January start and the team and on-site time stated.",
      entities: "Marrowfield Regional Health, Chief Strategy Officer, prediabetes, A1c, employer offer, April board",
    },
    {
      key: "owner-notes",
      title: "Harper's notes: Marrowfield proposal",
      type: "document",
      vendor: "google_docs",
      author: "quinn",
      section: "Proposal",
      date: "2026-11-17",
      body: `# Marrowfield proposal: working notes

- Due to the client by Friday 21 November.
- Partner: Maren. Likely lead: Tiago, who is at a client four days a week until mid-December.
- Ask is close to the service line work we have done before, but prevention rather than treatment.
- Open: how many interviews, whether the employer pricing is in scope or advice only, how much on-site time.
- Maren wants the proposal in our usual structure.`,
      summary:
        "Proposal owner's notes for Marrowfield: due 21 November, Maren is partner and Tiago the likely lead with limited time. Open questions on interview count, employer pricing scope and on-site time. Use the firm's usual proposal structure.",
      entities: "Marrowfield Regional Health, proposal, Maren Hollis, Tiago Pereira",
    },
  ],
};
