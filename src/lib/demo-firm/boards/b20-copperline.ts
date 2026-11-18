import type { DemoBoard } from "../types";

/** Active growth strategy board, not shared with the firm (privacy fixture). Holds the red pen demo deck. */
export const b20: DemoBoard = {
  key: "b20",
  practice: "Growth and marketing",
  client: { name: "Copperline Utilities", type: "investor-owned electric utility, about 1.1 million customers" },
  title: "Fleet electrification offering",
  pattern: "Growth strategy",
  shape: "phased",
  start: "2026-10-05",
  weeks: 10,
  fee: "$230k",
  status: "active",
  sharedWithFirm: false,
  situation: "growth_move",
  brief:
    "Commercial customers keep asking Copperline for help electrifying their fleets, and third-party charging providers are signing them first. Shape and price a fleet electrification offering the utility can sell through its key accounts team: what it includes, who owns the chargers, how it is priced, and a pilot plan with three customers for Q2 2027.",
  team: ["kowalski", "lindqvist", "eriksen", "lund"],
  sections: ["Discover", "Design", "Pilot and launch"],
  workstreams: ["Customer interviews", "Offer design", "Pricing", "Pilot plan"],
  items: [
    {
      key: "sow",
      title: "SOW: Copperline fleet electrification offering",
      type: "document",
      vendor: "google_docs",
      author: "lindqvist",
      section: "Discover",
      date: "2026-09-28",
      body: `# Statement of work: fleet electrification offering

**Client:** Copperline Utilities  **Sponsor:** VP, Customer Solutions  **Duration:** 10 weeks from 5 October 2026  **Fee:** $230,000 fixed, plus expenses capped at 6%

## Objective
Define a fleet electrification offering for Copperline's commercial customers, with pricing, an ownership model for charging assets and a pilot plan the executive team can approve in December 2026.

## Scope
1. Demand assessment: inquiry history, commercial account base, competitor activity in the territory.
2. Customer research: 9 interviews with fleet operators across distribution, public sector and trades, plus internal interviews with key accounts and grid planning.
3. Offer design: tiers, what Copperline owns and operates, partner roles.
4. Pricing and economics: customer total cost of ownership, Copperline margin, regulatory constraints flagged for counsel.
5. Pilot plan: three customers, sites, timeline and capital need.

## Out of scope
Rate case filing, charger procurement, vehicle sourcing, legal opinion on regulated versus unregulated treatment.

## Team
Partner (0.5 day a week), manager (full time), consultant (full time), analyst (full time).

## Milestones
- Week 1: kickoff
- Week 5: customer findings and offer options (SteerCo 1)
- Week 8: draft offer and pricing (SteerCo 2)
- Week 10: final offer and pilot plan`,
      summary:
        "Signed 10-week, $230k fixed-fee SOW to design a fleet electrification offering for Copperline Utilities. Scope covers demand assessment, 9 customer interviews, offer design, pricing and a three-customer pilot plan. Rate case filing and legal treatment are out of scope.",
      decisions: "Fixed fee of $230k with expenses capped at 6%\nRegulatory treatment flagged for counsel, not opined on",
      entities: "Copperline Utilities, VP Customer Solutions, fleet electrification, key accounts, SteerCo",
    },
    {
      key: "problem",
      title: "Problem definition worksheet",
      type: "document",
      vendor: "google_docs",
      author: "kowalski",
      section: "Discover",
      date: "2026-10-06",
      body: `# Problem definition

**Basic question:** What fleet electrification offering should Copperline sell to commercial customers, at what price and with what ownership model, so that it can sign three pilot customers for Q2 2027 and earn a margin the executive team accepts?

**Situation:** Copperline serves about 41,000 commercial accounts. The key accounts team estimates about 3,800 of them run fleets of 10 or more vehicles. Key accounts logged 212 fleet electrification inquiries in the 12 months to September 2026, up from 64 the year before.

**Complication:** Copperline has no product to sell. Inquiries are answered with a make-ready program brochure and a referral list of contractors. Third-party charging-as-a-service providers are now signing Copperline accounts directly, and the utility only learns about it when a load request arrives.

**Success looks like:** an offer the key accounts team can explain in one meeting, pricing that beats a customer's diesel running cost, and a pilot the CFO will fund.

**Stakeholders:** decides: VP Customer Solutions and CFO. Helps: Director of key accounts, grid planning lead. Can block: regulatory affairs, if the offer looks like it belongs in the rate base.

**Emerging hypotheses**
1. Upfront capital, not vehicle choice, is what stops fleets electrifying.
2. Customers will pay a monthly per-vehicle fee if Copperline owns and maintains the chargers.
3. Copperline's edge over third parties is speed to power, not price.`,
      summary:
        "Problem definition in the firm template. About 3,800 of 41,000 commercial accounts run fleets of 10 or more; inquiries rose to 212 in the 12 months to September 2026 from 64. Copperline has no product and third parties are signing its accounts. Three hypotheses on capital, per-vehicle fees and speed to power.",
      entities: "Copperline, commercial accounts, key accounts, CFO, regulatory affairs, charging-as-a-service",
    },
    {
      key: "kickoff",
      title: "Kickoff deck",
      type: "deck",
      vendor: "google_slides",
      author: "kowalski",
      section: "Discover",
      date: "2026-10-07",
      shown: [{ on: "2026-10-08", occasion: "Kickoff" }],
      body: `## Slide 1
Copperline fleet electrification offering: kickoff, 8 October 2026.

## Slide 2
The question we will answer by mid-December: what should Copperline sell to fleets, at what price, and who should own the chargers?

## Slide 3
How we will work: weekly working session with Customer Solutions on Tuesdays, SteerCo in weeks 5 and 8, final readout in week 10.

## Slide 4
Who we want to hear from: 9 fleet customers across distribution, schools, municipal, trades and health, plus key accounts and grid planning.

## Slide 5
What we need from Copperline in week 1: inquiry log, commercial account list with fleet flags, make-ready program spend, and load request history for depots.

## Slide 6
Three starting hypotheses: capital is the barrier, customers will pay per vehicle, speed to power is the edge.`,
      summary:
        "Kickoff deck shown on 8 October 2026. Sets the question, the working rhythm, the 9-customer interview plan, the week 1 data request and three starting hypotheses.",
      entities: "kickoff, SteerCo, interview plan, data request, hypotheses",
    },
    {
      key: "data-request",
      title: "Email: week 1 data request",
      type: "email",
      vendor: "upload",
      author: "lund",
      section: "Discover",
      date: "2026-10-07",
      body: `**To:** Director of key accounts, Copperline Utilities
**Cc:** Piotr Kowalski
**Subject:** Fleet offering: data request for week 1

Thanks for the time at kickoff. To get the demand picture right before customer interviews start, could your team share the following by Wednesday 14 October?

1. The fleet electrification inquiry log for the last 24 months, with account name, fleet size if known and outcome.
2. The commercial account list with any fleet flag or vehicle count.
3. Make-ready program budget and spend to date, by site if possible.
4. Load requests for depot charging in the last 24 months, with request date and energization date.
5. Any accounts you know have signed with a third-party charging provider.

Spreadsheets are fine as they are; we will clean them. If items 4 or 5 sit with grid planning, a name is enough and we will follow up.

Best,
Felix Lund
Analyst, Kestrel Bay Advisory`,
      summary:
        "Week 1 data request to Copperline's key accounts director: inquiry log, commercial accounts with fleet flags, make-ready spend, depot load requests and accounts lost to third-party providers. Due 14 October.",
      entities: "data request, inquiry log, make-ready program, load requests, grid planning",
    },
    {
      key: "research-chat",
      title: "Research: utility fleet programs and charging-as-a-service",
      type: "ai_thread",
      method: ["desk_research"],
      vendor: "claude",
      author: "eriksen",
      section: "Offer design",
      date: "2026-10-09",
      turns: [
        {
          role: "user",
          content:
            "I'm working with a US electric utility designing a fleet electrification offering for commercial customers. Summarize what utility fleet programs typically include, how third-party charging-as-a-service providers price, and where utilities have an advantage. Label each point FACT with a dated generic source or INFERENCE.",
        },
        {
          role: "assistant",
          content:
            "Here is a summary.\n\nFACT (utility program filings, 2024 to 2025): most utility fleet programs combine three elements: make-ready funding for the utility-side and customer-side wiring, a fleet advisory or assessment service, and a time-of-use or managed charging rate.\n\nFACT (provider marketing materials, 2025): charging-as-a-service providers usually charge a monthly fee per vehicle or per port over a five to ten year term, bundling chargers, installation, software and maintenance.\n\nFACT (industry reports, 2025): the longest lead time in depot electrification is commonly the grid connection, not vehicle delivery.\n\nINFERENCE: a utility can compete on speed to power, because it controls the interconnection queue and knows where capacity exists.\n\nINFERENCE: utilities may face regulatory limits on owning customer-side assets, so an unregulated affiliate or partner model may be needed.\n\nWhere sources disagree: published fee levels for charging-as-a-service vary widely depending on whether energy is included, so a single benchmark price is not reliable.",
        },
        {
          role: "user",
          content: "Good. Give me three offer structures we could test in interviews, then turn the whole thing into a brief for Piotr.",
        },
        {
          role: "assistant",
          content:
            "Three structures to test: (1) advisory only, a paid fleet assessment and site design; (2) chargers as a service, where the utility or an affiliate owns and maintains chargers for a monthly fee; (3) chargers plus energy at a fixed per-vehicle price with an uptime guarantee. The brief keeps the FACT and INFERENCE labels and ends with interview questions for each structure.",
        },
      ],
      summary:
        "AI research chat on what utility fleet programs include, how charging-as-a-service providers price and where utilities have an edge, labelled FACT or INFERENCE. Notes published fee levels vary by whether energy is included. Produced the offer structures brief.",
      entities: "utility fleet programs, charging-as-a-service, make-ready, managed charging, speed to power",
    },
    {
      key: "research-brief",
      title: "Brief: offer structures to test",
      type: "document",
      method: ["desk_research"],
      vendor: "claude",
      author: "eriksen",
      section: "Offer design",
      date: "2026-10-09",
      madeFrom: "research-chat",
      body: `# Offer structures to test: brief

**What utility programs include (FACT, utility program filings 2024 to 2025):** make-ready funding, a fleet advisory service and a time-of-use or managed charging rate.

**How third parties price (FACT, provider materials 2025):** a monthly fee per vehicle or per port over five to ten years, bundling chargers, install, software and maintenance.

**Where the delay is (FACT, industry reports 2025):** the grid connection is usually the longest lead time.

**Our likely edge (INFERENCE):** speed to power, because Copperline controls interconnection and knows where capacity exists.

**Watch out (INFERENCE):** owning customer-side chargers may need an unregulated affiliate or partner.

**Where sources disagree:** fee benchmarks vary with whether energy is included; do not quote a single market price.

## Three structures for interviews
1. **Plan:** paid fleet assessment and site design.
2. **Charge:** chargers owned and maintained for a monthly fee per vehicle.
3. **Charge Plus:** chargers plus energy at a fixed monthly price with an uptime guarantee.

## Questions for each interview
- What stops you electrifying today: capital, power, vehicles or know-how?
- Would you rather own chargers or pay monthly?
- What term length would you sign, and what would make you walk away?`,
      summary:
        "Brief made from the research chat setting out three offer structures to test: Plan, Charge and Charge Plus. Keeps FACT and INFERENCE labels, flags the affiliate question and warns against quoting a single market fee.",
      entities: "Plan, Charge, Charge Plus, make-ready, affiliate model, interview questions",
    },
    {
      key: "int-key-accounts",
      title: "Interview: Director of key accounts (Copperline)",
      type: "call",
      method: ["stakeholder_interviews"],
      role: "sales_leader",
      vendor: "granola",
      author: "kowalski",
      section: "Customer interviews",
      date: "2026-10-13",
      informs: ["offer-deck"],
      body: `# Interview: Director of key accounts, Copperline Utilities
Attendees: Piotr Kowalski (Kestrel Bay), Felix Lund (Kestrel Bay), Director of key accounts

**Piotr:** How has fleet demand changed?
**Director:** It has exploded. We logged 212 fleet electrification inquiries in the 12 months to September. The year before it was 64. My account managers are answering the same questions every week with nothing to sell.
**Felix:** What happens to those inquiries?
**Director:** We send the make-ready brochure and a contractor list. Most go quiet. The ones that move often move with someone else.
**Piotr:** Who is that someone else?
**Director:** Two third-party charging-as-a-service providers. Between them they have signed at least four of our accounts since January. We find out when the load request lands on grid planning's desk.
**Felix:** How long does it take to energize a depot today?
**Director:** Average time to energize a depot is 14 months from first request. Some of that is the customer, a lot of it is us: transformer lead times and engineering queue.
**Piotr:** What about the make-ready program?
**Director:** It is an $18M program over three years and we have spent about 22 percent of it. The money is there, the customers are not using it because nobody holds their hand.
**Felix:** If Copperline sold an offer, what would your team need?
**Director:** One page, three options, a price. And a promise on power dates we can actually keep.`,
      summary:
        "Key accounts director: 212 fleet inquiries in the 12 months to September 2026, up from 64; two third-party providers signed at least four accounts since January; average 14 months to energize a depot; make-ready program is $18M over three years, about 22 percent spent. Team needs one page, three options and a price.",
      decisions: "Speed-to-power promise must be something grid planning can keep",
      entities: "key accounts, inquiries, charging-as-a-service providers, depot energization, make-ready program, grid planning",
    },
    {
      key: "int-distributor",
      title: "Interview: Fleet director, regional food distributor",
      type: "call",
      method: ["customer_research"],
      role: "operations_leader",
      vendor: "granola",
      author: "kowalski",
      section: "Customer interviews",
      date: "2026-10-20",
      informs: ["offer-deck"],
      body: `# Interview: Fleet director, regional food distributor (140 vehicles)
Attendees: Piotr Kowalski, Nora Eriksen (Kestrel Bay), Fleet director

**Piotr:** Where are you on electrification?
**Fleet director:** We want to start with 20 delivery vans at our main depot. Corporate set a target, and the vans run fixed routes under 120 miles, so the duty cycle is easy.
**Nora:** What has stopped you so far?
**Fleet director:** The depot. A contractor quoted us $1.6M to upgrade the site for charging, and we were told 11 months to get the power. That money competes with a new cold store. It is the capital, not the vans.
**Piotr:** If someone owned the chargers and charged you monthly, how would you judge it?
**Fleet director:** Against diesel. If the monthly fee plus electricity is under what I pay for diesel per van, I can sell it internally. We pay roughly 38 cents a mile for diesel today.
**Nora:** Would it matter if that someone was the utility?
**Fleet director:** It would help. I want one party accountable for chargers working at 5 a.m. Right now I would be managing a contractor, a charger vendor, a software company and you.
**Piotr:** What term would you sign?
**Fleet director:** Five years feels right. Seven is long; our van leases are five.`,
      summary:
        "Food distributor fleet director: wants to start with 20 vans; depot upgrade quoted at $1.6M and 11 months to power; capital is the barrier, not vehicles. Judges any monthly fee against diesel at about 38 cents a mile, wants one accountable party, and prefers a five-year term over seven.",
      entities: "food distributor, delivery vans, depot upgrade, diesel cost per mile, one accountable party, contract term",
    },
    {
      key: "int-school",
      title: "Interview: Transportation director, school district",
      type: "call",
      method: ["customer_research"],
      role: "operations_leader",
      vendor: "granola",
      author: "eriksen",
      section: "Customer interviews",
      date: "2026-10-22",
      informs: ["offer-deck"],
      body: `# Interview: Transportation director, suburban school district (68 buses)
Attendees: Nora Eriksen, Felix Lund (Kestrel Bay), Transportation director

**Nora:** Tell us about your electric bus plans.
**Director:** We run 68 buses. We have grant funding for the first electric buses and they arrive next summer. Chargers have to be working before August 2027 or the buses sit in the lot.
**Felix:** Who would you want to own the chargers?
**Director:** Honestly, Copperline. We do not have electricians on staff and my board does not want a new maintenance liability. If you own them and maintain them, that is one less thing.
**Nora:** How do the buses run during the day?
**Director:** Morning routes finish by about 9:30 and afternoon routes start at 2:00. They sit in the yard in between, and overnight of course.
**Felix:** Would a monthly fee work with your budget process?
**Director:** If it is an operating line, yes. Capital needs a bond or board vote. A predictable monthly cost per bus that lines up with the bus life is easier.
**Nora:** What would worry you?
**Director:** Missing August. And any surprise on the electricity bill.`,
      summary:
        "School district transportation director: 68 buses, grant-funded electric buses arriving next summer, chargers must work before August 2027. Prefers Copperline to own and maintain chargers, buses idle between 9:30 and 2:00, and a monthly operating fee fits the budget better than capital.",
      entities: "school district, electric buses, August 2027, utility ownership, midday charging, operating budget",
    },
    {
      key: "interview-tracker",
      title: "Interview tracker and coding",
      type: "sheet",
      method: ["customer_research"],
      vendor: "upload",
      author: "lund",
      section: "Customer interviews",
      date: "2026-11-06",
      body: `# Customer interview tracker (updated 6 Nov)

9 interviews planned, 6 completed.

| # | Organization | Fleet | Date | Interviewer | Capital is main barrier | Wants one accountable party | Would sign 7-year term |
|---|---|---|---|---|---|---|---|
| 1 | Regional food distributor | 140 vehicles | 20 Oct | Kowalski | Yes | Yes | No, prefers 5 |
| 2 | Suburban school district | 68 buses | 22 Oct | Eriksen | Yes | Yes | Yes |
| 3 | Plumbing and HVAC contractor | 45 vans | 27 Oct | Eriksen | Yes | Yes | No |
| 4 | Municipal public works | 210 vehicles | 29 Oct | Kowalski | No, bond funded | No, wants to own | No |
| 5 | Parcel delivery contractor | 60 vans | 3 Nov | Lund | Yes | Yes | Maybe |
| 6 | Hospital system facilities | 32 vehicles | 5 Nov | Eriksen | Yes | No | No |
| 7 | Waste hauler | 85 trucks | 17 Nov | Kowalski | | | |
| 8 | Rental car branch network | 300 vehicles | 19 Nov | Eriksen | | | |
| 9 | Regional transit agency | 120 buses | 23 Nov | Kowalski | | | |

**Coding so far (6 interviews)**
- Capital is the main barrier: 5 of 6.
- Wants one accountable party for chargers: 4 of 6.
- Would sign a 7-year term: 1 of 6 yes, 1 maybe, 4 no. Five years is the common answer.`,
      summary:
        "Interview tracker: 9 planned, 6 completed. Capital is the main barrier for 5 of 6, 4 of 6 want one accountable party, and only 1 of 6 would sign a seven-year term; five years is the common answer.",
      entities: "interview tracker, capital barrier, accountable party, contract term, fleet customers",
    },
    {
      key: "tco-model",
      title: "Model: customer TCO, offer pricing and sizing",
      type: "sheet",
      method: ["market_sizing", "financial_model"],
      vendor: "upload",
      author: "lund",
      section: "Pricing",
      date: "2026-11-10",
      body: `# Model v3 (10 Nov): customer economics, offer pricing, sizing

## Customer TCO per delivery van (18,000 miles a year)
| Line | Diesel van | Electric van |
|---|---|---|
| Fuel or energy per mile | $0.38 | $0.13 (managed charging, 11pm to 6am) |
| Maintenance per mile | $0.17 | $0.09 |
| Annual running cost | $9,900 | $3,960 |
| Annual saving vs diesel | | $5,940 |
| Vehicle premium after federal credit | | $20,500 |
| Simple payback on vehicle | | 3.5 years |

## Offer pricing (draft)
| Tier | Includes | Price | Copperline gross margin |
|---|---|---|---|
| Plan | fleet assessment and site design | $18,000 one-off | 35% |
| Charge | chargers owned and maintained, managed charging software | $165 per vehicle per month | 22% |
| Charge Plus | Charge plus energy at a fixed price, 97% uptime guarantee | $295 per vehicle per month | 18% |

Customer view of Charge Plus: diesel fuel $6,840 a year vs fee $3,540 a year, plus $1,440 maintenance saving: $4,740 a year better off per van, net of the fee.

## Sizing
| Line | Value |
|---|---|
| Accounts with fleets of 10+ | 3,800 |
| Average vehicles per fleet account | 26 |
| Share won by 2029 (base case) | 5% |
| Customers by 2029 | 190 |
| Vehicles by 2029 | about 4,900 |
| Blended fee per vehicle per month | $230 |
| Annual recurring revenue by 2029 | $13.5M |

## Pilot
3 customers, 120 charging ports, live Q2 2027, capital need $2.4M.`,
      summary:
        "Model v3: an electric van saves $5,940 a year against diesel at 18,000 miles, with a 3.5-year vehicle payback. Draft prices: Plan $18,000, Charge $165 and Charge Plus $295 per vehicle per month at 22 and 18 percent margin. Base case of 190 customers and about 4,900 vehicles gives $13.5M recurring revenue by 2029; pilot is 3 customers, 120 ports, $2.4M.",
      entities: "TCO, diesel, managed charging, Plan, Charge, Charge Plus, gross margin, sizing, pilot",
    },
    {
      key: "offer-deck",
      title: "Draft offer deck for SteerCo 2",
      type: "deck",
      method: ["synthesis"],
      vendor: "google_slides",
      author: "kowalski",
      section: "Design",
      date: "2026-11-16",
      body: `## Slide 1
Copperline fleet electrification offer: draft for SteerCo 2. Working draft, 16 November 2026.

## Slide 2
Copperline should launch a three-tier fleet offer, Plan, Charge and Charge Plus, starting with a 3-customer pilot in Q2 2027.
- Demand is real and growing, and third parties are already signing Copperline accounts.
- Capital and grid connection, not vehicles, are what stall fleets.
- Fleet operators that electrify cut total fleet operating costs by 40 percent within two years.
Source: problem definition, interview tracker, model v3.

## Slide 3
Fleet demand has more than tripled in a year: key accounts logged 212 fleet electrification inquiries in the 12 months to September 2026, up from 64 the year before.
- About 3,800 of Copperline's 41,000 commercial accounts run fleets of 10 or more vehicles.
- Two third-party charging-as-a-service providers have signed at least four Copperline accounts since January.
Source: problem definition, key accounts interview.

## Slide 4
Grid connection and capital stall fleets: the average time to energize a depot is 14 months.
- One distributor was quoted $1.6M to upgrade its depot and told 11 months to get power.
- Capital is the main barrier for 5 of 6 customers interviewed.
Source: key accounts interview, food distributor interview, interview tracker.

## Slide 5
An electric van saves $5,940 a year in running costs against diesel at 18,000 miles.
- Energy costs $0.13 a mile on managed charging, against $0.38 a mile for diesel.
- Maintenance falls from $0.17 to $0.09 a mile.
- The vehicle premium of $20,500 after the federal credit pays back in 3.5 years.
Source: model v3, customer TCO tab.

## Slide 6
Customers want one accountable party, and most do not want to own chargers.
- 4 of 6 customers interviewed want one party accountable for chargers.
- Nine in ten fleet customers we interviewed said they would sign a seven-year term.
- 6 of 9 planned interviews are complete; the remaining 3 run by 23 November.
Source: interview tracker.

## Slide 7
Schools show the case for Copperline ownership: the district needs chargers working before August 2027 for its 68 buses.
- The transportation director would prefer Copperline to own and maintain the chargers.
- Buses sit idle between 9:30 and 2:00, so midday managed charging is possible.
Source: school district interview.

## Slide 8
Three tiers let customers start small and step up.
- Plan: fleet assessment and site design for $18,000 one-off.
- Charge: chargers owned and maintained by Copperline at $165 per vehicle per month.
- At $275 per vehicle per month, Charge Plus undercuts the leading third-party provider by 20 percent.
- Gross margin is 22 percent on Charge and 18 percent on Charge Plus.
Source: model v3, offer pricing tab; offer structures brief.

## Slide 9
On Charge Plus a typical van is $4,740 a year better off than on diesel, net of the fee.
Source: model v3.

## Slide 10
A 5 percent share of fleet accounts by 2029 means 190 customers and about 4,900 vehicles.
- The average fleet account runs 26 vehicles.
- At a blended $230 per vehicle per month, that is $13.5M in annual recurring revenue by 2029.
Source: model v3, sizing tab.

## Slide 11
The pilot needs 3 customers, 120 charging ports and $2.4M of capital, live in Q2 2027.
- The $12M make-ready budget covers the utility-side work at every pilot site.
- Copperline's make-ready program has already funded 1,200 charging ports across the territory.
Source: model v3, pilot tab.

## Slide 12
Decisions for SteerCo 2: approve the three tiers for pilot, approve $2.4M pilot capital, and ask regulatory affairs whether Charge and Charge Plus need an unregulated affiliate.`,
      summary:
        "Working draft of the offer deck for SteerCo 2, not yet shown. Recommends Plan, Charge and Charge Plus tiers with a 3-customer pilot in Q2 2027, built on the key accounts and customer interviews, the interview tracker and model v3. Needs a partner red pen before it goes to the client.",
      entities: "SteerCo 2, Plan, Charge, Charge Plus, pilot, make-ready, sizing, TCO",
      unsupported: [
        "Fleet operators that electrify cut total fleet operating costs by 40 percent within two years.",
        "Nine in ten fleet customers we interviewed said they would sign a seven-year term.",
        "At $275 per vehicle per month, Charge Plus undercuts the leading third-party provider by 20 percent.",
        "The $12M make-ready budget covers the utility-side work at every pilot site.",
        "Copperline's make-ready program has already funded 1,200 charging ports across the territory.",
      ],
    },
    {
      key: "private-notes",
      title: "My notes: sponsor and regulatory politics",
      type: "document",
      vendor: "upload",
      author: "kowalski",
      section: "Discover",
      date: "2026-10-30",
      visibility: "private",
      body: `Personal working notes, not for the board.

- The VP Customer Solutions wants this launched before the next rate case so it shows up as a growth story. That is driving the Q2 2027 pilot date more than customer readiness.
- Regulatory affairs has not been in a single working session. If they say Charge Plus belongs in an affiliate, the whole pricing tab moves. Ask Signe to raise it with the CFO directly.
- Grid planning lead is quietly skeptical that any power-date promise can be kept. Do not put a specific energization guarantee in the deck until we have spoken to her one to one.
- Key accounts director is our best ally; he will sell this internally if the one-pager is simple.`,
      summary:
        "Private working notes on sponsor motives, regulatory affairs' absence and grid planning's doubts about power-date promises. Not for the firm.",
    },
    {
      key: "tariff-note",
      title: "Upload: current commercial EV rate schedule (photo)",
      type: "document",
      vendor: "upload",
      author: "eriksen",
      section: "Pricing",
      date: "2026-10-15",
      placed: false,
      body: `Phone photo of the commercial EV time-of-use rate schedule pinned in the key accounts office, transcribed:

- Off-peak window 11pm to 6am.
- Demand charge holiday for new EV accounts for the first 24 months.
- Separate meter required for the charging load.

To check against the published tariff before we use any of it in pricing.`,
      summary:
        "Unfiled photo transcription of the commercial EV time-of-use rate schedule, with the off-peak window and demand charge holiday. Not yet checked against the published tariff.",
      entities: "EV rate, time-of-use, demand charge, off-peak",
    },
  ],
  stickies: [
    { section: "Design", text: "Signe: one number per bullet, and every number needs a Source line naming the board item it came from.", fill: "yellow" },
    { section: "Pricing", text: "Price Charge Plus against the customer's diesel cost, not against third-party fees we cannot verify.", fill: "green" },
  ],
};
