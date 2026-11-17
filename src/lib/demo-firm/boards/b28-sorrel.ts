import type { DemoBoard } from "../types";

/** Commercial due diligence on a travel clinician staffing platform, closed and never shared with the firm (privacy fixture). */
export const b28: DemoBoard = {
  key: "b28",
  practice: "Transactions",
  client: { name: "Sorrel Growth Equity", type: "growth equity firm, healthcare services and software" },
  title: "Diligence on a clinical staffing platform",
  pattern: "Commercial due diligence",
  shape: "diligence",
  start: "2025-09-08",
  weeks: 3,
  fee: "$130k",
  status: "closed",
  sharedWithFirm: false,
  brief:
    "Sorrel is bidding for a minority growth stake in CareShift, a travel nurse and allied clinician staffing platform whose revenue fell 41 percent from its 2022 peak. The investment committee wants one answer in three weeks: is demand for travel clinicians structural, or is the business still unwinding a pandemic spike? Build a demand model, run hospital interviews and test unit economics at today's bill rates.",
  team: ["brennan", "okafor", "park", "hart"],
  sections: ["Day 0 to 2", "Week 1", "Week 2", "Week 3 and IC"],
  items: [
    {
      key: "sow",
      title: "Engagement letter: CareShift commercial diligence",
      type: "document",
      vendor: "google_docs",
      author: "okafor",
      section: "Day 0 to 2",
      date: "2025-09-05",
      body: `# Engagement letter: commercial due diligence, Project Relay

**Client:** Sorrel Growth Equity  **Deal lead:** Partner, healthcare services  **Duration:** 3 weeks from 8 September 2025  **Fee:** $130,000 fixed, expenses at cost

## Question to answer
Is demand for travel nurses and allied clinicians in the US structural, and what revenue and margin can the target sustain at current bill rates?

## Scope
1. Market model: travel clinician demand 2019 to 2029, split into structural and cyclical drivers.
2. 12 to 15 interviews with hospital nursing and finance leaders and former competitors' executives (expert network).
3. Unit economics: bill rate, pay rate and gross margin per placement from VDR data.
4. Red-flag gate at end of week 1; IC report at end of week 3.

## Out of scope
Financial, legal and tax diligence; management assessment; quality of earnings.

## Team
Partner, principal, consultant, analyst.

## Confidentiality
Project name Relay. Target name not used in expert calls. Board stays private to the deal team.`,
      summary:
        "Engagement letter for a 3-week, $130k fixed-fee commercial diligence for Sorrel on travel clinician staffing (Project Relay). Scope: structural versus cyclical demand model, 12 to 15 interviews, unit economics from the VDR, a week 1 red-flag gate and an IC report.",
      decisions: "Fixed fee of $130k\nProject name Relay; target not named in expert calls\nBoard kept private to the deal team",
      entities: "Sorrel Growth Equity, CareShift, Project Relay, travel nurses, IC report, VDR",
    },
    {
      key: "problem",
      title: "Problem definition and would-have-to-be-true list",
      type: "document",
      vendor: "google_docs",
      author: "brennan",
      section: "Day 0 to 2",
      date: "2025-09-08",
      body: `# Problem definition: Project Relay

**Basic question:** Will US demand for travel clinicians support CareShift revenue of at least $450M a year from 2026 at a gross margin of 22 percent or better?

**Situation:** CareShift revenue was $690M in 2022 and $410M in 2024. Bill rates fell from a 2022 peak of about $150 an hour to about $98.

**Complication:** Management says the decline has bottomed. Hospitals say they are building internal float pools to cut agency spend. Both can be true.

**Success looks like:** an IC answer with a base, downside and upside case, each tied to named drivers, delivered by 26 September.

**Stakeholders:** decides: Sorrel IC. Helps: deal partner, operating partner for healthcare. Can block: the lender's advisor, who needs the downside case.

**Would have to be true (killer variables)**
1. Structural RN shortfall persists: hospitals still cannot fill 8 to 10 percent of RN positions with staff.
2. Internal float pools absorb no more than a third of current agency hours.
3. Bill rates stabilize above $90 an hour.
4. Gross margin holds at 22 percent as pay rates fall with bill rates.

**Emerging hypothesis:** about 60 percent of 2024 demand is structural; revenue settles at $430M to $470M.`,
      summary:
        "Problem definition for Project Relay: will travel clinician demand support $450M revenue and a 22 percent gross margin from 2026. Lists four would-have-to-be-true variables (RN shortfall, float pools, bill rates above $90, margin) and an emerging hypothesis that 60 percent of demand is structural.",
      entities: "Project Relay, killer variables, RN shortfall, float pools, bill rates, gross margin",
    },
    {
      key: "vdr-request",
      title: "Email: VDR data request to target management",
      type: "email",
      vendor: "upload",
      author: "park",
      section: "Day 0 to 2",
      date: "2025-09-09",
      body: `**To:** CFO, Project Relay target (via Sorrel deal team)
**From:** Daniel Park, Kestrel Bay Advisory
**Subject:** Project Relay: commercial data request, priority 1 items

Thank you for the VDR access. To hold the week 1 red-flag gate on Friday we need these by Wednesday:

1. Monthly placements, hours billed, bill rate and pay rate by specialty (RN, allied, locum), January 2019 to August 2025.
2. Top 50 hospital clients by revenue, with contract type (MSP, vendor-neutral, direct) and 2022 to 2025 revenue.
3. Fill rate and time to fill by specialty, last 24 months.
4. Clinician redeployment rate (share of clinicians taking a second assignment).
5. Any client notices of reduced agency use or float pool programs.

Priority 2 (week 2): recruiter productivity, clinician acquisition cost by channel, and credentialing cycle time.

Best,
Daniel`,
      summary:
        "VDR data request sent on day 2: monthly placements, bill and pay rates by specialty since 2019, top 50 hospital clients by contract type, fill rates, redeployment and any client float pool notices, with recruiter and acquisition cost data in week 2.",
      entities: "VDR, data request, bill rate, pay rate, MSP, fill rate, redeployment",
    },
    {
      key: "demand-chat",
      title: "Research: structural drivers of travel nurse demand",
      type: "ai_thread",
      vendor: "claude",
      author: "park",
      section: "Week 1",
      date: "2025-09-10",
      turns: [
        {
          role: "user",
          content:
            "I am building a demand model for US travel nurse and allied staffing for a diligence. Split the drivers into structural and pandemic-related. Cover RN workforce supply, hospital vacancy and turnover, internal float pools and bill rate trends since 2019. Label each point FACT with a dated source or INFERENCE.",
        },
        {
          role: "assistant",
          content:
            "Here is a structured view.\n\nStructural\nFACT (national nursing workforce survey, 2024): a large share of the RN workforce is over 55, and intent-to-leave figures rose after 2020.\nFACT (hospital workforce benchmark report, 2025): RN vacancy rates have come down from 2022 highs but remain above 2019 levels.\nINFERENCE: if vacancy stays above 2019, travel demand settles above its 2019 baseline, not back at it.\n\nPandemic-related\nFACT (staffing industry estimates, 2023 and 2025): travel nurse market revenue roughly tripled from 2019 to 2022 and has fallen sharply since.\nFACT (hospital association financial reports, 2024): many systems announced internal float pool or internal agency programs to cut contract labor spend.\nINFERENCE: float pools replace the easiest-to-fill shifts first, so remaining agency demand skews to ICU, OR and rural sites, which supports bill rates.\n\nWhere sources disagree: the staffing industry estimates show the market stabilizing in 2025, while the hospital benchmark shows contract labor hours still falling quarter on quarter. One measures revenue, the other hours, so bill rate mix may explain the gap.",
        },
        { role: "user", content: "Write the structural versus cyclical split up as a one-page brief I can put in front of Cormac before the gate." },
        {
          role: "assistant",
          content:
            "Done. The brief keeps the FACT and INFERENCE labels, sets out the split as a working assumption to test in interviews, and lists the three numbers the demand model needs from the VDR.",
        },
      ],
      summary:
        "AI research chat splitting travel nurse demand drivers into structural (aging workforce, vacancy above 2019) and pandemic-related (2022 spike, float pools), labelled FACT or INFERENCE. Notes revenue and hours sources disagree on whether the market has stabilized. Produced the demand drivers brief.",
      entities: "travel nurses, RN vacancy, float pools, contract labor, bill rates",
    },
    {
      key: "demand-brief",
      title: "Brief: structural versus cyclical demand",
      type: "document",
      vendor: "google_docs",
      author: "park",
      section: "Week 1",
      date: "2025-09-11",
      madeFrom: "demand-chat",
      informs: ["demand-model"],
      body: `# Structural versus cyclical demand: working brief

**Structural (FACT, workforce survey 2024; benchmark 2025):** aging RN workforce and vacancy still above 2019. Travel demand should settle above its 2019 baseline.

**Cyclical (FACT, industry estimates 2023 and 2025; hospital reports 2024):** market roughly tripled 2019 to 2022 and has fallen since; float pools are spreading.

**Working split (INFERENCE, to test):** about 60 percent of 2024 travel hours are structural, 40 percent are a pandemic tail that float pools and permanent hiring will absorb by 2027.

**Mix effect (INFERENCE):** float pools take med-surg shifts first; agency demand shifts to ICU, OR and rural sites, which holds bill rates up.

**Where sources disagree:** revenue estimates say stabilized; hours data says still falling. Check VDR hours, not revenue.

**Numbers the model needs from the VDR**
1. Hours billed by specialty, monthly since 2019.
2. Share of hours at rural and critical access sites.
3. Client-level hours for systems that launched float pools.`,
      summary:
        "Working brief made from the research chat: a 60/40 structural versus pandemic split of 2024 travel hours to test, a mix shift toward ICU, OR and rural work that supports bill rates, and a note to trust hours over revenue where sources disagree.",
      entities: "structural demand, float pools, ICU, rural hospitals, hours billed",
    },
    {
      key: "int-cno",
      title: "Interview: Chief Nursing Officer, regional health system",
      type: "call",
      vendor: "granola",
      author: "brennan",
      section: "Week 1",
      date: "2025-09-12",
      informs: ["ic-report", "demand-model"],
      body: `# Expert call: CNO, 9-hospital regional system (Midwest)
Attendees: Cormac Brennan (Kestrel Bay), Daniel Park (Kestrel Bay), CNO. Expert network call; target not named.

**Cormac:** How has your use of travel nurses changed since 2022?
**CNO:** We were at about 700 travelers at peak. We are at about 260 now. The float pool took most of the med-surg work.
**Daniel:** Do you expect to go lower?
**CNO:** Not much. 260 is roughly our floor. ICU, OR and our two rural hospitals cannot be staffed without travelers. That is a workforce problem, not a pandemic problem.
**Cormac:** What happened to rates?
**CNO:** We paid over $150 an hour for ICU in early 2022. Now we pay just under $100 on average, a bit more for ICU.
**Daniel:** How do you choose agencies now?
**CNO:** Through our MSP. Fill rate and speed matter more than price for the hard specialties. If an agency fills an ICU shift in five days instead of fifteen, I do not care about $5 an hour.
**Cormac:** Will you build an internal agency?
**CNO:** We looked at it. It works for med-surg, not for specialties. We will not try.`,
      summary:
        "CNO of a 9-hospital system: travelers fell from about 700 at peak to about 260, which she sees as the floor; ICU, OR and rural sites still need travelers. Rates fell from over $150 to just under $100 an hour. Fill speed matters more than price for hard specialties; no plans for an internal agency.",
      entities: "CNO, travel nurses, float pool, ICU, rural hospitals, MSP, bill rates",
    },
    {
      key: "int-cfo",
      title: "Interview: hospital system CFO",
      type: "call",
      vendor: "granola",
      author: "park",
      section: "Week 2",
      date: "2025-09-16",
      informs: ["ic-report"],
      body: `# Expert call: CFO, 4-hospital system (Southeast)
Attendees: Daniel Park, Isaac Hart (Kestrel Bay), CFO. Expert network call; target not named.

**Daniel:** How big is contract labor in your budget now?
**CFO:** About 6 percent of labor cost. It was 14 percent in 2022. Our board target is 4 percent by 2027.
**Isaac:** How do you get from 6 to 4?
**CFO:** Float pool expansion and a nurse residency program. Honestly the residency program will not produce experienced ICU nurses for three or four years, so most of the cut has to come from med-surg.
**Daniel:** Are you consolidating agencies?
**CFO:** Yes. We went from 40 agencies to 12 through a vendor-neutral MSP. The ones that stayed have national reach and credentialing speed.
**Isaac:** Would you sign a longer contract for a rate discount?
**CFO:** For allied roles, yes, imaging and respiratory especially. For nurses we want flexibility.`,
      summary:
        "CFO of a 4-hospital system: contract labor fell from 14 percent of labor cost in 2022 to 6 percent, with a board target of 4 percent by 2027, mostly from med-surg. Agencies cut from 40 to 12 via a vendor-neutral MSP; national reach and credentialing speed decided who stayed.",
      entities: "CFO, contract labor, float pool, nurse residency, vendor-neutral MSP, allied staffing",
    },
    {
      key: "demand-model",
      title: "Demand model v2: travel clinician hours and target revenue",
      type: "sheet",
      vendor: "upload",
      author: "hart",
      section: "Week 2",
      date: "2025-09-19",
      informs: ["ic-report"],
      body: `# Demand model v2 (19 September 2025), summary tab

| Case | 2025 market hours (index, 2019 = 100) | 2027 market hours | Target share | Avg bill rate | Target revenue 2027 | Gross margin |
|---|---|---|---|---|---|---|
| Downside | 158 | 132 | 3.6% | $92 | $395M | 21.0% |
| Base | 158 | 146 | 3.8% | $96 | $455M | 22.5% |
| Upside | 158 | 160 | 4.0% | $99 | $510M | 23.5% |

Structural share of 2024 hours: 58 percent (base), from interview floors and float pool adoption by client.

Key drivers: float pool absorption (base 30 percent of 2024 agency hours by 2027), ICU and OR share of hours (base 46 percent, up from 31 percent in 2021), rural share (base 18 percent).

Sources: VDR hours by specialty, 12 interviews, demand drivers brief.`,
      summary:
        "Demand model v2 with downside, base and upside cases. Base case: structural share of 58 percent, 2027 market hours at 146 (2019 = 100), target revenue $455M at a 22.5 percent gross margin. Downside $395M, upside $510M.",
      entities: "demand model, base case, float pool absorption, ICU share, gross margin, target revenue",
    },
    {
      key: "redflag-draft",
      title: "Red-flag gate memo, internal draft",
      type: "deck",
      vendor: "google_slides",
      author: "park",
      section: "Week 1",
      date: "2025-09-12",
      body: `## Slide 1
Project Relay: week 1 red-flag gate. Internal draft for the deal team, not for Sorrel IC.

## Slide 2
No red flag on demand: interview floors suggest hospitals have stopped cutting travelers in hard specialties.

## Slide 3
Amber on concentration: the top 10 hospital clients are 38 percent of revenue, and three of them run float pools.

## Slide 4
Amber on bill rates: VDR shows rates flat for two quarters at about $98, but only six months of data since the decline stopped.

## Slide 5
Proceed to week 2. Add four interviews with systems that launched float pools, and pull client-level hours for the top 10.`,
      summary:
        "Internal week 1 red-flag gate draft, not shown to the client. No red flag on demand, amber on client concentration (top 10 clients 38 percent of revenue) and on bill rate stability. Recommends proceeding with four more float pool interviews.",
      decisions: "Proceed past the red-flag gate\nAdd four float pool system interviews in week 2",
      entities: "red-flag gate, client concentration, bill rates, float pools",
    },
    {
      key: "ic-report",
      title: "IC report: Project Relay commercial diligence",
      type: "deck",
      vendor: "google_slides",
      author: "brennan",
      section: "Week 3 and IC",
      date: "2025-09-24",
      shown: [
        { on: "2025-09-25", occasion: "Sponsor readout" },
        { on: "2025-09-29", occasion: "Investment committee" },
      ],
      body: `## Slide 1
Project Relay: commercial due diligence. Investment committee, 29 September 2025.

## Slide 2
About 58 percent of travel clinician demand is structural; the rest is a pandemic tail that float pools will absorb by 2027.
Source: demand model v2, 12 hospital and expert interviews.

## Slide 3
Hospitals have reached a floor in ICU, OR and rural staffing: one 9-hospital system cut travelers from about 700 to about 260 and expects no further cut.
Source: CNO interview.

## Slide 4
Agency consolidation favors national platforms: one system cut its agencies from 40 to 12, keeping those with reach and credentialing speed.
Source: hospital CFO interview.

## Slide 5
Base case revenue is $455M in 2027 at a 22.5 percent gross margin; the downside is $395M.
Source: demand model v2.

## Slide 6
Main risk: the top 10 clients are 38 percent of revenue and three run float pools.
Source: VDR client data.

## Slide 7
Recommendation: demand supports the investment at a valuation built on the base case, not on 2022 to 2023 results. Underwrite to the downside for leverage.`,
      summary:
        "IC report shown at the sponsor readout and Sorrel's investment committee. Finds about 58 percent of demand structural, hospital floors in ICU, OR and rural, consolidation favoring national platforms, base case revenue of $455M in 2027 at 22.5 percent gross margin, and client concentration as the main risk.",
      decisions: "IC approved proceeding to final bid on the base case\nLeverage sized to the downside case",
      entities: "investment committee, structural demand, base case, client concentration, national platforms",
    },
    {
      key: "private-notes",
      title: "My notes: management and deal team dynamics",
      type: "document",
      vendor: "upload",
      author: "park",
      section: "Week 2",
      date: "2025-09-17",
      visibility: "private",
      body: `Personal working notes, not for the board or the client.

- Target CFO is guarded on client-level hours; took three asks to get the top 10 data. Assume anything not in the VDR by Wednesday will not arrive.
- Sorrel's deal partner already likes the deal and wants the base case to land at $450M or above. Cormac is keeping the cases honest; I should keep the downside visible on every page.
- The operating partner asked privately whether we would recommend walking away. Answer so far: no, but price matters more than the thesis.
- Two expert calls were weak (former competitor sales VPs talking their book). I have down-weighted them in the synthesis and said so in the model notes.`,
      summary:
        "Private working notes on target management and deal team dynamics: a guarded target CFO, deal partner pressure toward a high base case, and two down-weighted expert calls. Not for the firm or the client.",
    },
  ],
  stickies: [
    { section: "Week 3 and IC", text: "Partner: IC reads slide 2 and the recommendation. Every number gets a source line, and the downside goes on the same page as the base.", fill: "yellow" },
    { section: "Day 0 to 2", text: "Hours, not revenue. Revenue hides the bill rate decline.", fill: "green" },
  ],
  outcome: {
    ranToPlan: true,
    extended: false,
    lesson: "Asking every hospital interviewee for their traveler floor gave us the structural number faster than any market report; the float pool client data should have been on the day 1 request, not week 2.",
  },
};
