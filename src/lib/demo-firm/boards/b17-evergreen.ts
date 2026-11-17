import type { DemoBoard } from "../types";

/** Closed market entry sprint: an internal draft that led with stores, a final readout that went online first. */
export const b17: DemoBoard = {
  key: "b17",
  practice: "Growth and marketing",
  client: { name: "Evergreen Outdoor Co.", type: "US outdoor apparel brand, $310M revenue, 64 stores" },
  title: "Canada market entry",
  pattern: "Market entry",
  shape: "sprint",
  start: "2024-02-05",
  weeks: 10,
  fee: "$220k",
  status: "closed",
  sharedWithFirm: true,
  brief:
    "Evergreen already ships millions of dollars of online orders to Canada from US warehouses, with high duties, slow delivery and heavy returns. Decide whether to enter Canada properly, which provinces first, and how: own stores, wholesale through specialty retailers, or online first with local fulfillment. Deliver a market entry recommendation and business case for the April board.",
  team: ["whitfield", "lindqvist", "eriksen", "lund"],
  sections: ["Intake", "Weeks 1-2", "Weeks 3-5", "Weeks 6-8", "Weeks 9-10"],
  items: [
    {
      key: "sow",
      title: "SOW: Evergreen Canada market entry",
      type: "document",
      vendor: "google_docs",
      author: "lindqvist",
      section: "Intake",
      date: "2024-01-29",
      body: `# Statement of work: Canada market entry

**Client:** Evergreen Outdoor Co.  **Sponsor:** Chief Commercial Officer  **Duration:** 10 weeks from 5 February 2024  **Fee:** $220,000 fixed, plus expenses capped at 7%

## Objective
Recommend whether, where and how Evergreen should enter Canada, with a three-year business case the board can approve in April 2024.

## Scope
1. Market sizing for outdoor apparel and footwear by province.
2. Competitor scan: Canadian specialty chains, US brands already present, direct-to-consumer players.
3. Channel options: own stores, wholesale, online with Canadian fulfillment, and combinations.
4. Customer and trade research: 12 interviews with Canadian retail buyers, logistics providers and Evergreen leaders, plus a survey of existing Canadian online customers.
5. Entry plan and three-year business case.

## Out of scope
Store site selection, legal entity setup, tax structuring, French-language brand creative.

## Team
Partner (0.5 day a week), manager (full time), consultant (full time), analyst (full time).

## Milestones
- Week 1: kickoff
- Week 5: market and channel findings (SteerCo 1)
- Week 10: final readout and board pre-read`,
      summary:
        "Signed 10-week, $220k fixed-fee SOW for Evergreen Outdoor Co. to decide whether, where and how to enter Canada. Covers sizing by province, competitor scan, channel options, 12 interviews plus a customer survey, and a three-year business case for the April 2024 board.",
      decisions: "Fixed fee of $220k with expenses capped at 7%\nSite selection and legal entity setup out of scope",
      entities: "Evergreen Outdoor Co., Chief Commercial Officer, Canada, market entry, SteerCo",
    },
    {
      key: "problem",
      title: "Problem definition worksheet",
      type: "document",
      vendor: "google_docs",
      author: "whitfield",
      section: "Intake",
      date: "2024-02-06",
      body: `# Problem definition

**Basic question:** Should Evergreen enter Canada in 2024 to 2025, and if so in which provinces and through which channel mix, so that Canadian revenue reaches at least $25M by year 3 without diluting US margins?

**Situation:** Evergreen sold $6.8M of online orders to Canadian addresses in FY2023, all shipped from US warehouses. Ontario and British Columbia account for about two thirds of those orders. Several Canadian specialty retailers have asked about carrying the brand.

**Complication:** Cross-border orders arrive in 7 to 10 days with duties collected at the door. Canadian return rates run at 24 percent against 15 percent in the US, and the customer service team spends a disproportionate share of time on Canadian complaints. Two US competitors opened Canadian distribution centers in 2023.

**Success looks like:** a clear go or no-go, a channel sequence the CFO can fund in stages, and a year 2 breakeven.

**Stakeholders:** decides: CEO and CFO. Helps: Chief Commercial Officer, VP e-commerce, VP wholesale. Can block: VP retail, who wants stores first.

**Emerging hypotheses**
1. Local fulfillment alone would lift Canadian online revenue sharply by removing duties at the door and slow delivery.
2. Wholesale with one national specialty chain gives reach faster than stores.
3. Stores should follow proven demand, not lead it.`,
      summary:
        "Problem definition in the firm template. Basic question: whether and how to enter Canada to reach $25M by year 3. FY2023 cross-border sales were $6.8M, two thirds from Ontario and BC, with 24 percent returns against 15 percent in the US. VP retail wants stores first and could block.",
      entities: "Evergreen, Canada, Ontario, British Columbia, cross-border, returns, VP retail, CFO",
    },
    {
      key: "research-chat",
      title: "Research: Canadian outdoor apparel market and entry routes",
      type: "ai_thread",
      vendor: "chatgpt",
      author: "eriksen",
      section: "Weeks 1-2",
      date: "2024-02-09",
      turns: [
        {
          role: "user",
          content:
            "I'm sizing the Canadian outdoor apparel and footwear market for a US brand considering entry. Give me the market size, regional split, main specialty retailers by type, and how US apparel brands typically entered Canada in the last ten years. Label FACT with dated generic sources, or INFERENCE.",
        },
        {
          role: "assistant",
          content:
            "Summary below.\n\nFACT (industry market reports, 2023): Canadian outdoor apparel and footwear retail sales are commonly estimated in the low single-digit billions of Canadian dollars, with Ontario the largest province and British Columbia the highest spend per person.\n\nFACT (retail trade press, 2022 to 2023): the channel is concentrated in a few national specialty chains and a co-operative retailer, plus a long tail of independents.\n\nFACT (company announcements, 2015 to 2023): US apparel brands have used three routes: wholesale first with a national chain, online first with a Canadian fulfillment partner, and flagship stores in Toronto or Vancouver.\n\nINFERENCE: brands that led with stores tended to retrench more often, because lease commitments arrived before demand was proven.\n\nINFERENCE: a Canadian fulfillment partner removes the duty-at-the-door problem and is the cheapest way to test demand.\n\nWhere sources disagree: market size estimates range widely because some reports include general sportswear and others exclude footwear. Use a range, not a point estimate.",
        },
        { role: "user", content: "Write that up as a two-page brief with a sizing range we can put in the model." },
        {
          role: "assistant",
          content:
            "Done. The brief gives a range of C$2.6B to C$3.4B for the core category, with a midpoint of C$3.0B, keeps the FACT and INFERENCE labels, and lists the three entry routes with examples of what went wrong for each.",
        },
      ],
      summary:
        "AI research chat on Canadian outdoor apparel market size, regional split, specialty retail structure and how US brands entered Canada, labelled FACT or INFERENCE. Notes market size estimates disagree depending on category definitions. Produced the market and entry routes brief.",
      entities: "Canada, outdoor apparel, market sizing, specialty retail, fulfillment partner, flagship stores",
    },
    {
      key: "market-brief",
      title: "Brief: Canadian market size and entry routes",
      type: "document",
      vendor: "chatgpt",
      author: "eriksen",
      section: "Weeks 1-2",
      date: "2024-02-09",
      madeFrom: "research-chat",
      body: `# Canadian outdoor apparel: market size and entry routes

## Market size (FACT, industry market reports 2023)
Core outdoor apparel and footwear: C$2.6B to C$3.4B, midpoint C$3.0B. Ontario is the largest province by value; British Columbia has the highest spend per person.

**Where sources disagree:** estimates vary by whether general sportswear and footwear are included. The model uses the midpoint and tests the low end.

## Channel structure (FACT, retail trade press 2022 to 2023)
A few national specialty chains and a large co-operative retailer hold most branded outdoor sales; independents matter in mountain towns.

## Three entry routes US brands have used (FACT, company announcements 2015 to 2023)
1. **Wholesale first** through a national chain. Fast reach, lower margin, brand control risk.
2. **Online first** with a Canadian fulfillment partner. Cheap to test, removes duties at the door.
3. **Flagship stores** in Toronto or Vancouver. Strong brand signal, highest fixed cost.

## What we infer (INFERENCE)
- Store-led entries retrenched more often because leases came before proven demand.
- Online first with local fulfillment is the lowest-risk way to learn where demand sits.

## Questions for interviews
1. What would a national chain need in terms of exclusives and margin?
2. What does a Canadian 3PL charge per order at our volume?
3. What share of current Canadian customers would buy more with free duty and 3-day delivery?`,
      summary:
        "Brief made from the research chat: core Canadian outdoor apparel and footwear market of C$2.6B to C$3.4B, midpoint C$3.0B. Lays out wholesale-first, online-first and flagship routes, infers store-led entries retrench more often, and sets interview questions.",
      entities: "market size, Ontario, British Columbia, wholesale, 3PL, flagship stores",
    },
    {
      key: "int-buyer",
      title: "Interview: Head of apparel buying, national specialty chain",
      type: "call",
      vendor: "granola",
      author: "whitfield",
      section: "Weeks 3-5",
      date: "2024-02-21",
      informs: ["steerco-draft", "final"],
      body: `# Interview: Head of apparel buying, Canadian national outdoor specialty chain
Attendees: Grace Whitfield, Nora Eriksen (Kestrel Bay), Head of apparel buying

**Grace:** How do you decide which new US brands to carry?
**Buyer:** Sell-through data first. If a brand already has Canadian online customers and can show us where they are, that gets a meeting. We have been burned by brands that arrive with a big launch and no replenishment plan.
**Nora:** What would you need from Evergreen?
**Buyer:** Margin in line with our other outerwear brands, which means a wholesale discount in the mid-fifties off retail. A Canadian distribution point so we are not paying duty. And some exclusivity for the first season, maybe two or three styles.
**Grace:** How many doors would you start with?
**Buyer:** A test in 20 of our stores, mostly Ontario and BC. If sell-through is above 60 percent at full price in the first season, we would roll to all 48.
**Nora:** How would you feel if Evergreen opened its own stores in Toronto at the same time?
**Buyer:** Honestly, it would make us cautious. We would not want to be the brand's showroom for its own stores two blocks away.
**Grace:** Timeline?
**Buyer:** We buy for fall about nine months ahead. To be in stores for fall 2025, we would need samples by early summer 2024.`,
      summary:
        "Head of buying at a national specialty chain: would test Evergreen in 20 of 48 stores, mostly Ontario and BC, rolling out if first-season full-price sell-through tops 60 percent. Needs mid-fifties wholesale discount, Canadian distribution and some exclusives. Own stores in Toronto at the same time would make the chain cautious.",
      decisions: "Wholesale test requires a Canadian distribution point",
      entities: "national specialty chain, wholesale, sell-through, exclusivity, Ontario, British Columbia, fall 2025",
    },
    {
      key: "int-ecom",
      title: "Interview: VP e-commerce, Evergreen",
      type: "call",
      vendor: "granola",
      author: "eriksen",
      section: "Weeks 3-5",
      date: "2024-02-23",
      informs: ["final"],
      body: `# Interview: VP e-commerce, Evergreen Outdoor Co.
Attendees: Nora Eriksen, Felix Lund (Kestrel Bay), VP e-commerce

**Nora:** What do you know about the Canadian online customer?
**VP e-commerce:** They buy outerwear and boots, mostly in September to December. Average order is about $40 higher than in the US. But they hate the duty bill at the door. That is our top complaint reason from Canada.
**Felix:** What happens to conversion when shoppers see the shipping and duty estimate?
**VP e-commerce:** Canadian cart abandonment at the shipping step is about 1.8 times the US rate. We have tested a duty-included price for two weeks once and conversion went up noticeably, but margin went with it because we were paying the duty.
**Nora:** If you had a Canadian warehouse, what changes?
**VP e-commerce:** Delivery drops from 7 to 10 days to 2 to 3. No duty at the door. Returns become a local shipment instead of a cross-border nightmare. I think returns would come down a lot because people would stop returning things that took too long to arrive.
**Felix:** Would you want stores?
**VP e-commerce:** Eventually. But I would rather know which cities to put them in from our own data.`,
      summary:
        "Evergreen VP e-commerce: Canadian customers buy outerwear and boots with orders about $40 above US average, but duty at the door is the top complaint and cart abandonment at shipping is 1.8 times the US rate. A Canadian warehouse would cut delivery from 7 to 10 days to 2 to 3 and should reduce returns. Prefers data to pick store cities later.",
      entities: "VP e-commerce, cart abandonment, duty, Canadian warehouse, returns, delivery times",
    },
    {
      key: "business-case",
      title: "Model: Canada sizing and three-year business case",
      type: "sheet",
      vendor: "upload",
      author: "lund",
      section: "Weeks 6-8",
      date: "2024-03-15",
      body: `# Canada business case v4 (15 Mar), recommended sequence: online first, wholesale year 2, store test year 3

## Sizing
| Line | Value |
|---|---|
| Core market (midpoint) | C$3.0B |
| Ontario plus BC share | 58% |
| Evergreen target share by year 3 | 1.3% (about US$29M) |

## Three-year P&L (US$)
| Line | Year 1 | Year 2 | Year 3 |
|---|---|---|---|
| Online revenue | $11.2M | $15.4M | $18.9M |
| Wholesale revenue | $0 | $4.1M | $7.6M |
| Store revenue (1 test store) | $0 | $0 | $2.3M |
| Total revenue | $11.2M | $19.5M | $28.8M |
| Return rate (online) | 18% | 17% | 16% |
| Fixed cost (3PL, team, marketing) | $3.9M | $4.6M | $5.8M |
| Operating profit | -$0.6M | $1.4M | $3.3M |

## Assumptions
- Online uplift from local fulfillment of 65% in year 1 over FY2023 Canadian sales of $6.8M.
- Wholesale: 20-store test in fall 2025, roll to 48 stores in year 3 if sell-through is above 60%.
- Test store in Vancouver in year 3 only if online demand per head there stays highest.
- Stores-first alternative (two Toronto stores in year 1): year 1 operating loss of $3.1M, breakeven not before year 3.`,
      summary:
        "Business case v4 for the online-first sequence: revenue grows from $11.2M in year 1 to $28.8M in year 3 with operating profit turning positive in year 2 at $1.4M. Assumes a 65 percent online uplift from local fulfillment and a 20-store wholesale test. The stores-first alternative loses $3.1M in year 1.",
      entities: "business case, online first, wholesale, test store, Vancouver, 3PL, operating profit",
    },
    {
      key: "steerco-draft",
      title: "SteerCo 1 draft: stores-led entry (internal, not shown)",
      type: "deck",
      vendor: "google_slides",
      author: "whitfield",
      section: "Weeks 3-5",
      date: "2024-03-01",
      body: `## Slide 1
Evergreen in Canada: market and channel findings. Draft v1 for partner review.

## Slide 2
Canada is a C$3.0B outdoor apparel market and Evergreen already has $6.8M of demand there.
Source: market brief, Evergreen order data.

## Slide 3
Flagship stores in Toronto would build the brand fastest.
Source: team view.

## Slide 4
Wholesale through a national chain could follow once stores prove the brand.
Source: buyer interview.

## Slide 5
Online can continue from US warehouses in the meantime.
Source: VP e-commerce interview.

## Slide 6
Next steps: shortlist Toronto sites and size the store P&L.`,
      summary:
        "Internal first draft of the SteerCo 1 deck, never shown to the client. Led with Toronto flagship stores and treated online and wholesale as secondary. Partner review rejected the storyline because the interviews and model pointed to online first.",
      entities: "SteerCo 1 draft, Toronto, flagship stores, wholesale, partner review",
    },
    {
      key: "partner-notes",
      title: "Partner review notes on SteerCo 1 draft",
      type: "document",
      vendor: "upload",
      author: "lindqvist",
      section: "Weeks 3-5",
      date: "2024-03-02",
      body: `# Partner review: SteerCo 1 draft v1

- The storyline does not follow from our own evidence. The buyer told us stores in Toronto would make them cautious, and the VP e-commerce told us duty and delivery are the problem. Slide 3 has "Source: team view". That is not a source.
- Lead with the $6.8M the customer is already spending despite duties and slow delivery. That is the strongest fact we have.
- Recommend a sequence, not a channel: online with Canadian fulfillment now, wholesale test in fall 2025, store test only when data names the city.
- Show the stores-first P&L as the alternative so the VP retail sees we took it seriously.
- Every slide title is a full sentence finding. Source line on every slide, naming the interview or model tab.`,
      summary:
        "Partner review of the stores-led SteerCo 1 draft: storyline contradicts the buyer and e-commerce interviews, and 'team view' is not a source. Asks for a sequenced recommendation led by the existing $6.8M demand, with the stores-first P&L shown as the alternative.",
      decisions: "Recommend online first, wholesale test in fall 2025, store test later\nShow stores-first as the costed alternative\nNo slide without a named source",
      entities: "partner review, storyline, sources, VP retail, sequence",
    },
    {
      key: "final",
      title: "Final readout: Canada entry recommendation",
      type: "deck",
      vendor: "google_slides",
      author: "whitfield",
      section: "Weeks 9-10",
      date: "2024-04-05",
      shown: [
        { on: "2024-04-08", occasion: "Final readout" },
        { on: "2024-04-17", occasion: "Board pre-read" },
      ],
      body: `## Slide 1
Evergreen in Canada: entry recommendation and business case. Final readout, 8 April 2024.

## Slide 2
Evergreen should enter Canada online first with a Canadian fulfillment partner in fall 2024, test wholesale in fall 2025, and test one store only in year 3.

## Slide 3
Canadians already spent $6.8M with Evergreen in FY2023 despite duties at the door and 7 to 10 day delivery.
Source: Evergreen order data, problem definition.

## Slide 4
Duty and delivery, not the product, are what hold demand back: cart abandonment at the shipping step is 1.8 times the US rate.
Source: VP e-commerce interview.

## Slide 5
A national specialty chain would test Evergreen in 20 stores and roll to 48 if full-price sell-through tops 60 percent.
Source: specialty chain buyer interview.

## Slide 6
Opening Toronto stores first would cost $3.1M in year 1 and make the chain cautious.
Source: business case v4, buyer interview.

## Slide 7
The online-first sequence reaches $28.8M revenue in year 3 and breaks even in year 2.
Source: business case v4.

## Slide 8
Decisions today: approve a Canadian 3PL contract for fall 2024, and approve samples for the chain by June 2024.`,
      summary:
        "Final readout deck shown on 8 April 2024 and used as the board pre-read. Recommends online first with Canadian fulfillment in fall 2024, a wholesale test in fall 2025 and a store test in year 3, reaching $28.8M by year 3 with year 2 breakeven.",
      decisions: "Board approved online-first entry with a Canadian 3PL for fall 2024\nWholesale samples approved for June 2024",
      entities: "final readout, board pre-read, online first, 3PL, wholesale test, business case",
    },
    {
      key: "store-walk",
      title: "Upload: Toronto store walk photos and notes",
      type: "document",
      vendor: "upload",
      author: "eriksen",
      section: "Weeks 3-5",
      date: "2024-02-27",
      placed: false,
      body: `Phone notes from a Saturday store walk on Queen Street West and in a midtown mall, Toronto.

- Specialty chain flagship: outerwear wall dominated by three brands; two US brands we compete with have shop-in-shops.
- Price points for insulated jackets cluster around C$350 to C$450, roughly 30 percent above the US equivalent.
- Staff asked about Evergreen by name twice when we mentioned it; both had bought online.

Not yet filed; photos still on my phone.`,
      summary:
        "Unfiled store walk notes from Toronto: outerwear walls dominated by three brands, insulated jackets at C$350 to C$450, and staff aware of Evergreen through online purchases.",
      entities: "Toronto, store walk, pricing, specialty chain, competitors",
    },
    {
      key: "proposal",
      title: "Proposal: Evergreen Canada market entry",
      type: "document",
      kind: "proposal",
      vendor: "google_docs",
      author: "lindqvist",
      section: "Intake",
      date: "2024-01-22",
      body: `# Proposal: Canada market entry

**Prepared for:** Evergreen Outdoor Co., Chief Commercial Officer  **From:** Kestrel Bay Advisory  **Date:** 22 January 2024

## Context
Canadian customers already buy from Evergreen online and pay for cross-border shipping. The board wants to know whether a proper entry would pay, which provinces to start in, and which channel mix makes sense.

## Objectives
1. Size the opportunity for outdoor apparel and footwear by province.
2. Compare channel options and recommend one.
3. Give the board a three-year business case it can approve in April 2024.

## Our approach
### Weeks 1 and 2
Kickoff, data request and market sizing.
### Weeks 3 to 5
Competitor scan and channel options: own stores, wholesale, online with Canadian fulfillment. Findings at SteerCo 1.
### Weeks 6 to 10
Twelve interviews with retail buyers, logistics providers and Evergreen leaders, plus a survey of existing Canadian online customers. Entry plan and business case.

## Workstreams
Market sizing. Competitors. Channels. Customer and trade research. Business case.

## Deliverables
Market model. Competitor scan. Channel comparison. Entry plan and three-year business case.

## Timeline
10 weeks from 5 February 2024.

## Team
A partner half a day a week, a full-time manager, consultant and analyst.

## Fees
$220,000 fixed, plus expenses capped at 7%.

## Assumptions and exclusions
Store site selection, legal entity setup, tax structuring and French-language brand creative are out of scope.

## Why Kestrel Bay
We test entry decisions with the buyers and partners who would make them work.`,
      summary:
        "Proposal to Evergreen Outdoor Co. for a 10-week study of whether, where and how to enter Canada. Fixed fee of $220k. Covers market sizing by province, competitors, channel options, trade research and a three-year business case.",
      entities: "Evergreen Outdoor Co., Chief Commercial Officer, Canada, market entry, wholesale, direct-to-consumer",
      shown: [{ on: "2024-01-23", occasion: "Proposal sent to the Chief Commercial Officer" }],
    },
  ],
  stickies: [
    { section: "Weeks 6-8", text: "Signe: recommend a sequence, not a channel. Show the alternative we rejected, with its cost.", fill: "yellow" },
    { section: "Weeks 3-5", text: "Chain buyer: own stores nearby would make them cautious", fill: "green" },
  ],
  outcome: {
    ranToPlan: true,
    extended: false,
    lesson: "The stores-led first draft cost us a week; testing the storyline against the interviews before drafting slides would have got us to online first sooner.",
  },
};
