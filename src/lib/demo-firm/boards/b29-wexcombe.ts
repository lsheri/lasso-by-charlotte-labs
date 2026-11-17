import type { DemoBoard } from "../types";

/** Value creation plan for a family office's newly acquired distributor, closed on plan and not extended. */
export const b29: DemoBoard = {
  key: "b29",
  practice: "Transactions",
  client: { name: "Wexcombe Holdings", type: "single family office with direct private equity investments" },
  title: "Portfolio company value creation plan",
  pattern: "Value creation plan",
  shape: "phased",
  start: "2024-02-05",
  weeks: 8,
  fee: "$170k",
  status: "closed",
  sharedWithFirm: true,
  brief:
    "Wexcombe bought Brightwater Supply, a regional plumbing, HVAC and industrial supply distributor with 34 branches, in December 2023. It was the family office's first control deal without a co-investor. Build the baseline, size the pricing and procurement levers, and turn them into a 100-day plan and a 24-month value creation plan the new CEO and the Wexcombe investment committee both sign.",
  team: ["haddad", "okafor", "park", "hart"],
  sections: ["Weeks 1 to 3: diagnose", "Weeks 4 to 6: size", "Weeks 7 to 8: plan"],
  workstreams: ["Baseline", "Pricing levers", "Procurement", "100-day plan"],
  items: [
    {
      key: "sow",
      title: "SOW: Brightwater value creation plan",
      type: "document",
      vendor: "google_docs",
      author: "okafor",
      section: "Weeks 1 to 3: diagnose",
      date: "2024-01-29",
      body: `# Statement of work: Brightwater Supply value creation plan

**Client:** Wexcombe Holdings  **Sponsor:** Head of direct investments  **Duration:** 8 weeks from 5 February 2024  **Fee:** $170,000 fixed, expenses capped at 7%

## Objective
A 24-month value creation plan and a 100-day plan for Brightwater Supply, sized lever by lever and owned by named Brightwater executives.

## Scope
1. Baseline: EBITDA bridge from the deal model to the 2023 actuals, by branch and product category.
2. Pricing: price realization, discount leakage and contract pricing review across the top 2,000 SKUs.
3. Procurement: vendor consolidation and rebate capture across the top 40 suppliers.
4. 100-day plan with owners, milestones and a KPI pack for the monthly board.
5. Midpoint review (week 4) and final readout to the Wexcombe investment committee (week 8).

## Out of scope
ERP replacement, add-on acquisition screening, management assessment.

## Team
Partner (0.5 day a week), manager (full time), consultant (full time), analyst (full time). Brightwater CFO as day-to-day counterpart.`,
      summary:
        "Signed 8-week, $170k fixed-fee SOW for Wexcombe to build a value creation plan for Brightwater Supply. Covers an EBITDA baseline, pricing and procurement levers, a 100-day plan and KPI pack. Midpoint review at week 4 and final readout to the Wexcombe IC at week 8.",
      decisions: "Fixed fee of $170k with expenses capped at 7%\nERP replacement and add-on screening out of scope",
      entities: "Wexcombe Holdings, Brightwater Supply, value creation plan, 100-day plan, pricing, procurement",
    },
    {
      key: "problem",
      title: "Problem definition worksheet",
      type: "document",
      vendor: "google_docs",
      author: "haddad",
      section: "Weeks 1 to 3: diagnose",
      date: "2024-02-06",
      body: `# Problem definition

**Basic question:** Which levers can add at least $5M of run-rate EBITDA at Brightwater within 24 months, without losing contractor customers, and who owns each one?

**Situation:** Brightwater has 34 branches across three states, 2023 revenue of $212M and EBITDA of $15.1M (7.1 percent margin). Wexcombe paid 7.5x EBITDA.

**Complication:** The deal model assumed margin would reach 9 percent by 2026, but nobody has said how. Branch managers set their own discounts. Purchasing runs through 112 active suppliers with no rebate tracking.

**Success looks like:** a plan the CEO owns, sized to $5M or more, with a 100-day plan that shows results in the Q2 board pack.

**Stakeholders:** decides: Wexcombe head of direct investments and Brightwater CEO. Helps: Brightwater CFO, VP Sales. Can block: the four regional managers, who control branch discounts.

**Emerging hypotheses**
1. Discount leakage at branch level is worth more than list price increases.
2. Consolidating to fewer suppliers in the top categories unlocks rebate tiers Brightwater already qualifies for.
3. Regional managers will accept pricing guardrails if their bonus moves from revenue to gross margin dollars.`,
      summary:
        "Problem definition in the firm template. Basic question: find $5M or more of run-rate EBITDA in 24 months without losing contractors. Brightwater has $212M revenue and $15.1M EBITDA; discounts are set by branch and 112 suppliers have no rebate tracking. Three hypotheses on leakage, rebates and bonus design.",
      entities: "Brightwater Supply, EBITDA, discount leakage, rebates, regional managers, Wexcombe",
    },
    {
      key: "int-ceo",
      title: "Interview: Brightwater CEO",
      type: "call",
      vendor: "granola",
      author: "haddad",
      section: "Baseline",
      date: "2024-02-08",
      informs: ["midpoint", "final"],
      body: `# Interview: CEO, Brightwater Supply
Attendees: Sami Haddad (Kestrel Bay), Daniel Park (Kestrel Bay), CEO

**Sami:** You joined in January. What surprised you?
**CEO:** How independent the branches are. Each branch manager has a price book in his head. Two branches 30 miles apart quote the same contractor different prices for the same water heater.
**Daniel:** Is that a margin problem or a service strength?
**CEO:** Both. Contractors stay because their branch manager picks up the phone. I do not want to break that. I want to stop giving away margin nobody asked for.
**Sami:** Where do you think the money is?
**CEO:** Pricing first. Purchasing second. We buy from over a hundred suppliers and I could not tell you what rebates we earned last year.
**Daniel:** What would make the plan fail?
**CEO:** If it looks like head office taking power from branches. The regional managers have been here twenty years. They need to be the authors.
**Sami:** How fast can you move?
**CEO:** I need something visible in the Q2 board pack. Wexcombe is patient, but this is their first deal on their own.`,
      summary:
        "Brightwater CEO interview: branches set prices independently and quote the same contractor different prices. Sees pricing then purchasing as the main levers, but warns the plan fails if it looks like head office taking power. Needs visible results in the Q2 board pack.",
      entities: "CEO, branch pricing, contractors, rebates, regional managers, Q2 board pack",
    },
    {
      key: "int-regional",
      title: "Interview: regional manager, Ohio branches",
      type: "call",
      vendor: "granola",
      author: "park",
      section: "Pricing levers",
      date: "2024-02-14",
      informs: ["midpoint"],
      body: `# Interview: Regional manager, 11 Ohio branches
Attendees: Daniel Park, Isaac Hart (Kestrel Bay), Regional manager

**Daniel:** How do branch managers decide a discount?
**Regional manager:** Relationship and volume. A plumber who buys every day gets the best price. A walk-in pays list.
**Isaac:** The invoice data shows 23 percent of lines sold below the floor price in the system. Does that sound right?
**Regional manager:** Probably. The floor in the system is out of date, so nobody looks at it. If you gave us a floor that made sense we would use it.
**Daniel:** Would you accept a rule that anything below the floor needs your approval?
**Regional manager:** Mine, yes. Head office, no. I am not calling Cleveland to approve a $40 fitting.
**Isaac:** And bonuses?
**Regional manager:** We get paid on revenue today. If you pay us on margin, behavior changes in a month. Just do not change it mid-year without warning.`,
      summary:
        "Regional manager for 11 Ohio branches: discounts follow relationship and volume; agrees the system floor is outdated, so 23 percent of lines sell below it. Accepts regional (not head office) approval below a refreshed floor and supports moving bonuses to margin with notice.",
      decisions: "Below-floor pricing approved by regional managers, not head office",
      entities: "regional manager, price floor, discount approval, margin bonus, invoice data",
    },
    {
      key: "pricing-chat",
      title: "Research: pricing and rebate benchmarks for industrial distributors",
      type: "ai_thread",
      vendor: "claude",
      author: "park",
      section: "Pricing levers",
      date: "2024-02-12",
      turns: [
        {
          role: "user",
          content:
            "For a regional plumbing, HVAC and MRO distributor (about $210M revenue, 34 branches), summarize what public sources say about typical price realization gains, discount leakage and supplier rebate capture in value creation plans. Label each point FACT with a dated source or INFERENCE.",
        },
        {
          role: "assistant",
          content:
            "Here is a summary.\n\nFACT (distribution industry association benchmarking, 2023): gross margins for plumbing and HVAC distributors cluster in the mid to high 20s percent, with wide spread between top and bottom quartile.\nFACT (published PE operating partner case write-ups, 2022 and 2023): pricing programs in fragmented distribution typically report 1 to 3 points of gross margin improvement, mostly from discount discipline rather than list increases.\nFACT (supplier rebate practitioner guide, 2023): distributors without rebate tracking commonly leave a meaningful share of earned rebates unclaimed, often cited in the low single digits of purchases.\nINFERENCE: a branch-led distributor with an outdated floor price is likely at the low end of the margin range, so the opportunity sits toward the top of the 1 to 3 point band.\nINFERENCE: supplier consolidation works best category by category, starting where two or three suppliers sell near-identical products.\n\nWhere sources disagree: the case write-ups attribute most gains to discount discipline, while the association data suggests mix shift toward higher-margin categories explains much of the top-quartile gap. Both may apply; the invoice data can separate them.",
        },
        { role: "user", content: "Make that a short brief with the numbers we should test against Brightwater's invoice data." },
        {
          role: "assistant",
          content:
            "Done. The brief keeps the labels and lists four tests: share of lines below floor, discount spread by customer size, margin by category versus benchmark, and rebate earned versus claimed for the top 40 suppliers.",
        },
      ],
      summary:
        "AI research chat on pricing and rebate benchmarks for industrial distributors, labelled FACT or INFERENCE: 1 to 3 points of margin from pricing programs and unclaimed rebates where tracking is weak. Notes sources disagree on discount discipline versus mix. Produced the pricing benchmark brief.",
      entities: "industrial distribution, price realization, discount leakage, rebates, gross margin",
    },
    {
      key: "pricing-brief",
      title: "Brief: pricing and rebate benchmarks",
      type: "document",
      vendor: "google_docs",
      author: "park",
      section: "Pricing levers",
      date: "2024-02-13",
      madeFrom: "pricing-chat",
      informs: ["lever-sheet"],
      body: `# Pricing and rebate benchmarks: brief for the lever sizing

**Margin range (FACT, association benchmarking 2023):** plumbing and HVAC distributors sit in the mid to high 20s percent gross margin. Brightwater 2023: 24.8 percent.

**Pricing programs (FACT, operating partner case write-ups 2022 and 2023):** 1 to 3 points of gross margin, mostly discount discipline.

**Rebates (FACT, practitioner guide 2023):** weak tracking leaves earned rebates unclaimed.

**Where Brightwater sits (INFERENCE):** below the benchmark range with an outdated floor, so we size pricing toward the upper half of the band but use 1.6 points in the base case to stay credible with the IC.

**Where sources disagree:** discount discipline versus category mix. We will separate them in the invoice analysis.

**Tests against invoice data**
1. Share of lines below floor price (result: 23 percent).
2. Discount spread for contractors of similar size.
3. Margin by category versus benchmark.
4. Rebate earned versus claimed, top 40 suppliers.`,
      summary:
        "Pricing brief made from the research chat: Brightwater's 24.8 percent gross margin sits below the benchmark range, pricing programs deliver 1 to 3 points, and the base case uses 1.6 points. Lists four invoice tests, including 23 percent of lines below floor.",
      entities: "gross margin benchmark, pricing program, rebates, invoice analysis, price floor",
    },
    {
      key: "lever-sheet",
      title: "Lever sizing model: EBITDA bridge to 2026",
      type: "sheet",
      vendor: "upload",
      author: "hart",
      section: "Weeks 4 to 6: size",
      date: "2024-03-01",
      informs: ["midpoint", "final"],
      body: `# Lever sizing (v3, 1 March 2024), summary tab

| Lever | Basis | Run-rate EBITDA (base) | Range | Owner | Timing |
|---|---|---|---|---|---|
| Discount discipline (refreshed floors, regional approval) | 1.6 pts gross margin on $212M | $3.4M | $2.5M to $4.6M | VP Sales and regional managers | Months 1 to 9 |
| Supplier consolidation, 6 categories | 112 to 74 active suppliers, rebate tiers | $1.3M | $0.9M to $1.7M | VP Purchasing | Months 3 to 18 |
| Rebate claims recovery | Earned not claimed, top 40 suppliers | $0.6M | $0.4M to $0.8M | CFO | Months 1 to 6 |
| Freight and branch transfers | Route consolidation | $0.9M | $0.5M to $1.2M | VP Operations | Months 6 to 24 |
| **Total** | | **$6.2M** | **$4.3M to $8.3M** | | |

2023 EBITDA $15.1M (7.1 percent). With base case levers: $21.3M run rate, 10.0 percent at flat revenue. One-off cost to achieve: $1.1M.`,
      summary:
        "Lever sizing model v3: $6.2M of base case run-rate EBITDA (range $4.3M to $8.3M) from discount discipline ($3.4M), supplier consolidation ($1.3M), rebate recovery ($0.6M) and freight ($0.9M). Takes EBITDA from $15.1M to $21.3M run rate with $1.1M one-off cost.",
      entities: "EBITDA bridge, discount discipline, supplier consolidation, rebate recovery, freight",
    },
    {
      key: "midpoint",
      title: "Midpoint review: baseline and lever sizing",
      type: "deck",
      vendor: "google_slides",
      author: "haddad",
      section: "Weeks 4 to 6: size",
      date: "2024-03-04",
      shown: [{ on: "2024-03-05", occasion: "Midpoint review" }],
      body: `## Slide 1
Brightwater value creation plan: midpoint review. 5 March 2024.

## Slide 2
Brightwater can add about $6M of run-rate EBITDA in 24 months, and more than half comes from pricing discipline, not list increases.
Source: lever sizing model v3.

## Slide 3
23 percent of invoice lines sell below the system floor because the floor is out of date, not because managers ignore it.
Source: invoice analysis, Ohio regional manager interview.

## Slide 4
Gross margin of 24.8 percent sits below the plumbing and HVAC benchmark range.
Source: pricing benchmark brief.

## Slide 5
Purchasing runs through 112 suppliers; consolidating six categories to 74 suppliers unlocks rebate tiers worth $1.3M.
Source: lever sizing model v3.

## Slide 6
Branches must author the pricing rules: regional approval below floor, and bonuses moved to gross margin dollars from January 2025.
Source: CEO and regional manager interviews.

## Slide 7
Decisions needed: approve the six procurement categories and the bonus change timing.`,
      summary:
        "Midpoint review deck shown on 5 March 2024. Headlines: about $6M of run-rate EBITDA with pricing discipline the largest lever, 23 percent of lines below an outdated floor, margin below benchmark, supplier consolidation worth $1.3M, and branch-authored pricing rules with a margin bonus from January 2025.",
      decisions: "Approved six procurement categories for consolidation\nBonus moves to gross margin dollars from January 2025, announced in Q2",
      entities: "midpoint review, pricing discipline, price floor, supplier consolidation, margin bonus",
    },
    {
      key: "vcp-draft",
      title: "Value creation plan v1, internal draft",
      type: "deck",
      vendor: "google_slides",
      author: "park",
      section: "100-day plan",
      date: "2024-03-15",
      body: `## Slide 1
Brightwater value creation plan v1. Internal draft for partner review.

## Slide 2
EBITDA from $15.1M to $21.3M run rate by end of 2025.

## Slide 3
Workstream charters: pricing, procurement, rebates, freight. Each with owner, KPIs and first 100 days.

## Slide 4
Governance: monthly value creation committee chaired by the CEO, Wexcombe observer.

## Slide 5
100-day plan in a 40-row Gantt chart.

## Slide 6
Risks: contractor attrition if floors move too fast; supplier pushback in two categories.`,
      summary:
        "Internal first draft of the value creation plan, not shown to the client. Lays out the $15.1M to $21.3M EBITDA path, four workstream charters, a monthly value creation committee, a 40-row 100-day Gantt and key risks. Reworked after partner review.",
      entities: "value creation plan, workstream charters, 100-day plan, governance, risks",
    },
    {
      key: "partner-notes",
      title: "Partner review notes on VCP v1",
      type: "document",
      vendor: "upload",
      author: "okafor",
      section: "100-day plan",
      date: "2024-03-18",
      body: `# Partner review: value creation plan v1

- The IC will not read a 40-row Gantt. Give them 10 milestones they can check in each board pack, and put the Gantt in the appendix.
- Slide 2 needs the range, not just $21.3M. Show base $6.2M and the downside $4.3M on the same page.
- Name a person against every lever. A department is not an owner.
- Add a contractor retention KPI. If we lose plumbers the margin gain is worthless, and the CEO said so in week 1.
- Put the bonus change on its own slide. It is the decision the regional managers will remember.
- Titles must say what happens, in a full sentence. "Workstream charters" is a label, not a finding.`,
      summary:
        "Partner review of VCP v1: replace the 40-row Gantt with 10 board milestones, show base and downside together, name a person per lever, add a contractor retention KPI, give the bonus change its own slide, and use full-sentence titles.",
      decisions: "Ten board-trackable milestones instead of a Gantt\nContractor retention added as a KPI\nNamed person owns each lever",
      entities: "partner review, milestones, downside case, contractor retention, slide titles",
    },
    {
      key: "final",
      title: "Value creation plan and 100-day plan: final readout",
      type: "deck",
      vendor: "google_slides",
      author: "haddad",
      section: "Weeks 7 to 8: plan",
      date: "2024-03-26",
      shown: [
        { on: "2024-03-28", occasion: "Final readout" },
        { on: "2024-04-09", occasion: "Investment committee" },
      ],
      body: `## Slide 1
Brightwater Supply: value creation plan and 100-day plan. Final readout, 28 March 2024.

## Slide 2
Brightwater can reach $21.3M run-rate EBITDA by end of 2025, with a downside of $19.4M.
Source: lever sizing model v3.

## Slide 3
Discount discipline is the biggest lever at $3.4M, and regional managers own it.
Source: lever sizing model v3, regional manager interview.

## Slide 4
Procurement and rebate recovery add $1.9M, owned by the VP Purchasing and the CFO.
Source: lever sizing model v3.

## Slide 5
Regional manager bonuses move to gross margin dollars from January 2025, announced in May so nobody is surprised mid-year.

## Slide 6
Ten milestones in the first 100 days, each visible in the monthly board pack, starting with refreshed price floors live in all 34 branches by day 45.

## Slide 7
Contractor retention is a guardrail KPI: if active contractor accounts fall more than 3 percent, pricing changes pause for review.`,
      summary:
        "Final value creation plan shown at the readout and the Wexcombe IC. $21.3M run-rate EBITDA by end of 2025 (downside $19.4M), discount discipline worth $3.4M owned by regional managers, procurement and rebates $1.9M, a margin bonus from January 2025, ten 100-day milestones and a contractor retention guardrail.",
      decisions: "Wexcombe IC adopted the plan and its ten milestones for monthly board tracking\nPrice floors live in all branches by day 45",
      entities: "value creation plan, 100-day plan, EBITDA, regional managers, contractor retention, Wexcombe IC",
    },
  ],
  stickies: [
    { section: "Weeks 7 to 8: plan", text: "Partner: base and downside on the same slide, every time. Owners are people, not departments.", fill: "yellow" },
    { section: "Pricing levers", text: "Floors are out of date, not ignored. Fix the floor before we talk about discipline.", fill: "green" },
  ],
  outcome: {
    ranToPlan: true,
    extended: false,
    lesson: "Letting regional managers set the refreshed floors made the pricing lever theirs; the rebate data took two weeks longer than planned, so ask for supplier contracts in the SOW, not after kickoff.",
  },
};
