import type { DemoBoard } from "../types";

/** Sprint board by week: brand tracker and KPI rationalization at a regional telecom. Overran by a week. */
export const b16: DemoBoard = {
  key: "b16",
  practice: "Growth and marketing",
  client: { name: "Saltmarsh Telecom", type: "regional telecom, mobile and home broadband, 2.3 million customers" },
  title: "Brand tracker and KPI rationalization",
  pattern: "Campaign measurement",
  shape: "sprint",
  start: "2025-09-08",
  weeks: 6,
  fee: "$130k",
  status: "closed",
  sharedWithFirm: true,
  brief:
    "Saltmarsh runs three brand trackers that disagree with each other, and the executive team no longer trusts any of them. Audit the trackers, test which brand measures actually move with sales, and recommend one set of brand KPIs and one reporting format the board can use from January.",
  team: ["kowalski", "lindqvist", "lund"],
  sections: ["Week 1", "Week 2", "Week 3", "Week 4", "Week 5", "Week 6"],
  items: [
    {
      key: "sow",
      title: "SOW: Saltmarsh brand tracker and KPI rationalization",
      type: "document",
      vendor: "google_docs",
      author: "lindqvist",
      section: "Week 1",
      date: "2025-09-02",
      body: `# Statement of work: brand tracker and KPI rationalization

**Client:** Saltmarsh Telecom  **Sponsor:** Chief Marketing Officer  **Duration:** 6 weeks from 8 September 2025  **Fee:** $130,000 fixed, expenses capped at 5%

## Objective
Recommend one set of brand KPIs tied to sales and one reporting format, ready for the January 2026 board pack.

## Scope
1. Tracker audit: method, sample, cost and question wording of the three current trackers.
2. KPI correlation: test which brand measures lead gross adds and churn, using 2022 to 2025 data.
3. Reporting redesign: one monthly brand page for the executive team and a quarterly board version.
4. Tracker consolidation options with costs.

## Out of scope
Fielding a new tracker, agency renegotiation, campaign planning.

## Team
Partner (0.5 day a week), manager (full time), analyst (full time).

## Milestones
- Week 1: kickoff and data request
- Week 3: tracker audit readout
- Week 6: final KPI recommendation and reporting template`,
      summary:
        "Signed 6-week, $130k fixed-fee SOW for Saltmarsh Telecom. Covers an audit of three brand trackers, a correlation test of brand measures against gross adds and churn from 2022 to 2025, a redesigned monthly and quarterly brand report and consolidation options.",
      decisions: "Fixed fee of $130k with expenses capped at 5%\nFielding a new tracker out of scope",
      entities: "Saltmarsh Telecom, CMO, brand trackers, gross adds, churn, board pack",
    },
    {
      key: "problem",
      title: "Problem definition worksheet",
      type: "document",
      vendor: "google_docs",
      author: "kowalski",
      section: "Week 1",
      date: "2025-09-09",
      body: `# Problem definition

**Basic question:** Which brand measures should Saltmarsh report to its executive team and board so that brand health is read from one source and linked to sales, from the January 2026 board pack?

**Situation:** About 2.3 million mobile and broadband customers in four regions. Three brand trackers: an agency quarterly tracker, an in-house monthly pulse and a sponsorship tracker bought with the football league deal.

**Complication:** The trackers disagree. In Q2 2025 the agency tracker showed awareness rising while the pulse showed consideration falling, and gross adds were flat. Combined, the trackers report 27 brand KPIs and cost about $640k a year.

**Success looks like:** four or five brand KPIs with a demonstrated link to gross adds or churn, one tracker, and a page the CEO reads.

**Stakeholders:** decides: CMO and CFO. Helps: Head of Insight, Director of Consumer Sales. Can block: the sponsorship team, whose tracker justifies the league deal.

**Emerging hypotheses**
1. Consideration leads gross adds; awareness does not.
2. The trackers disagree because their samples and wording differ, not because the brand is moving in two directions.
3. One tracker can replace three and save at least a third of the cost.`,
      summary:
        "Problem definition in the firm template. Basic question: which brand measures to report from one source, linked to sales, from the January 2026 board pack. Three trackers report 27 KPIs at about $640k a year and disagreed in Q2 2025; the sponsorship team may block.",
      entities: "Saltmarsh, CMO, CFO, Head of Insight, consumer sales, sponsorship tracker, consideration, awareness",
    },
    {
      key: "data-request",
      title: "Email: data request to Head of Insight",
      type: "email",
      vendor: "upload",
      author: "lund",
      section: "Week 1",
      date: "2025-09-09",
      body: `**To:** Head of Insight, Saltmarsh Telecom
**Cc:** Piotr Kowalski
**Subject:** Tracker data for the KPI work

Hi,

Thanks for kickoff yesterday. To get the audit and correlation work started, could you send the following by Friday 12 September?

1. Respondent-level data or wave summaries for all three trackers from January 2022 to the latest wave, with question wording and sample definitions.
2. The tracker contracts or invoices for 2024 and 2025, so we can confirm annual cost.
3. Monthly gross adds and churn by region and product (mobile, broadband) for the same period. We can get these from finance if easier.
4. Monthly marketing spend by channel, so we can control for heavy campaign months.
5. Any past internal analysis linking brand measures to sales.

If the agency needs a formal request for respondent-level data, I can draft it for you.

Thanks,
Felix Lund
Kestrel Bay Advisory`,
      summary:
        "Data request email to Saltmarsh's Head of Insight asking for three years of tracker data with wording and samples, tracker costs, monthly gross adds and churn by region and product, marketing spend by channel and any past brand-to-sales analysis, due 12 September.",
      entities: "Head of Insight, tracker data, gross adds, churn, marketing spend, agency",
    },
    {
      key: "int-cmo",
      title: "Interview: Chief Marketing Officer",
      type: "call",
      vendor: "granola",
      author: "kowalski",
      section: "Week 2",
      date: "2025-09-16",
      informs: ["final"],
      body: `# Interview: Chief Marketing Officer, Saltmarsh Telecom
Attendees: Piotr Kowalski (Kestrel Bay), Felix Lund (Kestrel Bay), CMO

**Piotr:** What prompted this now?
**CMO:** The Q2 board meeting. I showed awareness up from the agency tracker, the CFO had the pulse showing consideration down, and gross adds were flat. I lost the room.
**Felix:** Which tracker do you trust?
**CMO:** Honestly, the pulse feels closer to what the sales team sees. But the agency tracker has ten years of history and the board knows its numbers.
**Piotr:** How many brand KPIs would you want?
**CMO:** Four. Five at most. And each one should mean something for sales.
**Felix:** What about the sponsorship tracker?
**CMO:** It exists to prove the football deal works. I need to keep the sponsorship team on side, but I do not need its numbers in the board pack.
**Piotr:** What would a good outcome look like in January?
**CMO:** One page, one source, and the CFO and I quoting the same number.`,
      summary:
        "CMO interview: lost the Q2 board when trackers showed awareness up and consideration down with flat gross adds. Trusts the monthly pulse more but the board knows the agency tracker. Wants four or five brand KPIs tied to sales, the sponsorship tracker out of the board pack and one page by January.",
      entities: "CMO, Q2 board meeting, agency tracker, monthly pulse, sponsorship tracker, CFO",
    },
    {
      key: "int-sales",
      title: "Interview: Director of Consumer Sales",
      type: "call",
      vendor: "granola",
      author: "lund",
      section: "Week 2",
      date: "2025-09-18",
      informs: ["final"],
      body: `# Interview: Director of Consumer Sales
Attendees: Felix Lund, Piotr Kowalski (Kestrel Bay), Director of Consumer Sales

**Felix:** When brand gets better, when do you see it in sales?
**Director:** A couple of months later. When people start to consider us, they come into stores or call when their contract ends. Most mobile contracts end on a 24-month cycle, so there is a lag.
**Piotr:** Which brand measure would you look at, if you could only have one?
**Director:** Whether people would consider us for their next contract. Awareness does nothing for me. Everyone knows the name.
**Felix:** Do you see differences by region?
**Director:** The north is all about network coverage. If people think our signal is bad there, no ad changes it.
**Piotr:** Would you use a monthly brand page?
**Director:** If it had consideration by region on it, yes. I would put it in my regional reviews.`,
      summary:
        "Director of Consumer Sales interview: brand improvements show up in sales about two months later because of contract cycles. Would pick consideration over awareness, which everyone already has. Network perception drives the north; would use a monthly page with consideration by region.",
      entities: "consumer sales, contract cycle, consideration, awareness, network perception, regional reviews",
    },
    {
      key: "research-chat",
      title: "Research: reconciling brand trackers and linking brand to sales",
      type: "ai_thread",
      vendor: "claude",
      author: "lund",
      section: "Week 2",
      date: "2025-09-17",
      turns: [
        {
          role: "user",
          content:
            "A regional telecom runs three brand trackers that disagree. What do public sources say about why trackers diverge, and how to test which brand measures lead sales? Label each point FACT with a dated source type, or INFERENCE.",
        },
        {
          role: "assistant",
          content:
            "FACT (market research methods literature, 2021 to 2024): trackers diverge mainly because of differences in sample source, screening, question wording and fieldwork timing; small wording changes can move awareness scores materially.\n\nFACT (marketing science studies, 2020 to 2023): consideration and preference measures tend to lead purchase more closely than awareness in mature categories where awareness is near saturation.\n\nFACT (econometric practice guides, 2022): lagged correlation and simple lead-lag tests are a common first step before full modeling, provided campaign spend and seasonality are controlled.\n\nINFERENCE: in telecom, contract cycles mean the lag between consideration and gross adds is likely to be one to three months.\n\nINFERENCE: a single tracker with continuous monthly fieldwork can carry both executive and board reporting.",
        },
        { role: "user", content: "Where do sources disagree, and what should we be careful about?" },
        {
          role: "assistant",
          content:
            "Where sources disagree: some studies argue awareness still matters for challenger brands, while others find it adds nothing once above about 90 percent. Practitioners also disagree on whether lagged correlation is good enough for decisions or only for screening.\n\nBe careful: with about 40 monthly data points, correlations above 0.6 are meaningful but not proof of cause. Say 'moves with' rather than 'drives'.",
        },
        { role: "user", content: "Turn this into a method note for the team." },
        { role: "assistant", content: "Done. The note keeps the FACT and INFERENCE labels, the disagreement section and the wording guidance." },
      ],
      summary:
        "AI research chat on why brand trackers diverge and how to test which brand measures lead sales, labelled FACT or INFERENCE. Notes disagreement on awareness for challenger brands and on lagged correlation, and warns to say 'moves with' rather than 'drives'. Produced the method note.",
      entities: "brand trackers, question wording, consideration, lead-lag correlation, contract cycles, awareness",
    },
    {
      key: "method-note",
      title: "Method note: testing brand KPIs against sales",
      type: "document",
      vendor: "claude",
      author: "lund",
      section: "Week 2",
      date: "2025-09-19",
      madeFrom: "research-chat",
      body: `# Method note: testing brand KPIs against sales

**Why trackers diverge (FACT, research methods literature 2021 to 2024):** sample source, screening, wording and fieldwork timing. Wording alone can move awareness.

**What leads purchase (FACT, marketing science studies 2020 to 2023):** consideration and preference lead more closely than awareness when awareness is saturated.

**How to test (FACT, econometric practice guides 2022):** lagged correlation with spend and seasonality controlled, before any full model.

**For Saltmarsh (INFERENCE):** expect a one to three month lag from consideration to gross adds, given contract cycles.

**Where sources disagree:** whether awareness matters for challengers; whether lagged correlation is decision-grade.

**Our approach**
1. Align the three trackers on a common monthly series from January 2022 (about 40 points).
2. Test each measure against gross adds and churn at lags of 0 to 4 months, controlling for spend.
3. Report correlations with the lag that fits best; use "moves with", never "drives".
4. Keep a measure only if r is 0.5 or above at a plausible lag.`,
      summary:
        "Method note made from the research chat: why trackers diverge, consideration leading purchase, and lagged correlation with spend controlled. Sets the approach: about 40 monthly points, lags of 0 to 4 months, keep measures at r of 0.5 or above, and say 'moves with' rather than 'drives'.",
      entities: "method note, lagged correlation, consideration, awareness, gross adds, churn",
    },
    {
      key: "correlation-sheet",
      title: "Tracker audit and KPI correlation results",
      type: "sheet",
      vendor: "upload",
      author: "lund",
      section: "Week 4",
      date: "2025-09-30",
      informs: ["final", "final-draft"],
      body: `# Tracker audit and KPI correlation (January 2022 to August 2025, 44 months)

| Tracker | Fieldwork | Sample per wave | KPIs reported | Annual cost |
|---|---|---|---|---|
| Agency quarterly tracker | Quarterly | 1,200 | 14 | $360k |
| In-house monthly pulse | Monthly | 600 | 8 | $170k |
| Sponsorship tracker | Twice a year | 800 | 5 | $110k |
| Total | | | 27 | $640k |

| Brand measure (best source) | Best lag | r with gross adds | r with churn (negative is good) |
|---|---|---|---|
| Consideration (pulse) | 2 months | 0.71 | -0.38 |
| Preference among considerers (pulse) | 2 months | 0.63 | -0.44 |
| Network perception score (pulse) | 1 month | 0.58 | -0.52 |
| Value for money (agency) | 1 month | 0.51 | -0.29 |
| Net promoter score (agency) | 3 months | 0.34 | -0.31 |
| Aided awareness (agency) | 0 to 4 months | 0.18 | -0.05 |

Notes: aided awareness has sat between 91 and 94 percent since 2022. Consolidating on an expanded monthly pulse (900 a month, adding value for money) is quoted at $390k a year, a saving of $250k.`,
      summary:
        "Tracker audit and correlation results over 44 months: three trackers report 27 KPIs for $640k a year. Consideration (r 0.71 at a two-month lag), preference, network perception and value for money move with gross adds; aided awareness (r 0.18) does not. An expanded monthly pulse at $390k a year would save $250k.",
      entities: "tracker audit, consideration, preference, network perception, value for money, aided awareness, monthly pulse",
    },
    {
      key: "final-draft",
      title: "KPI recommendation: internal draft v1",
      type: "deck",
      vendor: "google_slides",
      author: "lund",
      section: "Week 5",
      date: "2025-10-08",
      body: `## Slide 1
Brand KPI recommendation, draft v1 (internal).

## Slide 2
Background: three trackers, 27 KPIs, $640k a year.

## Slide 3
Tracker audit: methods, samples and wording compared side by side.

## Slide 4
Correlation results: six brand measures against gross adds and churn, with lags.

## Slide 5
Options: keep all three trackers, keep two, or consolidate on one.

## Slide 6
Recommended KPIs and reporting template.

Reviewer note: not shown. The partner asked for the recommendation up front and for the sponsorship tracker question to be handled before the CMO sees the deck.`,
      summary:
        "Internal first draft of the KPI recommendation, not shown to the client. Walks from background through audit and correlations to options, leaving the recommendation for the last slide; rewritten after partner review.",
      entities: "KPI recommendation draft, tracker audit, correlation results, consolidation options",
    },
    {
      key: "partner-notes",
      title: "Partner review notes on KPI recommendation draft",
      type: "document",
      vendor: "upload",
      author: "lindqvist",
      section: "Week 5",
      date: "2025-10-09",
      body: `# Partner review: KPI recommendation draft v1

- Lead with the four KPIs on slide 2. The CMO needs to walk into the board with one sentence.
- Use "moves with sales", not "drives sales". Forty-four months is good evidence, not proof.
- Show awareness at 91 to 94 percent on the slide; that is why it does not help, and nobody will argue with it.
- The sponsorship tracker: do not recommend killing it in the deck. Recommend it leaves the board pack and is reviewed when the league deal renews. Talk to the sponsorship lead before Thursday.
- Put the $250k saving on the consolidation slide in large type. That is what the CFO will remember.
- One mock-up of the monthly page with real numbers, not a wireframe.
- Titles are full-sentence findings.`,
      summary:
        "Partner review of the KPI draft: four KPIs on slide 2, 'moves with' wording, show awareness saturation, keep the sponsorship tracker out of the board pack rather than kill it, headline the $250k saving and use a real-number mock-up.",
      decisions: "Recommendation first\nSponsorship tracker leaves the board pack but is not cancelled\n$250k saving headlined for the CFO",
      entities: "partner review, CMO, CFO, sponsorship tracker, awareness, monthly brand page",
    },
    {
      key: "final",
      title: "Brand KPI recommendation and reporting template",
      type: "deck",
      vendor: "google_slides",
      author: "kowalski",
      section: "Week 6",
      date: "2025-10-23",
      shown: [{ on: "2025-10-27", occasion: "Final readout" }],
      body: `## Slide 1
Saltmarsh brand KPIs: recommendation and reporting template. Final readout, 27 October 2025.

## Slide 2
Four brand KPIs move with sales and should replace the 27 reported today: consideration, preference among considerers, network perception and value for money.
Source: tracker audit and KPI correlation results.

## Slide 3
Consideration moves with gross adds two months later (r 0.71), in line with contract cycles.
Source: KPI correlation results; Director of Consumer Sales interview.

## Slide 4
Awareness no longer tells us anything: it has sat between 91 and 94 percent since 2022 and does not move with sales.
Source: KPI correlation results.

## Slide 5
The trackers disagreed because of different samples and wording, not because the brand moved two ways.
Source: tracker audit; method note.

## Slide 6
One expanded monthly pulse can carry executive and board reporting for $390k a year, saving $250k.
Source: tracker audit.

## Slide 7
A one-page monthly brand report shows the four KPIs by region, with network perception leading in the north.
Source: reporting template; Director of Consumer Sales interview.

## Slide 8
Decisions requested: adopt the four KPIs for the January board pack, consolidate on the monthly pulse from Q1 2026, and move the sponsorship tracker out of the board pack until the league renewal.`,
      summary:
        "Final KPI recommendation shown on 27 October 2025, a week later than planned. Four brand KPIs replace 27; consideration moves with gross adds two months later (r 0.71); awareness is saturated; one monthly pulse saves $250k a year. Asks for the four KPIs in the January board pack and consolidation from Q1 2026.",
      decisions: "Four brand KPIs adopted for the January 2026 board pack\nConsolidate on an expanded monthly pulse from Q1 2026\nSponsorship tracker out of the board pack until league renewal",
      entities: "final readout, brand KPIs, consideration, monthly pulse, sponsorship tracker, board pack",
    },
  ],
  stickies: [
    { section: "Week 5", text: "Partner: simple, paste-ready slide text. Title as a full-sentence finding plus three short bullets.", fill: "yellow" },
    { section: "Week 3", text: "Agency respondent data arrived 10 days late. Readout moved a week.", fill: "pink" },
  ],
  outcome: {
    ranToPlan: false,
    extended: false,
    lesson: "Respondent-level data from the agency took ten days longer than promised and pushed the readout a week; put third-party data access in the SOW as a client dependency with a date.",
  },
};
