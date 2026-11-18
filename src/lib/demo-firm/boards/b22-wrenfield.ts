import type { DemoBoard } from "../types";

/** Sustainability model for an early learning nonprofit whose main funder wants fees to cover most costs. Closed, overran. */
export const b22: DemoBoard = {
  key: "b22",
  practice: "Social impact",
  client: { name: "Wrenfield Early Learning", type: "early childhood nonprofit, 6 centers, 480 children" },
  title: "Path to a self-funding model",
  pattern: "Sustainability model",
  shape: "phased",
  start: "2025-02-03",
  weeks: 12,
  fee: "$160k",
  status: "closed",
  sharedWithFirm: true,
  situation: "new_revenue",
  brief:
    "Wrenfield runs six early learning centers on a $9.4M budget, and its largest funder covers about 30 percent of it. The funder will renew only if earned revenue covers at least 75 percent of operating cost by FY28. Model paid service options, build a financial model the board trusts, and write the pitch for the funder's renewal meeting.",
  team: ["mbeki", "ramaswamy", "doyle", "galloway"],
  sections: ["Phase 1: Diagnose", "Phase 2: Model", "Phase 3: Pitch"],
  workstreams: ["Stakeholder interviews", "Service scenarios", "Financial model", "Funder pitch"],
  items: [
    {
      key: "sow",
      title: "SOW: Wrenfield sustainability model",
      type: "document",
      vendor: "google_docs",
      author: "ramaswamy",
      section: "Phase 1: Diagnose",
      date: "2025-01-27",
      body: `# Statement of work: path to a self-funding model

**Client:** Wrenfield Early Learning  **Sponsor:** Executive Director  **Duration:** 12 weeks from 3 February 2025  **Fee:** $160,000 fixed, expenses capped at 5%

## Objective
Give the board a credible plan to cover at least 75 percent of operating cost from earned revenue by FY28, and a pitch for the lead funder's renewal meeting in late April 2025.

## Scope
1. Diagnostic of current revenue, cost per enrolled child and subsidy reimbursement by center.
2. Stakeholder interviews: about 20, covering staff, parents, employers, the lead funder and public agencies.
3. Service scenarios: sliding-scale tuition, employer-sponsored seats, out-of-school programs, provider training.
4. A three-year financial model with scenario toggles, handed over to the finance team.
5. Funder pitch deck and a one-page board summary.

## Out of scope
Fundraising on the client's behalf, grant writing, facility planning, union negotiations.

## Team
Partner (0.5 day a week), manager (full time), consultant (full time), analyst (full time).

## Milestones
- Week 4: diagnostic readout
- Week 8: scenario review (SteerCo)
- Week 12: final readout and funder pitch`,
      summary:
        "Signed 12-week, $160k fixed-fee SOW to build a self-funding plan for Wrenfield. Target: earned revenue covers 75 percent of operating cost by FY28. Scope covers a diagnostic, about 20 interviews, service scenarios, a three-year model and the funder pitch.",
      decisions: "Fixed fee of $160k, expenses capped at 5%\nGrant writing and facility planning out of scope",
      entities: "Wrenfield Early Learning, Executive Director, lead funder, FY28, earned revenue",
    },
    {
      key: "problem",
      title: "Problem definition worksheet",
      type: "document",
      vendor: "google_docs",
      author: "mbeki",
      section: "Phase 1: Diagnose",
      date: "2025-02-05",
      body: `# Problem definition

**Basic question:** What mix of paid services lets Wrenfield cover at least 75 percent of operating cost from earned revenue by FY28, without pricing out the families it was founded to serve?

**Situation:** Six centers, 480 enrolled children, $9.4M operating budget. Tuition and state subsidy reimbursement cover 61 percent of cost today. The lead funder gives $2.8M a year.

**Complication:** The funder's new strategy caps operating support for any grantee. It will renew for three years only if Wrenfield shows a path to 75 percent. About 64 percent of enrolled children qualify for subsidy, and subsidy rates trail true cost by roughly $310 a month per child.

**Success looks like:** a board-approved plan, a model finance can run without us, and a three-year renewal from the funder.

**Stakeholders:** decides: board chair and Executive Director. Helps: Finance Director, center directors. Can block: lead funder program officer, staff union steward (if workloads change).

**Emerging hypotheses**
1. Employer-sponsored seats can carry a margin that cross-subsidizes low-income seats.
2. A sliding scale earns more than the current flat rate without raising the bottom band.
3. Training for home-based providers is a small but high-margin line.`,
      summary:
        "Problem definition in the firm template. Earned revenue covers 61 percent of cost today against a 75 percent FY28 target. Subsidy trails true cost by about $310 a month per child, and three hypotheses center on employer seats, a sliding scale and provider training.",
      entities: "lead funder, subsidy reimbursement, sliding scale, employer seats, provider training",
    },
    {
      key: "research-chat",
      title: "Research: employer-sponsored child care and sliding-scale tuition",
      type: "ai_thread",
      method: ["desk_research"],
      vendor: "chatgpt",
      author: "galloway",
      section: "Service scenarios",
      date: "2025-02-11",
      turns: [
        {
          role: "user",
          content:
            "I'm building revenue scenarios for a nonprofit early learning provider with six centers. Summarize how employer-sponsored child care seats are usually priced and contracted, and how nonprofit centers structure sliding-scale tuition. Label each point FACT with a dated source type, or INFERENCE. Note where sources disagree.",
        },
        {
          role: "assistant",
          content:
            "FACT (employer benefits surveys, 2024): reserved-seat agreements are the most common employer model. The employer pays a monthly fee per reserved seat, often at or above the market rate, and the employee may pay a reduced co-pay.\n\nFACT (provider association guidance, 2023): contracts typically run 12 months with 60 to 90 days notice, and many include a minimum seat count.\n\nFACT (nonprofit sector reports, 2024): sliding scales are usually set by household income as a percentage of area median income, with four to six bands.\n\nINFERENCE: hospitals and manufacturers with shift workers are the most likely buyers, because their hours make market care hard to find.\n\nINFERENCE: a sliding scale raises revenue only if the top band is priced at or above market, since most of the gain comes from families who already pay full rate.\n\nWhere sources disagree: estimates of employer uptake vary widely. Benefits surveys report strong interest, but provider association data shows far fewer signed contracts. Treat interest as a lead, not a forecast.",
        },
        { role: "user", content: "Good. Turn that into a short brief for the team with questions for the employer interviews." },
        {
          role: "assistant",
          content:
            "Done. The brief keeps the labels, separates the two models, and closes with four interview questions on seat counts, contract length, co-pays and who signs.",
        },
      ],
      summary:
        "AI research chat on how employer-sponsored child care seats are priced and contracted and how nonprofit sliding scales are banded, with FACT and INFERENCE labels. Flags that employer interest far outruns signed contracts. Produced the employer seats brief.",
      entities: "employer-sponsored seats, sliding scale, area median income, benefits surveys",
    },
    {
      key: "seats-brief",
      title: "Brief: employer seats and sliding-scale tuition",
      type: "document",
      method: ["desk_research"],
      vendor: "google_docs",
      author: "galloway",
      section: "Service scenarios",
      date: "2025-02-12",
      madeFrom: "research-chat",
      body: `# Employer seats and sliding-scale tuition: team brief

## Employer-sponsored seats
- **FACT (employer benefits surveys, 2024):** reserved seats are the dominant model; employers pay a monthly per-seat fee, often at or above market, and employees pay a reduced co-pay.
- **FACT (provider association guidance, 2023):** 12-month terms, 60 to 90 days notice, minimum seat counts are common.
- **INFERENCE:** shift-heavy employers (hospitals, manufacturers) are the best prospects.

## Sliding-scale tuition
- **FACT (nonprofit sector reports, 2024):** four to six income bands tied to area median income.
- **INFERENCE:** the gain comes from pricing the top band at market; the bottom band should not move.

## Where sources disagree
Surveys show strong employer interest, but signed contracts are much rarer. Model employer seats conservatively.

## Questions for employer interviews
1. How many seats would you reserve in year one?
2. Would you sign for 12 months or longer?
3. What co-pay would your employees accept?
4. Who signs a new benefit, HR or the CFO?`,
      summary:
        "Team brief made from the research chat. Sets out the reserved-seat model and income-banded sliding scales with FACT and INFERENCE labels, warns that interest outruns signed contracts, and lists four employer interview questions.",
      entities: "employer seats, sliding scale, co-pay, HR, CFO",
    },
    {
      key: "int-ed",
      title: "Interview: Executive Director",
      type: "call",
      method: ["stakeholder_interviews"],
      role: "executive_director",
      vendor: "granola",
      author: "mbeki",
      section: "Stakeholder interviews",
      date: "2025-02-13",
      informs: ["scenario-deck", "final"],
      body: `# Interview: Executive Director, Wrenfield Early Learning
Attendees: Ayanda Mbeki, Owen Galloway (Kestrel Bay), Executive Director

**Ayanda:** What does the funder actually need to see in April?
**ED:** A number and a path. They said 75 percent by FY28 and they meant it. They do not want a menu, they want to know which option we picked and why we believe it.
**Owen:** Where do you lose the most money today?
**ED:** Infant rooms. The ratio is one teacher to four babies, and subsidy pays almost the same as for a preschooler. Every infant seat loses money. Westside and Maple Street have the most infant rooms.
**Ayanda:** Have employers ever asked about reserving seats?
**ED:** Twice. The regional hospital asked last year, and we never followed up because we had no price. Their nurses work twelve-hour shifts and our Eastgate center is two blocks away.
**Owen:** What would make the board nervous?
**ED:** Anything that looks like we are moving away from low-income families. If the sliding scale raises the bottom band by even $20, the board will not sign it.
**Ayanda:** And staff?
**ED:** Teachers are already stretched. A summer program is fine if we hire seasonal staff. Asking current teachers to cover it is not.`,
      summary:
        "Executive Director interview: the funder wants one chosen path to 75 percent, not a menu. Infant rooms lose the most money; the regional hospital once asked about reserved seats near Eastgate. The board will reject any rise in the bottom sliding-scale band.",
      decisions: "Bottom sliding-scale band stays flat in every scenario",
      entities: "Executive Director, infant rooms, regional hospital, Eastgate center, sliding scale, board",
    },
    {
      key: "int-hospital",
      title: "Interview: HR Director, regional hospital",
      type: "call",
      method: ["customer_research"],
      role: "hr_leader",
      vendor: "granola",
      author: "galloway",
      section: "Stakeholder interviews",
      date: "2025-02-27",
      informs: ["scenario-deck", "fin-model"],
      body: `# Interview: Director of Human Resources, regional hospital
Attendees: Owen Galloway, Rosa Doyle (Kestrel Bay), HR Director, benefits manager

**Owen:** Why did the hospital ask Wrenfield about child care last year?
**HR Director:** Nurse turnover. Exit interviews put child care in the top three reasons for leaving, especially for night and weekend shifts.
**Rosa:** If you reserved seats, how many would you start with?
**HR Director:** Twenty-five is the number our CFO would approve for a pilot. If usage is good, forty in year two.
**Owen:** What monthly price per seat would work?
**Benefits manager:** We looked at a commercial provider at $1,800 a month. If a nonprofit came in around $1,650 with extended hours, that is an easy conversation.
**Rosa:** Contract length?
**HR Director:** Twelve months to start. We would not sign longer until we see utilization.
**Owen:** What would make you walk away?
**HR Director:** Hours. If care ends at 6 pm, it does not help a nurse whose shift ends at 7.`,
      summary:
        "Regional hospital HR interview: child care is a top-three reason nurses leave. Would pilot 25 reserved seats, rising to 40 in year two, at about $1,650 a month on a 12-month contract, but only with extended hours past 7 pm.",
      decisions: "Model employer seats at $1,650 a month, 25 seats in year one",
      entities: "regional hospital, HR Director, nurse turnover, reserved seats, extended hours, Eastgate",
    },
    {
      key: "fin-model",
      title: "Financial model: earned revenue share by scenario, FY25 to FY28",
      type: "sheet",
      method: ["financial_model"],
      vendor: "upload",
      author: "doyle",
      section: "Financial model",
      date: "2025-03-21",
      body: `# Earned revenue model, summary tab (v4, 21 March)

| Line | FY25 actual | FY26 | FY27 | FY28 |
|---|---|---|---|---|
| Operating cost | $9.4M | $9.7M | $10.0M | $10.3M |
| Tuition (sliding scale from FY26) | $3.1M | $3.4M | $3.6M | $3.7M |
| Subsidy reimbursement | $2.6M | $2.7M | $2.8M | $2.9M |
| Employer seats (25, then 40, then 55) | $0 | $0.5M | $0.8M | $1.1M |
| Provider training | $0 | $0.1M | $0.2M | $0.2M |
| Earned revenue share, scenario C | 61% | 69% | 74% | 76% |

## Scenario comparison, FY28 earned revenue share
| Scenario | What is in it | FY28 share |
|---|---|---|
| A | Sliding scale only | 67% |
| B | A plus employer seats | 74% |
| C | B plus provider training | 76% |

Assumptions: employer seats at $1,650 a month (hospital interview); bottom sliding-scale band held flat; operating cost grows 3 percent a year; subsidy rates grow 2 percent a year.`,
      summary:
        "Three-year earned revenue model with three scenarios. Scenario C (sliding scale, employer seats, provider training) reaches 76 percent by FY28; scenario A alone reaches only 67 percent. Employer seats at $1,650 a month carry most of the gap.",
      entities: "financial model, scenario A, scenario B, scenario C, employer seats, provider training, FY28",
    },
    {
      key: "ghost-deck",
      title: "Ghost deck v1 (internal)",
      type: "deck",
      method: ["synthesis"],
      vendor: "google_slides",
      author: "galloway",
      section: "Phase 2: Model",
      date: "2025-03-05",
      body: `## Slide 1
Wrenfield: path to 75 percent. Ghost deck v1, internal only.

## Slide 2
[Title TBC] Earned revenue covers 61 percent of cost today; the gap to 75 percent is about $1.3M.
Source: FY25 actuals.

## Slide 3
[Title TBC] Infant rooms lose money on every seat.
Source: ED interview; need cost per child by room from finance.

## Slide 4
[Placeholder] Employer seats: need hospital numbers before this slide works.

## Slide 5
[Placeholder] Three scenarios, one recommended. Waiting on model v2.

## Slide 6
[Open question] Do we show the funder a menu or one answer? ED says one answer.`,
      summary:
        "Internal ghost deck with placeholder titles, written before the hospital interview and model v2. Never shown to the client. Records the open question of whether to present a menu or one recommended path.",
      entities: "ghost deck, storyline, infant rooms, employer seats",
    },
    {
      key: "scenario-deck",
      title: "SteerCo: service scenarios",
      type: "deck",
      method: ["financial_model", "synthesis"],
      vendor: "google_slides",
      author: "mbeki",
      section: "Phase 2: Model",
      date: "2025-03-26",
      shown: [{ on: "2025-03-28", occasion: "SteerCo 1" }],
      body: `## Slide 1
Wrenfield service scenarios. Steering committee, 28 March 2025.

## Slide 2
Earned revenue covers 61 percent of operating cost today, against a 75 percent target for FY28.
Source: financial model, FY25 actuals.

## Slide 3
Subsidy pays about $310 a month less than true cost per child, and infant rooms carry most of the loss.
Source: problem definition, ED interview.

## Slide 4
A sliding scale alone reaches 67 percent by FY28 without moving the bottom band.
Source: financial model, scenario A.

## Slide 5
Employer seats close most of the gap: the regional hospital would pilot 25 seats at about $1,650 a month.
Source: hospital HR interview, financial model.

## Slide 6
Scenario C reaches 76 percent by FY28 by adding provider training to employer seats and the sliding scale.
Source: financial model, scenario C.

## Slide 7
Decision needed today: choose scenario C as the plan to take to the funder.`,
      summary:
        "Scenario deck shown at the steering committee on 28 March 2025. Shows 61 percent today, scenario A at 67 percent, and scenario C (sliding scale, employer seats, provider training) at 76 percent by FY28. Asks the committee to choose scenario C.",
      decisions: "Steering committee chose scenario C\nExtended hours at Eastgate to be costed before the funder pitch",
      entities: "steering committee, scenario C, regional hospital, sliding scale, subsidy gap",
    },
    {
      key: "partner-notes",
      title: "Partner review notes on the funder pitch draft",
      type: "document",
      vendor: "google_docs",
      author: "ramaswamy",
      section: "Funder pitch",
      date: "2025-04-17",
      body: `# Partner review: funder pitch draft v2

- The funder reads this as a risk document, not a vision document. Open with the number they asked for (76 percent by FY28) and the one assumption it depends on.
- Name the hospital pilot as signed intent, not a contract. If we overstate it and the program officer calls HR, we lose the room.
- Show the bottom band staying flat on its own slide. That is the board's red line and the funder will ask.
- Cut the provider training slide to one line. It is 2 points of the 76, not the story.
- Every slide title must be a full sentence that states the finding. Two of the current titles are labels ("Employer seats", "Next steps").
- Ask for a three-year renewal at the current $2.8M with a step-down in year three, rather than asking for flat funding. It shows we believe our own model.
- Extended hours at Eastgate add about $90k a year in staffing. Put it in the model before the readout or the numbers will not tie.`,
      summary:
        "Partner review of the funder pitch draft: lead with 76 percent by FY28, describe the hospital pilot as intent not contract, give the flat bottom band its own slide, shrink provider training, use full-sentence titles, and ask for a three-year renewal with a year-three step-down.",
      decisions: "Ask the funder for three years with a year-three step-down\nAdd $90k extended-hours staffing to the model",
      entities: "partner review, funder pitch, hospital pilot, bottom band, extended hours",
    },
    {
      key: "final",
      title: "Final readout and funder pitch",
      type: "deck",
      method: ["synthesis"],
      vendor: "google_slides",
      author: "mbeki",
      section: "Phase 3: Pitch",
      date: "2025-04-22",
      shown: [
        { on: "2025-04-24", occasion: "Final readout" },
        { on: "2025-05-06", occasion: "Funder renewal meeting" },
      ],
      body: `## Slide 1
Wrenfield Early Learning: a path to 76 percent earned revenue by FY28.

## Slide 2
Wrenfield can cover 76 percent of operating cost from earned revenue by FY28, if the hospital seat pilot converts to a contract.
Source: financial model v6.

## Slide 3
The bottom sliding-scale band does not move in any year; the gain comes from the top two bands priced at market.
Source: financial model, ED interview.

## Slide 4
Employer seats carry most of the gain: 25 seats in FY26 rising to 55 by FY28, at about $1,650 a month.
Source: hospital HR interview, financial model.

## Slide 5
Extended hours at Eastgate cost about $90k a year and are the hospital's condition for signing.
Source: hospital HR interview, partner review.

## Slide 6
We ask for a three-year renewal at $2.8M, stepping down to $2.3M in year three as employer revenue grows.

## Slide 7
Next 90 days: hospital term sheet by July, sliding scale live for the September enrollment cycle.`,
      summary:
        "Final deck shown at the client readout on 24 April and the funder renewal meeting on 6 May 2025. Plan reaches 76 percent by FY28, keeps the bottom band flat, relies on employer seats rising to 55, and asks for a three-year renewal stepping down to $2.3M.",
      decisions: "Board approved scenario C\nFunder renewed for three years with the year-three step-down",
      entities: "funder renewal, employer seats, sliding scale, Eastgate, extended hours, FY28",
    },
  ],
  stickies: [
    { section: "Funder pitch", text: "Partner: lead with the number they asked for. Full-sentence titles, source line on every figure.", fill: "yellow" },
    { section: "Service scenarios", text: "Board red line: bottom sliding-scale band never moves", fill: "pink" },
  ],
  outcome: {
    ranToPlan: false,
    extended: false,
    lesson:
      "Extended hours were the hospital's real condition and we costed them in week 11, which pushed the funder meeting two weeks past the SOW; ask employers for their deal breakers in the first interview.",
  },
};
