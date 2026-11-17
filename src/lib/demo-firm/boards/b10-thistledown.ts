import type { DemoBoard } from "../types";

/** Closed phased board: claims division move to product teams; overran at the firm's cost, not extended. Holds an unplaced item. */
export const b10: DemoBoard = {
  key: "b10",
  practice: "Operating model and strategy ops",
  client: { name: "Thistledown Mutual Insurance", type: "regional property and casualty mutual insurer, 640 claims staff" },
  title: "Claims division move to a product operating model",
  pattern: "Product mindset transformation",
  shape: "phased",
  start: "2024-02-05",
  weeks: 12,
  fee: "$260k",
  status: "closed",
  sharedWithFirm: true,
  brief:
    "Thistledown Mutual's claims division is organized by function (intake, adjusting, payments, recovery) and every claim crosses several teams. Staff have little view of what claimants experience and improvement projects stall between departments. Move the division toward product teams aligned to claimant journeys, using employee and customer surveys, best-practice research and a co-design workshop, and deliver a playbook, a one-year implementation plan and a metrics set.",
  team: ["sorensen", "lindqvist", "moreau", "achebe"],
  sections: ["Assess", "Design", "Co-design", "Plan"],
  workstreams: ["Employee and customer surveys", "Best-practice research", "Co-design workshop", "Implementation plan"],
  items: [
    {
      key: "sow",
      title: "SOW: Thistledown Mutual claims product operating model",
      type: "document",
      vendor: "google_docs",
      author: "lindqvist",
      section: "Assess",
      date: "2024-01-29",
      body: `# Statement of work: claims division product operating model

**Client:** Thistledown Mutual Insurance  **Sponsor:** SVP Claims  **Duration:** 12 weeks from 5 February 2024  **Fee:** $260,000 fixed, expenses capped at 5%

## Objective
Design how the claims division moves from functional departments to product teams aligned to claimant journeys, and deliver a plan Thistledown Mutual can start in the third quarter of 2024.

## Scope
1. Employee survey of all claims staff and a customer survey of recently closed claimants.
2. Best-practice research on product operating models in insurance and other regulated service businesses.
3. Current-state interviews with claims leadership, IT and HR (8 to 10).
4. One two-day co-design workshop with staff from every claims function.
5. Deliverables: product operating model playbook, one-year implementation plan, metrics set.

## Out of scope
Claims system replacement, job grading and compensation changes, union negotiations.

## Team
Partner (0.5 day a week), manager (full time), consultant (full time), analyst (full time).

## Milestones
- Week 4: SteerCo 1, diagnostic
- Week 7: co-design workshop
- Week 12: final readout`,
      summary:
        "Signed 12-week, $260k fixed-fee SOW to move Thistledown Mutual's claims division toward product teams aligned to claimant journeys. Covers employee and customer surveys, best-practice research, interviews, a two-day co-design workshop and a playbook, implementation plan and metrics set. System replacement and compensation are out of scope.",
      decisions: "Fixed fee of $260k\nJob grading, compensation and union negotiations out of scope",
      entities: "Thistledown Mutual Insurance, SVP Claims, product operating model, co-design workshop, playbook, metrics",
    },
    {
      key: "problem",
      title: "Problem definition worksheet",
      type: "document",
      vendor: "google_docs",
      author: "sorensen",
      section: "Assess",
      date: "2024-02-06",
      body: `# Problem definition

**Basic question:** How should Thistledown Mutual reorganize its 640-person claims division into product teams around claimant journeys so that cycle times, handoffs and claimant satisfaction improve measurably within a year of launch?

**Situation:** Claims is organized into four functional departments: intake, adjusting, payments and recovery. Each has its own manager, metrics and backlog with IT.

**Complication:** A typical auto claim passes through several teams, claimants repeat themselves and improvement projects die between departments. The SVP Claims has tried two cross-functional task forces; both dissolved within six months.

**Success looks like:** a product team design staff helped shape, a first pilot team live in Q3 2024, and a metrics set the board can track.

**Stakeholders:** decides: SVP Claims and COO. Helps: CIO, HR business partner, claims department managers. Can block: department managers who lose direct reports; the staff union representative.

**Emerging hypotheses**
1. Teams should be aligned to claimant journeys (first notice of loss, auto, property, payments and recovery), not to functions.
2. Each team needs a product owner from claims, not from IT.
3. Start with one pilot team in auto physical damage, where volume is highest.`,
      summary:
        "Problem definition in the firm template. Basic question: reorganize the 640-person claims division into journey-aligned product teams that measurably improve cycle time, handoffs and satisfaction within a year. Notes two failed task forces, department managers and the union as possible blockers, and a proposed auto pilot.",
      entities: "Thistledown Mutual, claims division, product teams, claimant journeys, SVP Claims, COO, union, task forces",
    },
    {
      key: "int-svp",
      title: "Interview: SVP Claims",
      type: "call",
      vendor: "granola",
      author: "sorensen",
      section: "Assess",
      date: "2024-02-14",
      informs: ["diagnostic", "final"],
      body: `# Interview: SVP Claims, Thistledown Mutual Insurance
Attendees: Erik Sorensen, Signe Lindqvist (Kestrel Bay), SVP Claims

**Erik:** Why did the two task forces fail?
**SVP:** People were lent to them. Their real boss was still their department manager, who measured them on the old numbers. The moment there was a backlog, they were pulled back.
**Signe:** What would a product team change?
**SVP:** Who you answer to. If a team owns auto claims end to end, the adjuster and the payments specialist share one goal: the claimant gets paid quickly and fairly.
**Erik:** Who should lead those teams?
**SVP:** Someone from claims who understands coverage. The last time IT ran a "product" it became a ticket queue.
**Signe:** Where would you start?
**SVP:** Auto physical damage. It is our biggest volume and the most complaints. If it works there, everyone will see it.
**Erik:** What worries you?
**SVP:** Two of my department managers will see this as losing their teams. And the union rep will ask whether job descriptions change. I need answers to both before the workshop, not after.`,
      summary:
        "SVP Claims says task forces failed because members still reported to department managers measured on old numbers. Wants product teams led by claims staff, not IT, and a first pilot in auto physical damage. Worried about two department managers and union questions on job descriptions before the workshop.",
      decisions: "Product owners come from claims\nAuto physical damage is the preferred pilot",
      entities: "SVP Claims, task forces, product owner, auto physical damage, department managers, union",
    },
    {
      key: "survey-results",
      title: "Survey results: claims staff and claimants",
      type: "sheet",
      vendor: "upload",
      author: "achebe",
      section: "Employee and customer surveys",
      date: "2024-02-23",
      informs: ["diagnostic", "final"],
      body: `# Survey and operating data summary

## Employee survey (412 of 640 claims staff, 64% response, February 2024)
| Statement | Agree |
|---|---|
| I know what claimants think of our claims experience | 29% |
| I can fix a claimant's problem without handing it to another team | 22% |
| My team's goals match what matters to claimants | 35% |
| I would like to work in a cross-functional team | 61% |

## Customer survey (1,180 claimants with claims closed Q4 2023)
| Measure | Value |
|---|---|
| Claimant NPS | +4 |
| Had to repeat information to more than one person | 57% |
| Satisfied with updates during the claim | 41% |

## Operating data (claims system, 2023)
| Measure | Auto physical damage | Property |
|---|---|---|
| Average handoffs per claim | 6.4 | 7.9 |
| Average cycle time | 18 days | 41 days |
| Annual claim volume | 31,000 | 9,400 |

Method note: employee survey anonymous, results reported only for groups of 10 or more. Customer survey by email, weighted by line of business.`,
      summary:
        "Survey and operating data: only 29 percent of claims staff know what claimants think and 22 percent can fix a problem without a handoff, while 61 percent want cross-functional teams. Claimant NPS is +4 and 57 percent repeated themselves. Auto claims average 6.4 handoffs and 18 days; property 7.9 handoffs and 41 days.",
      entities: "employee survey, customer survey, NPS, handoffs, cycle time, auto physical damage, property claims",
    },
    {
      key: "research-chat",
      title: "Research: product operating models in insurance claims",
      type: "ai_thread",
      vendor: "claude",
      author: "moreau",
      section: "Best-practice research",
      date: "2024-02-20",
      turns: [
        {
          role: "user",
          content:
            "We're helping a regional P&C insurer move its claims division from functional departments to product teams. What does published practice say about product operating models in insurance or similar regulated service businesses: team design, product owner roles, funding and metrics? Label each point FACT with a dated source or INFERENCE, and show where sources disagree.",
        },
        {
          role: "assistant",
          content:
            "Here is a summary.\n\nFACT (insurance industry operations survey, 2023): a growing number of carriers report organizing at least part of claims around customer journeys or lines of business rather than functions, usually starting with personal auto.\nFACT (management research on product operating models, 2022): teams that own an outcome end to end and include the skills to deliver it (operations, data, technology) report faster improvement cycles than teams that hand work across functions.\nFACT (banking and insurance case write-ups, 2021 to 2023): successful transitions typically pilot one or two teams for two to three quarters before scaling.\nINFERENCE: in claims, the product owner needs coverage and regulatory knowledge, so the role should come from operations, paired with a technology lead.\nINFERENCE: functional managers often become chapter or practice leads, which keeps professional standards and reduces resistance.\n\nWhere sources disagree: funding. Some sources say product teams need persistent annual funding to work; others report success keeping project funding for the first year and moving to persistent funding only after a pilot proves value.",
        },
        {
          role: "user",
          content: "Write this up as a short best-practice brief for the SteerCo, and recommend a position on the funding question for a mutual with tight IT budgets.",
        },
        {
          role: "assistant",
          content:
            "Done. The brief keeps the labels and recommends keeping project funding for the pilot year, with a gate to persistent funding once the pilot shows lower handoffs and cycle time.",
        },
      ],
      summary:
        "AI research chat on product operating models in insurance claims: journey-aligned teams starting in auto, end-to-end ownership, piloting before scaling, claims-led product owners and managers as chapter leads, labelled FACT or INFERENCE. Notes sources disagree on persistent versus project funding. Produced the best-practice brief.",
      entities: "product operating model, insurance claims, product owner, chapter leads, persistent funding, pilot teams",
    },
    {
      key: "practices-brief",
      title: "Brief: product operating model practices for claims",
      type: "document",
      vendor: "claude",
      author: "moreau",
      section: "Best-practice research",
      date: "2024-02-21",
      madeFrom: "research-chat",
      informs: ["diagnostic"],
      body: `# Product operating models in claims: best-practice brief

**Journey-aligned teams (FACT, insurance industry operations survey 2023):** more carriers are organizing claims around customer journeys or lines of business, usually starting with personal auto.

**End-to-end ownership (FACT, management research 2022):** teams that own an outcome and include operations, data and technology skills improve faster than teams that hand work across functions.

**Pilot first (FACT, banking and insurance case write-ups 2021 to 2023):** most successful transitions pilot one or two teams for two to three quarters before scaling.

**Who owns the product (INFERENCE):** in claims the product owner needs coverage and regulatory knowledge, so the role should come from claims operations, paired with a technology lead.

**What happens to managers (INFERENCE):** functional managers can become chapter leads for adjusting, payments and recovery standards, which keeps quality and lowers resistance.

**Where sources disagree: funding.** Some say persistent funding from day one; others keep project funding in year one. **Our recommendation for Thistledown Mutual:** project funding for the pilot year, with a gate to persistent funding once handoffs and cycle time fall.

**Implications for the design:** one auto pilot team, claims-led product owner, department managers as chapter leads, a funding gate at month 9.`,
      summary:
        "Best-practice brief made from the research chat: journey-aligned teams, end-to-end ownership, pilot before scaling, claims-led product owners and managers as chapter leads. Recommends project funding in the pilot year with a gate to persistent funding at month 9.",
      decisions: "Recommend project funding in the pilot year with a month 9 gate",
      entities: "best-practice brief, product owner, chapter leads, funding gate, auto pilot",
    },
    {
      key: "diagnostic",
      title: "SteerCo 1: claims diagnostic",
      type: "deck",
      vendor: "google_slides",
      author: "sorensen",
      section: "Design",
      date: "2024-02-29",
      shown: [{ on: "2024-03-04", occasion: "SteerCo 1" }],
      body: `## Slide 1
Thistledown Mutual claims product operating model: diagnostic. SteerCo 1, 4 March 2024.

## Slide 2
Claims staff want to fix problems for claimants, but only 22 percent can do so without a handoff.
Source: employee survey (412 respondents).

## Slide 3
Claimants feel the handoffs: 57 percent repeated their information to more than one person, and NPS is +4.
Source: customer survey (1,180 claimants).

## Slide 4
An auto claim passes through 6.4 handoffs and takes 18 days; property takes 41 days.
Source: claims system operating data, 2023.

## Slide 5
Past task forces failed because members still reported to department managers measured on old numbers.
Source: SVP Claims interview.

## Slide 6
Peers start with one journey-aligned pilot team, led from operations, before scaling.
Source: best-practice brief.

## Slide 7
Proposed direction: four product teams aligned to claimant journeys, starting with an auto physical damage pilot. Decision needed today: approve this direction for the co-design workshop.`,
      summary:
        "SteerCo 1 diagnostic deck shown on 4 March 2024. Headlines: 22 percent of staff can fix problems without a handoff, 57 percent of claimants repeat themselves, NPS of +4, auto claims at 6.4 handoffs and 18 days, failed task forces and peer practice of piloting first. Asks for approval of four journey teams with an auto pilot.",
      decisions: "SteerCo approved four journey-aligned product teams as the direction for co-design",
      entities: "SteerCo, diagnostic, handoffs, NPS, cycle time, task forces, auto pilot",
    },
    {
      key: "workshop-notes",
      title: "Co-design workshop: outputs and decisions",
      type: "document",
      vendor: "google_docs",
      author: "moreau",
      section: "Co-design workshop",
      date: "2024-04-04",
      informs: ["final"],
      body: `# Co-design workshop, 2 and 3 April 2024 (moved from mid-March)

**Who:** 34 participants: adjusters, intake specialists, payments and recovery staff, two department managers, IT leads, HR and the staff union representative as an observer.

**Why it moved:** the union representative asked for staff to be consulted on job descriptions before any design session. We ran two listening sessions in March first, which pushed the workshop back three weeks.

## What the room designed
1. **Four product teams:** First notice of loss; Auto physical damage; Property; Payments and recovery.
2. **Team shape:** a claims product owner, 8 to 12 adjusters and specialists, a data analyst and an IT engineer.
3. **Chapters:** department managers lead adjusting, payments and recovery chapters that own standards, training and quality audits.
4. **Rituals:** a weekly team review of handoffs and stuck claims; a monthly claimant story shared with the whole division.

## What the room rejected
- Rotating adjusters between teams every quarter (too disruptive to licensing and caseloads).
- Product owners from IT.

## Commitments
- Job titles and grades stay the same in the pilot year (agreed with HR and noted by the union representative).
- Auto physical damage pilot team chosen by volunteers first, then filled by the department manager.`,
      summary:
        "Co-design workshop outputs from 2 and 3 April 2024, delayed three weeks for union-requested listening sessions. Staff designed four product teams, a team shape with a claims product owner, chapters led by department managers and weekly handoff reviews. Job titles and grades stay unchanged in the pilot year.",
      decisions: "Four product teams confirmed\nDepartment managers become chapter leads\nJob titles and grades unchanged in the pilot year",
      entities: "co-design workshop, product teams, chapters, union representative, job descriptions, auto pilot",
    },
    {
      key: "final-draft",
      title: "Final readout draft v1 (internal)",
      type: "deck",
      vendor: "google_slides",
      author: "achebe",
      section: "Implementation plan",
      date: "2024-04-17",
      body: `## Slide 1
Thistledown Mutual claims: product operating model. Draft v1 for partner review.

## Slide 2
Background and approach: 12 weeks, surveys, 9 interviews, research, workshop.

## Slide 3
Survey results in full: 4 employee statements, 3 claimant measures, operating data.

## Slide 4
Target operating model: 4 teams, chapters, rituals, roles (detailed org chart with 640 positions).

## Slide 5
Implementation plan: 38 activities across 4 quarters.

## Slide 6
Metrics: 14 measures across efficiency, quality, claimant and employee.

## Slide 7
Recommendation and next steps.`,
      summary:
        "Internal first draft of the final readout, not shown to the client. Structured background first with the recommendation on the last slide, a 640-position org chart, 38 plan activities and 14 metrics. Partner sent it back: answer first, four metrics not fourteen, one page per quarter.",
      entities: "final readout draft, partner review, org chart, implementation plan, metrics",
    },
    {
      key: "final",
      title: "Final readout: playbook, one-year plan and metrics",
      type: "deck",
      vendor: "google_slides",
      author: "sorensen",
      section: "Plan",
      date: "2024-04-26",
      shown: [{ on: "2024-05-02", occasion: "Final readout" }],
      body: `## Slide 1
Thistledown Mutual claims product operating model: playbook, one-year plan and metrics. Final readout, 2 May 2024.

## Slide 2
Move claims to four journey-aligned product teams, starting with an auto physical damage pilot in Q3 2024 and scaling in 2025 if the pilot hits its targets.

## Slide 3
Staff designed it: 34 people from every claims function shaped the teams, chapters and rituals.
Source: co-design workshop outputs.

## Slide 4
Each team has a claims product owner, 8 to 12 adjusters and specialists, a data analyst and an IT engineer; department managers lead chapters.
Source: co-design workshop outputs; best-practice brief.

## Slide 5
Four metrics tell the board whether it works: handoffs per claim, cycle time, claimant NPS and staff who can fix a problem without a handoff.
Source: survey results (baselines).

## Slide 6
Pilot targets for auto physical damage by Q2 2025: handoffs from 6.4 to 4.0, cycle time from 18 to 12 days, claimant NPS from +4 to +20.
Source: survey results; claims system data.

## Slide 7
Quarter by quarter: Q3 2024 stand up the pilot; Q4 first review; Q1 2025 funding gate; Q2 2025 decide on scaling to property and payments.

## Slide 8
Keep project funding for the pilot year and move to persistent funding at the month 9 gate if handoffs and cycle time fall.
Source: best-practice brief.`,
      summary:
        "Final readout shown on 2 May 2024. Recommends four journey-aligned product teams with an auto physical damage pilot from Q3 2024, claims-led product owners and manager-led chapters, four board metrics, pilot targets (handoffs 6.4 to 4.0, cycle time 18 to 12 days, NPS +4 to +20) and a month 9 funding gate.",
      decisions: "Auto physical damage pilot approved for Q3 2024\nFour board metrics adopted\nFunding gate at month 9",
      entities: "final readout, product teams, auto pilot, metrics, funding gate, chapters, playbook",
    },
    {
      key: "verbatims-export",
      title: "Customer survey verbatims export (unfiled)",
      type: "sheet",
      vendor: "upload",
      author: "achebe",
      section: "Employee and customer surveys",
      date: "2024-02-26",
      placed: false,
      body: `# Raw export: claimant survey free-text answers (first 6 of 1,180 rows)

| Row | Line | Verbatim |
|---|---|---|
| 1 | Auto | Three different people asked me for the same photos. |
| 2 | Auto | The adjuster was great, but nobody told me the payment had gone out. |
| 3 | Property | I waited a month to hear who was handling my claim. |
| 4 | Auto | Quick and easy, thank you. |
| 5 | Property | Every call started from zero. |
| 6 | Auto | I had to chase the body shop and the insurer myself. |

Export only; not cleaned, coded or checked for personal details.`,
      summary:
        "Raw export of claimant survey free-text answers, uploaded but never placed on the board. Not cleaned or checked for personal details, so it stays off firm surfaces. Themes echo repeated information and missing updates.",
      entities: "survey verbatims, raw export, claimants",
    },
  ],
  stickies: [
    { section: "Plan", text: "Partner: answer on slide 2, four metrics the board can remember, one line per quarter.", fill: "yellow" },
    { section: "Co-design workshop", text: "Union rep wants consultation before design, not after", fill: "pink" },
  ],
  outcome: {
    ranToPlan: false,
    extended: false,
    lesson: "The co-design workshop slipped three weeks when the union representative asked for staff consultation first, and we absorbed the extra time. Bring employee representatives in at week 1.",
  },
};
