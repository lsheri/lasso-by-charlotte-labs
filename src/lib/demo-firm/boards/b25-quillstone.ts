import type { DemoBoard } from "../types";

/** LP memo and add-on diligence for a micro-cap PE fund. Closed; the pricing comparable for later fundraising work. */
export const b25: DemoBoard = {
  key: "b25",
  practice: "Transactions",
  client: { name: "Quillstone Capital", type: "micro-cap private equity fund, Fund I, $75M target" },
  title: "LP memo and add-on diligence",
  pattern: "PE fundraising and diligence",
  shape: "diligence",
  start: "2024-04-08",
  weeks: 4,
  fee: "$85k",
  status: "closed",
  sharedWithFirm: true,
  situation: "fundraising",
  brief:
    "Quillstone held a $41M first close for Fund I from family offices that already know route-based commercial services. To reach its $75M target it must raise from LPs outside that niche. Write the confidential investment memorandum for new LP types, and in parallel run a fast diligence on an out-of-focus add-on (a smart irrigation subscription business) for its landscaping platform.",
  team: ["brennan", "okafor", "park"],
  sections: ["Day 0-2", "Week 1", "Week 2", "Week 3", "Memo and IC"],
  items: [
    {
      key: "sow",
      title: "Engagement letter: LP memo and add-on diligence",
      type: "document",
      vendor: "google_docs",
      author: "okafor",
      section: "Day 0-2",
      date: "2024-04-04",
      body: `# Engagement letter: Quillstone Capital

**Client:** Quillstone Capital (Fund I)  **Sponsor:** Managing Partner  **Duration:** 4 weeks from 8 April 2024  **Fee:** $85,000 fixed, expenses billed at cost

## Fee by module
| Module | Scope | Fee |
|---|---|---|
| A. LP landscape and confidential memo | LP segment research, target LP list of 60 to 80 names, investment memorandum (about 30 pages plus a 12-slide teaser deck) | $50,000 |
| B. Add-on diligence | Data room review, 10 customer and expert calls, retention and concentration analysis, risk review, 15-page diligence summary for the investment committee | $35,000 |
| **Total** | | **$85,000** |

## Out of scope
Placement agent services, LP introductions, legal review of fund documents, quality of earnings, technology or IP diligence on the add-on.

## Optional, not included in the fee
LP meeting preparation sessions at $4,500 per day, billed only if requested.

## Team
Partner (one day a week), principal (full time), consultant (full time).

## Milestones
- Day 2: hypotheses and data room request
- Week 2: red-flag gate on the add-on
- Week 4: memo final and investment committee readout`,
      summary:
        "Signed 4-week, $85k fixed engagement letter in two modules: $50k for LP landscape research and the confidential investment memorandum, $35k for add-on diligence with 10 calls and an IC summary. LP introductions, quality of earnings and IP diligence are out of scope; LP prep days are optional at $4,500 a day.",
      decisions: "Fixed fee $85k: Module A $50k, Module B $35k\nQuality of earnings and placement services out of scope",
      entities: "Quillstone Capital, Fund I, investment memorandum, add-on diligence, Managing Partner",
    },
    {
      key: "problem",
      title: "Problem definition and would-have-to-be-true hypotheses",
      type: "document",
      vendor: "google_docs",
      author: "brennan",
      section: "Day 0-2",
      date: "2024-04-09",
      body: `# Problem definition

**Basic question:** (A) What story and evidence will persuade LPs outside route-based services to commit to Fund I before its final close in October 2024? (B) Should Alpine Grounds buy Verdant Irrigation Analytics, and at what price?

**Situation:** Fund I targets $75M and held a $41M first close in December 2023. Strategy: control buyouts of route-based commercial services companies in the Mountain West with $1M to $4M of EBITDA. The platform company Alpine Grounds (commercial landscaping, $22M revenue) wants to buy Verdant, a smart irrigation controller and monitoring business.

**Complication:** Current LPs are local family offices and operators. New LP types (emerging manager programs, small endowments, multi-family offices) do not know the niche. Verdant is out of focus: part hardware, part subscription, asking $11M.

**Success looks like:** a memo the Managing Partner can send to 60 to 80 LPs; a clear proceed, reprice or pass on Verdant.

**Stakeholders:** decides: Managing Partner and investment committee. Helps: Alpine Grounds CEO. Can block: anchor LP (has a side-letter consent right on out-of-strategy deals).

**Would have to be true for Verdant**
1. Subscription revenue retains at least 85 percent a year.
2. No customer is more than 15 percent of revenue.
3. Demand does not depend on utility rebates that may end.
4. Alpine Grounds can cross-sell to at least a fifth of its sites.`,
      summary:
        "Problem definition for both modules: an LP story for investors outside the niche before the October 2024 final close, and a proceed, reprice or pass call on the $11M Verdant add-on. Lists four would-have-to-be-true tests: retention above 85 percent, no customer over 15 percent, no rebate dependence, cross-sell to a fifth of Alpine sites.",
      entities: "Fund I, Alpine Grounds, Verdant Irrigation Analytics, anchor LP, side letter, would-have-to-be-true",
    },
    {
      key: "lp-chat",
      title: "Research: LP segments for a first-time micro-cap fund",
      type: "ai_thread",
      method: ["desk_research"],
      vendor: "chatgpt",
      author: "park",
      section: "Week 1",
      date: "2024-04-11",
      turns: [
        {
          role: "user",
          content:
            "A first-time micro-cap buyout fund ($75M target, $41M first close from family offices) needs LPs outside its niche. Which LP segments commit to first-time micro-cap buyout funds, what do they screen for, and what check sizes are typical? Label each point FACT with a dated source type, or INFERENCE, and flag where sources disagree.",
        },
        {
          role: "assistant",
          content:
            "Main segments:\n\n1. Emerging manager programs at public pensions and their fund-of-funds managers. FACT (pension board materials, 2023): several large plans run emerging manager programs, usually allocated through a separate manager, with minimum fund sizes that sometimes exclude funds under $100M.\n2. Fund-of-funds focused on lower middle market and micro-cap. FACT (fund-of-funds marketing materials, 2023): they back first-time funds and commonly ask for co-investment rights.\n3. Small endowments and foundations. INFERENCE: interested if the strategy is differentiated, but they often rely on consultants who screen out funds below $100M.\n4. Multi-family offices and RIAs. FACT (industry surveys, 2023): growing private markets allocations among high-net-worth platforms.\n\nINFERENCE: the strongest pitch for new LPs is attributed track record from prior deals plus a clear sourcing edge.\n\nWhere sources disagree: reports differ on whether emerging manager programs are expanding or contracting in 2024. Treat this segment as possible, not core.",
        },
        { role: "user", content: "Draft an LP landscape note with check sizes and a priority order for the Managing Partner." },
        {
          role: "assistant",
          content:
            "Done. The note ranks multi-family offices and micro-cap fund-of-funds first, emerging manager programs second, endowments third, with typical check size ranges and what each will ask for in diligence.",
        },
      ],
      summary:
        "AI research chat on which LP segments back first-time micro-cap buyout funds: emerging manager programs, micro-cap fund-of-funds, small endowments and multi-family offices, with FACT and INFERENCE labels. Notes that sources disagree on whether emerging manager programs are growing. Produced the LP landscape note.",
      entities: "LP segments, emerging manager programs, fund-of-funds, multi-family offices, co-investment rights",
    },
    {
      key: "lp-landscape",
      title: "LP landscape note and priority order",
      type: "document",
      method: ["desk_research"],
      vendor: "google_docs",
      author: "park",
      section: "Week 1",
      date: "2024-04-12",
      madeFrom: "lp-chat",
      body: `# LP landscape for Quillstone Fund I

| Priority | Segment | Typical check | What they screen for | Fit |
|---|---|---|---|---|
| 1 | Multi-family offices and RIAs | $1M to $5M | Attributed track record, alignment, reporting | High |
| 1 | Micro-cap fund-of-funds | $3M to $7M | Track record, sourcing edge, co-investment rights | High |
| 2 | Emerging manager programs | $5M to $10M | Minimum fund size, institutional operations | Medium |
| 3 | Small endowments and foundations | $2M to $5M | Consultant approval, differentiation | Low to medium |

- **FACT (fund-of-funds marketing materials, 2023):** micro-cap fund-of-funds back first-time managers and usually ask for co-investment rights.
- **FACT (pension board materials, 2023):** some emerging manager programs set fund size floors that may exclude a $75M fund.
- **INFERENCE:** attributed track record and a proprietary sourcing story matter more than the niche itself.

**Where sources disagree:** emerging manager program growth in 2024 is contested, so we rank it second.

**Implication for the memo:** lead with the partners' attributed track record (7 realized deals) and the sourcing model (founder-owned route businesses, mostly unbanked), and offer co-investment rights to fund-of-funds. Target list: 72 names across the four segments.`,
      summary:
        "LP landscape note made from the research chat: multi-family offices and micro-cap fund-of-funds first, emerging manager programs second, endowments third, with check sizes and screens. Recommends leading the memo with attributed track record and sourcing, offering co-investment rights; target list of 72 LPs.",
      decisions: "Memo leads with attributed track record and sourcing\nOffer co-investment rights to fund-of-funds",
      entities: "LP landscape, multi-family offices, fund-of-funds, emerging manager programs, co-investment rights, target list",
    },
    {
      key: "call-customer",
      title: "Customer check: regional property management firm",
      type: "call",
      method: ["customer_research"],
      role: "customer",
      vendor: "granola",
      author: "park",
      section: "Week 2",
      date: "2024-04-17",
      informs: ["dd-summary"],
      body: `# Customer check: Director of Facilities, regional property management firm (Verdant's largest customer)
Attendees: Daniel Park, Cormac Brennan (Kestrel Bay), Director of Facilities

**Daniel:** How many of your sites use Verdant?
**Director:** About 160 of our managed properties, mostly office parks and HOAs. We started with 20 as a pilot in 2021.
**Cormac:** Why did you expand?
**Director:** Water bills. We cut irrigation water by roughly a quarter on the pilot sites. And in two of our cities the utility paid most of the controller cost through a rebate.
**Daniel:** If the rebates ended, would you keep adding sites?
**Director:** Slower. The subscription is easy to justify on existing sites. New hardware without a rebate is a harder conversation with the HOA boards.
**Cormac:** Have you ever canceled a site?
**Director:** When a property leaves our management, the subscription usually goes with it. That is most of our cancellations.
**Daniel:** What would make you leave Verdant?
**Director:** If the controllers start failing. We had a bad batch in 2022 and Verdant replaced them, but it was slow.
**Cormac:** Would you buy landscaping and irrigation monitoring from one company?
**Director:** Possibly, but our landscaping contracts are bid site by site. I would not assume a bundle.`,
      summary:
        "Largest customer check: about 160 sites on Verdant after a 20-site pilot, driven by roughly a quarter less irrigation water and utility rebates. New sites would slow if rebates end; cancellations mostly follow properties leaving management. A 2022 controller batch failed, and the customer would not assume a landscaping bundle.",
      entities: "Verdant Irrigation Analytics, property management, utility rebates, controller failures, cross-sell",
    },
    {
      key: "call-expert",
      title: "Expert call: former VP sales, irrigation equipment distributor",
      type: "call",
      method: ["expert_calls"],
      role: "industry_expert",
      vendor: "granola",
      author: "brennan",
      section: "Week 2",
      date: "2024-04-18",
      informs: ["dd-summary"],
      body: `# Expert call: former Vice President of Sales, irrigation equipment distributor (expert network)
Attendees: Cormac Brennan, Daniel Park (Kestrel Bay), expert

**Cormac:** How big a role do utility rebates play in smart controller sales?
**Expert:** In the Mountain West, a large one. In some territories more than half of commercial smart controller installs used a rebate in the last three years. Several of those programs were funded through 2025 and nobody knows what happens after.
**Daniel:** How do monitoring subscriptions hold up?
**Expert:** Better than hardware. Once a property manager is using the dashboard, they rarely turn it off. Churn comes from properties changing hands.
**Cormac:** Who are Verdant's competitors?
**Expert:** Two national controller brands with their own apps, and the big landscape firms who resell those apps. Verdant's edge is local service and the alerting.
**Daniel:** Any supply chain risk?
**Expert:** Most of the small players buy controllers from one or two contract manufacturers. If that factory has a problem, you have nothing to install.`,
      summary:
        "Expert call: in some Mountain West territories more than half of commercial smart controller installs used a utility rebate, and many programs are funded only through 2025. Monitoring subscriptions are sticky, churn follows property turnover, and small players depend on one or two contract manufacturers.",
      entities: "expert network, utility rebates, smart controllers, monitoring subscriptions, contract manufacturer",
    },
    {
      key: "target-data",
      title: "Verdant data room analysis: revenue, retention, concentration",
      type: "sheet",
      method: ["data_analysis"],
      vendor: "upload",
      author: "park",
      section: "Week 2",
      date: "2024-04-19",
      body: `# Verdant Irrigation Analytics, data room analysis (v2)

| Metric | FY22 | FY23 | Note |
|---|---|---|---|
| Revenue | $5.6M | $6.8M | |
| Subscription revenue share | 36% | 41% | |
| Hardware and install revenue | $3.6M | $4.0M | |
| EBITDA | $0.6M | $0.9M | |
| Commercial sites monitored | 920 | 1,150 | |
| Subscription gross revenue retention | 87% | 88% | Passes the 85% test |
| Largest customer share of revenue | 12% | 14% | Passes the 15% test, barely |
| New installs using a utility rebate | 27% | 31% | Programs funded to end of 2025 |
| Alpine Grounds sites overlapping Verdant territory | | 410 | |

## Valuation
| Case | EBITDA basis | Multiple | Value |
|---|---|---|---|
| Asking price | $0.9M | 12.2x | $11.0M |
| Rebate-adjusted | $0.75M | 11.5x | $8.6M |

Rebate-adjusted case removes margin on rebate-dependent installs in FY23 and holds subscription revenue.`,
      summary:
        "Data room analysis of Verdant: revenue grew from $5.6M to $6.8M with subscriptions at 41 percent, subscription retention at 88 percent, and the largest customer at 14 percent of revenue. 31 percent of new installs used a utility rebate funded to end of 2025; the rebate-adjusted value is $8.6M against an $11.0M ask.",
      entities: "Verdant, gross revenue retention, customer concentration, utility rebates, valuation, rebate-adjusted case",
    },
    {
      key: "risk-review",
      title: "Risk review: Verdant add-on",
      type: "document",
      method: ["data_analysis"],
      vendor: "google_docs",
      author: "brennan",
      section: "Week 3",
      date: "2024-04-24",
      body: `# Risk review: Verdant Irrigation Analytics

| Risk | Evidence | Severity | Mitigation |
|---|---|---|---|
| Rebate dependence | 31% of FY23 new installs used a rebate; programs funded to end of 2025 (data room, expert call) | High | Reprice to $8.6M; earnout on non-rebate installs |
| Customer concentration | Largest customer 14% of revenue (data room) | Medium | Change of control consent before signing |
| Hardware supply | Single contract manufacturer (expert call, data room supplier list) | Medium | Second source qualified within 12 months, budget $150k |
| Product quality | 2022 controller batch failure (customer check) | Medium | Warranty reserve review in quality of earnings |
| Cross-sell assumption | Largest customer bids landscaping site by site (customer check) | Medium | Exclude cross-sell from the price; treat as upside |
| Anchor LP consent | Side letter consent right on out-of-strategy deals | Low | Brief anchor LP before IC |

**Red-flag gate (week 2):** no deal-breaking findings; two pricing issues (rebates, cross-sell).

**Recommendation to IC:** proceed only at or near $8.6M with up to $1.5M of earnout tied to installs that do not use a rebate in 2025 and 2026.`,
      summary:
        "Risk review of the Verdant add-on: rebate dependence is the high risk, followed by customer concentration, single-source hardware, a past controller failure and an unproven cross-sell. Recommends proceeding only near $8.6M with up to $1.5M of earnout on non-rebate installs.",
      decisions: "Cross-sell excluded from the price\nRecommend $8.6M plus up to $1.5M earnout",
      entities: "risk review, rebate dependence, earnout, contract manufacturer, anchor LP, red-flag gate",
    },
    {
      key: "memo-draft",
      title: "Investment memorandum draft v1 (internal)",
      type: "deck",
      method: ["synthesis"],
      vendor: "google_slides",
      author: "park",
      section: "Week 3",
      date: "2024-04-23",
      body: `## Slide 1
Quillstone Capital Fund I. Teaser draft v1, internal.

## Slide 2
The Mountain West route-based services market is large and growing. [Tobi: every fund says this. Why us?]

## Slide 3
Our team: bios of the two partners.

## Slide 4
Track record: 7 realized deals. [Cormac: need gross and net, and attribution language from counsel before this goes anywhere]

## Slide 5
Fund terms: 2 and 20, $75M target.

## Slide 6
Pipeline: 14 companies in conversation.
[Tobi: lead with sourcing and track record, not market size. New LPs do not care about landscaping; they care whether these two people can find and fix small companies.]`,
      summary:
        "Internal first draft of the LP teaser, never shown. It led with market size; the partner's comments redirected it to lead with sourcing and attributed track record, and asked for gross and net returns with counsel-approved attribution language.",
      entities: "teaser draft, track record, attribution, sourcing, partner comments",
    },
    {
      key: "lp-memo",
      title: "Confidential investment memorandum: teaser deck",
      type: "deck",
      method: ["synthesis"],
      vendor: "google_slides",
      author: "brennan",
      section: "Memo and IC",
      date: "2024-04-30",
      shown: [
        { on: "2024-05-02", occasion: "Final readout" },
        { on: "2024-05-14", occasion: "LP roadshow" },
      ],
      body: `## Slide 1
Quillstone Capital Fund I: buying and building founder-owned route-based service companies in the Mountain West.

## Slide 2
The partners have bought and exited 7 founder-owned service companies, returning 2.9x gross on invested capital.
Source: attributed track record, approved by fund counsel.

## Slide 3
Most targets have never had an outside buyer: 11 of the last 14 deals in the pipeline came direct from founders, not from bankers.
Source: Quillstone pipeline log.

## Slide 4
Route density is the value lever: adding customers on existing routes lifts margin without adding trucks.
Source: Alpine Grounds operating data.

## Slide 5
Fund I has $41M committed from family offices and operators who know the sector, toward a $75M target.

## Slide 6
We are inviting a small number of new LPs, with co-investment rights for commitments of $5M or more.
Source: LP landscape note.

## Slide 7
Final close: October 2024.`,
      summary:
        "Confidential investment memorandum teaser shown at the client readout on 2 May and used in the LP roadshow from 14 May 2024. Leads with 7 realized deals at 2.9x gross, founder-direct sourcing, route density as the value lever, the $41M first close, and co-investment rights for commitments of $5M or more.",
      decisions: "Co-investment rights for LPs committing $5M or more",
      entities: "investment memorandum, Fund I, track record, route density, co-investment rights, final close",
    },
    {
      key: "dd-summary",
      title: "Diligence summary: Verdant add-on",
      type: "deck",
      method: ["synthesis"],
      vendor: "google_slides",
      author: "brennan",
      section: "Memo and IC",
      date: "2024-05-01",
      shown: [{ on: "2024-05-02", occasion: "Investment committee" }],
      body: `## Slide 1
Verdant Irrigation Analytics: add-on diligence summary. Investment committee, 2 May 2024.

## Slide 2
Recommendation: proceed at $8.6M plus up to $1.5M of earnout, not at the $11.0M ask.
Source: data room analysis, risk review.

## Slide 3
The subscription business is solid: 88 percent gross revenue retention and 41 percent of revenue.
Source: data room analysis, expert call.

## Slide 4
31 percent of new installs used a utility rebate, and those programs are funded only to the end of 2025.
Source: data room analysis, expert call, customer check.

## Slide 5
The largest customer is 14 percent of revenue and would not assume a landscaping bundle, so cross-sell is upside, not price.
Source: customer check, data room analysis.

## Slide 6
Hardware comes from a single contract manufacturer; qualify a second source within 12 months for about $150k.
Source: expert call, risk review.

## Slide 7
Before signing: change of control consent from the largest customer, warranty reserve review, anchor LP briefing.`,
      summary:
        "Diligence summary shown to the investment committee on 2 May 2024. Recommends proceeding at $8.6M plus up to $1.5M earnout rather than the $11.0M ask, citing 88 percent subscription retention, 31 percent rebate-dependent installs, 14 percent customer concentration and single-source hardware.",
      decisions: "IC approved an offer at $8.6M plus up to $1.5M earnout",
      entities: "investment committee, Verdant, earnout, gross revenue retention, utility rebates, concentration",
    },
  ],
  stickies: [
    { section: "Memo and IC", text: "Partner: lead with sourcing and track record, not market size. Every return figure needs counsel-approved attribution.", fill: "yellow" },
    { section: "Week 2", text: "Red-flag gate passed: no deal breakers, two pricing issues (rebates, cross-sell)", fill: "green" },
  ],
  outcome: {
    ranToPlan: true,
    extended: true,
    lesson:
      "Running the memo and the add-on in parallel worked because one principal owned both; the client extended for three LP prep days at the day rate, and splitting the fee by module made the follow-on easy to price.",
  },
};
