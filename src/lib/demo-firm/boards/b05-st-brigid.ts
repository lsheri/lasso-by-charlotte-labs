import type { DemoBoard } from "../types";

/** Exemplar board: phased service line design, closed, with client-shown decks the ghost partner learns from. */
export const b05: DemoBoard = {
  key: "b5",
  practice: "Health",
  client: { name: "St. Brigid Health", type: "nonprofit health system, 4 hospitals, 38 clinics" },
  title: "Comprehensive weight management service line",
  pattern: "Service line design",
  shape: "phased",
  start: "2025-03-03",
  weeks: 16,
  fee: "$380k",
  status: "closed",
  sharedWithFirm: true,
  brief:
    "Obesity care at St. Brigid is spread across bariatric surgery, endocrinology, primary care and nutrition, with no single front door. Patients bounce between referrals and payers are pushing back on GLP-1 costs. Design a standalone weight management service line: care model, intake, governance, pricing and a launch plan, ready for the board in July.",
  team: ["pereira", "hollis", "fairbanks", "yilmaz"],
  sections: ["Discover", "Diagnose", "Design", "Deliver"],
  workstreams: ["Patient and clinician research", "Care model and intake", "Financial model and pricing", "Launch"],
  items: [
    {
      key: "sow",
      title: "SOW: St. Brigid weight management service line",
      type: "document",
      vendor: "google_docs",
      author: "hollis",
      section: "Discover",
      date: "2025-02-24",
      body: `# Statement of work: weight management service line

**Client:** St. Brigid Health  **Sponsor:** Chief Strategy Officer  **Duration:** 16 weeks from 3 March 2025  **Fee:** $380,000 fixed, plus expenses capped at 8%

## Objective
Design a standalone, patient-centered weight management service line and a launch plan the board can approve in July 2025.

## Scope
1. Current-state diagnostic: referral flows, wait times, payer mix and leakage across bariatric surgery, endocrinology, primary care and nutrition.
2. Patient and clinician research: 20 to 25 interviews, two co-design workshops.
3. Care model and intake design, including a centralised front door and the role of primary care.
4. Financial model and pricing, including employer contracts and GLP-1 prescribing guardrails.
5. Governance and a 6-month launch plan.

## Out of scope
IT system build, clinical protocol authorship, recruitment.

## Team
Partner (0.5 day a week), manager (full time), consultant (full time), analyst (full time).

## Milestones
- Week 4: diagnostic readout (SteerCo 1)
- Week 10: care model options (SteerCo 2)
- Week 16: final recommendation and launch plan (board pre-read)`,
      summary:
        "Signed 16-week, $380k fixed-fee SOW to design a weight management service line for St. Brigid Health. Scope covers diagnostic, 20 to 25 interviews, care model and intake, financial model and pricing, governance and a launch plan. Three SteerCos at weeks 4, 10 and 16.",
      decisions: "Fixed fee of $380k with expenses capped at 8%\nIT build and clinical protocols out of scope",
      entities: "St. Brigid Health, Chief Strategy Officer, GLP-1, bariatric surgery, SteerCo",
    },
    {
      key: "problem",
      title: "Problem definition worksheet",
      type: "document",
      vendor: "google_docs",
      author: "pereira",
      section: "Discover",
      date: "2025-03-04",
      body: `# Problem definition

**Basic question:** How should St. Brigid organize obesity care into one service line that patients can find, payers will fund and clinicians will refer into, launched by January 2026?

**Situation:** Four hospitals and 38 clinics each run part of obesity care. Bariatric surgery volumes are steady; GLP-1 prescriptions tripled in 18 months.

**Complication:** No single intake. Patients wait an average of 11 weeks for a first specialist visit and about a third are referred out of network. Two large employers asked for a bundled offer St. Brigid cannot price today.

**Success looks like:** a care model the CMO signs, a price employers accept, no loss of downstream surgical referrals.

**Stakeholders:** decides: CSO and CFO. Helps: CMO, primary care medical director. Can block: bariatric surgery chief.

**Emerging hypotheses**
1. A central intake team can cut time to first visit by half.
2. Primary care should own maintenance, specialists own escalation.
3. An employer bundle can fund the intake team.`,
      summary:
        "Problem definition in the firm template. Basic question: one obesity service line patients can find, payers fund and clinicians refer into by January 2026. Lists 11-week waits, a third of referrals leaving the network and three emerging hypotheses.",
      entities: "St. Brigid, CSO, CFO, CMO, bariatric surgery, GLP-1, central intake",
    },
    {
      key: "research-chat",
      title: "Research: GLP-1 coverage and employer bundles",
      type: "ai_thread",
      vendor: "claude",
      author: "fairbanks",
      section: "Discover",
      date: "2025-03-07",
      turns: [
        {
          role: "user",
          content:
            "I'm scoping a weight management service line for a nonprofit health system. Summarize how US employers are handling GLP-1 coverage in 2024 and 2025, and what bundled weight management offers from health systems typically include. Label each point FACT with a dated source or INFERENCE.",
        },
        {
          role: "assistant",
          content:
            "Here is a structured summary.\n\nFACT (employer surveys, late 2024): a growing minority of large employers cover GLP-1s for weight loss, and many that do attach conditions such as BMI thresholds, lifestyle program enrolment or prior authorization.\n\nFACT (health system announcements, 2024): bundled offers commonly combine a medical evaluation, nutrition and behavioral coaching, medication management and a defined escalation path to surgery.\n\nINFERENCE: employers are more willing to pay a per-member fee when the bundle includes adherence support and outcome reporting, because that is how they justify drug spend.\n\nINFERENCE: a health system can differentiate on the escalation path, since digital-only vendors cannot offer surgery.\n\nWhere sources disagree: coverage rates vary widely by survey sample, so treat any single percentage with caution.",
        },
        { role: "user", content: "Turn this into a one-page brief I can share with the partner." },
        {
          role: "assistant",
          content:
            "Done. The brief keeps the FACT and INFERENCE labels and ends with three questions for the employer interviews.",
        },
      ],
      summary:
        "AI research chat on employer GLP-1 coverage and what health system weight management bundles include, labelled FACT or INFERENCE. Notes that coverage rates vary by survey. Produced the employer bundle brief.",
      entities: "GLP-1, employer coverage, bundled care, prior authorization, escalation to surgery",
    },
    {
      key: "bundle-brief",
      title: "Brief: employer weight management bundles",
      type: "document",
      vendor: "claude",
      author: "fairbanks",
      section: "Discover",
      date: "2025-03-07",
      madeFrom: "research-chat",
      body: `# Employer weight management bundles: one-page brief

**What employers are doing (FACT, employer surveys 2024):** a minority of large employers cover GLP-1s for weight loss; most attach conditions such as BMI thresholds or program enrolment.

**What bundles include (FACT, health system announcements 2024):** medical evaluation, nutrition and behavioral coaching, medication management, defined escalation to surgery.

**Why employers pay (INFERENCE):** adherence support and outcome reporting justify drug spend.

**Our edge (INFERENCE):** St. Brigid can offer surgery as the escalation path; digital-only vendors cannot.

**Questions for employer interviews**
1. What would you need to see in a quarterly outcome report?
2. Per member per month or per episode?
3. Who in your organisation signs off on a new benefit?`,
      summary:
        "One-page brief on employer weight management bundles made from the research chat. Keeps FACT and INFERENCE labels and sets three questions for employer interviews.",
      entities: "employers, GLP-1, outcome reporting, per member per month",
    },
    {
      key: "int-cmo",
      title: "Interview: Chief Medical Officer",
      type: "call",
      vendor: "granola",
      author: "pereira",
      section: "Patient and clinician research",
      date: "2025-03-18",
      informs: ["steerco1"],
      body: `# Interview: Chief Medical Officer, St. Brigid Health
Attendees: Tiago Pereira (Kestrel Bay), Leah Fairbanks (Kestrel Bay), CMO

**Tiago:** Where does obesity care break down today?
**CMO:** At the front door. A patient sees their primary care doctor, gets a referral to endocrinology, waits about ten or eleven weeks, and half the time they are told they should have gone to nutrition first.
**Leah:** How many end up outside St. Brigid?
**CMO:** Our referral data says roughly 31 percent of weight-related specialist referrals leave the network. Some go to the academic centre, some to digital programs.
**Tiago:** If there were one intake team, who should it report to?
**CMO:** Not surgery. If surgery owns it, everyone assumes the answer is surgery. It should sit with primary care, with a fast lane to specialists.
**Leah:** What worries you about GLP-1 prescribing?
**CMO:** Inconsistency. Three clinics prescribe heavily, others hardly at all. I want guardrails, not a ban.`,
      summary:
        "CMO interview: care breaks down at the front door with waits of about 11 weeks; roughly 31 percent of weight-related specialist referrals leave the network. Wants intake under primary care, not surgery, and guardrails for GLP-1 prescribing.",
      entities: "CMO, primary care, endocrinology, referral leakage, GLP-1 guardrails",
    },
    {
      key: "int-surgery",
      title: "Interview: Chief of bariatric surgery",
      type: "call",
      vendor: "granola",
      author: "fairbanks",
      section: "Patient and clinician research",
      date: "2025-03-20",
      informs: ["steerco1"],
      body: `# Interview: Chief of bariatric surgery
Attendees: Leah Fairbanks, Elif Yilmaz (Kestrel Bay), Chief of bariatric surgery

**Leah:** What would a central intake team change for your service?
**Chief:** If it is done badly, fewer surgical referrals. GLP-1s already took some of our volume. Our case count was flat last year.
**Elif:** What would make it work for you?
**Chief:** A clear escalation rule. If a patient has not reached their goal after a defined period on medication and coaching, they get a surgical consult automatically.
**Leah:** Would you sit on a service line steering group?
**Chief:** Yes, if surgery has a vote and not just a seat.`,
      summary:
        "Bariatric surgery chief fears central intake will cut surgical referrals; case count flat last year. Supports it if there is an automatic escalation rule to a surgical consult and surgery gets a vote in governance.",
      decisions: "Escalation rule to surgical consult is a condition of surgery's support",
      entities: "bariatric surgery, escalation rule, governance, surgical referrals",
    },
    {
      key: "steerco1",
      title: "SteerCo 1: diagnostic readout",
      type: "deck",
      vendor: "google_slides",
      author: "pereira",
      section: "Diagnose",
      date: "2025-03-28",
      shown: [{ on: "2025-03-31", occasion: "SteerCo 1" }],
      body: `## Slide 1
St. Brigid weight management service line: diagnostic readout. SteerCo 1, 31 March 2025.

## Slide 2
Obesity care has no front door: patients wait about 11 weeks for a first specialist visit.
Source: referral data, CMO interview.

## Slide 3
About 31 percent of weight-related specialist referrals leave the St. Brigid network.
Source: referral data, CMO interview.

## Slide 4
Clinicians agree on the problem but not on ownership: primary care and surgery each want the intake team.
Source: 9 clinician interviews.

## Slide 5
Employers will pay for a bundle if it reports outcomes quarterly.
Source: employer bundle brief, 3 employer interviews.

## Slide 6
Recommendation: design a central intake under primary care with an automatic escalation rule to surgery. Decision needed today: approve this as the design direction.`,
      summary:
        "SteerCo 1 diagnostic deck shown to the client on 31 March 2025. Headlines: 11-week waits, about 31 percent referral leakage, ownership disagreement between primary care and surgery, employer appetite for an outcome-reporting bundle. Asks for approval of central intake under primary care with an escalation rule.",
      decisions: "SteerCo approved central intake under primary care as the design direction",
      entities: "SteerCo, referral leakage, central intake, primary care, escalation rule, employers",
    },
    {
      key: "fin-model",
      title: "Financial model: service line P&L and employer bundle pricing",
      type: "sheet",
      vendor: "upload",
      author: "yilmaz",
      section: "Financial model and pricing",
      date: "2025-05-09",
      body: `# Service line P&L (year 1 to 3), summary tab

| Line | Year 1 | Year 2 | Year 3 |
|---|---|---|---|
| Patients enrolled | 2,400 | 3,900 | 5,100 |
| Employer bundle members | 1,200 | 2,600 | 3,800 |
| Bundle price (per member per month) | $68 | $68 | $70 |
| Intake team cost | $1.1M | $1.3M | $1.4M |
| Contribution margin | -$0.2M | $0.9M | $1.8M |

Assumptions: bundle price tested with 3 employers; surgical referrals held flat (escalation rule); GLP-1 drug cost passed through, not in the bundle.`,
      summary:
        "Three-year P&L for the service line and employer bundle pricing at $68 per member per month. Contribution margin moves from a $0.2M loss in year 1 to $1.8M in year 3, assuming flat surgical referrals and GLP-1 drug cost passed through.",
      entities: "P&L, employer bundle, per member per month, contribution margin, intake team",
    },
    {
      key: "final",
      title: "Final recommendation and launch plan",
      type: "deck",
      vendor: "google_slides",
      author: "pereira",
      section: "Deliver",
      date: "2025-06-13",
      shown: [
        { on: "2025-06-16", occasion: "SteerCo 3" },
        { on: "2025-07-09", occasion: "Board pre-read" },
      ],
      body: `## Slide 1
St. Brigid Comprehensive Weight Management: recommendation and launch plan.

## Slide 2
One front door: a central intake team under primary care, live in January 2026.

## Slide 3
Primary care owns maintenance; specialists own escalation, with an automatic surgical consult rule.

## Slide 4
The employer bundle at $68 per member per month funds the intake team by year 2.
Source: financial model.

## Slide 5
Governance: a service line council with votes for primary care, endocrinology, surgery and nutrition.

## Slide 6
Launch plan: pilot with St. Brigid employees in October, two employers in January, all sites by June 2026.`,
      summary:
        "Final recommendation deck shown at SteerCo 3 and as the July board pre-read. One front door under primary care from January 2026, automatic surgical consult rule, $68 per member per month employer bundle funding intake by year 2, service line council, phased launch starting with an employee pilot.",
      decisions: "Board approved the service line and the January 2026 launch",
      entities: "service line council, employer bundle, employee pilot, launch plan",
    },
    {
      key: "partner-notes",
      title: "Partner review notes on SteerCo 3 draft",
      type: "document",
      vendor: "upload",
      author: "hollis",
      section: "Deliver",
      date: "2025-06-10",
      body: `# Partner review: SteerCo 3 draft

- Lead with the answer on slide 2. The CFO reads two slides and stops.
- Every number needs its source on the slide, in small type, bottom left.
- Kill the 14-box governance chart; one sentence and a list of who votes.
- The employer bundle slide is the one the board will argue about. Show the year 2 break-even, not year 3.
- Titles must be full sentences that state the finding.`,
      summary:
        "Partner's review notes on the SteerCo 3 draft: answer first, a source on every number, simpler governance slide, show year 2 break-even, titles as full-sentence findings.",
      decisions: "Answer-first structure\nSource line on every number\nFull-sentence slide titles",
      entities: "partner review, CFO, slide titles, sources, governance",
    },
    {
      key: "private-notes",
      title: "My notes: stakeholder dynamics",
      type: "document",
      vendor: "upload",
      author: "pereira",
      section: "Diagnose",
      date: "2025-04-02",
      visibility: "private",
      body: `Personal working notes. Surgery chief and primary care director do not get on; keep them in separate interviews until the co-design workshop. CFO is the real decision maker.`,
      summary: "Private working notes on stakeholder dynamics. Not for the firm.",
    },
    {
      key: "proposal",
      title: "Proposal: St. Brigid weight management service line",
      type: "document",
      kind: "proposal",
      vendor: "google_docs",
      author: "hollis",
      section: "Discover",
      date: "2025-02-17",
      body: `# Proposal: weight management service line

**Prepared for:** St. Brigid Health, Chief Strategy Officer  **From:** Kestrel Bay Advisory  **Date:** 17 February 2025

## Context
Demand for weight management care has outgrown the way St. Brigid delivers it. Bariatric surgery, endocrinology, primary care and nutrition each run their own referrals, and patients who start a GLP-1 prescription often leave the system for follow-up. Employers in the region are asking for a single offer they can contract for.

## Objectives
1. Design one patient-centered weight management service line with a single front door.
2. Show the financial case, including employer contracts and guardrails for GLP-1 prescribing.
3. Give the board a launch plan it can approve in July 2025.

## Our approach
### Phase 1: Discover (weeks 1 to 4)
Map referral flows, wait times, payer mix and leakage across the four specialties. Diagnostic readout at SteerCo 1.
### Phase 2: Diagnose and Design (weeks 5 to 10)
Interview 20 to 25 patients and clinicians and run two co-design workshops. Develop care model options and the intake design. Options at SteerCo 2.
### Phase 3: Deliver (weeks 11 to 16)
Build the financial model and pricing, governance and a 6-month launch plan. Final recommendation as a board pre-read.

## Workstreams
Patient and clinician research. Care model and intake. Financial model and pricing. Launch.

## Deliverables
Diagnostic readout. Care model options. Financial model. Governance design. Launch plan and board pre-read.

## Timeline
16 weeks from 3 March 2025, with SteerCos at weeks 4, 10 and 16.

## Team
A partner half a day a week, a full-time manager, consultant and analyst.

## Fees
$380,000 fixed, plus expenses capped at 8%.

## Assumptions and exclusions
IT system build, clinical protocol authorship and recruitment are out of scope. We assume access to referral and claims data by week 2, and a named clinical lead from each specialty.

## Why Kestrel Bay
We design service lines with the clinicians who will run them, and we leave a financial model your finance team owns.`,
      summary:
        "Proposal to St. Brigid Health for a 16-week design of a standalone weight management service line, in four phases with four workstreams. Fixed fee of $380k. Leads with a diagnostic of referral leakage and ends with a board-ready launch plan.",
      entities: "St. Brigid Health, Chief Strategy Officer, weight management, GLP-1, bariatric surgery, employer contracts",
      shown: [{ on: "2025-02-18", occasion: "Proposal sent to the Chief Strategy Officer" }],
    },
  ],
  stickies: [
    { section: "Design", text: "Partner: titles are full sentences that state the finding. Source line on every number.", fill: "yellow" },
    { section: "Diagnose", text: "Escalation rule is the price of surgery's support", fill: "green" },
  ],
  outcome: {
    ranToPlan: true,
    extended: true,
    lesson: "Getting surgery a vote in governance early unlocked the design; the employer bundle needed CFO time two weeks sooner than planned.",
  },
};
