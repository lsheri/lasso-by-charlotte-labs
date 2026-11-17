import type { DemoBoard } from "../types";

/** Retainer board: a two-year embedded strategy and operations team, laid out by quarter, closed with a handover. */
export const b12: DemoBoard = {
  key: "b12",
  practice: "Operating model and strategy ops",
  client: { name: "Orbiton Media", type: "global tech and media company, 6,800 staff, four business units" },
  title: "Embedded strategy and operations team",
  pattern: "Embedded strategy and ops",
  shape: "retainer",
  start: "2023-01-09",
  weeks: 104,
  fee: "$45k/month",
  status: "closed",
  sharedWithFirm: true,
  brief:
    "Orbiton grew headcount 38 percent in 2022 and its planning did not keep up: four business units plan on different calendars, company OKRs number in the hundreds and hiring ran well over plan. Embed a small team to stand up a strategy and operations function: objective setting, a quarterly reporting cadence, budget and headcount alignment, then hand it to internal hires.",
  team: ["voss", "lindqvist", "moreau", "achebe"],
  sections: ["Q1 2023", "Q2 2023", "Q3 2023", "Q4 2023", "Q1 2024", "Q2 2024", "Q3 2024", "Q4 2024"],
  items: [
    {
      key: "sow",
      title: "SOW: Orbiton embedded strategy and operations team",
      type: "document",
      vendor: "google_docs",
      author: "lindqvist",
      section: "Q1 2023",
      date: "2023-01-03",
      body: `# Statement of work: embedded strategy and operations team

**Client:** Orbiton Media  **Sponsor:** Chief Financial Officer  **Term:** 12 months from 9 January 2023, renewable for a further 12  **Fee:** $45,000 per month, expenses billed at cost

## Objective
Stand up a strategy and operations (S&O) function that runs company planning, reporting and headcount alignment, then transfer it to Orbiton hires.

## Scope
1. Objective setting: a company OKR set of no more than 25, cascaded to four business units.
2. Reporting cadence: a monthly KPI pack and a quarterly business review (QBR) run by S&O.
3. Budget and headcount: one annual plan with quarterly reforecasts, tied to approved requisitions.
4. Embedded support: day-to-day help to the CFO and business unit GMs on priorities and decisions.
5. Handover: hiring profiles and onboarding for an internal S&O team.

## Team
Principal (3 days a week on site), consultant (full time), analyst (full time), partner (2 days a month).

## Governance
Monthly check-in with the CFO; renewal review in November 2023.`,
      summary:
        "Signed SOW for an embedded strategy and operations team at Orbiton Media: $45k a month for 12 months, renewable for 12. Covers a company OKR set of 25 or fewer, a monthly KPI pack and QBR, one budget and headcount plan, embedded support and a handover to internal hires.",
      decisions: "Monthly retainer of $45k, expenses at cost\nCompany OKRs capped at 25\nRenewal review in November 2023",
      entities: "Orbiton Media, CFO, strategy and operations, OKRs, QBR, headcount plan",
    },
    {
      key: "problem",
      title: "Problem definition worksheet",
      type: "document",
      vendor: "google_docs",
      author: "voss",
      section: "Q1 2023",
      date: "2023-01-17",
      body: `# Problem definition

**Basic question:** How should Orbiton set objectives, report progress and approve headcount so that the 2024 plan is built on one calendar and hiring stays within 2 percent of plan?

**Situation:** Four business units (Ad Platform, Streaming, News and Publishing, Developer Tools) with about 6,800 staff after 38 percent headcount growth in 2022. Revenue of $2.9B.

**Complication:** Each unit plans on its own calendar. The company carries 212 OKRs, few of which tie to budget. 2022 hiring ended 410 heads over plan, a 6.4 percent variance, and the annual planning cycle takes 14 weeks.

**Success looks like:** one planning calendar, a short OKR set the executive team actually reviews, headcount variance under 2 percent and an internal team that runs it without us.

**Stakeholders:** decides: CFO and CEO. Helps: business unit GMs, Head of People, FP&A director. Can block: GMs who prefer their own plans.

**Emerging hypotheses**
1. Headcount overrun comes from requisitions approved outside the budget, not from bad forecasting.
2. A QBR the CEO chairs will do more than any framework document.
3. Planning can drop to six weeks once units share a calendar.`,
      summary:
        "Problem definition in the firm template. Basic question: one objective, reporting and headcount process so the 2024 plan uses one calendar and hiring stays within 2 percent. Baseline: 212 OKRs, 410 heads over plan (6.4 percent) in 2022 and a 14-week planning cycle.",
      entities: "Orbiton, CFO, CEO, business unit GMs, FP&A, OKRs, headcount variance, planning cycle",
    },
    {
      key: "int-cfo",
      title: "Interview: Chief Financial Officer",
      type: "call",
      vendor: "granola",
      author: "voss",
      section: "Q1 2023",
      date: "2023-01-24",
      informs: ["framework", "qbr-q2-2023"],
      body: `# Interview: Chief Financial Officer, Orbiton Media
Attendees: Anika Voss (Kestrel Bay), Julien Moreau (Kestrel Bay), CFO

**Anika:** Where does planning break today?
**CFO:** Every unit shows up with a plan built on its own assumptions and its own calendar. Streaming plans on a content slate year. Ad Platform plans on the ad market. I spend the first six weeks just getting numbers I can add up.
**Julien:** How did hiring end up 410 over plan?
**CFO:** Requisitions get approved by GMs and the People team in the middle of the year, and finance sees them when payroll moves. Nobody is lying; there is no gate.
**Anika:** What do you want from the QBR?
**CFO:** A room where the CEO sees the same five numbers for every unit and makes trade-offs. Today it is four separate decks and nobody compares them.
**Julien:** How many OKRs should the company have?
**CFO:** I would be happy with twenty. We have over two hundred and I cannot name ten.
**Anika:** What would make you renew us after a year?
**CFO:** If the 2024 plan is built in one go, on one calendar, and I have someone internal who can run it.`,
      summary:
        "CFO interview: units plan on separate calendars and the first six weeks go on reconciling numbers. The 410-head overrun came from mid-year requisitions with no finance gate. Wants a CEO-chaired QBR with the same five numbers per unit, about 20 company OKRs and an internal owner by year end.",
      decisions: "Requisition gate tied to the approved budget is a priority for Q2 2023",
      entities: "CFO, requisitions, headcount gate, QBR, OKRs, planning calendar",
    },
    {
      key: "int-gm",
      title: "Interview: General Manager, Streaming",
      type: "call",
      vendor: "granola",
      author: "moreau",
      section: "Q2 2023",
      date: "2023-04-11",
      informs: ["qbr-q2-2023"],
      body: `# Interview: General Manager, Streaming
Attendees: Julien Moreau, Ngozi Achebe (Kestrel Bay), GM Streaming

**Julien:** The new planning calendar starts in July. What worries you?
**GM:** Our content commitments are signed 18 months ahead. If the company plan is annual and the slate is not, I end up reforecasting every quarter anyway.
**Ngozi:** Would a rolling content line inside the annual plan work?
**GM:** If finance treats it as committed spend and not as discretionary, yes.
**Julien:** How do you feel about the requisition gate?
**GM:** Fine, as long as it is fast. If a req sits for three weeks we lose the candidate. Give me a five-day turnaround and I will live with it.
**Ngozi:** What should the QBR show for Streaming?
**GM:** Subscribers, churn, content spend against slate, and margin. Not 40 OKRs.
**Julien:** Anything else?
**GM:** Please do not make my team fill in another template that nobody reads.`,
      summary:
        "Streaming GM interview: content is committed 18 months ahead, so the annual plan needs a committed rolling content line. Accepts a requisition gate with a five-day turnaround. Wants the QBR to show subscribers, churn, content spend against slate and margin.",
      decisions: "Requisition gate service level set at five working days",
      entities: "Streaming, content slate, rolling forecast, requisition gate, QBR metrics, churn",
    },
    {
      key: "research-chat",
      title: "Research: planning cadences at scaled tech and media companies",
      type: "ai_thread",
      vendor: "chatgpt",
      author: "moreau",
      section: "Q1 2023",
      date: "2023-02-08",
      turns: [
        {
          role: "user",
          content:
            "I'm designing a planning and reporting cadence for a 6,800-person tech and media company with four business units. What do public sources say about how scaled companies run annual planning, quarterly reviews and OKRs? Label each point FACT with a dated source type, or INFERENCE.",
        },
        {
          role: "assistant",
          content:
            "FACT (management practice articles and published operating cadences, 2021 to 2022): many scaled tech companies run an annual plan with quarterly reforecasts and a quarterly business review chaired by the CEO or COO.\n\nFACT (OKR practitioner guides, 2020 to 2022): guides commonly recommend three to five objectives per team and caution that company-level sets above a few dozen stop being reviewed.\n\nFACT (finance leadership surveys, 2022): companies that tie requisition approval to the budget report smaller headcount variances than those that approve hires outside it.\n\nINFERENCE: media units with long content commitments need a rolling line inside the annual plan rather than a separate calendar.\n\nINFERENCE: a short, fixed set of QBR metrics per unit will do more for comparability than any OKR framework.",
        },
        { role: "user", content: "Where do the sources disagree?" },
        {
          role: "assistant",
          content:
            "Where sources disagree: some practitioner guides say OKRs should be decoupled from budget and compensation, while finance surveys argue the opposite for company-level objectives. Planning cycle length estimates also vary widely, from four to twelve weeks, depending on how the sample defines the start of planning.",
        },
        { role: "user", content: "Write it up as a short benchmark brief for the CFO conversation." },
        { role: "assistant", content: "Done. The brief keeps the FACT and INFERENCE labels and the disagreement note, with three design choices for the CFO." },
      ],
      summary:
        "AI research chat on how scaled tech and media companies run annual planning, QBRs and OKRs, labelled FACT or INFERENCE. Notes disagreement on tying OKRs to budget and on cycle length. Produced the planning cadence benchmark brief.",
      entities: "planning cadence, QBR, OKRs, requisition approval, rolling forecast, content commitments",
    },
    {
      key: "benchmark-brief",
      title: "Brief: planning cadence benchmarks",
      type: "document",
      vendor: "chatgpt",
      author: "moreau",
      section: "Q1 2023",
      date: "2023-02-09",
      madeFrom: "research-chat",
      informs: ["framework"],
      body: `# Planning cadence benchmarks: brief for the CFO

**Common pattern (FACT, published operating cadences 2021 to 2022):** annual plan, quarterly reforecast, CEO-chaired quarterly business review.

**OKR scale (FACT, practitioner guides 2020 to 2022):** three to five objectives per team; company sets above a few dozen stop being reviewed.

**Headcount control (FACT, finance surveys 2022):** tying requisition approval to the budget is linked to smaller headcount variance.

**For Orbiton (INFERENCE):** a rolling content line inside the annual plan for Streaming; a fixed set of five QBR metrics per unit.

**Where sources disagree:** whether company OKRs should tie to budget, and how long planning should take (four to twelve weeks).

**Three choices for the CFO**
1. Cap company OKRs at 25 and tie each to a budget line?
2. Gate every requisition against the approved plan, with a five-day turnaround?
3. Run the first company QBR in July 2023, chaired by the CEO?`,
      summary:
        "Benchmark brief made from the research chat: annual plan with quarterly reforecasts and a CEO-chaired QBR, small OKR sets and requisitions gated to the budget. Notes where sources disagree and puts three design choices to the CFO.",
      entities: "benchmark brief, OKRs, QBR, requisition gate, CFO",
    },
    {
      key: "framework",
      title: "Orbiton planning framework",
      type: "document",
      vendor: "google_docs",
      author: "voss",
      section: "Q1 2023",
      date: "2023-03-20",
      shown: [{ on: "2023-03-29", occasion: "Executive staff review" }],
      body: `# Orbiton planning framework (v1.0, approved 29 March 2023)

## Calendar
- One planning calendar for all units. Annual plan built in six weeks, September to mid-October.
- Quarterly reforecast in the second week after quarter close.
- QBR in the fourth week after quarter close, chaired by the CEO.

## Objectives
- Company OKRs capped at 25, each with a named executive owner and a budget line.
- Business units hold no more than five objectives each.

## Headcount
- Every requisition is checked against the approved plan by FP&A before posting.
- Turnaround of five working days; exceptions go to the CFO weekly.

## Reporting
- Monthly KPI pack: five metrics per unit plus company revenue, margin and headcount.
- QBR pack: same five metrics, plan against actual, three decisions requested per unit.

## Content commitments
- Streaming carries a rolling 18-month committed content line inside the annual plan.

## Owners
S&O runs the calendar, the KPI pack and the QBR. FP&A owns the numbers. GMs own their unit pages.`,
      summary:
        "Planning framework approved at the 29 March 2023 executive staff review. One calendar with a six-week annual plan, quarterly reforecasts and a CEO-chaired QBR; company OKRs capped at 25; FP&A gates every requisition within five days; five metrics per unit in a monthly KPI pack.",
      decisions: "One planning calendar from July 2023\nCompany OKRs capped at 25\nRequisitions gated by FP&A within five working days",
      entities: "planning framework, QBR, OKRs, FP&A, requisition gate, KPI pack, content line",
    },
    {
      key: "headcount-sheet",
      title: "Headcount plan against actual, H1 2023",
      type: "sheet",
      vendor: "upload",
      author: "achebe",
      section: "Q2 2023",
      date: "2023-06-19",
      informs: ["qbr-q2-2023"],
      body: `# Headcount plan against actual (as of 16 June 2023)

| Business unit | 2023 plan | Actual | Variance | Reqs gated since 1 May | Median gate days |
|---|---|---|---|---|---|
| Ad Platform | 2,050 | 2,091 | 2.0% | 118 | 4 |
| Streaming | 1,720 | 1,764 | 2.6% | 96 | 6 |
| News and Publishing | 1,180 | 1,171 | -0.8% | 41 | 3 |
| Developer Tools | 1,610 | 1,668 | 3.6% | 102 | 5 |
| Company | 6,560 | 6,694 | 2.0% | 357 | 5 |

Notes: variance at 2.0 percent against 6.4 percent at the end of 2022. Developer Tools carries 22 requisitions approved before the gate started. Streaming's median gate time is above the five-day target because of content team reqs that need legal review.`,
      summary:
        "Headcount sheet for H1 2023: company actual of 6,694 against a plan of 6,560, a 2.0 percent variance against 6.4 percent at the end of 2022. 357 requisitions went through the gate since 1 May with a median of five days; Developer Tools runs highest at 3.6 percent.",
      entities: "headcount plan, requisition gate, Ad Platform, Streaming, News and Publishing, Developer Tools",
    },
    {
      key: "qbr-q2-2023",
      title: "Quarterly business review: Q2 2023",
      type: "deck",
      vendor: "google_slides",
      author: "voss",
      section: "Q3 2023",
      date: "2023-07-10",
      shown: [{ on: "2023-07-12", occasion: "Quarterly business review" }],
      body: `## Slide 1
Orbiton quarterly business review, Q2 2023. The first QBR on the shared planning calendar.

## Slide 2
Headcount is back under control: the company is 2.0 percent over plan, down from 6.4 percent at the end of 2022.
Source: headcount plan against actual, H1 2023.

## Slide 3
The requisition gate is working at a median of five days, but Streaming content reqs take six.
Source: headcount plan against actual; Streaming GM interview.

## Slide 4
Company OKRs are down from 212 to 25, each with an owner and a budget line.
Source: planning framework v1.0.

## Slide 5
Streaming needs a committed rolling content line in the 2024 plan, because its slate is signed 18 months ahead.
Source: Streaming GM interview.

## Slide 6
Developer Tools carries 22 pre-gate requisitions that put it 3.6 percent over plan; we recommend closing them by 31 August.
Source: headcount plan against actual.

## Slide 7
Decisions requested: approve the 2024 planning calendar, close the Developer Tools legacy reqs, and fast-track legal review for content reqs.`,
      summary:
        "First company QBR, shown on 12 July 2023. Headcount variance down to 2.0 percent from 6.4, the requisition gate running at a five-day median, company OKRs cut from 212 to 25. Asks for the 2024 calendar, closure of 22 legacy Developer Tools reqs and faster legal review for content reqs.",
      decisions: "CEO approved the 2024 planning calendar\nDeveloper Tools legacy requisitions to close by 31 August",
      entities: "QBR, headcount variance, requisition gate, OKRs, Streaming, Developer Tools, CEO",
    },
    {
      key: "qbr-q1-2024-draft",
      title: "QBR Q1 2024: internal draft v1",
      type: "deck",
      vendor: "google_slides",
      author: "moreau",
      section: "Q1 2024",
      date: "2024-04-08",
      body: `## Slide 1
Orbiton QBR Q1 2024, draft v1 (internal, not for circulation).

## Slide 2
Q1 overview: revenue, margin, headcount and OKR status for all four units in one table.

## Slide 3
Ad Platform: revenue ahead of plan; three OKRs on track, one at risk; headcount 1.1 percent over.

## Slide 4
Streaming: subscribers on plan, churn up 0.3 points; content spend tracking the rolling line.

## Slide 5
News and Publishing: revenue 4 percent behind plan; restructuring options under review.

## Slide 6
Developer Tools: usage up, monetization behind; two OKRs at risk.

## Slide 7
Appendix: 25 company OKRs with status, owners and commentary.

Reviewer note: replaced after partner review. Titles are topics, not findings, and there is no ask on any slide.`,
      summary:
        "Internal first draft of the Q1 2024 QBR, not shown to the client. Organized unit by unit with topic titles and no decisions requested; replaced after partner review with an answer-first version.",
      entities: "QBR draft, partner review, OKR status, News and Publishing, Developer Tools",
    },
    {
      key: "handover",
      title: "S&O handover and Q4 2024 business review",
      type: "deck",
      vendor: "google_slides",
      author: "voss",
      section: "Q4 2024",
      date: "2024-12-09",
      shown: [{ on: "2024-12-11", occasion: "Quarterly business review" }],
      body: `## Slide 1
Two years of the Orbiton strategy and operations function: results and handover. Q4 2024 business review.

## Slide 2
Planning now takes six weeks on one calendar, down from 14 weeks on four.
Source: planning framework; 2024 and 2025 planning calendars.

## Slide 3
Headcount ended 2024 at 1.2 percent over plan, against 6.4 percent in 2022.
Source: FP&A headcount reports, December 2024.

## Slide 4
The company runs on 24 OKRs, every one with a budget line and an owner the CEO reviews each quarter.
Source: Q4 2024 OKR register.

## Slide 5
Eight QBRs have run on the same five metrics per unit, and every one closed with recorded decisions.
Source: QBR decision log, 2023 to 2024.

## Slide 6
An internal S&O team of five, led by a Director of Strategy and Operations hired in June 2024, now runs the calendar, KPI pack and QBR.
Source: S&O handover plan.

## Slide 7
What to watch in 2025: requisition gate times in Streaming, and keeping OKRs from creeping back above 25.

## Slide 8
Kestrel Bay rolls off on 31 December 2024. The partner remains available for the 2025 planning retrospective in March.`,
      summary:
        "Final QBR and handover deck shown on 11 December 2024. Planning down from 14 weeks to six, headcount 1.2 percent over plan against 6.4 percent in 2022, 24 company OKRs, eight QBRs with recorded decisions and an internal S&O team of five taking over.",
      decisions: "Internal S&O team takes over from 1 January 2025\nRetainer ends 31 December 2024 without renewal",
      entities: "handover, S&O team, planning cycle, headcount variance, OKRs, QBR decision log",
    },
  ],
  stickies: [
    { section: "Q1 2024", text: "Partner: QBR titles state the finding and every unit page ends with the decision we want.", fill: "yellow" },
    { section: "Q2 2024", text: "Director of S&O starts June. Shadow two QBRs before handover.", fill: "green" },
    { section: "Q4 2023", text: "Renewed for year 2 at the same fee. Focus shifts to handover.", fill: "blue" },
  ],
  outcome: {
    ranToPlan: true,
    extended: false,
    lesson: "The requisition gate did more for headcount than any framework; hiring the internal S&O lead six months before roll-off made a clean handover possible.",
  },
};
