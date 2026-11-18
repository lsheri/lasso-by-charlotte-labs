import type { DemoBoard } from "../types";

/** Corporate partnership tiers for a regional arts council. Active in week 5 on 16 Nov 2026; holds the red pen deck. */
export const b24: DemoBoard = {
  key: "b24",
  practice: "Social impact",
  client: { name: "Harborlight Arts Council", type: "regional arts council, 60 member organizations" },
  title: "Corporate partnership strategy",
  pattern: "Revenue diversification",
  shape: "sprint",
  start: "2026-10-19",
  weeks: 6,
  fee: "$75k",
  status: "active",
  sharedWithFirm: true,
  situation: "new_revenue",
  brief:
    "Harborlight's 23 corporate partners almost all renew one year at a time, so the development team spends much of the year chasing renewals and cannot plan the festival or schools program more than a season ahead. Design multi-year partnership tiers, test them with current and lapsed partners, and build a pitch kit the team can take to renewals in January.",
  team: ["mbeki", "lindqvist", "galloway", "doyle"],
  sections: ["Week 1", "Week 2", "Week 3", "Week 4", "Week 5", "Week 6"],
  items: [
    {
      key: "sow",
      title: "SOW: Harborlight corporate partnership strategy",
      type: "document",
      vendor: "google_docs",
      author: "lindqvist",
      section: "Week 1",
      date: "2026-10-14",
      body: `# Statement of work: corporate partnership strategy

**Client:** Harborlight Arts Council  **Sponsor:** Executive Director  **Duration:** 6 weeks from 19 October 2026  **Fee:** $75,000 fixed, expenses billed at cost up to $3,000

## Objective
Design a multi-year corporate partnership offer and a pitch kit the development team can use from the January 2027 renewal cycle.

## Scope
1. Review of corporate partner history, FY24 to FY26: revenue, renewals, benefits delivered.
2. Six interviews: development team, three current partners, one lapsed partner, one prospect.
3. Benchmark of multi-year sponsorship practice at peer arts organizations.
4. Tier design: price points, benefits, term, exit clauses, and a three-year revenue model.
5. Pitch kit: partnership deck, one-page tier sheet, renewal talk track.

## Out of scope
Individual giving, grant strategy, event production, brand redesign.

## Team
Partner (half a day a week), manager (full time), consultant (full time), analyst (part time).

## Milestones
- Week 1: kickoff
- Week 4: tier options working session
- Week 6: SteerCo and pitch kit handover (25 November)`,
      summary:
        "Signed 6-week, $75k fixed-fee SOW to design multi-year corporate partnership tiers for Harborlight Arts Council. Scope covers partner history, six interviews, a peer benchmark, tier design with a revenue model and a pitch kit for the January renewal cycle.",
      decisions: "Fixed fee of $75k, expenses at cost up to $3,000\nIndividual giving and grant strategy out of scope",
      entities: "Harborlight Arts Council, Executive Director, corporate partners, tiers, pitch kit",
    },
    {
      key: "problem",
      title: "Problem definition worksheet",
      type: "document",
      vendor: "google_docs",
      author: "mbeki",
      section: "Week 1",
      date: "2026-10-20",
      body: `# Problem definition

**Basic question:** What multi-year partnership offer would move most of Harborlight's corporate partners onto three-year agreements by FY28, while growing corporate revenue and freeing development staff time?

**Situation:** Harborlight raised $1.18M from 23 corporate partners in FY26, about 19 percent of a $6.2M budget. Corporate money funds most of the Harborlight Summer Festival and part of the Arts in Schools program.

**Complication:** 22 of the 23 agreements are one-year deals. Renewal has averaged 72 percent over three years, so the team replaces six or seven partners every year, and the festival cannot commit to artists more than a season out.

**Success looks like:** a tier structure the Executive Director and board approve on 25 November, at least three partners signed to multi-year terms in the January cycle, and a model finance can update.

**Stakeholders:** decides: Executive Director and board development committee. Helps: Development Director, corporate relations team. Can block: festival director (if benefits commit stages or dates she cannot deliver).

**Emerging hypotheses**
1. Partners care more about employee engagement and impact reporting than logo placement.
2. A three-year term with an annual exit clause is acceptable to most corporate budget owners.
3. Naming rights on festival stages can anchor a top tier.`,
      summary:
        "Problem definition in the firm template. $1.18M from 23 partners in FY26, 22 of them on one-year deals, with renewal averaging 72 percent. Success is board approval on 25 November and at least three multi-year signings in January; three hypotheses on engagement, exit clauses and stage naming.",
      entities: "Harborlight Summer Festival, Arts in Schools, Development Director, festival director, multi-year agreements",
    },
    {
      key: "kickoff",
      title: "Kickoff deck",
      type: "deck",
      vendor: "google_slides",
      author: "mbeki",
      section: "Week 1",
      date: "2026-10-21",
      shown: [{ on: "2026-10-22", occasion: "Kickoff" }],
      body: `## Slide 1
Harborlight corporate partnership strategy. Kickoff, 22 October 2026.

## Slide 2
Our question: what offer moves most corporate partners onto three-year agreements by FY28?

## Slide 3
What we will do in six weeks: partner history review, six interviews, a peer benchmark, tier design and a pitch kit.

## Slide 4
Who we want to speak to: the development team, three current partners, one lapsed partner and one prospect. We need introductions by 28 October.

## Slide 5
Working rhythm: weekly check-in with the Development Director on Thursdays, a tier options session in week 4, SteerCo on 25 November.

## Slide 6
What we need from you this week: partner history FY24 to FY26, current agreement templates, and the benefits delivery log.`,
      summary:
        "Kickoff deck shown on 22 October 2026. Sets the question, the six-week plan, the interview list, the weekly rhythm with a 25 November SteerCo, and the data the team needs in week 1.",
      entities: "kickoff, interview list, SteerCo, benefits delivery log",
    },
    {
      key: "data-request",
      title: "Email: data request to the Development Director",
      type: "email",
      vendor: "upload",
      author: "doyle",
      section: "Week 1",
      date: "2026-10-22",
      body: `**To:** Development Director, Harborlight Arts Council
**Cc:** Ayanda Mbeki
**Subject:** Partner history and agreements for the partnership work

Hi,

Thank you for a great kickoff this morning. As discussed, could your team send the following by Tuesday 27 October?

1. Corporate partner list for FY24, FY25 and FY26 with the amount, term and renewal status for each.
2. The current partnership agreement template and any non-standard agreements (we understand there is one multi-year deal).
3. The benefits delivery log: which benefits were promised and which were delivered, by partner.
4. Any impact reports or recap emails sent to partners after the festival.
5. Contact details and a warm introduction for the three current partners, the lapsed partner and the prospect on our list.

A spreadsheet export is perfect. If the benefits log is not kept in one place, a short call with whoever tracks it would work just as well.

Thanks,
Rosa Doyle
Kestrel Bay Advisory`,
      summary:
        "Data request email asking for three years of partner history, agreement templates, the benefits delivery log, any impact reports and introductions to five interviewees, due 27 October.",
      entities: "Development Director, partner list, agreement template, benefits delivery log, impact reports",
    },
    {
      key: "research-chat",
      title: "Research: multi-year corporate sponsorship in the arts",
      type: "ai_thread",
      method: ["desk_research"],
      vendor: "claude",
      author: "galloway",
      section: "Week 1",
      date: "2026-10-23",
      turns: [
        {
          role: "user",
          content:
            "I'm designing multi-year corporate partnership tiers for a regional arts council with about 23 corporate partners. What do we know about how arts organizations structure multi-year sponsorships, what corporate partners value now, and how terms and exit clauses usually work? Label each point FACT with a dated source type, or INFERENCE.",
        },
        {
          role: "assistant",
          content:
            "Here is what the public material supports.\n\nFACT (arts sponsorship surveys, 2025): corporate sponsors increasingly rank employee engagement and measurable community impact above logo placement and hospitality.\n\nFACT (arts council and orchestra annual reports, 2024): multi-year agreements usually run three years, paid annually, often with an annual appropriation or exit clause so the company's budget process is respected.\n\nFACT (nonprofit fundraising benchmarks, 2024): tiered partnership programs usually have three or four levels, with benefits that scale by visibility, access and engagement.\n\nINFERENCE: multi-year partners probably renew at higher rates than annual ones, because the renewal decision happens once every three years rather than every year. I found no reliable arts-specific figure for the size of that effect.\n\nINFERENCE: naming rights on a recurring, high-attendance asset (a festival stage, a season) are the most natural anchor for a top tier.\n\nWhere sources disagree: estimates of the share of corporate giving going to arts and culture differ. Some surveys show it flat since 2022, others show a decline as companies shift to health and education causes. Do not build the case on sector growth.",
        },
        { role: "user", content: "Write that up as a benchmark note the team can cite in the deck." },
        {
          role: "assistant",
          content:
            "Done. The note keeps the FACT and INFERENCE labels, adds a short section on exit clause wording, and states plainly that no reliable figure exists for the multi-year renewal uplift.",
        },
      ],
      summary:
        "AI research chat on multi-year arts sponsorship: three-year terms paid annually with exit clauses are common, and sponsors now value employee engagement and impact over logos. States that no reliable figure exists for the renewal uplift and that sources disagree on arts' share of corporate giving. Produced the benchmark note.",
      entities: "multi-year sponsorship, exit clause, appropriation clause, employee engagement, naming rights",
    },
    {
      key: "int-devdir",
      title: "Interview: Development Director",
      type: "call",
      method: ["stakeholder_interviews"],
      role: "fundraising_leader",
      vendor: "granola",
      author: "mbeki",
      section: "Week 1",
      date: "2026-10-23",
      informs: ["partnership-deck"],
      body: `# Interview: Development Director, Harborlight Arts Council
Attendees: Ayanda Mbeki, Owen Galloway (Kestrel Bay), Development Director

**Ayanda:** How many of your partners are on multi-year terms today?
**Development Director:** One. The regional credit union signed a two-year deal in FY25. The other 22 are one-year agreements, all renewing between January and March.
**Owen:** How much of the team's time goes on renewals?
**Development Director:** About 40 percent of the corporate team's time, January to May. Three people, and nearly half their time is spent re-selling things the partner already bought.
**Ayanda:** When a partner lapses, how long does it take to replace them?
**Development Director:** About nine months from a first meeting to a signed agreement. So if someone drops in March, the money is gone for that festival.
**Owen:** What benefits do partners ask for?
**Development Director:** Stage naming at the festival is the most requested benefit by far. After that, it is employee things: volunteer days, staff tickets, a private studio tour.
**Ayanda:** What do you send partners after the festival?
**Development Director:** Honestly, a thank-you email with photos. We do not report attendance or reach by partner. We have the data, we just never pulled it together.
**Owen:** What would worry you about multi-year deals?
**Development Director:** Locking in a price too low. And promising a stage to someone for three years when the festival layout might change.`,
      summary:
        "Development Director interview: 22 of 23 partners are on one-year deals renewing January to March; the corporate team spends about 40 percent of its time on renewals; replacing a lapsed partner takes about nine months. Festival stage naming is the most requested benefit, and partners get no reach reporting today.",
      decisions: "Every tier will include an annual impact report",
      entities: "Development Director, regional credit union, festival stage naming, renewals, impact reporting",
    },
    {
      key: "benchmark",
      title: "Benchmark note: multi-year sponsorship practice",
      type: "document",
      method: ["desk_research"],
      vendor: "google_docs",
      author: "galloway",
      section: "Week 2",
      date: "2026-10-26",
      madeFrom: "research-chat",
      body: `# Benchmark note: multi-year corporate sponsorship in the arts

## Terms
- **FACT (arts council and orchestra annual reports, 2024):** three-year agreements paid annually are the most common multi-year structure.
- **FACT (same):** most include an annual appropriation or exit clause, usually with 90 days notice before the next payment date.

## What partners value
- **FACT (arts sponsorship surveys, 2025):** employee engagement and measurable community impact now rank above logo placement and hospitality.
- **INFERENCE:** reporting on reach and outcomes is the cheapest benefit to add and the one most often missing.

## Tier structures
- **FACT (nonprofit fundraising benchmarks, 2024):** three or four tiers, scaling by visibility, access and engagement.
- **INFERENCE:** naming rights on a recurring, high-attendance asset anchor the top tier.

## What we could not find
No reliable arts-specific figure for how much multi-year terms improve renewal or lifetime value. Do not quote one.

## Where sources disagree
Surveys disagree on whether arts and culture's share of corporate giving is flat or falling since 2022. Build the case on Harborlight's own partners, not on sector growth.`,
      summary:
        "Benchmark note made from the research chat. Three-year terms paid annually with an exit clause on 90 days notice are standard; partners value engagement and impact over logos; three or four tiers are typical. States that no reliable figure exists for the multi-year renewal or lifetime value uplift.",
      entities: "benchmark, three-year term, exit clause, tiers, impact reporting",
    },
    {
      key: "partner-history",
      title: "Partner history, FY24 to FY26",
      type: "sheet",
      method: ["data_analysis"],
      vendor: "upload",
      author: "doyle",
      section: "Week 2",
      date: "2026-10-28",
      body: `# Corporate partner history (from the development team's export, cleaned)

| Fiscal year | Partners | Corporate revenue | Renewed from prior year | Renewal rate | New partners | Multi-year agreements |
|---|---|---|---|---|---|---|
| FY24 | 21 | $1.09M | 15 of 20 | 75% | 6 | 0 |
| FY25 | 22 | $1.12M | 14 of 21 | 67% | 8 | 1 |
| FY26 | 23 | $1.18M | 16 of 22 | 73% | 7 | 1 |

**Three-year average renewal rate:** 72%
**FY26 average agreement:** $51,300
**FY26 share of total budget ($6.2M):** 19%

## Concentration, FY26
| Group | Revenue | Share of corporate revenue |
|---|---|---|
| Top 5 partners | $684k | 58% |
| Next 8 partners | $328k | 28% |
| Remaining 10 partners | $168k | 14% |

Notes: FY23 and earlier are not in the export; the team changed CRM systems in 2023. One lapsed FY25 partner (regional health system) gave $35k in FY24.`,
      summary:
        "Partner history sheet for FY24 to FY26. Corporate revenue rose from $1.09M to $1.18M while partners went from 21 to 23; renewal averaged 72 percent and dipped to 67 percent in FY25. The top five partners give 58 percent of corporate revenue; data before FY24 is not available.",
      entities: "partner history, renewal rate, concentration, FY24, FY25, FY26, CRM",
    },
    {
      key: "int-bank",
      title: "Interview: community affairs director, regional bank",
      type: "call",
      method: ["customer_research"],
      role: "community_giving_leader",
      vendor: "granola",
      author: "galloway",
      section: "Week 2",
      date: "2026-10-29",
      informs: ["partnership-deck", "tier-model"],
      body: `# Interview: Director of Community Affairs, regional bank (current partner)
Attendees: Owen Galloway, Ayanda Mbeki (Kestrel Bay), Director of Community Affairs

**Owen:** How does the bank decide its community partnerships each year?
**Director:** We set the community budget on a three-year cycle, approved by our foundation board. Inside that, I re-justify every sponsorship each year, which is a lot of paperwork for a $45,000 partnership.
**Ayanda:** What does the bank get from Harborlight today?
**Director:** Our logo on the festival banners and a tent. Honestly, a logo on a banner does nothing for us anymore. What our people loved was the one volunteer day at the schools program two years ago.
**Owen:** If Harborlight offered a three-year agreement, what would it need to include?
**Director:** Two or three employee volunteer days a year, and an annual impact report I can put in front of my board: how many students, how many festival visitors, what our money did.
**Ayanda:** At what level?
**Director:** For that package I could commit $60,000 a year for three years. More than today, because it is worth more to us.
**Owen:** Any deal breakers?
**Director:** We need an exit if the bank is acquired or the budget is cut. Ninety days notice is normal for us.`,
      summary:
        "Regional bank interview: community budgets run on a three-year cycle and logo placement no longer matters. Would commit $60,000 a year for three years (up from $45,000) for employee volunteer days and an annual impact report, with a 90-day exit clause.",
      decisions: "Season tier priced at $60,000 a year",
      entities: "regional bank, community affairs, volunteer days, impact report, exit clause",
    },
    {
      key: "int-utility",
      title: "Interview: VP marketing, regional utility",
      type: "call",
      method: ["customer_research"],
      role: "marketing_leader",
      vendor: "granola",
      author: "mbeki",
      section: "Week 2",
      date: "2026-10-30",
      informs: ["partnership-deck", "tier-model"],
      body: `# Interview: Vice President of Marketing, regional utility (current partner)
Attendees: Ayanda Mbeki, Rosa Doyle (Kestrel Bay), VP Marketing

**Ayanda:** The utility has been a festival partner for six years. What keeps you coming back?
**VP:** Reach. The festival puts us in front of families in every county we serve. It is the only sponsorship where customers come up and thank us.
**Rosa:** Could you sign a three-year agreement?
**VP:** Our board approves sponsorship budgets every year, so legally I cannot commit future money. But I can sign a three-year agreement with an annual appropriation clause. We do that with the minor league ballpark.
**Ayanda:** What would a top-level package look like for you?
**VP:** Naming the main festival stage. If our name is on the stage for three summers, I could go up to $120,000 a year. Today we pay $85,000.
**Rosa:** What would you need in return, beyond the name?
**VP:** Attendance numbers by stage, and some photos and video we can use. And I would want first refusal on renewal.
**Ayanda:** Anything that would put you off?
**VP:** If two other companies also got a stage at the same level. Presenting should mean something.`,
      summary:
        "Regional utility interview: can sign three years only with an annual appropriation clause. Would pay up to $120,000 a year (up from $85,000) to name the main festival stage, with attendance by stage and first refusal, and wants presenting status kept scarce.",
      decisions: "Presenting tier capped at two partners",
      entities: "regional utility, VP Marketing, festival main stage, appropriation clause, first refusal",
    },
    {
      key: "int-health",
      title: "Interview: corporate giving manager, lapsed partner",
      type: "call",
      method: ["customer_research"],
      role: "community_giving_leader",
      vendor: "granola",
      author: "galloway",
      section: "Week 3",
      date: "2026-11-04",
      informs: ["partnership-deck"],
      body: `# Interview: Corporate Giving Manager, regional health system (lapsed partner)
Attendees: Owen Galloway, Rosa Doyle (Kestrel Bay), Corporate Giving Manager

**Owen:** The health system partnered with Harborlight in FY24 and did not renew. What happened?
**Manager:** Nothing bad, which was the problem. We gave $35,000, came to the festival, and then we never heard from them between festivals. When our committee asked what the money did, I had nothing to show.
**Rosa:** What would you have needed?
**Manager:** Reach and outcomes. How many kids in the schools program came from the neighborhoods our hospitals serve. That is what my committee funds.
**Owen:** Would you come back?
**Manager:** At a smaller level to start, maybe $25,000 a year, if there was real reporting and if we could tie it to the schools program rather than the festival.
**Rosa:** And a three-year term?
**Manager:** For $25,000 a year, yes, if there is an exit clause. Three years is easier for me than re-applying every year.`,
      summary:
        "Lapsed health system partner interview: left after FY24 because there was no reporting on reach between festivals. Would return at about $25,000 a year on a three-year term with an exit clause, if reporting is real and the money is tied to the schools program.",
      entities: "regional health system, lapsed partner, Arts in Schools, impact reporting, Community tier",
    },
    {
      key: "tier-model",
      title: "Tier model and three-year revenue projection",
      type: "sheet",
      method: ["financial_model"],
      vendor: "upload",
      author: "doyle",
      section: "Week 3",
      date: "2026-11-06",
      body: `# Tier design and projection (v2, base case)

## Tiers (all three-year terms, paid annually, 90-day exit clause, annual impact report)
| Tier | Price per year | Anchor benefit | Cap |
|---|---|---|---|
| Presenting Partner | $120,000 | Festival stage naming, attendance by stage | 2 partners |
| Season Partner | $60,000 | 3 employee volunteer days, schools program recognition | none |
| Community Partner | $25,000 | 1 volunteer day, named schools residency | none |

## Projection
| Line | FY26 actual | FY27 | FY28 | FY29 |
|---|---|---|---|---|
| Corporate revenue | $1.18M | $1.27M | $1.39M | $1.48M |
| Partners on multi-year agreements | 1 | 9 | 15 | 18 |
| Renewal rate | 73% | 76% | 80% | 82% |
| Corporate team time on renewals | 40% | 35% | 28% | 25% |

Assumptions: Presenting and Season prices from the utility and bank interviews; Community price from the lapsed partner interview; one-year partners convert as their agreements come up; renewal improves only for multi-year partners. Downside case (half the conversions): $1.31M in FY28.`,
      summary:
        "Tier model: Presenting at $120,000 (capped at two), Season at $60,000 and Community at $25,000, all three-year terms with a 90-day exit clause and an impact report. Base case grows corporate revenue to $1.39M in FY28 and $1.48M in FY29, with 15 multi-year partners and 80 percent renewal by FY28.",
      entities: "tier model, Presenting Partner, Season Partner, Community Partner, revenue projection, renewal rate",
    },
    {
      key: "partnership-deck",
      title: "Partnership deck draft v2 (for SteerCo, 25 Nov)",
      type: "deck",
      method: ["synthesis"],
      vendor: "google_slides",
      author: "galloway",
      section: "Week 4",
      date: "2026-11-12",
      body: `## Slide 1
Harborlight Arts Council: a three-year partnership offer. Draft v2 for the 25 November SteerCo.

## Slide 2
Moving partners onto three-year tiers grows corporate revenue to $1.39M by FY28 and gives the festival a planning horizon of three seasons.
Source: tier model.

## Slide 3
Harborlight raised $1.18M from 23 corporate partners in FY26, 19 percent of its $6.2M budget.
Corporate revenue has grown 12 percent a year since FY22.
Seven of the 23 partners were new in FY26.
Source: partner history.

## Slide 4
22 of 23 partners are on one-year agreements, so every partnership is re-sold every year.
Renewal averaged 72 percent over three years and fell to 67 percent in FY25.
The only multi-year agreement is a two-year deal with the regional credit union, signed in FY25.
Source: partner history, Development Director interview.

## Slide 5
The corporate team spends about 40 percent of its time on renewals, and a lapsed partner takes about nine months to replace.
The top five partners give 58 percent of corporate revenue, so one lapse can cost a festival stage.
Source: Development Director interview, partner history.

## Slide 6
Partners now value employee engagement and impact reporting over logo placement.
The regional bank told us a logo on a banner does nothing for it anymore.
The lapsed health system left because it never heard from Harborlight between festivals.
Source: benchmark note, bank interview, health system interview.

## Slide 7
Three-year agreements paid annually with an exit clause are standard practice, and they fit how partners budget.
The bank sets community budgets on a three-year cycle; the utility can sign three years with an annual appropriation clause.
Eight of the ten partners we interviewed said they would sign a three-year agreement.
Source: benchmark note, bank and utility interviews.

## Slide 8
Multi-year partners give 2.4 times more over their lifetime than annual partners across the sector.
Peer arts councils that moved to tiers reached 90 percent renewal within two years.
Source: benchmark note.

## Slide 9
Three tiers: Presenting Partner at $120,000 a year, Season Partner at $60,000 and Community Partner at $25,000, all on three-year terms.
Presenting is capped at two partners and anchored on festival stage naming, the most requested benefit.
Every tier carries a 90-day exit clause, which the bank called normal.
Source: tier model, utility interview, Development Director interview.

## Slide 10
Current partners would pay more for the right package: the bank would move from $45,000 to $60,000 a year, and the utility from $85,000 to $120,000.
The lapsed health system would return at $25,000 a year if the money is tied to the schools program.
Source: bank, utility and health system interviews.

## Slide 11
In the base case, 15 partners are on multi-year agreements by FY28 and renewal rises to 80 percent.
Corporate team time on renewals falls from 40 percent to 28 percent by FY28.
The tier model lifts corporate revenue to $1.9M by FY29.
Source: tier model.

## Slide 12
Every tier includes an annual impact report with reach by program, the cheapest benefit to add and the one partners miss most.
Today partners receive a thank-you email with photos and no reach reporting.
Source: Development Director interview, benchmark note.

## Slide 13
Decision needed on 25 November: approve the three tiers and the pitch kit for the January renewal cycle, starting with the bank, the utility and the health system.`,
      summary:
        "Draft v2 of the partnership deck for the 25 November SteerCo, not yet shown. Argues for three-year Presenting, Season and Community tiers at $120,000, $60,000 and $25,000, growing corporate revenue to $1.39M by FY28 with 80 percent renewal. Several headline figures still need checking against the partner history, interviews and tier model before it goes to the client.",
      entities: "partnership deck, SteerCo, tiers, renewal rate, festival stage naming, impact report",
      unsupported: [
        "Corporate revenue has grown 12 percent a year since FY22.",
        "Eight of the ten partners we interviewed said they would sign a three-year agreement.",
        "Multi-year partners give 2.4 times more over their lifetime than annual partners across the sector.",
        "Peer arts councils that moved to tiers reached 90 percent renewal within two years.",
        "The tier model lifts corporate revenue to $1.9M by FY29.",
      ],
    },
    {
      key: "partner-notes",
      title: "Partner review notes on partnership deck v2",
      type: "document",
      vendor: "google_docs",
      author: "lindqvist",
      section: "Week 5",
      date: "2026-11-16",
      body: `# Partner review: partnership deck draft v2

- The story is right: one-year deals cost staff time and planning, three-year tiers fix both. Keep slide 2 as the answer.
- Too many numbers per slide. The ED will present this to her board; she needs one number per slide she can defend without us in the room.
- Before this goes to the client, every figure must trace to the partner history, an interview or the tier model. If we cannot point to the row or the line, it comes out. I do not want a board member asking where a sector statistic came from and getting silence.
- Slide 8 reads like marketing. Our benchmark note says plainly what we could not find; the deck should say the same.
- Show the downside case next to the base case on slide 11. Boards trust a range more than a point.
- Titles must be full sentences that state the finding. Slide 9 is close; slide 12 is a label.
- Rename "Community Partner" if the festival director thinks it sounds like a discount tier. Ask her Thursday.`,
      summary:
        "Partner review of deck v2: keep the answer on slide 2, one defensible number per slide, trace every figure to the partner history, an interview or the tier model before the client sees it, rewrite slide 8 to match the benchmark note, and show the downside case on slide 11.",
      decisions: "Every figure must trace to a board source before the SteerCo\nShow downside case beside base case",
      entities: "partner review, Executive Director, source check, downside case, slide titles",
    },
  ],
  stickies: [
    { section: "Week 4", text: "Partner: one number per slide, full-sentence titles, source line on every figure.", fill: "yellow" },
    { section: "Week 2", text: "No data before FY24 (CRM change in 2023). Do not quote growth before FY24.", fill: "pink" },
    { section: "Week 5", text: "SteerCo 25 Nov: tiers decision. Festival director check on stage naming Thursday.", fill: "blue" },
  ],
};
