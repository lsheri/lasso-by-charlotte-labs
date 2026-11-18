import type { DemoBoard } from "../types";

/** Three-week commercial due diligence on an HVAC services platform for a lower mid-market PE firm. Closed, ran over. */
export const b26: DemoBoard = {
  key: "b26",
  practice: "Transactions",
  client: { name: "Ironwillow Partners", type: "lower mid-market private equity firm" },
  title: "Commercial diligence on an HVAC services roll-up",
  pattern: "Commercial due diligence",
  shape: "diligence",
  start: "2025-09-08",
  weeks: 3,
  fee: "$120k",
  status: "closed",
  sharedWithFirm: true,
  situation: "deal_diligence",
  brief:
    "Ironwillow is in exclusivity to buy Coldfront Mechanical, a nine-branch residential and light commercial HVAC services platform in the Southeast with $64M of revenue. Management's plan rests on 9 percent market growth and 88 percent service agreement renewal. Test both, map competitors and acquisition targets, and flag anything that should change the price before the investment committee.",
  team: ["haddad", "okafor", "obi", "hart"],
  sections: ["Day 0-2", "Week 1", "Week 2", "Week 3 and IC"],
  items: [
    {
      key: "sow",
      title: "Engagement letter: Coldfront commercial due diligence",
      type: "document",
      vendor: "google_docs",
      author: "okafor",
      section: "Day 0-2",
      date: "2025-09-04",
      body: `# Engagement letter: commercial due diligence on Coldfront Mechanical

**Client:** Ironwillow Partners  **Sponsor:** Partner, deal lead  **Duration:** 3 weeks from 8 September 2025  **Fee:** $120,000 fixed, expenses billed at cost, survey panel costs passed through

## Scope
1. Market model: residential replacement, residential service and repair, light commercial, in Coldfront's footprint (Georgia, the Carolinas, Tennessee), 2024 to 2029.
2. Customer work: 14 customer interviews (residential members and commercial accounts) and a 300-response homeowner survey.
3. Expert calls: 8 to 10 former competitor, distributor and OEM executives.
4. Service agreement retention analysis from data room cohorts.
5. Competitor and add-on target map.
6. Red flags and a diligence report for the investment committee.

## Out of scope
Quality of earnings, legal, insurance, IT and HR diligence.

## Team
Partner (1.5 days a week), manager (full time), consultant (full time), analyst (full time).

## Milestones
- Day 2: hypotheses and data room request
- End of week 1: red-flag gate
- Week 3: deck freeze (T-3) and investment committee report`,
      summary:
        "Signed 3-week, $120k fixed engagement letter for commercial diligence on Coldfront Mechanical: a footprint market model to 2029, 14 customer interviews, a 300-response survey, 8 to 10 expert calls, retention analysis, a competitor and target map and an IC report.",
      decisions: "Fixed fee $120k plus pass-through survey costs\nQuality of earnings and legal out of scope",
      entities: "Ironwillow Partners, Coldfront Mechanical, commercial due diligence, investment committee",
    },
    {
      key: "problem",
      title: "Problem definition and killer variables",
      type: "document",
      vendor: "google_docs",
      author: "haddad",
      section: "Day 0-2",
      date: "2025-09-09",
      body: `# Problem definition

**Basic question:** Does Coldfront's market and customer base support management's plan of 9 percent market growth and 88 percent service agreement renewal through 2029, and if not, what should Ironwillow pay?

**Situation:** Nine branches, $64M revenue, about 70 percent residential and 30 percent light commercial. About 41,000 residential service agreement members. Ironwillow plans to buy and add four to six branches over five years.

**Complication:** The market grew strongly in 2021 to 2023 on replacement demand and a refrigerant transition price lift. Housing turnover has slowed. Management's retention figure has not been reconciled to billing data.

**Success looks like:** an independent growth range, a verified renewal rate and a short list of add-on targets, in time for IC on 29 September.

**Stakeholders:** decides: Ironwillow investment committee. Helps: deal lead, operating partner. Can block: lender (covenants sized on management case).

**Killer variables**
1. Footprint market growth below 5 percent a year.
2. Service agreement renewal below 80 percent.
3. Technician turnover so high that branch growth stalls.

**Hypotheses that would have to be true**
- Replacement demand holds as the installed base ages.
- Members renew because of priority service, not just auto-renew.
- At least 15 add-on targets exist in the footprint.`,
      summary:
        "Problem definition and killer variables for the Coldfront diligence: test management's 9 percent market growth and 88 percent renewal, with kill thresholds at growth below 5 percent, renewal below 80 percent and runaway technician turnover. IC is set for 29 September.",
      entities: "Coldfront Mechanical, killer variables, service agreements, technician turnover, add-on targets, lender",
    },
    {
      key: "vdr-request",
      title: "Email: data room request to management",
      type: "email",
      vendor: "upload",
      author: "hart",
      section: "Day 0-2",
      date: "2025-09-09",
      placed: false,
      body: `**To:** CFO, Coldfront Mechanical; deal team, Ironwillow Partners
**Cc:** Sami Haddad
**Subject:** Commercial diligence: priority data room requests

Hello,

Ahead of tomorrow's management session, these are the items we need first. Items 1 and 2 are on the critical path for the retention analysis.

1. Service agreement billing extract, 2021 to date: member ID, sign date, renewal dates, payment status, cancellation reason.
2. Definition used for the 88 percent renewal figure in the management presentation.
3. Revenue by branch, segment and job type, monthly, 2022 to date.
4. Technician headcount, hires and exits by branch, 2023 to date.
5. Top 50 commercial accounts with revenue and contract end dates.
6. Pricing history for replacement systems, including the 2025 refrigerant changeover.
7. Any list of acquisition targets management has spoken to.

Could you confirm by end of day which items can be uploaded by Friday?

Thank you,
Isaac Hart
Kestrel Bay Advisory`,
      summary:
        "Data room request email to Coldfront's CFO listing seven priority items, led by the service agreement billing extract and the definition behind the 88 percent renewal figure. Captured but never placed on the board.",
      entities: "data room, CFO, billing extract, renewal definition, technician headcount, refrigerant changeover",
    },
    {
      key: "market-chat",
      title: "Research: residential and light commercial HVAC demand in the Southeast",
      type: "ai_thread",
      method: ["desk_research"],
      vendor: "claude",
      author: "obi",
      section: "Week 1",
      date: "2025-09-10",
      turns: [
        {
          role: "user",
          content:
            "I'm building a market model for an HVAC services platform in Georgia, the Carolinas and Tennessee. What drives residential replacement, service and light commercial HVAC demand from 2024 to 2029, and what do public sources say about growth? Label each point FACT with a dated source type or INFERENCE, and note where sources disagree.",
        },
        {
          role: "assistant",
          content:
            "Key drivers:\n\nFACT (federal energy efficiency rulemaking, 2023): new refrigerant rules took effect for new residential systems from January 2025, which raised equipment prices.\n\nFACT (industry association shipment data, 2024): heat pump shipments overtook gas furnaces in recent years, with the Southeast among the strongest regions.\n\nFACT (census housing data, 2024): the Southeast has the fastest household formation in the country, but existing home sales slowed sharply after 2022.\n\nINFERENCE: replacement demand is driven mainly by the age of the installed base, so it should hold even with slower home sales, but the 2025 price lift is a one-time step, not ongoing growth.\n\nINFERENCE: service and repair grows roughly with the installed base and labor rates, slower than replacement in strong years.\n\nWhere sources disagree: published market growth forecasts range from about 4 to 9 percent a year. The high end usually counts the refrigerant price lift as growth and uses national, not regional, data.",
        },
        { role: "user", content: "Write me a market brief with a base case range we can defend at IC." },
        {
          role: "assistant",
          content:
            "Done. The brief separates volume from price, strips the one-time refrigerant lift out of the growth rate, and proposes a base case of about 5 to 6 percent a year for the footprint, with sources labeled.",
        },
      ],
      summary:
        "AI research chat on Southeast HVAC demand drivers: refrigerant rules from January 2025, heat pump adoption, household formation versus slower home sales. Notes forecasts range from 4 to 9 percent because the high end counts the one-time refrigerant price lift. Produced the market brief.",
      entities: "HVAC, refrigerant transition, heat pumps, household formation, replacement demand, market forecasts",
    },
    {
      key: "market-brief",
      title: "Market brief: footprint growth base case",
      type: "document",
      method: ["market_sizing", "desk_research"],
      vendor: "google_docs",
      author: "obi",
      section: "Week 1",
      date: "2025-09-11",
      madeFrom: "market-chat",
      body: `# Market brief: HVAC services in Coldfront's footprint

## Drivers
- **FACT (federal energy efficiency rulemaking, 2023):** refrigerant rules for new residential systems from January 2025 raised equipment prices.
- **FACT (industry association shipment data, 2024):** heat pumps are now the majority of new residential heating shipments, strongest in the Southeast.
- **FACT (census housing data, 2024):** fastest household formation in the US, but existing home sales well below 2021 levels.
- **INFERENCE:** replacement follows installed-base age; the refrigerant price lift is a one-time step.

## Base case
| Segment | Management view | Our base case |
|---|---|---|
| Residential replacement | 9% | 5.5% |
| Residential service and repair | 7% | 4.5% |
| Light commercial | 8% | 6.0% |
| **Blended footprint** | **8.4%** | **5.4%** |

## Where sources disagree
Forecasts range from about 4 to 9 percent. The high end treats the 2025 refrigerant price lift as recurring and uses national data. We strip it out and weight to regional housing data.

## What would move us
Expert calls on replacement cycle length; survey data on repair versus replace decisions.`,
      summary:
        "Market brief made from the research chat: blended footprint growth of 5.4 percent a year in our base case versus 8.4 percent in management's view, after removing the one-time 2025 refrigerant price lift and weighting to regional housing data.",
      decisions: "Base case footprint growth of 5.4 percent",
      entities: "market brief, base case, refrigerant price lift, residential replacement, light commercial",
    },
    {
      key: "call-expert",
      title: "Expert call: former regional GM, national HVAC services consolidator",
      type: "call",
      method: ["expert_calls"],
      role: "industry_expert",
      vendor: "granola",
      author: "haddad",
      section: "Week 1",
      date: "2025-09-12",
      informs: ["ic-report"],
      body: `# Expert call: former Regional General Manager, national HVAC services consolidator (expert network)
Attendees: Sami Haddad, Chidi Obi (Kestrel Bay), expert

**Sami:** How did 2025 look for residential replacement in the Southeast?
**Expert:** Revenue up, units down. The refrigerant changeover pushed system prices up 10 to 15 percent, so everyone's revenue looks good this year. Unit volume in our Atlanta branches was flat to slightly down.
**Chidi:** How do you think about service agreement renewal?
**Expert:** Most companies quote renewal including members on auto-renew whose card failed. When we cleaned that up at my old company, our 89 percent became 80 something. Paid renewal is the number to ask for.
**Sami:** What breaks a roll-up in this market?
**Expert:** Technicians. A good residential tech can walk across the street for two dollars an hour more. If a platform has turnover above 30 percent, it cannot open branches fast enough to hit an acquisition plan.
**Chidi:** How many acquirable shops are in that footprint?
**Expert:** Dozens with $5M to $20M of revenue. The family-owned ones with good service agreement books are getting expensive; three consolidators are bidding for them.`,
      summary:
        "Expert call: 2025 revenue looks strong only because the refrigerant changeover raised system prices 10 to 15 percent while unit volume was flat. Warns that quoted renewal often includes failed auto-renewals; turnover above 30 percent stalls roll-ups; dozens of $5M to $20M targets exist but prices are rising.",
      entities: "expert network, refrigerant changeover, unit volume, paid renewal, technician turnover, add-on targets",
    },
    {
      key: "call-customer",
      title: "Customer interview: commercial property manager",
      type: "call",
      method: ["customer_research"],
      role: "customer",
      vendor: "granola",
      author: "obi",
      section: "Week 2",
      date: "2025-09-16",
      informs: ["ic-report"],
      body: `# Customer interview: Regional Property Manager, commercial office and retail portfolio (Coldfront account)
Attendees: Chidi Obi, Isaac Hart (Kestrel Bay), Regional Property Manager

**Chidi:** How long have you used Coldfront?
**Property Manager:** Six years, across 22 buildings in Atlanta and Raleigh. We moved from a national provider because their response times were terrible.
**Isaac:** What keeps you with them?
**Property Manager:** Same technicians every visit, and they pick up the phone. When a rooftop unit fails in July, I need someone there the same day.
**Chidi:** Have their prices changed?
**Property Manager:** Up about 8 percent this year on maintenance, more on replacements. I accepted it because the service is good, but I re-bid every three years.
**Isaac:** Would anything make you switch?
**Property Manager:** If the technicians I know left. Two of my regular techs left in the spring and the new ones were slower. That is the thing I watch.
**Chidi:** Would you use them in more markets?
**Property Manager:** We have 15 buildings in Nashville. If they opened a branch there, I would give them a trial.`,
      summary:
        "Commercial property manager interview: six years with Coldfront across 22 buildings, kept for same-technician service and fast response. Accepted an 8 percent maintenance price rise but re-bids every three years; technician departures are the main switching risk. Would trial Coldfront in Nashville if it opened a branch.",
      entities: "commercial account, property manager, rooftop units, technician continuity, Nashville, re-bid",
    },
    {
      key: "model",
      title: "Market model and service agreement retention",
      type: "sheet",
      method: ["market_sizing", "data_analysis"],
      vendor: "upload",
      author: "hart",
      section: "Week 2",
      date: "2025-09-19",
      body: `# Market model and retention (v3)

## Footprint market, 2024 to 2029
| Segment | 2024 market | Management CAGR | Base case CAGR | 2029 base case |
|---|---|---|---|---|
| Residential replacement | $2.1B | 9.0% | 5.5% | $2.74B |
| Residential service and repair | $0.9B | 7.0% | 4.5% | $1.12B |
| Light commercial | $1.2B | 8.0% | 6.0% | $1.61B |
| **Total** | **$4.2B** | **8.4%** | **5.4%** | **$5.47B** |

Coldfront share of footprint market, 2024: 1.5%.

## Service agreement renewal (billing extract, paid renewals only)
| Sign cohort | Members | Year 1 paid renewal | Year 2 paid renewal |
|---|---|---|---|
| 2021 | 8,900 | 83% | 85% |
| 2022 | 10,400 | 81% | 84% |
| 2023 | 11,200 | 79% | n/a |
| **Blended year 1** | | **81%** | |

Management's 88 percent counts members on auto-renew with a failed payment as renewed.

## Technician turnover
| Year | Average techs | Exits | Turnover |
|---|---|---|---|
| 2023 | 212 | 66 | 31% |
| 2024 | 231 | 79 | 34% |`,
      summary:
        "Market model and retention sheet: footprint market of $4.2B growing 5.4 percent a year in our base case versus 8.4 percent in management's. Paid year-one renewal is 81 percent, not 88 percent, and falling by cohort; technician turnover rose from 31 to 34 percent.",
      entities: "market model, CAGR, paid renewal, cohort, technician turnover, Coldfront share",
    },
    {
      key: "red-flags",
      title: "Red flags memo",
      type: "document",
      method: ["synthesis"],
      vendor: "google_docs",
      author: "haddad",
      section: "Week 3 and IC",
      date: "2025-09-23",
      body: `# Red flags memo for the deal team (pre-IC)

**1. Growth is price, not volume.** Footprint growth is 5.4 percent in our base case, not 8.4 percent. 2025 revenue growth is flattered by a one-time 10 to 15 percent refrigerant price lift. Not a killer variable (above 5 percent) but close.

**2. Renewal is overstated.** Paid year-one renewal is 81 percent, not 88 percent. It passes the 80 percent kill line by one point, and the 2023 cohort is at 79 percent. Ask management to restate.

**3. Technician turnover is high and rising.** 34 percent in 2024. Our expert puts the stall point for a roll-up at about 30 percent. The largest commercial account named technician departures as its main switching risk.

**4. Add-on prices are rising.** Three consolidators are bidding for the same family-owned shops.

## What this means for price
We recommend underwriting at 5.4 percent market growth and 81 percent renewal, which lowers 2029 revenue in the management plan by roughly 11 percent. Make a technician retention plan a 100-day priority and consider a retention pool in the management incentive plan.

**Data delay:** the billing extract arrived on day 9 instead of day 3, so the retention work moved IC from 26 to 29 September and pushed the report past the three-week window.`,
      summary:
        "Red flags memo before IC: growth is mostly price (5.4 percent base case), paid renewal is 81 percent not 88 percent, technician turnover is 34 percent and rising, and add-on prices are climbing. Recommends underwriting about 11 percent below management's 2029 revenue and prioritizing technician retention.",
      decisions: "Underwrite at 5.4 percent growth and 81 percent renewal\nTechnician retention plan as a 100-day priority",
      entities: "red flags, refrigerant price lift, paid renewal, technician turnover, add-on prices, underwriting case",
    },
    {
      key: "draft-report",
      title: "Diligence report draft (internal, pre-freeze)",
      type: "deck",
      method: ["synthesis"],
      vendor: "google_slides",
      author: "obi",
      section: "Week 3 and IC",
      date: "2025-09-22",
      body: `## Slide 1
Coldfront Mechanical commercial diligence. Draft, internal, before deck freeze.

## Slide 2
The Southeast HVAC market is attractive and growing 8.4 percent a year. [Sami: that is management's number. Ours is 5.4. Fix.]

## Slide 3
Coldfront members renew at 88 percent. [Sami: billing extract says 81 paid. We cannot repeat their number.]

## Slide 4
Customers love the service.

## Slide 5
Technicians: TBC.

## Slide 6
[Tobi: this reads like the management presentation. The IC is paying us for the gaps. Lead with what changes the price, then what holds up.]`,
      summary:
        "Internal draft of the diligence report, never shown. It repeated management's 8.4 percent growth and 88 percent renewal; the manager and partner comments redirected it to our own figures and to lead with what changes the price.",
      entities: "draft report, deck freeze, management case, partner comments",
    },
    {
      key: "ic-report",
      title: "Commercial diligence report: Coldfront Mechanical",
      type: "deck",
      method: ["synthesis"],
      vendor: "google_slides",
      author: "haddad",
      section: "Week 3 and IC",
      date: "2025-09-26",
      shown: [{ on: "2025-09-29", occasion: "Investment committee" }],
      body: `## Slide 1
Coldfront Mechanical: commercial due diligence. Ironwillow investment committee, 29 September 2025.

## Slide 2
The business is sound but the plan is too high: underwrite at 5.4 percent market growth and 81 percent renewal, about 11 percent below management's 2029 revenue.
Source: market model, red flags memo.

## Slide 3
Footprint market growth is 5.4 percent a year once the one-time refrigerant price lift is removed, against 8.4 percent in the management case.
Source: market brief, market model, expert call.

## Slide 4
Paid year-one service agreement renewal is 81 percent, not 88 percent, and the 2023 cohort is at 79 percent.
Source: market model (billing extract), expert call.

## Slide 5
Customers stay for technician continuity and same-day response; technician departures are the main reason they would switch.
Source: customer interviews, survey.

## Slide 6
Technician turnover reached 34 percent in 2024, above the roughly 30 percent level at which roll-ups stall.
Source: market model, expert call.

## Slide 7
Add-on targets exist (dozens with $5M to $20M revenue) and a large commercial account would follow Coldfront into Nashville.
Source: expert call, customer interview.

## Slide 8
100-day priorities: technician retention pool, restated renewal reporting, Nashville branch case.`,
      summary:
        "Commercial diligence report shown to Ironwillow's investment committee on 29 September 2025. Recommends underwriting at 5.4 percent market growth and 81 percent paid renewal, about 11 percent below management's 2029 revenue, and flags 34 percent technician turnover as the main operating risk.",
      decisions: "IC approved the deal at a reduced price on the base case\nTechnician retention pool added to the 100-day plan",
      entities: "investment committee, Coldfront Mechanical, market growth, paid renewal, technician turnover, Nashville",
    },
    {
      key: "proposal",
      title: "Proposal: Coldfront commercial due diligence",
      type: "document",
      kind: "proposal",
      vendor: "google_docs",
      author: "okafor",
      section: "Day 0-2",
      date: "2025-08-25",
      body: `# Proposal: commercial due diligence on Coldfront Mechanical

**Prepared for:** Ironwillow Partners, deal lead  **From:** Kestrel Bay Advisory  **Date:** 25 August 2025

## Context
Ironwillow is in exclusivity on Coldfront Mechanical, an HVAC services platform in the Southeast. The investment committee needs an independent view of the market, customer loyalty and the add-on pipeline in three weeks.

## Objectives
1. Test the growth case for residential replacement, service and repair, and light commercial work.
2. Test service agreement retention.
3. Flag anything that should stop or reprice the deal.

## Our approach
### Days 0 to 2
Hypotheses and data room request.
### Week 1
Market model for Georgia, the Carolinas and Tennessee, 2024 to 2029. Expert calls begin. Red-flag gate at the end of the week.
### Weeks 2 and 3
14 customer interviews, a 300-response homeowner survey, retention analysis from data room cohorts and a competitor and add-on target map. Deck freeze three days before IC.

## Workstreams
Market model. Customer work. Expert calls. Retention. Competitors and targets.

## Deliverables
Red-flag memo. Market model. Survey and interview findings. Investment committee report.

## Timeline
3 weeks from 8 September 2025.

## Team
A partner 1.5 days a week, a full-time manager, consultant and analyst.

## Fees
$120,000 fixed, expenses billed at cost, survey panel costs passed through.

## Assumptions and exclusions
Quality of earnings, legal, insurance, IT and HR diligence are out of scope.

## Why Kestrel Bay
We give investment committees a clear answer on time, and we say early when something is wrong.`,
      summary:
        "Proposal to Ironwillow Partners for three weeks of commercial due diligence on Coldfront Mechanical, an HVAC services roll-up. Fixed fee of $120k. Covers a footprint market model, customer interviews, a survey, expert calls, retention analysis and an IC report.",
      entities: "Ironwillow Partners, Coldfront Mechanical, HVAC services, commercial due diligence, investment committee",
      shown: [{ on: "2025-08-26", occasion: "Proposal sent to the deal lead" }],
    },
  ],
  stickies: [
    { section: "Week 3 and IC", text: "Partner: lead with what changes the price, then what holds up. Our numbers, never management's.", fill: "yellow" },
    { section: "Week 1", text: "Red-flag gate: renewal definition unresolved until billing extract lands", fill: "pink" },
  ],
  outcome: {
    ranToPlan: false,
    extended: true,
    lesson:
      "The billing extract arrived six days late and moved IC by three days; put the renewal definition and billing data in the engagement letter as a day-3 dependency with a fee clause for slippage.",
  },
};
