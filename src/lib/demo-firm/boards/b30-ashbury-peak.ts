import type { DemoBoard } from "../types";

/**
 * Active board, red pen demo and proposal demo: Fund II LP materials for a micro-cap PE fund, run as a 4-week sprint.
 * The draft LP memo deck plants five claims no other item supports (listed in its unsupported array).
 */
export const b30: DemoBoard = {
  key: "b30",
  practice: "Transactions",
  client: { name: "Ashbury Peak Partners", type: "micro-cap private equity fund manager, Denver, raising Fund II" },
  title: "Fund II LP materials",
  pattern: "PE fundraising and diligence",
  shape: "sprint",
  start: "2026-10-26",
  weeks: 4,
  fee: "$90k",
  status: "active",
  sharedWithFirm: true,
  situation: "fundraising",
  brief:
    "Ashbury Peak is raising Fund II at $150M after an $82M Fund I. Most Fund I LPs were friends, family and a few family offices; Fund II needs RIAs, fund of funds and small endowments who will diligence the track record line by line. In four weeks, refresh the thesis using Fund I lessons, segment the LP universe and draft the LP memo and its summary deck.",
  team: ["brennan", "okafor", "obi", "hart"],
  sections: ["Intake", "Week 1", "Week 2", "Week 3", "Week 4"],
  items: [
    {
      key: "sow",
      title: "SOW: Fund II LP materials sprint",
      type: "document",
      vendor: "google_docs",
      author: "okafor",
      section: "Intake",
      date: "2026-10-20",
      body: `# Statement of work: Ashbury Peak Partners Fund II LP materials

**Client:** Ashbury Peak Partners  **Sponsor:** Managing Partner  **Duration:** 4 weeks from 26 October 2026  **Fee:** $90,000 fixed, expenses capped at 5%

## Objective
A refreshed Fund II thesis, an LP segmentation with a target list, and a draft LP memo with a 12-slide summary deck, ready for the managing partners to take to existing LPs in December.

## Scope
1. Thesis refresh: what Fund I proved and what changes for Fund II.
2. Fund I track record review, rebuilt from quarterly reports into one LP-ready table.
3. LP segmentation: re-up indications from Fund I LPs and four new LP segments with target amounts.
4. Six to eight interviews: managing partners, Fund I LPs and prospective LPs.
5. Draft LP memo and summary deck, two rounds of comments.

## Out of scope
Placement agent selection, LPA drafting, audited financials, regulatory filings.

## Team
Partner (0.5 day a week), principal (full time), consultant (full time), analyst (half time).

## Pricing basis
Priced against comparable firm work: two prior fund memos for lower middle market managers (3 and 5 weeks) and one commercial diligence (3 weeks). This sprint reuses the fund memo structure and the track record table template, so it is scoped at 4 weeks with a half-time analyst, below the midpoint of the fund memo range.

## Milestones
- Week 1: kickoff, data request, Fund I track record table
- Week 2: interviews, LP segmentation
- Week 3: thesis refresh and draft memo deck
- Week 4: comments, final draft memo`,
      summary:
        "Signed 4-week, $90k fixed-fee SOW for Ashbury Peak's Fund II LP materials: thesis refresh, Fund I track record table, LP segmentation, six to eight interviews and a draft LP memo with summary deck. Priced against two prior fund memos and one commercial diligence at the firm.",
      decisions: "Fixed fee of $90k with expenses capped at 5%\nPlacement agent selection and LPA drafting out of scope\nScoped below the fund memo midpoint by reusing the memo structure",
      entities: "Ashbury Peak Partners, Fund II, LP memo, track record, LP segmentation, pricing comparables",
    },
    {
      key: "problem",
      title: "Problem definition worksheet",
      type: "document",
      vendor: "google_docs",
      author: "brennan",
      section: "Intake",
      date: "2026-10-26",
      body: `# Problem definition

**Basic question:** What does Ashbury Peak need to show, and to whom, to reach a $90M first close for Fund II by the end of Q1 2027?

**Situation:** Fund I closed at $82M in 2020 with 31 LPs. Nine platform investments, four realized. The managing partners have raised once, mostly through their own network.

**Complication:** Fund II at $150M needs new LP types. RIAs, fund of funds and endowments run formal diligence, compare against benchmarks and ask for DPI, not paper marks. Fund I's best story (operator-led value creation) is told in anecdotes, not numbers.

**Success looks like:** an LP memo whose every number ties to the Fund I quarterly reports, a ranked LP target list, and re-up indications from Fund I LPs before the memo goes out.

**Stakeholders:** decides: the two managing partners. Helps: CFO and fund administrator, anchor Fund I LP. Can block: fund counsel (anything that reads as a performance promise).

**Emerging hypotheses**
1. Re-ups can cover about a third of the target; new LPs must bring the rest.
2. The thesis lands better narrowed: founder-owned industrial and business services in the Mountain West.
3. Low DPI is the main objection; the memo has to address it head on.`,
      summary:
        "Problem definition in the firm template. Basic question: what Ashbury Peak must show, and to whom, to reach a $90M Fund II first close by end of Q1 2027. Notes Fund I's 31 LPs, new LP types that diligence formally, and three hypotheses on re-ups, a narrower thesis and the DPI objection.",
      entities: "Ashbury Peak, Fund II, first close, DPI, RIAs, fund of funds, managing partners",
    },
    {
      key: "kickoff",
      title: "Kickoff deck: Fund II LP materials",
      type: "deck",
      vendor: "google_slides",
      author: "brennan",
      section: "Intake",
      date: "2026-10-27",
      shown: [{ on: "2026-10-28", occasion: "Kickoff" }],
      body: `## Slide 1
Ashbury Peak Partners Fund II: LP materials sprint. Kickoff, 28 October 2026.

## Slide 2
The question: what do we need to show, and to whom, to reach a $90M first close by end of Q1 2027?

## Slide 3
Four weeks, three outputs: a thesis refresh, an LP segmentation with targets, and a draft LP memo with a summary deck.

## Slide 4
Week by week: track record table and data request in week 1, interviews and segmentation in week 2, thesis and draft memo in week 3, comments in week 4.

## Slide 5
What we need from you this week: Fund I quarterly reports, the LP register, the fund administrator's cash flow file and an hour with each managing partner.`,
      summary:
        "Kickoff deck shown on 28 October 2026. Sets the question (a $90M first close by end of Q1 2027), the three outputs, the week-by-week plan and the documents and time needed from Ashbury Peak in week 1.",
      entities: "kickoff, first close, LP memo, data request, managing partners",
    },
    {
      key: "data-request",
      title: "Email: data request to the Ashbury Peak CFO",
      type: "email",
      vendor: "upload",
      author: "obi",
      section: "Week 1",
      date: "2026-10-27",
      body: `**To:** CFO, Ashbury Peak Partners
**From:** Chidi Obi, Kestrel Bay Advisory
**Subject:** Fund II LP materials: documents for week 1

Hi,

Thanks for kickoff tomorrow. So we can build the Fund I track record table by Friday, could you share:

1. Fund I quarterly LP reports, Q1 2020 to Q2 2026.
2. The fund administrator's cash flow file (calls and distributions by date), so we can compute IRR, TVPI and DPI ourselves.
3. Deal-level data for all nine platforms: entry and exit dates, entry and exit EV and EBITDA, equity invested, current mark.
4. The Fund I LP register with commitment amounts (we will keep names to the deal team only).
5. Any soft-circle or re-up notes from conversations with Fund I LPs so far.
6. The current draft of the Fund II term sheet.

Anything that is not final is still helpful; mark it draft and we will treat it that way.

Thanks,
Chidi`,
      summary:
        "Data request email for week 1: Fund I quarterly reports, the administrator's cash flow file, deal-level data for all nine platforms, the LP register, any re-up notes and the draft Fund II term sheet.",
      entities: "data request, quarterly reports, cash flow file, LP register, term sheet, re-ups",
    },
    {
      key: "int-mp",
      title: "Interview: Managing Partner (thesis and Fund I story)",
      type: "call",
      method: ["stakeholder_interviews"],
      role: "investment_partner",
      vendor: "granola",
      author: "brennan",
      section: "Week 1",
      date: "2026-10-28",
      informs: ["thesis-refresh", "memo-deck"],
      body: `# Interview: Managing Partner, Ashbury Peak Partners
Attendees: Cormac Brennan (Kestrel Bay), Chidi Obi (Kestrel Bay), Managing Partner

**Cormac:** In one sentence, what is Ashbury Peak?
**MP:** The operator-led buyer for founder-owned industrial and business services companies in the Mountain West. Colorado, Utah, Idaho, Montana.
**Chidi:** How did Fund I deals come to you?
**MP:** Six of the nine came through founder relationships, no banker, no auction. The other three were small processes run by local brokers.
**Cormac:** What actually created the value?
**MP:** EBITDA growth, mostly. Our 100-day playbook: pricing, a real finance function, and a second-layer management team. In the four exits, EBITDA grew about 19 percent a year. We also bought cheap; small founder-owned companies trade at low multiples.
**Chidi:** What went wrong?
**MP:** Summit Fabrication. We overpaid for a customer list that left with the founder. It is marked at 0.4x. We would not do a founder-dependent deal again without a two-year earnout.
**Cormac:** What changes in Fund II?
**MP:** Same strategy, bigger checks. Companies with $2M to $8M of EBITDA, 10 to 12 platforms. We will add an operating partner full time and a third investment partner. The anchor LP has been pushing us on that.
**Chidi:** What objection do you expect most?
**MP:** DPI. We have returned a bit under one turn. Our best companies are still in the portfolio.`,
      summary:
        "Managing Partner interview: positions Ashbury Peak as the operator-led buyer of founder-owned industrial and business services companies in the Mountain West. Six of nine Fund I deals came via founder relationships; EBITDA at the four exits grew about 19 percent a year; Summit Fabrication is marked at 0.4x. Fund II adds an operating partner and a third investment partner; DPI below one turn is the expected objection.",
      entities: "Managing Partner, Mountain West, founder-owned, 100-day playbook, Summit Fabrication, DPI",
    },
    {
      key: "market-chat",
      title: "Research: lower middle market fundraising and LP appetite, 2025 to 2026",
      type: "ai_thread",
      method: ["desk_research"],
      vendor: "claude",
      author: "obi",
      section: "Week 1",
      date: "2026-10-29",
      turns: [
        {
          role: "user",
          content:
            "I am drafting an LP memo for a Fund II micro-cap buyout manager raising $150M. Summarize the 2025 to 2026 fundraising environment for funds under $250M, and what family offices, RIAs, fund of funds and small endowments look for. Label each point FACT with a dated source or INFERENCE, and flag where sources disagree.",
        },
        {
          role: "assistant",
          content:
            "Here is a structured summary.\n\nFACT (private capital fundraising data report, Q2 2026): funds under $250M took a median of 17 months to reach final close in 2025, up from 12 months in 2021.\nFACT (family office LP survey, March 2026): 58 percent of family offices surveyed planned to hold or increase their allocation to lower middle market buyout over the next two years.\nFACT (emerging manager fundraising report, 2025): Fund II and Fund III managers raised a smaller share of buyout capital in 2025 than in 2021, and LPs cited realized returns (DPI) as the first screen.\nFACT (RIA alternatives platform survey, 2026): most RIA platforms set a minimum fund size, commonly $100M, and prefer client minimums around $250k with quarterly reporting.\nINFERENCE: a $150M Fund II clears RIA size screens but needs a feeder or a low client minimum to be practical for advisors.\nINFERENCE: fund of funds emerging manager programs are the likeliest institutional anchor at this size, because they are built to back Fund IIs.\n\nWhere sources disagree: the fundraising data report shows time to close lengthening for small funds, while placement agent commentary (2026) says top-quartile Fund IIs with strong DPI are closing in under 12 months. The two are compatible if the market is splitting by realized performance.",
        },
        { role: "user", content: "Write it up as a one-page market brief for the memo, keeping the labels and the disagreement note." },
        {
          role: "assistant",
          content:
            "Done. The brief keeps FACT and INFERENCE labels and dated sources, puts the disagreement note in its own section, and ends with what each LP segment will ask about first.",
        },
      ],
      summary:
        "AI research chat on the 2025 to 2026 fundraising environment for funds under $250M and what each LP type wants, labelled FACT or INFERENCE: 17-month median time to close, 58 percent of family offices holding or increasing allocations, RIA platform minimums around $100M fund size. Notes sources disagree on time to close. Produced the market brief.",
      entities: "fundraising environment, time to close, family offices, RIAs, fund of funds, DPI",
    },
    {
      key: "market-brief",
      title: "Brief: Fund II fundraising market and LP segments",
      type: "document",
      method: ["desk_research"],
      vendor: "claude",
      author: "obi",
      section: "Week 1",
      date: "2026-10-30",
      madeFrom: "market-chat",
      informs: ["lp-segments", "memo-deck"],
      body: `# Fund II fundraising market: one-page brief

**Time to close (FACT, fundraising data report, Q2 2026):** funds under $250M took a median of 17 months to reach final close in 2025, up from 12 months in 2021.

**Family offices (FACT, LP survey, March 2026):** 58 percent plan to hold or increase allocations to lower middle market buyout over two years.

**First screen (FACT, emerging manager report, 2025):** LPs screen Fund II and III managers on realized returns (DPI) before anything else.

**RIAs (FACT, RIA platform survey, 2026):** platform minimum fund size is commonly $100M; advisors prefer client minimums around $250k and quarterly reporting.

**Implications (INFERENCE)**
- Fund II at $150M clears RIA screens; a feeder or low minimum makes it practical.
- Fund of funds emerging manager programs are the likeliest institutional anchor.
- The memo must address DPI directly rather than lead with gross marks.

**Where sources disagree:** the data report says small funds take longer to close; placement agent commentary (2026) says top-quartile Fund IIs with strong DPI close in under 12 months. Plan on 15 to 18 months to final close.

**What each segment asks first**
- Family offices: alignment and access to the managing partners.
- RIAs: minimums, reporting cadence, capital call predictability.
- Fund of funds: attribution of returns and team depth.
- Endowments and foundations: GP commitment and governance.`,
      summary:
        "Market brief made from the research chat: 17-month median time to close for small funds, 58 percent of family offices holding or increasing allocations, DPI as the first screen, RIA minimums. Notes the disagreement on time to close, plans for 15 to 18 months, and lists what each LP segment asks first.",
      entities: "market brief, time to close, family offices, RIAs, fund of funds, endowments, DPI",
    },
    {
      key: "track-record",
      title: "Fund I track record table (rebuilt from quarterly reports)",
      type: "sheet",
      method: ["data_analysis"],
      vendor: "upload",
      author: "hart",
      section: "Week 1",
      date: "2026-10-30",
      informs: ["memo-deck", "thesis-refresh"],
      body: `# Fund I track record (as of 30 June 2026), rebuilt from administrator cash flows

**Fund summary**

| Metric | Value |
|---|---|
| Commitments | $82M |
| Vintage (final close) | 2020 |
| LPs | 31 |
| Platform investments | 9 (4 realized, 5 unrealized) |
| Gross MOIC | 2.6x |
| Net TVPI | 2.1x |
| Gross IRR | 27% |
| Net IRR | 21% |
| DPI | 0.9x |
| Gross MOIC, realized deals | 3.1x |

**Deal characteristics**

| Metric | Value |
|---|---|
| Average entry EBITDA | $3.4M |
| Average entry EV/EBITDA | 5.8x |
| Average exit EV/EBITDA (realized) | 8.9x |
| EBITDA CAGR, realized deals | 19% |
| Sourced through founder relationships (no auction) | 6 of 9 |
| Write-downs | 1 (Summit Fabrication, 0.4x) |

**Value creation attribution (all deals, gross)**

| Driver | Share |
|---|---|
| EBITDA growth | 48% |
| Multiple expansion | 37% |
| Debt paydown | 15% |

Notes: computed by Kestrel Bay from the administrator cash flow file; reconciles to the Q2 2026 LP report within 0.1x. No benchmark or quartile ranking has been sourced yet.`,
      summary:
        "Fund I track record rebuilt from administrator cash flows as of 30 June 2026: $82M, 31 LPs, 9 platforms (4 realized), 2.6x gross MOIC, 2.1x net TVPI, 27 percent gross and 21 percent net IRR, 0.9x DPI. Entry at 5.8x, exit at 8.9x, 6 of 9 deals via founder relationships, one write-down at 0.4x, value creation 48 percent from EBITDA growth. No quartile ranking sourced.",
      entities: "Fund I, track record, MOIC, TVPI, IRR, DPI, value creation attribution, Summit Fabrication",
    },
    {
      key: "int-anchor-lp",
      title: "Interview: Fund I anchor LP, family office CIO",
      type: "call",
      method: ["customer_research"],
      role: "investor",
      vendor: "granola",
      author: "obi",
      section: "Week 2",
      date: "2026-11-03",
      informs: ["lp-segments", "memo-deck"],
      body: `# Interview: CIO, single family office (Fund I anchor LP)
Attendees: Chidi Obi (Kestrel Bay), Isaac Hart (Kestrel Bay), CIO

**Chidi:** Will you come back for Fund II?
**CIO:** Yes. We put $10M into Fund I. We intend to commit $15M to Fund II, subject to the terms and the team changes we have asked for.
**Isaac:** What team changes?
**CIO:** A third investment partner and a full-time operating partner. Two partners running nine companies was stretched. Twelve would break them.
**Chidi:** What will other LPs ask that the managing partners underestimate?
**CIO:** DPI. They talk about 2.6x gross like it is cash. It is not. Fund I has returned 0.9x. New LPs will ask when the rest comes back.
**Isaac:** Anything on terms?
**CIO:** A key person clause that covers both founders, not just one. And I want the GP commitment to go up. Three percent is fine, but it should be cash, not fee waivers.
**Chidi:** How would you describe their edge to another LP?
**CIO:** They get calls from founders before bankers do. And they fix the finance function in the first 100 days. Every one of our portfolio reports shows it.`,
      summary:
        "Anchor Fund I LP (family office CIO) intends to commit $15M to Fund II, up from $10M, subject to adding a third investment partner and a full-time operating partner. Warns new LPs will focus on DPI of 0.9x, not 2.6x gross. Wants a key person clause covering both founders and a 3 percent GP commitment in cash.",
      decisions: "Anchor LP indication: $15M, conditional on team additions",
      entities: "anchor LP, family office, re-up, key person clause, GP commitment, DPI, operating partner",
    },
    {
      key: "int-ria",
      title: "Interview: prospective LP, RIA head of alternatives",
      type: "call",
      method: ["customer_research"],
      role: "investor",
      vendor: "granola",
      author: "obi",
      section: "Week 2",
      date: "2026-11-05",
      informs: ["lp-segments", "memo-deck"],
      body: `# Interview: Head of alternatives, regional RIA (about $9B in client assets)
Attendees: Chidi Obi, Cormac Brennan (Kestrel Bay), Head of alternatives

**Chidi:** Would a $150M micro-cap buyout fund get onto your platform?
**Head of alternatives:** It clears our size screen. Our platform minimum is a $100M fund. Below that, our compliance team will not do the work.
**Cormac:** What do your clients need?
**Head of alternatives:** A $250k minimum, quarterly reporting they can read, and no surprise capital calls. The J-curve is fine if we explain it up front. Surprise calls are not.
**Chidi:** How much might you allocate across clients?
**Head of alternatives:** For a manager we like, $10M to $15M across clients, through a feeder. We would need two years of audited Fund I financials, which they have.
**Cormac:** What makes you say no?
**Head of alternatives:** A track record I cannot rebuild from cash flows. If the memo shows gross numbers without net and DPI next to them, it goes in the no pile.
**Chidi:** And on the strategy?
**Head of alternatives:** Regional and sector-focused is fine. I would rather see six founder-sourced deals proven than a claim that every deal is proprietary.`,
      summary:
        "RIA head of alternatives: a $150M fund clears the $100M platform minimum; clients need a $250k minimum, readable quarterly reporting and predictable capital calls. Might allocate $10M to $15M across clients via a feeder. Rejects memos showing gross returns without net and DPI, and distrusts claims that every deal is proprietary.",
      entities: "RIA, platform minimum, feeder fund, capital calls, J-curve, net returns, DPI",
    },
    {
      key: "lp-segments",
      title: "LP segmentation and Fund II target build",
      type: "sheet",
      method: ["data_analysis"],
      vendor: "upload",
      author: "hart",
      section: "Week 2",
      date: "2026-11-06",
      informs: ["memo-deck"],
      body: `# Fund II LP target build (6 November 2026)

**Re-ups from Fund I LPs (from soft-circle notes and interviews)**

| Group | LPs | Fund I commitment | Fund II indication |
|---|---|---|---|
| Anchor family office | 1 | $10M | $15M |
| Other family offices | 6 | $28M | $24M |
| Individuals and founders | 12 | $19M | $13M |
| Not yet indicated or declining | 12 | $25M | $0M |
| **Total** | **31** | **$82M** | **$52M** |

**New LP segments**

| Segment | Target | Pipeline names | First question they will ask |
|---|---|---|---|
| Family offices (new) | $40M | 22 | Alignment and access |
| RIAs and multi-family offices | $30M | 14 | Minimums and reporting |
| Fund of funds, emerging manager programs | $20M | 6 | Attribution and team depth |
| Endowments and foundations | $8M | 9 | GP commitment and governance |
| **Total new** | **$98M** | **51** | |

**Fund II target:** $52M re-ups plus $98M new = $150M. First close target $90M by end of Q1 2027 (re-ups plus about $38M new).`,
      summary:
        "LP target build: 19 of 31 Fund I LPs have indicated $52M of Fund II re-ups, including the anchor's $15M. New LPs must bring $98M across family offices ($40M), RIAs and multi-family offices ($30M), fund of funds ($20M) and endowments and foundations ($8M). First close target $90M by end of Q1 2027.",
      entities: "LP segmentation, re-ups, family offices, RIAs, fund of funds, endowments, first close",
    },
    {
      key: "term-sheet",
      title: "Fund II summary of terms, draft (client upload)",
      type: "document",
      vendor: "upload",
      author: "brennan",
      section: "Intake",
      date: "2026-10-29",
      placed: false,
      body: `# Ashbury Peak Partners Fund II, L.P.: summary of principal terms (DRAFT, subject to counsel review)

- **Target size:** $150M. **Hard cap:** $175M.
- **GP commitment:** 3 percent of commitments ($4.5M at target).
- **Management fee:** 2.0 percent on commitments during the investment period, 1.5 percent on invested capital thereafter.
- **Carried interest:** 20 percent over an 8 percent preferred return, whole-fund (European) waterfall.
- **Investment period:** 5 years. **Term:** 10 years plus two 1-year extensions.
- **Key persons:** both managing partners (draft currently names one; to be updated).
- **Minimum commitment:** $1M, GP discretion to accept less.
- **First close:** targeted Q1 2027.

Uploaded by the CFO on 29 October. Not yet placed on the board; awaiting counsel's mark-up.`,
      summary:
        "Draft Fund II summary of terms uploaded by the client CFO and not yet placed on the board: $150M target, $175M hard cap, 3 percent GP commitment, 2 and 20 with an 8 percent preferred return, five-year investment period, first close targeted Q1 2027. Key person clause still names only one partner.",
      entities: "Fund II terms, hard cap, GP commitment, management fee, carried interest, key person",
    },
    {
      key: "thesis-refresh",
      title: "Fund II thesis refresh",
      type: "document",
      method: ["synthesis"],
      vendor: "google_docs",
      author: "brennan",
      section: "Week 3",
      date: "2026-11-10",
      informs: ["memo-deck"],
      body: `# Fund II thesis refresh (draft 2)

**Thesis in one sentence:** Ashbury Peak is the operator-led buyer for founder-owned industrial and business services companies in the Mountain West, with $2M to $8M of EBITDA.

**What Fund I proved**
- Founder access: 6 of 9 platforms came through founder relationships, without an auction (track record table, MP interview).
- Value creation from operations: 48 percent of value from EBITDA growth; realized companies grew EBITDA about 19 percent a year (track record table).
- Entry discipline: average entry at 5.8x EBITDA, exits at 8.9x.

**What Fund I taught**
- Founder dependence is the main loss risk (Summit Fabrication, 0.4x). Fund II requires a two-year earnout or a second-layer leader in place at close.
- Two partners cannot cover a larger portfolio. Fund II adds a third investment partner and a full-time operating partner, as the anchor LP asked.

**What changes in Fund II**
- 10 to 12 platforms, equity checks of $6M to $15M.
- Target $150M, hard cap $175M, 3 percent GP commitment in cash.
- Key person clause covering both managing partners.

**What we will not claim**
- No quartile ranking until a benchmark provider confirms it.
- No claim that every deal is proprietary.`,
      summary:
        "Fund II thesis refresh: operator-led buyer of founder-owned Mountain West industrial and business services companies with $2M to $8M EBITDA. Fund I proved founder access (6 of 9), operational value creation and entry discipline; it taught founder-dependence risk and team stretch. Fund II adds a third partner and operating partner and avoids quartile or all-proprietary claims.",
      decisions: "Thesis narrowed to founder-owned industrial and business services in the Mountain West\nNo quartile ranking claimed without a benchmark provider\nKey person clause to cover both managing partners",
      entities: "Fund II thesis, Mountain West, founder access, Summit Fabrication, operating partner, key person",
    },
    {
      key: "memo-deck",
      title: "Draft LP memo summary deck v1",
      type: "deck",
      method: ["synthesis"],
      vendor: "google_slides",
      author: "obi",
      section: "Week 3",
      date: "2026-11-13",
      body: `## Slide 1
Ashbury Peak Partners Fund II: LP memo summary. Draft v1, 13 November 2026. Confidential, for discussion.

## Slide 2
Fund II targets $150M, with a $175M hard cap and a 3 percent GP commitment.
Ashbury Peak is the operator-led buyer for founder-owned industrial and business services companies in the Mountain West with $2M to $8M of EBITDA.
Fund II will build a portfolio of 10 to 12 platforms.
Source: Fund II thesis refresh.

## Slide 3
Small funds face a slower market, but family offices are still leaning in.
Funds under $250M took a median of 17 months to reach final close in 2025.
58 percent of family offices plan to hold or increase lower middle market buyout allocations.
Lower middle market buyouts have outperformed large-cap buyouts by 640 basis points a year over the past decade.
Source: Fund II fundraising market brief.

## Slide 4
Fund I has delivered a 2.6x gross MOIC and a 2.1x net TVPI on $82M of commitments.
Net IRR is 21 percent as of 30 June 2026.
Fund I ranks in the top decile of its 2020 vintage on net IRR.
Source: Fund I track record table.

## Slide 5
Four of nine Fund I platforms are realized, at a 3.1x gross MOIC on realized deals.
Fund I has already returned 1.4x DPI to its LPs.
Source: Fund I track record table.

## Slide 6
Operations, not leverage, drove Fund I returns: 48 percent of value came from EBITDA growth, 37 percent from multiple expansion and 15 percent from debt paydown.
EBITDA at the four realized companies grew about 19 percent a year.
Average entry multiple was 5.8x EBITDA, against 8.9x at exit.
Source: Fund I track record table, Managing Partner interview.

## Slide 7
All nine Fund I platforms were sourced off-market through founder relationships.
Average entry EBITDA was $3.4M, inside the Fund II target band.
Source: Managing Partner interview, Fund I track record table.

## Slide 8
Fund I's one loss taught the firm to manage founder dependence.
Summit Fabrication is marked at 0.4x after its customer relationships left with the founder.
Fund II requires a two-year earnout or a second-layer leader at close, and adds a third investment partner and a full-time operating partner.
Source: Managing Partner interview, Fund II thesis refresh, anchor LP interview.

## Slide 9
Fund I LPs are coming back.
19 of 31 Fund I LPs have indicated they will re-up.
Existing LPs have soft-circled $70M of Fund II re-ups.
The anchor family office intends to commit $15M, up from $10M in Fund I.
Source: LP segmentation and target build, anchor LP interview.

## Slide 10
New LPs need to bring $98M across four segments.
Family offices $40M, RIAs and multi-family offices $30M, fund of funds emerging manager programs $20M, endowments and foundations $8M.
The pipeline holds 51 named prospects.
Source: LP segmentation and target build.

## Slide 11
New LP types will diligence the track record line by line, starting with DPI.
RIA platforms require a minimum fund size of $100M, which Fund II clears.
RIA clients need a $250k minimum and quarterly reporting.
LPs want a key person clause covering both managing partners.
Source: RIA interview, anchor LP interview, market brief.

## Slide 12
Next steps: first close of $90M targeted by end of Q1 2027.
December: memo to Fund I LPs and re-up confirmations.
January: RIA and fund of funds meetings.
Plan on 15 to 18 months to final close.
Source: LP segmentation and target build, market brief.`,
      summary:
        "Draft v1 of the LP memo summary deck, 12 slides, not yet reviewed or shown. Covers Fund II terms and thesis, the fundraising market, Fund I returns, value creation, sourcing, lessons from the Summit Fabrication loss, re-ups, new LP targets, LP diligence asks and next steps.",
      entities: "LP memo, Fund II, Fund I track record, DPI, re-ups, LP segments, red pen",
      unsupported: [
        "Lower middle market buyouts have outperformed large-cap buyouts by 640 basis points a year over the past decade.",
        "Fund I ranks in the top decile of its 2020 vintage on net IRR.",
        "Fund I has already returned 1.4x DPI to its LPs.",
        "All nine Fund I platforms were sourced off-market through founder relationships.",
        "Existing LPs have soft-circled $70M of Fund II re-ups.",
      ],
    },
    {
      key: "partner-notes",
      title: "Partner notes before the memo deck goes to the managing partners",
      type: "document",
      vendor: "upload",
      author: "okafor",
      section: "Week 4",
      date: "2026-11-16",
      body: `# Partner notes: LP memo summary deck v1

- This deck will be read by RIAs and fund of funds analysts who rebuild track records from cash flows. Every number has to tie to the track record table or an interview on this board. If it does not tie, cut it.
- Net and DPI sit next to gross on every page that shows returns. The RIA interview said gross without net goes in the no pile.
- Fund counsel will strike anything that reads as a performance promise. Keep forward-looking lines to the plan, not to returns.
- Re-up numbers change weekly; date every LP figure.
- Titles are full sentences that state the finding; the source line sits bottom left in small type.
- Run the deck through a claim check against the board before it goes to the managing partners on Wednesday.`,
      summary:
        "Partner notes on memo deck v1: every number must tie to the track record table or an interview, show net and DPI beside gross, avoid anything counsel would read as a performance promise, date LP figures, and run a claim check before the deck goes to the managing partners.",
      decisions: "Claim check against the board before the deck goes to the managing partners\nNet and DPI shown beside every gross return",
      entities: "partner review, claim check, DPI, net returns, fund counsel, slide titles",
    },
  ],
  stickies: [
    { section: "Week 3", text: "Partner: titles are full-sentence findings, net and DPI next to every gross number, source line bottom left.", fill: "yellow" },
    { section: "Week 2", text: "Anchor LP's $15M depends on the third partner hire. Keep that condition visible in the memo.", fill: "green" },
    { section: "Week 4", text: "Wed 18 Nov: deck v2 to the managing partners after the claim check.", fill: "blue" },
  ],
};
