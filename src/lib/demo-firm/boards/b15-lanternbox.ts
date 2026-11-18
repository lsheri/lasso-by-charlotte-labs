import type { DemoBoard } from "../types";

/** Phased board: campaign measurement at a streaming service, closed and extended into a dashboard build. */
export const b15: DemoBoard = {
  key: "b15",
  practice: "Growth and marketing",
  client: { name: "Lanternbox Streaming", type: "subscription streaming service, 14 million subscribers" },
  title: "Campaign measurement streamline",
  pattern: "Campaign measurement",
  shape: "phased",
  start: "2024-04-08",
  weeks: 8,
  fee: "$160k",
  status: "closed",
  sharedWithFirm: true,
  situation: "marketing_proof",
  brief:
    "Lanternbox's campaign results arrive about 90 days after launch, too late to change spend, and the marketing team tracks 38 KPIs that no one reads in full. Analyze four years of campaigns to find the early signals that predict subscriber growth, cut the KPI set to the few that matter, design a panel for brand reads and a quarterly dashboard.",
  team: ["whitfield", "lindqvist", "eriksen", "lund"],
  sections: ["Diagnose", "Analyze", "Design", "Deliver"],
  workstreams: ["KPI prioritization", "Four-year campaign analysis", "Panel design", "Dashboard"],
  items: [
    {
      key: "sow",
      title: "SOW: Lanternbox campaign measurement streamline",
      type: "document",
      vendor: "google_docs",
      author: "lindqvist",
      section: "Diagnose",
      date: "2024-04-01",
      body: `# Statement of work: campaign measurement streamline

**Client:** Lanternbox Streaming  **Sponsor:** Chief Marketing Officer  **Duration:** 8 weeks from 8 April 2024  **Fee:** $160,000 fixed, expenses capped at 5%

## Objective
Give Lanternbox's marketing team a short set of campaign KPIs, early signals they can act on within two weeks of launch, and a quarterly dashboard.

## Scope
1. KPI prioritization: audit the current 38 campaign KPIs with marketing, finance and analytics.
2. Four-year campaign analysis: campaigns from 2020 to 2023, testing which early signals predict 90-day incremental subscriber adds.
3. Panel design: a lean brand panel for fast reads at day 7 and day 14.
4. Dashboard: a quarterly dashboard specification and a mock-up with real data.

## Out of scope
Media mix modeling, agency selection, dashboard build in production.

## Team
Partner (0.5 day a week), manager (full time), consultant (full time), analyst (full time).

## Milestones
- Week 4: midpoint review, KPI framework
- Week 8: final readout and dashboard specification`,
      summary:
        "Signed 8-week, $160k fixed-fee SOW for Lanternbox Streaming. Covers an audit of 38 campaign KPIs, analysis of four years of campaigns for early signals of subscriber growth, a lean brand panel and a quarterly dashboard specification. Media mix modeling and production build are out of scope.",
      decisions: "Fixed fee of $160k with expenses capped at 5%\nProduction dashboard build out of scope",
      entities: "Lanternbox Streaming, CMO, campaign KPIs, early signals, brand panel, dashboard",
    },
    {
      key: "problem",
      title: "Problem definition worksheet",
      type: "document",
      vendor: "google_docs",
      author: "whitfield",
      section: "Diagnose",
      date: "2024-04-09",
      body: `# Problem definition

**Basic question:** Which few measures should Lanternbox use to judge a campaign, and which early signals can tell the team within two weeks whether to keep spending, from the Q3 2024 campaign onwards?

**Situation:** About 14 million subscribers. Around a dozen major campaigns a year across originals, sports and price promotions. A brand tracker, an agency post-campaign report and an internal subscriber model all report on campaigns.

**Complication:** The authoritative read, incremental subscriber adds, lands about 90 days after launch. By then the budget is spent. Meanwhile the team reports 38 KPIs, and each source tells a different story.

**Success looks like:** six or fewer campaign KPIs finance agrees with, an early read at day 7 or 14 the CMO trusts enough to move money, and one dashboard.

**Stakeholders:** decides: CMO and VP Finance. Helps: Head of Marketing Analytics, VP Brand Marketing. Can block: the media agency, whose report would lose its central role.

**Emerging hypotheses**
1. Trial starts and branded search in the first week predict 90-day adds better than brand tracker measures.
2. Most of the 38 KPIs are duplicates or vanity measures.
3. A small always-on panel can give brand reads in 14 days instead of a quarter.`,
      summary:
        "Problem definition in the firm template. Basic question: which six or fewer KPIs judge a campaign and which early signals justify moving money within two weeks, from Q3 2024. Notes the 90-day lag, 38 KPIs and three conflicting sources, with the agency as a possible blocker.",
      entities: "Lanternbox, CMO, VP Finance, marketing analytics, media agency, incremental subscriber adds, brand tracker",
    },
    {
      key: "int-vp-brand",
      title: "Interview: VP Brand Marketing",
      type: "call",
      method: ["stakeholder_interviews"],
      role: "marketing_leader",
      vendor: "granola",
      author: "whitfield",
      section: "KPI prioritization",
      date: "2024-04-16",
      informs: ["kpi-framework"],
      body: `# Interview: VP Brand Marketing, Lanternbox Streaming
Attendees: Grace Whitfield (Kestrel Bay), Nora Eriksen (Kestrel Bay), VP Brand Marketing

**Grace:** When do you know whether a campaign worked?
**VP:** Officially, three months later, when analytics publishes incremental adds. Unofficially I look at social buzz in week one, which I know is not great.
**Nora:** How many of the 38 KPIs do you use?
**VP:** Maybe eight. The rest were added by someone at some point and nobody wants to be the one to remove them.
**Grace:** Have you ever moved money mid-campaign?
**VP:** Once, on the football launch last year, and that was a gut call. I would love to do it on evidence.
**Nora:** What would a good early read look like?
**VP:** A number at day 7 that I can show finance and say: this one is tracking ahead, give me more.
**Grace:** What about the agency report?
**VP:** It is thorough, but it lands six weeks after the campaign ends and it always looks positive.`,
      summary:
        "VP Brand Marketing interview: the official read comes three months after launch, so the team leans on week-one social buzz. Uses about 8 of 38 KPIs and has moved money mid-campaign only once, on instinct. Wants a day-7 number finance will accept; finds the agency report late and always positive.",
      entities: "VP Brand Marketing, incremental adds, social buzz, KPIs, agency report, mid-campaign reallocation",
    },
    {
      key: "int-analytics",
      title: "Interview: Head of Marketing Analytics",
      type: "call",
      method: ["stakeholder_interviews"],
      role: "analytics_leader",
      vendor: "granola",
      author: "eriksen",
      section: "Four-year campaign analysis",
      date: "2024-04-18",
      informs: ["kpi-framework", "campaign-analysis"],
      body: `# Interview: Head of Marketing Analytics
Attendees: Nora Eriksen, Felix Lund (Kestrel Bay), Head of Marketing Analytics

**Nora:** Why does incremental adds take 90 days?
**Head:** We need the trial-to-paid conversion window to close, which is 30 days, then a holdout comparison, then finance reconciles it with billing. It is accurate, but it is slow.
**Felix:** What campaign data can you give us?
**Head:** Every major campaign from 2020 to 2023, 46 in total, with daily trial starts, branded search, social mentions, and the brand tracker waves. Incremental adds at 90 days for all of them.
**Nora:** Which signal do you believe?
**Head:** Trial starts. They are the closest thing to a purchase. Branded search is good but noisy around big sports nights.
**Felix:** What about the brand tracker?
**Head:** It is quarterly, so it cannot see a two-week campaign. The ad recall scores are mostly a function of spend.
**Nora:** Would you back cutting the KPI list?
**Head:** Please. My team spends two days a month producing measures nobody reads.`,
      summary:
        "Head of Marketing Analytics interview: incremental adds take 90 days because of the trial window, holdout and billing reconciliation. Offers 46 campaigns from 2020 to 2023 with daily signals. Trusts trial starts most, sees branded search as noisy around sports and the quarterly tracker as blind to short campaigns.",
      entities: "marketing analytics, trial starts, branded search, brand tracker, holdout, 46 campaigns",
    },
    {
      key: "research-chat",
      title: "Research: early signals for campaign effectiveness in subscription businesses",
      type: "ai_thread",
      method: ["desk_research"],
      vendor: "chatgpt",
      author: "eriksen",
      section: "Panel design",
      date: "2024-04-19",
      turns: [
        {
          role: "user",
          content:
            "I'm working with a subscription streaming service whose campaign results arrive 90 days after launch. What do public sources say about early indicators of campaign effectiveness in subscription businesses, and how fast brand panels can read? Label each point FACT with a dated source type, or INFERENCE.",
        },
        {
          role: "assistant",
          content:
            "FACT (marketing effectiveness studies, 2021 to 2023): short-term behavioral signals such as search volume and trial or sign-up starts are commonly used as leading indicators of acquisition in subscription categories.\n\nFACT (research industry guidance, 2022): continuous online panels with daily sampling can produce brand reads within one to two weeks, at the cost of smaller samples per day.\n\nFACT (advertising research literature, 2020 to 2023): ad recall tends to track spend and is a weak predictor of sales on its own.\n\nINFERENCE: a combination of trial starts and branded search at day 7 is likely to be a better early read for this client than any brand measure.\n\nINFERENCE: the brand panel should be reserved for consideration and preference, which change more slowly, not for recall.",
        },
        { role: "user", content: "Where do sources disagree?" },
        {
          role: "assistant",
          content:
            "Where sources disagree: some effectiveness studies warn that over-weighting short-term signals biases budgets toward promotions and away from brand building, while performance marketing sources treat short-term signals as sufficient. Recommended panel sizes for weekly reads also vary by a factor of three.",
        },
        { role: "user", content: "Write me a one-page memo on panel design and early signals for the team." },
        { role: "assistant", content: "Done. The memo keeps the FACT and INFERENCE labels and ends with a proposed panel spec to test." },
      ],
      summary:
        "AI research chat on early indicators of campaign effectiveness in subscription businesses and how quickly brand panels can read, labelled FACT or INFERENCE. Notes disagreement on the risk of over-weighting short-term signals. Produced the panel design memo.",
      entities: "early signals, trial starts, branded search, brand panel, ad recall, consideration",
    },
    {
      key: "panel-memo",
      title: "Memo: early signals and lean panel design",
      type: "document",
      method: ["desk_research"],
      vendor: "chatgpt",
      author: "eriksen",
      section: "Panel design",
      date: "2024-04-22",
      madeFrom: "research-chat",
      body: `# Early signals and lean panel design: memo

**Leading indicators (FACT, effectiveness studies 2021 to 2023):** search volume and trial starts are standard early reads for subscription acquisition.

**Fast panels (FACT, research guidance 2022):** continuous panels with daily sampling can read brand measures in one to two weeks.

**Recall is weak (FACT, advertising research 2020 to 2023):** ad recall tracks spend and predicts sales poorly.

**For Lanternbox (INFERENCE):** use trial starts and branded search at day 7 as the early read; keep the panel for consideration and preference.

**Where sources disagree:** whether short-term signals bias budgets toward promotions; panel size guidance varies threefold.

**Proposed panel spec to test**
- Always-on, 300 completes a week, weighted to the subscriber and prospect mix.
- Three questions only: consideration, preference among streaming services, campaign recognition.
- Read at day 14 for each campaign, against the four weeks before launch.
- Replace the quarterly brand tracker waves for campaign reads; keep one annual deep-dive.`,
      summary:
        "Memo made from the research chat: trial starts and branded search as the day-7 read, a lean always-on panel for consideration and preference, and ad recall dropped. Proposes 300 completes a week, three questions and a day-14 read.",
      entities: "panel design, trial starts, branded search, consideration, preference, brand tracker",
    },
    {
      key: "campaign-analysis",
      title: "Four-year campaign analysis: early signals against 90-day adds",
      type: "sheet",
      method: ["data_analysis"],
      vendor: "upload",
      author: "lund",
      section: "Four-year campaign analysis",
      date: "2024-05-03",
      informs: ["kpi-framework", "final"],
      body: `# Early signals against 90-day incremental subscriber adds (46 campaigns, 2020 to 2023)

| Early signal | Read at | Correlation with 90-day adds (r) | Correct keep or cut call |
|---|---|---|---|
| Trial starts against baseline | Day 7 | 0.74 | 39 of 46 (85%) |
| Branded search lift | Day 7 | 0.68 | 36 of 46 (78%) |
| Trial starts plus branded search (combined index) | Day 7 | 0.81 | 41 of 46 (89%) |
| Ad recall (brand tracker) | Next wave | 0.39 | 27 of 46 (59%) |
| Social mentions | Day 7 | 0.21 | 25 of 46 (54%) |

| KPI audit | Count |
|---|---|
| KPIs reported today | 38 |
| Duplicates of another KPI | 11 |
| Not used in any decision in 12 months | 15 |
| Kept in proposed set | 6 |

Notes: "correct call" means the day-7 signal sorted the campaign into the right half of 90-day adds. Sports campaigns excluded from search lift baselines on match days.`,
      summary:
        "Analysis of 46 campaigns from 2020 to 2023: day-7 trial starts (r 0.74) and branded search lift (r 0.68) predict 90-day adds, and a combined index (r 0.81) makes the right keep-or-cut call on 89 percent of campaigns. Ad recall and social mentions are weak. 11 of 38 KPIs are duplicates and 15 unused; six are kept.",
      entities: "campaign analysis, trial starts, branded search, ad recall, social mentions, KPI audit",
    },
    {
      key: "kpi-framework",
      title: "Midpoint review: KPI framework",
      type: "deck",
      method: ["synthesis"],
      vendor: "google_slides",
      author: "whitfield",
      section: "Analyze",
      date: "2024-05-06",
      shown: [{ on: "2024-05-08", occasion: "Midpoint review" }],
      body: `## Slide 1
Lanternbox campaign measurement: KPI framework. Midpoint review, 8 May 2024.

## Slide 2
A day-7 index of trial starts and branded search makes the right keep-or-cut call on 89 percent of past campaigns.
Source: four-year campaign analysis, 46 campaigns.

## Slide 3
Social mentions and ad recall, the measures the team watches first, are among the weakest predictors of subscriber growth.
Source: four-year campaign analysis; VP Brand Marketing interview.

## Slide 4
26 of the 38 KPIs are duplicates or unused in any decision in the last year.
Source: KPI audit.

## Slide 5
Six KPIs are enough: day-7 index, 90-day incremental adds, cost per incremental add, trial-to-paid rate, consideration and preference.
Source: KPI audit; Head of Marketing Analytics interview.

## Slide 6
Decision needed today: adopt the six-KPI framework for the Q3 2024 campaigns and start a lean brand panel in June.`,
      summary:
        "Midpoint KPI framework deck shown on 8 May 2024. A day-7 index of trial starts and branded search makes the right call on 89 percent of campaigns; social mentions and ad recall are weak; 26 of 38 KPIs are duplicates or unused. Proposes six KPIs and a lean panel from June.",
      decisions: "CMO adopted the six-KPI framework for Q3 2024 campaigns\nLean brand panel to start in June",
      entities: "KPI framework, day-7 index, trial starts, branded search, consideration, cost per incremental add",
    },
    {
      key: "final-draft",
      title: "Final readout: internal draft v1",
      type: "deck",
      method: ["synthesis"],
      vendor: "google_slides",
      author: "eriksen",
      section: "Deliver",
      date: "2024-05-24",
      body: `## Slide 1
Final readout, draft v1 (internal).

## Slide 2
Project recap: objectives, approach, interviews, data sources.

## Slide 3
Methodology: correlation analysis of 46 campaigns, five signals, holdout definitions.

## Slide 4
Results table: all five signals with correlation and hit rates.

## Slide 5
KPI audit detail: all 38 KPIs with keep, merge or cut.

## Slide 6
Panel design: sample, questions, weighting.

## Slide 7
Dashboard mock-up and next steps.

Reviewer note: not shown. Reads as a methods report; the answer is on slide 4 and the CMO's ask is missing.`,
      summary:
        "Internal first draft of the final readout, not shown to the client. Structured as recap, method and results with the answer buried on slide 4 and no decision asked; rewritten answer first for the final readout.",
      entities: "final readout draft, methodology, KPI audit, panel design, dashboard",
    },
    {
      key: "final",
      title: "Final readout: campaign measurement",
      type: "deck",
      method: ["synthesis"],
      vendor: "google_slides",
      author: "whitfield",
      section: "Deliver",
      date: "2024-05-30",
      shown: [{ on: "2024-06-03", occasion: "Final readout" }],
      body: `## Slide 1
Lanternbox campaign measurement: final readout, 3 June 2024.

## Slide 2
Lanternbox can decide whether to keep spending on a campaign at day 7, not day 90.
Source: four-year campaign analysis.

## Slide 3
The day-7 index of trial starts and branded search would have made the right call on 41 of 46 past campaigns.
Source: four-year campaign analysis.

## Slide 4
Six KPIs replace 38, and finance has agreed the definitions of all six.
Source: KPI audit; VP Finance sign-off, 29 May.

## Slide 5
A lean always-on panel reads consideration and preference at day 14, replacing quarterly tracker waves for campaign reads.
Source: panel design memo.

## Slide 6
One quarterly dashboard shows every campaign on the same six measures, with a day-7 traffic light.
Source: dashboard specification.

## Slide 7
Next steps: run the Q3 sports launch on the new framework and build the dashboard in production by September.`,
      summary:
        "Final readout shown on 3 June 2024. Campaign keep-or-cut calls can move to day 7; the day-7 index would have called 41 of 46 past campaigns correctly. Six finance-agreed KPIs replace 38, a lean panel reads at day 14 and one quarterly dashboard carries a day-7 traffic light.",
      decisions: "Six KPIs adopted with finance definitions\nQ3 sports launch to run on the new framework\nDashboard production build commissioned as a follow-on",
      entities: "final readout, day-7 index, KPIs, brand panel, quarterly dashboard, VP Finance",
    },
    {
      key: "agency-report",
      title: "Agency post-campaign report: spring originals launch (client upload)",
      type: "document",
      vendor: "upload",
      author: "lund",
      section: "KPI prioritization",
      date: "2024-04-12",
      placed: false,
      body: `# Post-campaign report: spring originals launch (media agency, shared by client)

Uploaded for reference; not yet filed on the board.

**Campaign window:** 4 to 31 March 2024. **Spend:** as per media plan.

**Headline results reported by the agency**
- Reach and frequency delivered against plan across video, social and audio.
- Ad recall uplift reported from the agency's own exposed and control survey.
- Social engagement rate above the agency's category benchmark.
- Cost per thousand impressions below plan on connected TV.

**What the report does not include**
- Trial starts or incremental subscriber adds.
- Any comparison with Lanternbox's holdout method.
- Results for audiences outside the agency's targeting segments.

Analyst note: useful for the KPI audit as an example of the measures the agency reports. Several of its measures (ad recall uplift, engagement rate) appear in Lanternbox's 38 KPIs and are candidates to cut. Check with the Head of Marketing Analytics before quoting any agency number.`,
      summary:
        "Unfiled upload of the media agency's post-campaign report for the spring originals launch, shared by the client. Reports reach, recall uplift and engagement but no trial starts or incremental adds; kept as an example for the KPI audit.",
      entities: "media agency, post-campaign report, ad recall, engagement rate, KPI audit",
    },
  ],
  stickies: [
    { section: "Deliver", text: "Partner: answer on slide 2, the CMO's decision on the last slide. Methods go in the appendix.", fill: "yellow" },
    { section: "Analyze", text: "Agency will push back on dropping recall. Bring the 0.39 figure.", fill: "green" },
  ],
  outcome: {
    ranToPlan: true,
    extended: true,
    lesson: "Getting finance to sign the six KPI definitions before the readout made the recommendation stick; the follow-on dashboard build came straight from the day-7 traffic light.",
  },
};
