import type { DemoBoard } from "../types";

/** Earned revenue options for a regional food bank. Closed, not shared with the firm: the privacy fixture board. */
export const b23: DemoBoard = {
  key: "b23",
  practice: "Social impact",
  client: { name: "Kettle Creek Food Network", type: "regional food bank, 9 counties, 140 partner agencies" },
  title: "Earned revenue options",
  pattern: "Revenue diversification",
  shape: "sprint",
  start: "2025-06-02",
  weeks: 8,
  fee: "$80k",
  status: "closed",
  sharedWithFirm: false,
  brief:
    "Kettle Creek depends on grants and individual gifts for 58 percent of a $14M budget, and two large grant cycles moved or shrank in the last 18 months. Scan earned revenue options that fit the hunger relief mission, test the feasibility of the strongest three, and design one or two pilots the board can approve in August.",
  team: ["abernathy", "hollis", "doyle"],
  sections: ["Week 1: intake", "Weeks 2-3: options scan", "Weeks 4-6: feasibility", "Weeks 7-8: pilot design"],
  items: [
    {
      key: "sow",
      title: "SOW: Kettle Creek earned revenue options",
      type: "document",
      vendor: "google_docs",
      author: "hollis",
      section: "Week 1: intake",
      date: "2025-05-27",
      body: `# Statement of work: earned revenue options

**Client:** Kettle Creek Food Network  **Sponsor:** President and CEO  **Duration:** 8 weeks from 2 June 2025  **Fee:** $80,000 fixed, no expenses billed

## Objective
Identify earned revenue lines that fit Kettle Creek's mission and assets, and design up to two pilots for board approval at the August meeting.

## Scope
1. Options scan: 10 to 12 earned revenue models used by food banks and hunger relief nonprofits.
2. Asset review: warehouse, cold storage, fleet, kitchen and staff skills.
3. Eight stakeholder interviews (leadership, operations, board, two partner agencies, one health plan).
4. Feasibility of the top three options: demand, margin, mission fit, operational risk.
5. Pilot design for up to two options: scope, budget, metrics, go or no-go gates.

## Out of scope
Capital campaign advice, real estate transactions, legal structuring of a subsidiary.

## Team
Partner (half a day a week), principal (full time), analyst (full time).

## Milestones
- Week 3: options shortlist
- Week 6: feasibility review
- Week 8: final readout with pilot designs`,
      summary:
        "Signed 8-week, $80k fixed-fee SOW to find mission-fit earned revenue for Kettle Creek Food Network. Covers an options scan, asset review, eight interviews, feasibility of the top three options and up to two pilot designs for the August board.",
      decisions: "Fixed fee of $80k, no expenses billed\nSubsidiary legal structuring out of scope",
      entities: "Kettle Creek Food Network, CEO, cold storage, earned revenue, pilot design",
    },
    {
      key: "problem",
      title: "Problem definition worksheet",
      type: "document",
      vendor: "google_docs",
      author: "abernathy",
      section: "Week 1: intake",
      date: "2025-06-03",
      body: `# Problem definition

**Basic question:** Which earned revenue lines can Kettle Creek launch within 18 months that contribute at least $1M a year in net margin, use assets it already has and do not pull food or staff time away from partner agencies?

**Situation:** Kettle Creek distributes about 31 million pounds of food a year through 140 partner agencies. It owns a 120,000 square foot warehouse with 18,000 square feet of cold storage, a fleet of 22 trucks and a teaching kitchen used two days a week.

**Complication:** 58 percent of revenue comes from grants and gifts. A state grant moved from annual to biennial and a national funder cut its award by 40 percent. Reserves cover about four months of operations.

**Success looks like:** two pilots the board approves in August, each with a margin case, a mission fit test and a clear kill rule.

**Stakeholders:** decides: CEO and board finance committee. Helps: COO, Director of Programs. Can block: partner agency council (if it looks like Kettle Creek is competing with them).

**Emerging hypotheses**
1. Cold storage is under-used outside the holiday peak and can be leased.
2. Medically tailored meals for health plans fit the mission and pay per meal.
3. A retail or thrift model would anger partner agencies.`,
      summary:
        "Problem definition in the firm template. Target: earned lines worth $1M a year in net margin within 18 months, using existing warehouse, cold storage, fleet and kitchen. Reserves cover about four months, and partner agencies could block anything that looks like competition.",
      entities: "Kettle Creek, cold storage, teaching kitchen, medically tailored meals, partner agency council",
    },
    {
      key: "data-request",
      title: "Email: data request to the COO",
      type: "email",
      vendor: "upload",
      author: "doyle",
      section: "Week 1: intake",
      date: "2025-06-04",
      body: `**To:** COO, Kettle Creek Food Network
**Cc:** June Abernathy
**Subject:** Data request for the earned revenue work

Hi,

Thanks for the warehouse walk-through on Monday. To start the asset review we would be grateful for the following by Friday 13 June, in whatever format is easiest:

1. Monthly cold storage utilization (pallet positions used versus available) for the last 24 months.
2. Fleet schedule for a typical week, including empty return legs.
3. Teaching kitchen calendar for the last six months.
4. Revenue by source for FY23, FY24 and FY25 to date.
5. Any past proposals or inquiries from outside parties about using the warehouse, kitchen or trucks.
6. The partner agency agreement template.

If any of these do not exist, a quick note saying so is just as useful. I am happy to sit with your team for an hour if that is faster than pulling reports.

Thanks,
Rosa Doyle
Kestrel Bay Advisory`,
      summary:
        "Data request email to the COO asking for cold storage utilization, fleet schedules, kitchen calendar, revenue by source, past outside inquiries and the partner agency agreement, due 13 June.",
      entities: "COO, cold storage utilization, fleet schedule, teaching kitchen, partner agency agreement",
    },
    {
      key: "research-chat",
      title: "Research: food bank earned revenue models",
      type: "ai_thread",
      vendor: "claude",
      author: "doyle",
      section: "Weeks 2-3: options scan",
      date: "2025-06-09",
      turns: [
        {
          role: "user",
          content:
            "I'm scanning earned revenue options for a regional food bank with a large warehouse, cold storage, a truck fleet and a small teaching kitchen. List the earned revenue models food banks and hunger relief nonprofits use in the US, with how each makes money and the usual risks. Label each point FACT with a dated source type, or INFERENCE.",
        },
        {
          role: "assistant",
          content:
            "Here are the main models.\n\n1. Medically tailored meals. FACT (state Medicaid waiver documents, 2023 to 2024): several states allow managed care plans to pay for home-delivered medically tailored meals as an in-lieu-of service. Payment is per meal.\n2. Cold storage and warehouse leasing. FACT (food bank annual reports, 2024): some food banks lease surplus cold storage to growers and distributors outside peak months.\n3. Culinary job training with catering. FACT (nonprofit sector reports, 2023): training kitchens often sell catering or school meal contracts.\n4. Contract logistics. INFERENCE: backhaul capacity on return legs can be sold to regional suppliers, but pricing is thin.\n5. Social enterprise retail. FACT (sector news, 2024): a few food banks run discount grocery stores; results are mixed.\n\nINFERENCE: models that reuse idle assets (cold storage, return legs) have the lowest startup cost.\n\nWhere sources disagree: reports on medically tailored meals margins differ sharply. Some programs report surplus per meal, others report losses once delivery is counted. The answer depends on delivery density.",
        },
        { role: "user", content: "Make me a one-page options scan the principal can use for the shortlist meeting." },
        {
          role: "assistant",
          content:
            "Done. The scan lists eleven options in a table with revenue model, asset used, startup cost band and mission fit, keeps the FACT and INFERENCE labels, and notes the disagreement on meal margins.",
        },
      ],
      summary:
        "AI research chat listing earned revenue models used by food banks (medically tailored meals, cold storage leasing, training kitchens, logistics, retail) with FACT and INFERENCE labels. Notes that sources disagree on meal margins depending on delivery density. Produced the options scan.",
      entities: "medically tailored meals, Medicaid in-lieu-of services, cold storage leasing, culinary training, backhaul",
    },
    {
      key: "options-scan",
      title: "Options scan: eleven earned revenue models",
      type: "document",
      vendor: "google_docs",
      author: "doyle",
      section: "Weeks 2-3: options scan",
      date: "2025-06-11",
      madeFrom: "research-chat",
      body: `# Options scan: earned revenue for Kettle Creek

| # | Option | How it earns | Asset used | Startup cost | Mission fit |
|---|---|---|---|---|---|
| 1 | Medically tailored meals | Per meal from health plans | Kitchen, fleet | Medium | High |
| 2 | Cold storage leasing | Per pallet per month | Cold storage | Low | Medium |
| 3 | Catering from training kitchen | Per event | Kitchen | Low | High |
| 4 | School meal contracts | Per meal | Kitchen, fleet | High | High |
| 5 | Backhaul logistics | Per load | Fleet | Low | Low |
| 6 | Discount grocery store | Retail margin | New site | High | Medium |
| 7 | Shared purchasing for agencies | Admin fee | Buying team | Low | Medium |
| 8 | Corporate volunteer fees | Per group | Warehouse | Low | Medium |
| 9 | Food safety training | Per course | Staff | Low | Medium |
| 10 | Thrift or resale | Retail margin | New site | Medium | Low |
| 11 | Data and reporting services | Per agency | Systems | Medium | Low |

**FACT (state Medicaid waiver documents, 2023 to 2024):** health plans in several states may pay for medically tailored meals.
**FACT (food bank annual reports, 2024):** cold storage leasing exists in the sector.
**INFERENCE:** options 2 and 8 reuse idle assets and can start fastest.

**Where sources disagree:** medically tailored meals margins depend on delivery density.

**Shortlist proposed for feasibility:** 1, 2, 8.`,
      summary:
        "Options scan made from the research chat: eleven earned revenue models scored on revenue model, asset, startup cost and mission fit. Proposes medically tailored meals, cold storage leasing and corporate volunteer fees for feasibility.",
      decisions: "Shortlist: medically tailored meals, cold storage leasing, corporate volunteer fees",
      entities: "options scan, medically tailored meals, cold storage leasing, corporate volunteer fees",
    },
    {
      key: "int-coo",
      title: "Interview: Chief Operating Officer",
      type: "call",
      vendor: "granola",
      author: "abernathy",
      section: "Weeks 4-6: feasibility",
      date: "2025-06-24",
      informs: ["options-deck"],
      body: `# Interview: Chief Operating Officer, Kettle Creek Food Network
Attendees: June Abernathy, Rosa Doyle (Kestrel Bay), COO

**June:** The utilization data shows cold storage under half full from February to September. Does that match what you see?
**COO:** Yes. We run about 45 percent full most of the year and then we are over capacity from October to December. Anything we lease has to be out by October 1.
**Rosa:** Has anyone asked to rent space?
**COO:** Two produce growers and a regional distributor asked last year. One offered $28 a pallet a month. We said no because we had no contract template and no insurance answer.
**June:** How many pallet positions could you lease safely?
**COO:** About 600 for eight months, without touching the holiday buffer.
**Rosa:** And the kitchen for medically tailored meals?
**COO:** The kitchen can do maybe 900 meals a day with a second shift. The problem is delivery. Our trucks are built for pallets, not for 300 doorsteps.
**June:** What would worry you about a meals contract?
**COO:** Food safety liability and the hiring. We would need a kitchen manager who has done this before.`,
      summary:
        "COO interview: cold storage runs about 45 percent full from February to September and must be clear by October 1. About 600 pallet positions could be leased for eight months; a grower once offered $28 a pallet a month. The kitchen could make about 900 meals a day, but doorstep delivery is the constraint.",
      decisions: "Cold storage leases end by October 1 every year",
      entities: "COO, cold storage, pallet positions, produce growers, kitchen capacity, delivery",
    },
    {
      key: "int-plan",
      title: "Interview: health plan community programs lead",
      type: "call",
      vendor: "granola",
      author: "doyle",
      section: "Weeks 4-6: feasibility",
      date: "2025-06-26",
      informs: ["options-deck"],
      body: `# Interview: Director of Community Programs, regional Medicaid managed care plan
Attendees: Rosa Doyle, June Abernathy (Kestrel Bay), Director of Community Programs

**Rosa:** Does the plan pay for medically tailored meals today?
**Director:** Yes, under the state's in-lieu-of services list. We contract with two vendors, both out of state, and shipped frozen.
**June:** What do you pay?
**Director:** Between $11 and $13 a meal, usually two meals a day for 12 weeks after a hospital discharge.
**Rosa:** What would make you add a local provider?
**Director:** Members tell us the frozen meals do not match what they eat at home. A local, culturally matched menu would help. We also need a dietitian sign-off on every menu and monthly reporting.
**June:** How many members a year might that cover?
**Director:** For our plan in Kettle Creek's counties, maybe 350 to 400 members a year to start.
**Rosa:** Delivery?
**Director:** Weekly delivery of frozen meals is fine. It does not need to be daily.`,
      summary:
        "Health plan interview: the plan pays $11 to $13 a meal for medically tailored meals, two a day for 12 weeks after discharge. Would add a local provider for 350 to 400 members a year with dietitian-signed menus and monthly reporting; weekly frozen delivery is acceptable.",
      entities: "Medicaid managed care plan, in-lieu-of services, medically tailored meals, dietitian, weekly delivery",
    },
    {
      key: "feasibility-sheet",
      title: "Feasibility model: three shortlisted options",
      type: "sheet",
      vendor: "upload",
      author: "doyle",
      section: "Weeks 4-6: feasibility",
      date: "2025-07-03",
      body: `# Feasibility model, year 2 run rate (v3)

| Option | Volume | Price | Revenue | Direct cost | Net margin | Mission fit |
|---|---|---|---|---|---|---|
| Cold storage leasing | 600 pallets x 8 months | $28 per pallet per month | $134k | $31k | $103k | Medium |
| Medically tailored meals | 375 members x 168 meals | $12 per meal | $756k | $598k | $158k | High |
| Corporate volunteer fees | 140 groups | $1,500 per group | $210k | $72k | $138k | Medium |
| **Total** | | | **$1.10M** | **$0.70M** | **$0.40M** | |

Assumptions: leasing volume and price from COO interview; meals volume and price from health plan interview; meals delivered weekly, frozen; volunteer groups from the last two years of corporate inquiries.

**Read across:** the three options together reach $0.40M of net margin, well short of the $1M aim. Meals carry the mission case; leasing is the fastest to start.`,
      summary:
        "Feasibility model for the three shortlisted options at year-two run rate. Together they reach about $1.10M of revenue and $0.40M of net margin, short of the $1M aim. Meals lead on mission fit and leasing is fastest to start.",
      entities: "feasibility model, cold storage leasing, medically tailored meals, corporate volunteer fees, net margin",
    },
    {
      key: "draft-deck",
      title: "Options deck draft v1 (internal)",
      type: "deck",
      vendor: "google_slides",
      author: "doyle",
      section: "Weeks 4-6: feasibility",
      date: "2025-07-08",
      body: `## Slide 1
Kettle Creek earned revenue options. Draft v1, internal.

## Slide 2
Kettle Creek can earn $1M a year from three new lines. [June: not true on our own numbers, see feasibility model]

## Slide 3
Cold storage leasing: $134k revenue.

## Slide 4
Medically tailored meals: $756k revenue.

## Slide 5
Corporate volunteer fees: $210k revenue.

## Slide 6
Recommendation: launch all three.
[Maren: revenue is not margin. The board will ask what it nets. And three pilots at once with four months of reserves is not a recommendation, it is a wish list.]`,
      summary:
        "Internal first draft of the options deck, never shown. It claimed $1M a year by quoting revenue rather than margin and recommended all three options; the partner rejected both points in comments.",
      entities: "draft deck, partner comments, revenue versus margin",
    },
    {
      key: "options-deck",
      title: "Final readout: earned revenue options and two pilots",
      type: "deck",
      vendor: "google_slides",
      author: "abernathy",
      section: "Weeks 7-8: pilot design",
      date: "2025-07-22",
      shown: [{ on: "2025-07-24", occasion: "Final readout" }],
      body: `## Slide 1
Kettle Creek Food Network: earned revenue options and two pilots. Final readout, 24 July 2025.

## Slide 2
Three earned lines can net about $0.40M a year by year two, less than half of the $1M aim, so earned revenue complements fundraising rather than replacing it.
Source: feasibility model.

## Slide 3
Cold storage sits about 45 percent full from February to September; leasing 600 pallet positions nets about $103k a year.
Source: COO interview, feasibility model.

## Slide 4
A regional health plan would buy locally made medically tailored meals at about $12 a meal for 350 to 400 members a year.
Source: health plan interview.

## Slide 5
Medically tailored meals net about $158k a year and carry the strongest mission case.
Source: feasibility model.

## Slide 6
Pilot 1: lease 300 pallet positions to two growers from February 2026, with every lease ending October 1.

## Slide 7
Pilot 2: 100 members of medically tailored meals with one health plan, weekly frozen delivery, a kill rule if the margin is negative after six months.

## Slide 8
Decision needed in August: approve both pilots and a part-time kitchen manager hire.`,
      summary:
        "Final readout deck shown on 24 July 2025. Three earned lines net about $0.40M by year two, so earned revenue complements fundraising. Recommends two pilots: leasing 300 pallet positions to growers from February 2026 and a 100-member medically tailored meals pilot with a six-month kill rule.",
      decisions: "Board approved both pilots in August\nCorporate volunteer fees deferred to the development team",
      entities: "final readout, cold storage pilot, medically tailored meals pilot, health plan, kill rule",
    },
    {
      key: "private-notes",
      title: "My notes: board and CEO dynamics",
      type: "document",
      vendor: "upload",
      author: "abernathy",
      section: "Weeks 4-6: feasibility",
      date: "2025-07-01",
      visibility: "private",
      body: `Personal working notes, not for the client or the firm.

- The CEO wants a big number for the board and will push us to quote revenue. Hold the line on margin; the finance committee chair is a retired CFO and will take it apart in the room.
- The COO is the person who will actually run any pilot and is quietly worried about being handed a meals program with no new staff. Bring him into the pilot design session before the CEO sees it.
- The Director of Programs is protective of partner agencies and sees the leasing idea as a distraction. She is not wrong that the October 1 rule must be absolute.
- Board chair asked me privately whether the national funder cut was about Kettle Creek's reporting. I said I did not know. Worth flagging to Maren as a possible follow-on on grant reporting.
- Rosa did excellent work on the feasibility model; mention in her review.`,
      summary:
        "Private working notes on CEO, COO, programs director and board chair dynamics, a possible follow-on on grant reporting and a note on the analyst's review. Not for the client or the firm.",
      entities: "CEO, COO, finance committee chair, Director of Programs, board chair",
    },
  ],
  stickies: [
    { section: "Weeks 4-6: feasibility", text: "Partner: quote net margin, never revenue. One recommendation, not a wish list.", fill: "yellow" },
    { section: "Weeks 7-8: pilot design", text: "Every lease ends October 1. Holiday buffer is untouchable.", fill: "pink" },
  ],
  outcome: {
    ranToPlan: true,
    extended: false,
    lesson:
      "The honest answer (about $0.40M, not $1M) landed well because the finance committee saw the margin math early; resetting the target in week 6 avoided a hard conversation at the readout.",
  },
};
