import type { DemoBoard } from "../types";

/** Closed phased board: digital product operating model at a mid-size bank, laid out by week ranges, extended to coach more teams. */
export const b11: DemoBoard = {
  key: "b11",
  practice: "Operating model and strategy ops",
  client: { name: "Fairhaven Bank", type: "mid-size regional bank, $14B in assets" },
  title: "Digital product operating model",
  pattern: "Product mindset transformation",
  shape: "phased",
  start: "2025-09-08",
  weeks: 10,
  fee: "$240k",
  status: "closed",
  sharedWithFirm: true,
  brief:
    "Fairhaven's digital teams ship projects, not products: each mobile or online banking change is funded as a project, staffed from a shared pool and disbanded at launch, so nobody owns outcomes like account opening completion. Define product roles, a persistent funding model and metrics, prove them with two pilot teams, and give the bank a decision on scaling.",
  team: ["voss", "lindqvist", "achebe"],
  sections: ["Weeks 1-3: Current state", "Weeks 4-6: Design", "Weeks 7-10: Pilot"],
  workstreams: ["Current-state assessment", "Role design", "Funding model", "Pilot teams"],
  items: [
    {
      key: "sow",
      title: "SOW: Fairhaven digital product operating model",
      type: "document",
      vendor: "google_docs",
      author: "lindqvist",
      section: "Weeks 1-3: Current state",
      date: "2025-09-01",
      body: `# Statement of work: digital product operating model

**Client:** Fairhaven Bank  **Sponsor:** Chief Digital Officer  **Duration:** 10 weeks from 8 September 2025  **Fee:** $240,000 fixed, expenses capped at 5%

## Objective
Define how Fairhaven organizes, funds and measures digital work as persistent products rather than projects, and test the model with two pilot teams before a scaling decision in November.

## Scope
1. Current-state assessment of the 2025 digital portfolio, roles and funding process, with 10 to 12 interviews.
2. Role design: product owner, product manager, technology lead, designer and chapter roles, written as role cards.
3. Funding model: persistent team funding within the existing digital budget, with quarterly business reviews.
4. Two pilot teams for six weeks, with coaching and a pilot readout.

## Out of scope
Vendor or core banking platform changes, compensation and grading, hiring.

## Team
Partner (0.5 day a week), principal (full time), analyst (full time).

## Milestones
- Week 3: SteerCo 1, current state
- Week 5: pilot teams launch
- Week 10: pilot readout and scaling decision`,
      summary:
        "Signed 10-week, $240k fixed-fee SOW to move Fairhaven's digital work from projects to persistent products. Covers a portfolio and role assessment, role cards, a persistent funding model and two six-week pilot teams ending in a scaling decision. Platform changes, compensation and hiring are out of scope.",
      decisions: "Fixed fee of $240k\nTwo pilot teams for six weeks",
      entities: "Fairhaven Bank, Chief Digital Officer, product operating model, role cards, persistent funding, pilot teams",
    },
    {
      key: "problem",
      title: "Problem definition worksheet",
      type: "document",
      vendor: "google_docs",
      author: "voss",
      section: "Weeks 1-3: Current state",
      date: "2025-09-09",
      body: `# Problem definition

**Basic question:** What product roles, funding model and metrics would let Fairhaven run its digital channels as persistent products, and do two pilot teams show enough improvement in six weeks to justify scaling in 2026?

**Situation:** Fairhaven's digital budget funds individual projects through an annual approval cycle. Staff are drawn from a shared delivery pool and return to it at launch.

**Complication:** Projects run late, launched features have no owner, and fixes compete for next year's budget. Account opening on mobile loses more than half of applicants and nobody is accountable for improving it.

**Success looks like:** role cards the business and technology leaders both sign, a funding model the CFO accepts within the current budget, and pilot results strong enough for a scaling decision.

**Stakeholders:** decides: Chief Digital Officer and CFO. Helps: CIO, head of retail banking, head of HR. Can block: the project management office, whose role shrinks; finance business partners used to project budgets.

**Emerging hypotheses**
1. Persistent teams can be funded inside the current digital budget.
2. Product owners must come from the business lines, product managers from digital.
3. Mobile onboarding is the best first pilot: high volume, a clear outcome metric.`,
      summary:
        "Problem definition in the firm template. Basic question: which roles, funding and metrics let Fairhaven run digital as persistent products, and can two six-week pilots justify scaling in 2026. Names the PMO and finance business partners as possible blockers and three hypotheses including a mobile onboarding pilot.",
      entities: "Fairhaven, digital budget, product roles, funding model, PMO, CFO, mobile onboarding",
    },
    {
      key: "int-cdo",
      title: "Interview: Chief Digital Officer",
      type: "call",
      vendor: "granola",
      author: "voss",
      section: "Current-state assessment",
      date: "2025-09-12",
      informs: ["steerco1"],
      body: `# Interview: Chief Digital Officer, Fairhaven Bank
Attendees: Anika Voss, Signe Lindqvist (Kestrel Bay), Chief Digital Officer

**Anika:** What is the cost of running digital as projects?
**CDO:** Nobody owns anything after launch. We rebuilt mobile account opening in 2024, it went live, the team dissolved, and completion went down when a vendor changed the ID check. It took four months to get budget to fix it.
**Signe:** How many releases does the mobile app get?
**CDO:** Four a year. Our competitors release every two weeks.
**Anika:** Where does resistance come from?
**CDO:** Finance and the PMO. Finance likes project budgets because they close. The PMO is 14 people whose job is project reporting.
**Signe:** Who should own a product like account opening?
**CDO:** Someone from retail banking who cares about deposits, paired with a product manager from my team. If digital owns it alone, the business will treat it as an IT thing.
**Anika:** What would convince your CFO?
**CDO:** Two things. That it fits in this year's money, and that a pilot moves a number she already watches, like account opening completion.`,
      summary:
        "Chief Digital Officer: launched features have no owner, as when mobile account opening degraded and took four months to fund a fix. The app ships four releases a year. Resistance comes from finance and a 14-person PMO. Wants business-line product owners paired with digital product managers and a pilot that moves account opening completion.",
      decisions: "Product owners from business lines, paired with digital product managers",
      entities: "Chief Digital Officer, account opening, mobile app, releases, PMO, finance, product owner, CFO",
    },
    {
      key: "portfolio-sheet",
      title: "Digital portfolio analysis, 2025",
      type: "sheet",
      vendor: "upload",
      author: "achebe",
      section: "Current-state assessment",
      date: "2025-09-24",
      informs: ["steerco1", "pilot-readout"],
      body: `# 2025 digital portfolio analysis (summary)

Source: PMO project register, finance budget file and app store release history, extracted September 2025.

| Measure | Value |
|---|---|
| Digital projects funded in 2025 | 23 |
| Total 2025 digital budget | $18.6M |
| Projects delivered more than a month late | 14 of 23 (61%) |
| Average project length | 7.5 months |
| Projects with a standing team after launch | 3 of 23 |
| Share of budget spent fixing or reworking launched features | 34% |
| Mobile app releases per year | 4 |
| Mobile account opening abandonment | 58% |

## Candidate product areas
| Product area | Annual spend today | Outcome metric |
|---|---|---|
| Mobile onboarding and account opening | $2.9M | completion rate |
| Small business payments | $2.2M | payments volume, support calls |
| Digital lending | $3.1M | application to decision time |
| Online banking servicing | $2.4M | calls avoided |

## Persistent team cost
A persistent team (product owner, product manager, designer, tech lead, 5 engineers, QA) costs about $1.4M a year fully loaded. Eight teams would cost about $11.2M, inside the $18.6M budget, leaving $7.4M for one-off projects and run costs.`,
      summary:
        "Portfolio analysis: 23 digital projects with an $18.6M budget, 61 percent delivered late, only 3 with a standing team after launch and 34 percent of budget spent fixing launched features. The app ships 4 releases a year and mobile account opening loses 58 percent of applicants. Eight persistent teams at $1.4M each would fit inside the budget.",
      entities: "portfolio analysis, PMO register, digital budget, late projects, rework, account opening abandonment, persistent teams",
    },
    {
      key: "research-chat",
      title: "Research: product roles and funding in banks",
      type: "ai_thread",
      vendor: "chatgpt",
      author: "achebe",
      section: "Role design",
      date: "2025-09-22",
      turns: [
        {
          role: "user",
          content:
            "For a mid-size US bank moving digital work from projects to persistent product teams: what do published sources say about product owner versus product manager roles, where they should sit, and how banks fund persistent teams? Label each point FACT with a dated source or INFERENCE, and note where sources disagree.",
        },
        {
          role: "assistant",
          content:
            "Here is a summary.\n\nFACT (agile practitioner guide, 2020 edition): the product owner is accountable for maximizing the value of a team's work and owns the backlog order; one person, not a committee.\nFACT (banking technology research, 2024): banks that moved to product models most often pair a business-line owner with a digital product manager, rather than giving one role all of the work.\nFACT (financial services operating model survey, 2023): banks that adopted persistent team funding usually allocated budget to a product area annually and reviewed outcomes quarterly, instead of approving each project.\nINFERENCE: at a bank of this size, a business-line product owner keeps the business accountable for outcomes like deposits, while the product manager carries discovery and delivery.\nINFERENCE: the PMO's reporting skills can move into a portfolio office that runs the quarterly business reviews.\n\nWhere sources disagree: whether product owner and product manager should be one role. Many practitioner guides say one role avoids confusion; several bank case studies found a single role overloaded and split it. Size and regulatory load seem to drive the difference.",
        },
        {
          role: "user",
          content: "Use this to draft role cards for product owner, product manager, tech lead, designer and chapter lead, one card each, with what the role decides.",
        },
        {
          role: "assistant",
          content:
            "Done. Each card states purpose, what the role decides, who it works with and how it is measured, and the cards note where we chose the split model over a single role.",
        },
      ],
      summary:
        "AI research chat on product owner and product manager roles and persistent team funding in banks, labelled FACT or INFERENCE. Notes sources disagree on combining the two roles; bank case studies favor a split. Produced the draft role cards.",
      entities: "product owner, product manager, persistent funding, quarterly business review, portfolio office, banks",
    },
    {
      key: "role-cards",
      title: "Role cards: digital product roles",
      type: "document",
      vendor: "chatgpt",
      author: "achebe",
      section: "Role design",
      date: "2025-09-26",
      madeFrom: "research-chat",
      informs: ["steerco1", "pilot-readout"],
      body: `# Role cards (draft for SteerCo 1)

**Product owner (from the business line)**
Purpose: owns the outcome of a product area, such as account opening completion. Decides: priorities and what "good" means. Works with: product manager, business line leadership. Measured by: the product's outcome metric.

**Product manager (from digital)**
Purpose: turns the outcome into a backlog through discovery and delivery. Decides: what to build next to move the metric, within the owner's priorities. Works with: designer, tech lead, product owner. Measured by: release cadence and metric movement.

**Technology lead**
Purpose: owns how the product is built and run. Decides: architecture, engineering practices, release readiness. Measured by: reliability and lead time.

**Designer**
Purpose: owns the customer experience and research. Decides: interaction design, when to test with customers. Measured by: task completion in research and live data.

**Chapter lead (engineering, design, analytics)**
Purpose: keeps craft standards across teams; hires and coaches. Decides: standards, tooling, career growth. Measured by: quality and retention in the chapter.

**Why a split owner and manager:** bank case studies (banking technology research 2024) found one role overloaded at this scale; practitioner guides prefer one role. We chose the split and will test it in the pilots.`,
      summary:
        "Role cards made from the research chat for product owner (business line), product manager (digital), technology lead, designer and chapter lead, each with purpose, decisions and measures. Explains the choice of split owner and manager roles, to be tested in the pilots.",
      decisions: "Split product owner and product manager roles for the pilots",
      entities: "role cards, product owner, product manager, technology lead, designer, chapter lead",
    },
    {
      key: "steerco1",
      title: "SteerCo 1: current state and proposed model",
      type: "deck",
      vendor: "google_slides",
      author: "voss",
      section: "Weeks 1-3: Current state",
      date: "2025-09-29",
      shown: [{ on: "2025-10-01", occasion: "SteerCo 1" }],
      body: `## Slide 1
Fairhaven digital product operating model: current state and proposed model. SteerCo 1, 1 October 2025.

## Slide 2
Fairhaven funds 23 digital projects a year, and only 3 keep a team after launch.
Source: digital portfolio analysis.

## Slide 3
61 percent of projects ran more than a month late, and 34 percent of the budget went to fixing launched features.
Source: digital portfolio analysis.

## Slide 4
Mobile account opening loses 58 percent of applicants, and no one owns fixing it.
Source: digital portfolio analysis; Chief Digital Officer interview.

## Slide 5
Each product area gets a business-line product owner paired with a digital product manager.
Source: role cards; Chief Digital Officer interview.

## Slide 6
Eight persistent teams at about $1.4M each fit inside the current $18.6M digital budget.
Source: digital portfolio analysis.

## Slide 7
Decision needed today: launch two six-week pilots, mobile onboarding and small business payments, from 6 October.`,
      summary:
        "SteerCo 1 deck shown on 1 October 2025. Shows only 3 of 23 projects keep a team after launch, 61 percent run late, 34 percent of budget goes to rework and account opening loses 58 percent of applicants. Proposes split owner and manager roles and eight persistent teams within budget, and asks for two pilots.",
      decisions: "SteerCo approved pilots for mobile onboarding and small business payments from 6 October",
      entities: "SteerCo, portfolio, account opening, product owner, persistent teams, pilots",
    },
    {
      key: "private-notes",
      title: "My notes: PMO and finance dynamics",
      type: "document",
      vendor: "upload",
      author: "voss",
      section: "Weeks 4-6: Design",
      date: "2025-10-14",
      visibility: "private",
      body: `Personal working notes, not for the client or the firm library.

- The PMO head is quietly briefing finance that pilots will "lose budget control". Not hostile, scared for his team. Offer him the portfolio office design role before SteerCo 2; he would be good at running the quarterly reviews.
- The finance business partner for digital is the real gate, more than the CFO. She needs to see the quarterly review template before she will say yes to annual team funding.
- Head of retail banking agreed to give a product owner for onboarding but picked someone junior. Raise with the CDO, gently: the owner needs authority to say no to branch requests.
- Small business payments team is stronger than onboarding on paper but onboarding has the better metric story. Lead the readout with onboarding.`,
      summary:
        "Principal's private working notes on PMO and finance dynamics, the junior onboarding product owner and how to sequence the readout. Not for the firm.",
    },
    {
      key: "pilot-draft",
      title: "Pilot readout draft v1 (internal)",
      type: "deck",
      vendor: "google_slides",
      author: "achebe",
      section: "Pilot teams",
      date: "2025-11-05",
      body: `## Slide 1
Fairhaven pilot readout: internal draft v1.

## Slide 2
Pilot set-up: two teams, six weeks, coaching twice a week, roles from the role cards.

## Slide 3
Activity log: 41 backlog items closed, 12 discovery interviews, 9 releases across both teams.

## Slide 4
Team health survey: 18 questions, before and after.

## Slide 5
Lessons: 11 things that went well, 9 that did not.

## Slide 6
Results: onboarding completion moved; payments support calls fell.

## Slide 7
Recommendation: consider scaling.`,
      summary:
        "Internal first draft of the pilot readout, not shown to the client. Leads with set-up and activity counts, buries results on slide 6 and ends with a soft recommendation. Partner asked for the scaling decision first and the two outcome numbers on their own slides.",
      entities: "pilot readout draft, partner review, activity log, team health survey",
    },
    {
      key: "pilot-readout",
      title: "Pilot readout and scaling recommendation",
      type: "deck",
      vendor: "google_slides",
      author: "voss",
      section: "Weeks 7-10: Pilot",
      date: "2025-11-11",
      shown: [{ on: "2025-11-13", occasion: "Final readout" }],
      body: `## Slide 1
Fairhaven digital product operating model: pilot readout and scaling recommendation. Final readout, 13 November 2025.

## Slide 2
Scale to eight persistent product teams in 2026, funded annually inside the current digital budget, with quarterly business reviews run by a portfolio office.

## Slide 3
In six weeks the onboarding team shipped 5 releases, more than the mobile app's 4 a year.
Source: pilot team release log; digital portfolio analysis.

## Slide 4
Mobile account opening abandonment fell from 58 percent to 49 percent for applicants in the pilot cohort.
Source: pilot analytics; digital portfolio analysis (baseline).

## Slide 5
The small business payments team cut payment-related support calls by 18 percent by fixing the three most common failed transfer messages.
Source: pilot analytics, contact center data.

## Slide 6
The split owner and manager roles worked where the product owner had authority to say no to other requests.
Source: pilot retrospectives; role cards.

## Slide 7
Eight teams at about $1.4M each cost $11.2M, leaving $7.4M of the $18.6M budget for one-off projects and run costs.
Source: digital portfolio analysis.

## Slide 8
The PMO becomes a portfolio office that runs quarterly business reviews; no roles are lost in 2026.

## Slide 9
Next steps: name six more product owners by January, launch teams in two waves (February and May), first quarterly business review in April.`,
      summary:
        "Final pilot readout shown on 13 November 2025. Recommends scaling to eight persistent teams at about $1.4M each within the $18.6M budget. The onboarding team shipped 5 releases in six weeks and cut abandonment from 58 to 49 percent in the pilot cohort; the payments team cut related support calls by 18 percent.",
      decisions: "Scale to eight persistent product teams in 2026\nPMO becomes a portfolio office running quarterly business reviews",
      entities: "pilot readout, persistent teams, account opening, releases, support calls, portfolio office, quarterly business review",
    },
    {
      key: "proposal",
      title: "Proposal: Fairhaven digital product operating model",
      type: "document",
      kind: "proposal",
      vendor: "google_docs",
      author: "lindqvist",
      section: "Weeks 1-3: Current state",
      date: "2025-08-25",
      body: `# Proposal: digital product operating model

**Prepared for:** Fairhaven Bank, Chief Digital Officer  **From:** Kestrel Bay Advisory  **Date:** 25 August 2025

## Context
Fairhaven funds digital work one project at a time. Teams form, deliver and disband, and the bank loses what they learned. Leadership wants to try persistent product teams but needs to see the model work inside the existing budget before scaling it.

## Objectives
1. Define how Fairhaven organizes, funds and measures digital work as products.
2. Test the model with two pilot teams.
3. Support a scaling decision in November.

## Our approach
### Phase 1: Current state (weeks 1 to 3)
Assess the 2025 digital portfolio, roles and funding process, with 10 to 12 interviews. Current state at SteerCo 1.
### Phase 2: Design (weeks 4 to 6)
Role cards for product owner, product manager, technology lead, designer and chapter roles. A persistent funding model with quarterly business reviews. Pilot teams launch in week 5.
### Phase 3: Pilot (weeks 7 to 10)
Coach the two pilot teams for six weeks. Pilot readout and scaling recommendation.

## Workstreams
Current-state assessment. Role design. Funding model. Pilot teams.

## Deliverables
Current-state assessment. Role cards. Funding model. Pilot readout and scaling recommendation.

## Timeline
10 weeks from 8 September 2025.

## Team
A partner half a day a week, a full-time principal and analyst.

## Fees
$240,000 fixed, expenses capped at 5%.

## Assumptions and exclusions
Vendor or core banking platform changes, compensation and grading, and hiring are out of scope.

## Why Kestrel Bay
We test operating models with real teams before asking leadership to scale them.`,
      summary:
        "Proposal to Fairhaven Bank for 10 weeks to move digital work from projects to persistent products, tested with two pilot teams. Fixed fee of $240k. Covers a current-state assessment, role cards, a funding model and a pilot readout.",
      entities: "Fairhaven Bank, Chief Digital Officer, product operating model, persistent funding, pilot teams",
      shown: [{ on: "2025-08-26", occasion: "Proposal sent to the Chief Digital Officer" }],
    },
  ],
  stickies: [
    { section: "Pilot teams", text: "Partner: lead with the scaling decision, then one outcome number per slide. Activity counts go in the appendix.", fill: "yellow" },
    { section: "Funding model", text: "Finance business partner is the gate: show her the quarterly review template first", fill: "blue" },
  ],
  outcome: {
    ranToPlan: true,
    extended: true,
    lesson: "Pairing each pilot with a number the CFO already watched made the scaling decision easy. Fairhaven extended us six weeks to coach the first wave of new teams; name product owners with real authority earlier.",
  },
};
