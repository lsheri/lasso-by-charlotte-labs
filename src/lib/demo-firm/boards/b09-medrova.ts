import type { DemoBoard } from "../types";

/** Closed phased board: integration of a search-fund-backed SaaS company's first acquisition, ran to plan, not extended. */
export const b09: DemoBoard = {
  key: "b9",
  practice: "Health",
  client: { name: "Medrova Software", type: "B2B healthcare SaaS, search-fund backed, 85 employees" },
  title: "Integration of a first acquisition",
  pattern: "Post-merger integration",
  shape: "phased",
  start: "2025-08-04",
  weeks: 10,
  fee: "$210k",
  status: "closed",
  sharedWithFirm: true,
  brief:
    "Medrova sells scheduling and intake software to specialty clinics and has signed to buy a 22-person referral management software company (Project Heron), the first of several planned acquisitions. Plan the announcement, keep the target's key people and top customers, stand up a light integration management office, and leave Medrova with a playbook it can reuse on the next deal.",
  team: ["pereira", "hollis", "park"],
  sections: ["Pre-announcement", "Announce and Day 1", "First 30 days", "Hand-off"],
  workstreams: ["Pre-announcement plan", "Communications sequence", "Customer advisory panel", "Integration management office"],
  items: [
    {
      key: "sow",
      title: "SOW: Project Heron integration support",
      type: "document",
      vendor: "google_docs",
      author: "hollis",
      section: "Pre-announcement",
      date: "2025-07-28",
      body: `# Statement of work: Project Heron integration

**Client:** Medrova Software  **Sponsor:** Chief Executive Officer  **Duration:** 10 weeks from 4 August 2025  **Fee:** $210,000 fixed, expenses capped at 5%

## Objective
Integrate Project Heron (a 22-person referral management software company) into Medrova without losing key people or top customers, and leave Medrova with a reusable acquisition integration playbook.

## Scope
1. Pre-announcement plan: sequencing, key person conversations, retention offers, clean team rules until close.
2. Communications sequence for employees, customers, partners and investors, from announcement to day 30.
3. A customer advisory panel of 6 to 10 Heron and Medrova customers to shape the combined roadmap.
4. A light integration management office (IMO): workstream charters, Day 1 checklist, weekly status, risk log.
5. Integration playbook for future acquisitions.

## Out of scope
Legal and tax structuring, product or code integration, HR system migration.

## Team
Partner (0.5 day a week), manager (full time), consultant (full time).

## Milestones
- Week 3: SteerCo 1, integration plan and announcement sequence
- Week 5: announcement and Day 1 (target close on 2 September)
- Week 9: day 30 review
- Week 10: final readout and playbook hand-off`,
      summary:
        "Signed 10-week, $210k fixed-fee SOW to integrate Project Heron, a 22-person referral management software company, into Medrova. Covers pre-announcement planning, a communications sequence, a customer advisory panel, a light IMO and a reusable playbook. Product integration and legal work are out of scope.",
      decisions: "Fixed fee of $210k, expenses capped at 5%\nProduct and code integration out of scope",
      entities: "Medrova Software, Project Heron, CEO, integration management office, Day 1, playbook, clean team",
    },
    {
      key: "problem",
      title: "Problem definition worksheet",
      type: "document",
      vendor: "google_docs",
      author: "pereira",
      section: "Pre-announcement",
      date: "2025-08-05",
      body: `# Problem definition

**Basic question:** How should Medrova announce and integrate Project Heron so that it keeps at least 20 of 22 Heron employees and every top-20 Heron customer through day 90, and finishes with a playbook it can reuse on the next acquisition?

**Situation:** Medrova is backed by a search fund and plans three to four acquisitions over four years. Heron brings $3.1M of ARR, 140 clinic customers and a referral product Medrova customers have been asking for.

**Complication:** Medrova has never acquired a company. Heron's value sits in a handful of engineers and its founder's customer relationships. A clumsy announcement could trigger departures, and competitors will call Heron's customers the day the deal is public.

**Success looks like:** key people signed on retention terms before announcement, no top-20 customer lost, a functioning IMO by Day 1, a playbook the board can see.

**Stakeholders:** decides: Medrova CEO, with the search fund investors. Helps: Heron founder, Medrova CFO, head of customer success. Can block: Heron head of engineering (most courted by recruiters).

**Emerging hypotheses**
1. The founder's endorsement on announcement day matters more than the retention money.
2. Customers fear price rises and product sunset more than they fear the acquisition itself.
3. A small IMO (three workstreams, weekly) is enough for a deal this size.`,
      summary:
        "Problem definition in the firm template. Basic question: announce and integrate Heron while keeping 20 of 22 employees and every top-20 customer through day 90, and leave a reusable playbook. Flags Heron's head of engineering as the likeliest blocker and three hypotheses about founder endorsement, customer fears and a small IMO.",
      entities: "Medrova, Project Heron, search fund, ARR, retention, head of engineering, IMO, customers",
    },
    {
      key: "data-request",
      title: "Email: data request for customer overlap and key people",
      type: "email",
      vendor: "upload",
      author: "park",
      section: "Pre-announcement",
      date: "2025-08-05",
      body: `**To:** Chief Financial Officer, Medrova Software
**Cc:** Tiago Pereira
**Subject:** Project Heron: data we need before SteerCo 1

Thanks for the time yesterday. To build the retention plan and the customer sequence we need the following, ideally by Friday 8 August. Everything about Heron people stays inside the clean team (you, the CEO and us) until close.

1. Heron customer list with ARR, renewal dates and whether each is also a Medrova customer.
2. Heron org chart with roles, tenure and current compensation bands (no names needed for our analysis; role titles are fine).
3. Any change of control clauses in Heron customer or partner contracts.
4. The agreed retention and earnout terms from the purchase agreement.
5. Medrova's standard benefits and equity terms, so we can map gaps for Heron staff.

If the customer list can only come through the data room, we will work from there.

Best,
Daniel Park, Kestrel Bay Advisory`,
      summary:
        "Data request to Medrova's CFO for the Heron customer list with ARR and overlap, role-level org chart and pay bands, change of control clauses, retention and earnout terms, and Medrova's benefits for gap mapping. Restricts people data to the clean team until close.",
      entities: "data request, CFO, clean team, customer overlap, change of control, earnout, retention",
    },
    {
      key: "research-chat",
      title: "Research: integrating small software acquisitions",
      type: "ai_thread",
      vendor: "chatgpt",
      author: "park",
      section: "Pre-announcement plan",
      date: "2025-08-06",
      turns: [
        {
          role: "user",
          content:
            "I'm supporting an 85-person healthcare SaaS company on its first acquisition, a 22-person software company. What does good practice say about announcement sequencing, key employee retention and customer communication for small software acquisitions? Label each point FACT with a dated source or INFERENCE, and say where sources disagree.",
        },
        {
          role: "assistant",
          content:
            "Here is a summary.\n\nFACT (M&A practitioner survey, 2023): acquirers that told key target employees about the deal and their role before the public announcement reported lower first-year attrition than those that told everyone at once.\nFACT (software M&A advisory report, 2024): retention packages in small software deals commonly combine a cash retention bonus paid in two installments with equity in the acquirer, vesting over two to three years.\nFACT (customer research by a SaaS trade publication, 2023): after an acquisition, customers most often worry about price increases, product sunset and losing their account contact.\nINFERENCE: for a 22-person target, the founder's public endorsement on announcement day carries more weight than the package, because staff joined for the founder.\nINFERENCE: a proactive call to every top customer within 24 hours of announcement prevents competitors from setting the story.\n\nWhere sources disagree: practitioners split on whether to integrate quickly (one culture, fewer duplicated roles) or leave small targets alone for 6 to 12 months to protect what made them work. Evidence is mostly anecdotal on both sides.",
        },
        {
          role: "user",
          content: "Turn this into a short integration principles brief for the SteerCo, and suggest a stance on the speed question for a deal this size.",
        },
        {
          role: "assistant",
          content:
            "Done. The brief keeps the labels and recommends a middle path: integrate the back office by day 90, but leave product and engineering teams intact for at least six months.",
        },
      ],
      summary:
        "AI research chat on announcement sequencing, key employee retention and customer communication in small software acquisitions, labelled FACT or INFERENCE. Notes that practitioners disagree on fast versus slow integration. Produced the integration principles brief.",
      entities: "acquisition integration, announcement sequencing, retention packages, customer communication, founder endorsement",
    },
    {
      key: "principles-brief",
      title: "Brief: integration principles for Project Heron",
      type: "document",
      vendor: "chatgpt",
      author: "park",
      section: "Pre-announcement plan",
      date: "2025-08-07",
      madeFrom: "research-chat",
      informs: ["steerco1"],
      body: `# Integration principles for Project Heron (draft for SteerCo 1)

**1. Tell the key people first (FACT, M&A practitioner survey 2023).** Acquirers that briefed key employees on their role before announcement saw lower first-year attrition. For Heron: six key people hear from the CEO and founder the day before announcement.

**2. Pay retention in two parts, plus equity (FACT, software M&A advisory report 2024).** Cash at 6 and 12 months, Medrova equity vesting over three years.

**3. Call every top customer within 24 hours (INFERENCE, from customer research 2023 on post-deal worries).** The worries are price, sunset and losing a contact. The call answers all three: no price change in 2025, both products supported, same account manager.

**4. Let the founder lead the story (INFERENCE).** Staff joined Heron for the founder. The founder opens the all-hands and the customer letter.

**5. Integrate the back office, protect the product team.** Where sources disagree on speed, we take a middle path: payroll, benefits, finance and contracts by day 90; Heron's product and engineering team stays intact for at least six months.

**For decision at SteerCo 1:** principles 4 and 5, since they shape the announcement and the IMO.`,
      summary:
        "Integration principles brief made from the research chat: brief key people first, two-part cash retention plus equity, call every top customer within 24 hours, let the founder lead, and integrate the back office by day 90 while protecting the product team for six months.",
      decisions: "Middle path on integration speed: back office by day 90, product team intact six months",
      entities: "integration principles, key people, retention, customer calls, founder, back office",
    },
    {
      key: "int-ceo",
      title: "Interview: Medrova CEO",
      type: "call",
      vendor: "granola",
      author: "pereira",
      section: "Pre-announcement plan",
      date: "2025-08-08",
      informs: ["steerco1"],
      body: `# Interview: Chief Executive Officer, Medrova Software
Attendees: Tiago Pereira, Maren Hollis (Kestrel Bay), Medrova CEO

**Tiago:** What does success look like for Heron a year from now?
**CEO:** Referral management sold into our base. We think about a third of our clinics would buy it. And the Heron team still here, building.
**Maren:** What worries you most between now and close?
**CEO:** Their head of engineering. Recruiters call him every week. If he goes, two engineers follow him.
**Tiago:** What have you promised the founder?
**CEO:** He runs Heron as a product line, reporting to me, with a 12-month earnout tied to ARR. He wants his people treated fairly on benefits; ours are better on health cover, worse on vacation.
**Maren:** Your investors: what do they expect to see?
**CEO:** A repeatable machine. This is deal one of three or four. They asked me directly whether we will have a playbook after this one.
**Tiago:** How involved do you want to be in Day 1?
**CEO:** I want to be in the room for the Heron all-hands, but the founder should speak first.`,
      summary:
        "Medrova CEO wants Heron's referral product sold into about a third of Medrova clinics and the team retained. The head of engineering is the biggest flight risk. The founder will run Heron as a product line with a 12-month ARR earnout. Investors expect a reusable playbook.",
      decisions: "Founder speaks first at the Heron all-hands",
      entities: "Medrova CEO, head of engineering, earnout, product line, investors, playbook, benefits",
    },
    {
      key: "int-founder",
      title: "Interview: Heron founder (clean team)",
      type: "call",
      vendor: "granola",
      author: "park",
      section: "Pre-announcement plan",
      date: "2025-08-12",
      informs: ["steerco1", "retention-sheet"],
      body: `# Interview: Founder and CEO, Project Heron (clean team only)
Attendees: Daniel Park, Tiago Pereira (Kestrel Bay), Heron founder

**Daniel:** Who on your team would you most hate to lose?
**Founder:** Six people. Head of engineering, two senior engineers who know the matching engine, my head of customer success, our lead implementation specialist and the product designer. Everyone else I could replace in a quarter.
**Tiago:** How do you think they will react?
**Founder:** Relief from some, the company has been tight on cash. Fear from the engineers, they think big companies kill products. Medrova is not big, but to them it is.
**Daniel:** What would reassure them?
**Founder:** Hearing it from me first, with their own number in front of them. Not an email.
**Tiago:** And your customers?
**Founder:** Twenty customers are about 60 percent of revenue. I know every one of their practice managers. They will want to hear from me, and they will ask whether the price goes up.
**Daniel:** Any customer you are worried about?
**Founder:** Two of the top twenty are also talking to a competitor. And there is a change of control clause in one contract; legal has it.`,
      summary:
        "Heron founder names six key people (head of engineering, two senior engineers, head of customer success, lead implementer and designer) and wants to tell them personally with their own terms. Twenty customers make up about 60 percent of revenue; two are talking to a competitor and one contract has a change of control clause.",
      entities: "Heron founder, key people, engineers, customer success, top customers, change of control, competitor",
    },
    {
      key: "retention-sheet",
      title: "Retention risk tracker: key people and top customers",
      type: "sheet",
      vendor: "upload",
      author: "park",
      section: "Integration management office",
      date: "2025-08-15",
      informs: ["steerco1", "final"],
      body: `# Retention risk tracker v2 (clean team)

## Key people (roles only)
| Role | Flight risk | Retention offer | Conversation |
|---|---|---|---|
| Head of engineering | High | $110k cash (two installments) + Medrova equity | CEO and founder, day before announcement |
| Senior engineer, matching engine | High | $70k + equity | Founder, day before |
| Senior engineer, integrations | Medium | $60k + equity | Founder, day before |
| Head of customer success | Medium | $60k + equity | Founder, day before |
| Lead implementation specialist | Medium | $50k | Founder, day before |
| Product designer | Low | $40k | Founder, day before |
| Retention pool, key people | | $390k | |
| General staff (16) | Low | Benefits gap payment, $30k total | All-hands |
| **Total retention budget** | | **$420k** | |

## Top customers
| Measure | Value |
|---|---|
| Heron customers | 140 |
| Heron ARR | $3.1M |
| Top 20 customers, share of ARR | 61% ($1.9M) |
| Customers also using Medrova | 53 (38%) |
| Top 20 at elevated risk | 2 (competitor talks), 1 (change of control clause) |

Rule: every top-20 customer gets a call from the founder or head of customer success within 24 hours of announcement.`,
      summary:
        "Clean team retention tracker: six key roles with offers totalling $390k plus $30k for general staff, a $420k budget in all. Heron has 140 customers and $3.1M ARR; the top 20 hold 61 percent of ARR, 53 customers also use Medrova, and three top-20 accounts are at elevated risk.",
      decisions: "Retention budget of $420k\nTop-20 customers called within 24 hours of announcement",
      entities: "retention tracker, key people, retention pool, top customers, ARR, customer overlap, change of control",
    },
    {
      key: "steerco1",
      title: "SteerCo 1: integration plan and announcement sequence",
      type: "deck",
      vendor: "google_slides",
      author: "pereira",
      section: "Pre-announcement",
      date: "2025-08-20",
      shown: [{ on: "2025-08-21", occasion: "SteerCo 1" }],
      body: `## Slide 1
Project Heron integration: plan and announcement sequence. SteerCo 1, 21 August 2025.

## Slide 2
Heron's value sits in six people and twenty customers; the plan is built around keeping both.
Source: Heron founder interview; retention risk tracker.

## Slide 3
The six key people hear from the founder and CEO the day before announcement, each with their own retention terms in writing.
Source: integration principles brief; retention risk tracker ($390k key person pool).

## Slide 4
The top 20 customers hold 61 percent of Heron's ARR; each gets a founder or customer success call within 24 hours.
Source: retention risk tracker.

## Slide 5
Customers will ask about price and product sunset: no price change in 2025, both products supported, same account manager.
Source: integration principles brief.

## Slide 6
Integrate the back office by day 90; keep Heron's product and engineering team intact for at least six months.
Source: integration principles brief; Medrova CEO interview.

## Slide 7
A light IMO with three workstreams (people, customers, back office) meets weekly; the Medrova COO chairs it.

## Slide 8
Decisions needed today: approve the $420k retention budget, the founder-led announcement and the day 90 back-office scope.`,
      summary:
        "SteerCo 1 deck shown on 21 August 2025. Builds the plan around six key people and twenty customers holding 61 percent of ARR, with key person conversations the day before announcement, 24-hour customer calls, a middle-path integration speed and a weekly three-workstream IMO.",
      decisions: "SteerCo approved the $420k retention budget\nFounder-led announcement approved\nMedrova COO chairs the IMO",
      entities: "SteerCo, retention budget, announcement, top customers, IMO, back office, COO",
    },
    {
      key: "comms-draft",
      title: "Announcement narrative draft v1 (internal)",
      type: "deck",
      vendor: "google_slides",
      author: "park",
      section: "Communications sequence",
      date: "2025-08-25",
      body: `## Slide 1
Project Heron announcement narrative: internal draft v1, for partner review.

## Slide 2
Message house: "Better referrals for specialty clinics." Three pillars: one connected workflow, the same team you know, no change to your contract this year.

## Slide 3
Sequence: day minus 1, six key people; day 0 at 9am, Heron all-hands led by the founder; 10am, Medrova all-hands; 11am, customer email from the founder; same day, top-20 calls; day 1, press release and investor note.

## Slide 4
Audience matrix: 9 audiences, owner, channel and timing for each. (Table to be simplified.)

## Slide 5
FAQ: 34 questions for staff, 21 for customers.

## Slide 6
Risks: leak before day 0; competitor outreach to top customers; engineers reading the press release before hearing from the founder.`,
      summary:
        "Internal first draft of the announcement narrative, not shown to the client. Sets a message house, the day minus 1 to day 1 sequence, a nine-audience matrix and long FAQs. Partner asked for one page per audience and FAQs cut to the ten questions people will actually ask.",
      entities: "announcement, message house, communications sequence, FAQ, audience matrix, leak risk",
    },
    {
      key: "final",
      title: "Final readout: day 30 results and acquisition playbook",
      type: "deck",
      vendor: "google_slides",
      author: "pereira",
      section: "Hand-off",
      date: "2025-10-06",
      shown: [{ on: "2025-10-08", occasion: "Final readout" }],
      body: `## Slide 1
Project Heron integration: day 30 results and the Medrova acquisition playbook. Final readout, 8 October 2025.

## Slide 2
Thirty days in, Medrova has kept 21 of 22 Heron employees and all top-20 customers.
Source: IMO weekly status, day 30.

## Slide 3
All six key people signed retention terms before announcement; the one departure was a junior support role.
Source: retention risk tracker; IMO status.

## Slide 4
Two small customers left, $46k of ARR; both had been at risk before the deal.
Source: customer workstream log.

## Slide 5
The customer advisory panel (8 customers, two sessions) ranked referral status in the Medrova scheduling screen as the first combined feature.
Source: advisory panel notes.

## Slide 6
Back office is on track for day 90: payroll moved on 1 October, benefits on 1 November, contracts by year end.
Source: IMO weekly status.

## Slide 7
The playbook: 12 steps from signing to day 90, each with an owner, a template and the Heron lesson behind it.

## Slide 8
For the next deal: start key person planning before signing, not after, and budget two weeks for change of control reviews.`,
      summary:
        "Final readout shown on 8 October 2025. At day 30 Medrova kept 21 of 22 Heron employees and all top-20 customers, lost two small customers worth $46k ARR, and the advisory panel picked referral status in scheduling as the first combined feature. Hands over a 12-step acquisition playbook.",
      decisions: "Playbook adopted as Medrova's standard for future acquisitions\nReferral status in scheduling is the first combined feature",
      entities: "final readout, day 30, retention, customer advisory panel, back office, acquisition playbook",
    },
  ],
  stickies: [
    { section: "Communications sequence", text: "Partner: one page per audience, ten FAQs not fifty-five. Founder's words, not ours.", fill: "yellow" },
    { section: "Pre-announcement plan", text: "Head of engineering hears first, from the CEO and founder together", fill: "green" },
  ],
  outcome: {
    ranToPlan: true,
    extended: false,
    lesson: "Key person conversations the day before announcement, with terms in writing, kept every key person. Start that planning before signing next time; the change of control review nearly delayed close.",
  },
};
