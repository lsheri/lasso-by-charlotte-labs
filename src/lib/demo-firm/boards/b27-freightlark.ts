import type { DemoBoard } from "../types";

/** Post-merger integration of a second acquisition, closed; overran after the product roadmap merge slipped. */
export const b27: DemoBoard = {
  key: "b27",
  practice: "Transactions",
  client: { name: "Freightlark Software", type: "logistics SaaS, freight visibility and dispatch, about 520 staff" },
  title: "Second acquisition integration",
  pattern: "Post-merger integration",
  shape: "phased",
  start: "2026-06-01",
  weeks: 8,
  fee: "$180k",
  status: "closed",
  sharedWithFirm: true,
  brief:
    "Freightlark closed its second acquisition, Haulwise, a smaller dispatch software competitor, in May 2026. The first acquisition two years earlier was integrated in a rush and lost close to a fifth of the acquired ARR in year one. Run the first 60 days of the Haulwise integration: learn from deal one, protect the top accounts, merge the product roadmaps and sequence customer communications.",
  team: ["haddad", "okafor", "obi", "hart"],
  sections: ["Day 1 readiness", "First 30 days", "Days 31 to 60"],
  workstreams: ["Lessons from deal one", "Retention plan", "Product roadmap merge", "Customer comms"],
  items: [
    {
      key: "sow",
      title: "SOW: Haulwise integration, first 60 days",
      type: "document",
      vendor: "google_docs",
      author: "okafor",
      section: "Day 1 readiness",
      date: "2026-05-26",
      body: `# Statement of work: Haulwise integration support

**Client:** Freightlark Software  **Sponsor:** Chief Operating Officer  **Duration:** 8 weeks from 1 June 2026  **Fee:** $180,000 fixed, expenses capped at 6%

## Objective
Stand up and run an integration management office (IMO) for the first 60 days after the Haulwise close, so that Freightlark keeps the acquired customers and engineers it paid for.

## Scope
1. Lessons review of the 2024 RouteNorth integration: what was lost, when, and why.
2. Retention plan: account-level risk scoring for all Haulwise customers and an owner for each top account.
3. Product roadmap merge: a single 18-month roadmap and a sunset decision for overlapping modules.
4. Customer communications: sequence, messages and FAQ by customer segment.
5. Weekly IMO status and two SteerCos.

## Out of scope
Systems migration, legal entity merger, HR harmonization (handled by the client's HR team).

## Team
Partner (0.5 day a week), manager (full time), consultant (full time), analyst (full time).

## Milestones
- Day 1 (1 June): IMO charter and Day 1 communications live
- Week 4: SteerCo 1, retention plan and roadmap options
- Week 8: Day 60 readout and handover to the internal IMO lead`,
      summary:
        "Signed 8-week, $180k fixed-fee SOW to run the first 60 days of the Haulwise integration for Freightlark. Covers a lessons review of the 2024 RouteNorth deal, a retention plan, a merged product roadmap and customer communications. SteerCo at week 4 and a Day 60 readout.",
      decisions: "Fixed fee of $180k with expenses capped at 6%\nSystems migration and HR harmonization out of scope",
      entities: "Freightlark Software, Haulwise, RouteNorth, COO, IMO, SteerCo",
    },
    {
      key: "problem",
      title: "Problem definition worksheet",
      type: "document",
      vendor: "google_docs",
      author: "haddad",
      section: "Day 1 readiness",
      date: "2026-06-02",
      body: `# Problem definition

**Basic question:** How does Freightlark keep at least 92 percent of Haulwise ARR and all six named Haulwise engineers through the first 12 months, while moving to one product roadmap by Q4 2026?

**Situation:** Haulwise brings 410 customers and $14.2M ARR, mostly regional carriers and brokers. Freightlark paid roughly 6x ARR.

**Complication:** Deal one (RouteNorth, 2024) lost 19 percent of acquired ARR in the first year, and two of the five engineers Freightlark most wanted left within six months. Haulwise customers already hear from Freightlark sales reps that their module will be retired.

**Success looks like:** gross ARR retention of 92 percent or better at month 12, no unplanned engineering departures, a roadmap both product teams sign.

**Stakeholders:** decides: COO and CEO. Helps: Chief Revenue Officer, Haulwise founder (now VP Product). Can block: Freightlark VP Engineering, who owns the overlapping dispatch module.

**Emerging hypotheses**
1. Deal one lost customers through silence, not through product changes.
2. The top 60 Haulwise accounts carry most of the risk and need a named executive owner.
3. Announcing module sunsets before a migration path exists will cost more ARR than keeping both modules for a year.`,
      summary:
        "Problem definition in the firm template. Basic question: keep 92 percent of Haulwise ARR and all six named engineers for 12 months while reaching one roadmap by Q4 2026. Notes deal one lost 19 percent of acquired ARR and sets three hypotheses.",
      entities: "Haulwise, RouteNorth, ARR retention, COO, CRO, VP Engineering, VP Product",
    },
    {
      key: "data-request",
      title: "Email: Day 1 data request to the COO's office",
      type: "email",
      vendor: "upload",
      author: "haddad",
      section: "Day 1 readiness",
      date: "2026-06-02",
      body: `**To:** Chief of Staff to the COO, Freightlark
**From:** Sami Haddad, Kestrel Bay Advisory
**Subject:** Haulwise integration: data we need this week

Hi,

Thanks for the time at kickoff. To get the retention plan moving by Friday we need the following. Where something does not exist, a note saying so is just as useful.

1. Haulwise customer list with ARR, contract end date, modules used and support tickets for the last 12 months.
2. RouteNorth customer list at close (2024) with the same fields, plus churn date and reason where known.
3. Product usage by module for both companies, monthly, last 12 months.
4. Org chart for Haulwise engineering and product, with the retention bonus list.
5. Any customer communications already sent since signing.

We will hold everything in the project folder and only share account-level data with the IMO.

Thanks,
Sami`,
      summary:
        "Data request email sent on day 2 asking for Haulwise and RouteNorth customer lists with ARR and churn, module usage, the Haulwise engineering org and retention bonus list, and any customer communications already sent.",
      entities: "data request, Haulwise, RouteNorth, customer list, retention bonus, module usage",
    },
    {
      key: "lessons-chat",
      title: "Research: why software acquisitions lose acquired customers",
      type: "ai_thread",
      vendor: "chatgpt",
      author: "obi",
      section: "Lessons from deal one",
      date: "2026-06-03",
      turns: [
        {
          role: "user",
          content:
            "We are running the first 60 days of a vertical SaaS acquisition (logistics software, about $14M ARR acquired). Summarize what public research and practitioner writing say about why acquired SaaS customers churn in the first year, and which integration moves reduce it. Label each point FACT with a dated source or INFERENCE.",
        },
        {
          role: "assistant",
          content:
            "Here is a structured summary.\n\nFACT (software M&A practitioner survey, 2025): the most cited reason for early churn of acquired customers is uncertainty about product continuity, ahead of price changes.\n\nFACT (SaaS benchmarking report, 2024): acquired customers with a named executive sponsor in the first 90 days renewed at noticeably higher rates than those handled by the general account pool.\n\nFACT (integration playbooks published by two serial acquirers, 2023 and 2025): both recommend no module retirement announcement until a migration path and timeline exist.\n\nINFERENCE: in vertical software with high switching costs, churn usually lands at the first renewal after close, so the risk window is set by contract end dates rather than by the close date.\n\nINFERENCE: sales reps from the acquirer are a common source of unplanned messages, because they see the acquired base as upsell territory.\n\nWhere sources disagree: the practitioner survey puts price increases as a minor cause, while the benchmarking report finds price increases at first renewal to be the single largest predictor of churn. The difference may be sample: the survey asked executives, the benchmark used contract data.",
        },
        { role: "user", content: "Write that up as a one-page lessons brief we can test against the RouteNorth data." },
        {
          role: "assistant",
          content:
            "Done. The brief keeps the labels, turns each point into a testable question for the RouteNorth customer list, and ends with three interview questions for the CRO.",
        },
      ],
      summary:
        "AI research chat on why acquired SaaS customers churn in year one and which integration moves help, labelled FACT or INFERENCE. Notes sources disagree on the role of price increases. Produced the deal one lessons brief.",
      entities: "SaaS M&A, customer churn, executive sponsor, module retirement, renewal risk",
    },
    {
      key: "lessons-brief",
      title: "Brief: lessons from deal one (RouteNorth)",
      type: "document",
      vendor: "google_docs",
      author: "obi",
      section: "Lessons from deal one",
      date: "2026-06-08",
      madeFrom: "lessons-chat",
      informs: ["steerco1"],
      body: `# Lessons from deal one: RouteNorth, 2024

**What the research says (from the research chat):** continuity uncertainty drives early churn (FACT, practitioner survey 2025); named executive sponsors help (FACT, benchmark 2024); no sunset announcement before a migration path (FACT, acquirer playbooks); price at first renewal may matter more than executives think (sources disagree).

**What the RouteNorth data shows (tested 5 to 8 June)**
- 19 percent of acquired ARR churned in 12 months; 71 percent of that churned ARR left at the first renewal after close.
- 23 of the 31 churned accounts had no contact from a named Freightlark leader in the first 90 days.
- The module retirement email went out in month 2; churn requests spiked in months 3 and 4.
- Price increases were applied to 40 percent of renewals; churn among those accounts was roughly double the rest.

**Implications for Haulwise**
1. Name an executive owner for every top account before day 30.
2. No module sunset message until the merged roadmap is signed.
3. Hold price on first renewal for accounts renewing in the first two quarters.

**Questions for the CRO**
1. Who sent the month 2 retirement email, and who approved it?
2. Which reps are already talking to Haulwise customers?
3. Can you commit to a price hold for two quarters?`,
      summary:
        "Lessons brief made from the research chat and tested against RouteNorth data: 19 percent of acquired ARR churned, mostly at first renewal; 23 of 31 churned accounts had no leader contact; an early retirement email and renewal price increases preceded churn. Sets three implications for Haulwise.",
      decisions: "Recommend a two-quarter price hold on first renewals\nNo module sunset message before the roadmap is signed",
      entities: "RouteNorth, churn, first renewal, executive owner, price hold, module retirement",
    },
    {
      key: "int-cro",
      title: "Interview: Chief Revenue Officer",
      type: "call",
      vendor: "granola",
      author: "haddad",
      section: "Retention plan",
      date: "2026-06-09",
      informs: ["steerco1"],
      body: `# Interview: Chief Revenue Officer, Freightlark
Attendees: Sami Haddad (Kestrel Bay), Chidi Obi (Kestrel Bay), CRO

**Sami:** Looking back at RouteNorth, where did the customers go?
**CRO:** Honestly, we told them the old product was going away before we had anything to move them to. Month two, a product marketing email. I signed off on it. That was a mistake.
**Chidi:** Are your reps already talking to Haulwise customers?
**CRO:** Some are. A few saw the deal announcement and started calling the bigger brokers. I have told them to stop, but I cannot promise it has stopped.
**Sami:** Would you accept a rule that only named account owners contact the top 60 Haulwise accounts until day 90?
**CRO:** Yes, if those owners include some of my senior AEs and not only executives. Executives will not make 60 calls.
**Chidi:** And pricing at renewal?
**CRO:** I can hold price for two quarters. Beyond that the board will want the uplift; it is in the deal model.
**Sami:** What would make you call this integration a success?
**CRO:** Net retention above 100 percent on the Haulwise base by month 12. Gross retention I would take at 92.`,
      summary:
        "CRO interview: admits the RouteNorth retirement email in month 2 was a mistake. Some reps are already calling Haulwise accounts. Agrees to named owners for the top 60 accounts until day 90 and a two-quarter price hold; targets 92 percent gross retention.",
      decisions: "Only named owners contact the top 60 Haulwise accounts until day 90\nPrice hold for two quarters on first renewals",
      entities: "CRO, RouteNorth, account owners, price hold, gross retention, net retention",
    },
    {
      key: "int-haulwise-cs",
      title: "Interview: Haulwise head of customer success",
      type: "call",
      vendor: "granola",
      author: "obi",
      section: "Customer comms",
      date: "2026-06-11",
      informs: ["steerco1", "comms-draft"],
      body: `# Interview: Head of customer success, Haulwise
Attendees: Chidi Obi, Isaac Hart (Kestrel Bay), Haulwise head of customer success

**Chidi:** What are customers asking you since the deal was announced?
**Head of CS:** Three things. Will my price change, will my module be switched off, and will I keep my support contact. The third one comes up more than I expected.
**Isaac:** How many accounts have raised it formally?
**Head of CS:** About 40 have emailed or called. Six asked about contract termination clauses. Four of those six are in the top 60.
**Chidi:** Who do they trust on your side?
**Head of CS:** Their support lead and our founder. Most of the big carriers bought because of the founder.
**Isaac:** If you could write the first message, what would it say?
**Head of CS:** Your contact stays the same, your price stays the same for this term, nothing gets switched off this year. Signed by our founder, not by a Freightlark executive they have never met.`,
      summary:
        "Haulwise head of customer success: customers ask about price, module shutdown and keeping their support contact. About 40 accounts have raised concerns and six asked about termination clauses, four in the top 60. Recommends the first message come from the Haulwise founder.",
      entities: "Haulwise, customer success, termination clauses, support contact, founder letter",
    },
    {
      key: "retention-sheet",
      title: "Retention dashboard: Haulwise account risk, week 3",
      type: "sheet",
      vendor: "upload",
      author: "hart",
      section: "Retention plan",
      date: "2026-06-19",
      informs: ["steerco1", "final"],
      body: `# Haulwise retention dashboard (as of 19 June 2026)

| Segment | Accounts | ARR | Share of ARR | Renewing in next 2 quarters | Risk: red | ARR at risk (red) |
|---|---|---|---|---|---|---|
| Top 60 (enterprise carriers and brokers) | 60 | $8.2M | 58% | 22 | 9 | $2.0M |
| Mid-market | 140 | $4.1M | 29% | 51 | 14 | $0.8M |
| Small fleets | 210 | $1.9M | 13% | 88 | 21 | $0.3M |
| **Total** | **410** | **$14.2M** | **100%** | **161** | **44** | **$3.1M** |

Risk score inputs: renewal within two quarters, open termination question, support tickets up more than 50 percent since signing, uses a module Freightlark plans to retire.

Owner coverage: 52 of the top 60 have a named owner (target 60 by day 30).`,
      summary:
        "Account risk dashboard for Haulwise at week 3: 410 accounts and $14.2M ARR, top 60 accounts hold 58 percent of ARR. 44 accounts flagged red with $3.1M ARR at risk, $2.0M of it in the top 60. 52 of the top 60 have named owners.",
      entities: "retention dashboard, ARR at risk, top 60 accounts, account owners, risk score",
    },
    {
      key: "steerco1",
      title: "SteerCo 1: retention plan and roadmap options",
      type: "deck",
      vendor: "google_slides",
      author: "haddad",
      section: "First 30 days",
      date: "2026-06-24",
      shown: [{ on: "2026-06-26", occasion: "SteerCo 1" }],
      body: `## Slide 1
Haulwise integration: retention plan and roadmap options. SteerCo 1, 26 June 2026.

## Slide 2
Deal one lost 19 percent of acquired ARR, and most of it left at first renewal after an early retirement message.
Source: lessons brief, RouteNorth customer data.

## Slide 3
$3.1M of Haulwise ARR is at risk today, and two thirds of it sits in the top 60 accounts.
Source: retention dashboard, 19 June.

## Slide 4
Haulwise customers want three promises: same contact, same price this term, nothing switched off this year.
Source: Haulwise head of customer success interview.

## Slide 5
Named owners now cover 52 of the top 60 accounts; the remaining 8 will be assigned by day 30.
Source: retention dashboard.

## Slide 6
Roadmap options: A) retire the Haulwise dispatch module in Q1 2027, B) run both modules through 2027 and migrate by account, C) rebuild dispatch on the Haulwise codebase.

## Slide 7
Recommendation: hold price for two quarters, send a founder-signed letter in week 5, and choose option B. Decision needed today: approve the price hold and the letter.`,
      summary:
        "SteerCo 1 deck shown on 26 June 2026. Headlines: deal one lost 19 percent of acquired ARR, $3.1M of Haulwise ARR at risk with two thirds in the top 60, customers want three continuity promises, 52 of 60 top accounts owned. Recommends a price hold, a founder letter and roadmap option B.",
      decisions: "SteerCo approved the two-quarter price hold and the founder-signed letter\nRoadmap option deferred two weeks for engineering input",
      entities: "SteerCo, retention plan, ARR at risk, founder letter, roadmap options, price hold",
    },
    {
      key: "comms-draft",
      title: "Customer comms sequence, internal draft v0",
      type: "deck",
      vendor: "google_slides",
      author: "obi",
      section: "Customer comms",
      date: "2026-06-30",
      body: `## Slide 1
Customer communications sequence, internal draft v0. Not for client circulation.

## Slide 2
Week 5: founder-signed letter to all 410 accounts. Three promises: same contact, same price this term, nothing switched off in 2026.

## Slide 3
Week 6: named owner calls to the top 60, script built from the head of customer success interview.

## Slide 4
Week 8: roadmap preview webinar for mid-market and small fleets (held until the roadmap option is signed).

## Slide 5
FAQ: twelve questions, owner for each answer. Open question: do we mention the 2027 migration at all? Partner view: no, not until engineering signs option B.`,
      summary:
        "Internal draft of the customer communications sequence, never shown to the client. Founder letter in week 5, owner calls to the top 60 in week 6, roadmap webinar in week 8, and a twelve-question FAQ. Holds the migration message until engineering signs the roadmap option.",
      entities: "customer comms, founder letter, FAQ, webinar, migration message",
    },
    {
      key: "final",
      title: "Day 60 readout and IMO handover",
      type: "deck",
      vendor: "google_slides",
      author: "haddad",
      section: "Days 31 to 60",
      date: "2026-07-31",
      shown: [{ on: "2026-08-04", occasion: "Final readout" }],
      body: `## Slide 1
Haulwise integration: Day 60 readout and handover to the internal IMO lead. 4 August 2026.

## Slide 2
No Haulwise account has given notice since the founder letter, and ARR at risk fell from $3.1M to $1.4M.
Source: retention dashboard, 19 June and 28 July.

## Slide 3
All 60 top accounts now have a named owner, and 57 have had a first call.
Source: retention dashboard, 28 July.

## Slide 4
Engineering signed roadmap option B three weeks late: both dispatch modules run through 2027 and customers migrate account by account.
Source: roadmap working sessions.

## Slide 5
All six named Haulwise engineers remain; two are now leading the merged dispatch squad.

## Slide 6
Handover: the internal IMO lead owns the dashboard, the owner cadence and the migration plan from 11 August. Kestrel Bay exits after a two-week shadow period.`,
      summary:
        "Day 60 readout shown on 4 August 2026. No notices since the founder letter, ARR at risk down from $3.1M to $1.4M, all top 60 accounts owned, all six named engineers retained. Roadmap option B signed three weeks late. Handover to an internal IMO lead after a two-week shadow.",
      decisions: "Roadmap option B adopted: both dispatch modules run through 2027\nInternal IMO lead takes over from 11 August",
      entities: "Day 60 readout, IMO handover, roadmap option B, ARR at risk, engineer retention",
    },
  ],
  stickies: [
    { section: "First 30 days", text: "Partner: lead every SteerCo with ARR at risk in dollars, not percentages. Sources bottom left.", fill: "yellow" },
    { section: "Product roadmap merge", text: "VP Engineering will not sign option B without a headcount line for 2027. Raise with COO before SteerCo.", fill: "pink" },
  ],
  outcome: {
    ranToPlan: false,
    extended: true,
    lesson: "Retention held because the founder letter went out before any Freightlark rep could freelance; the roadmap merge needed engineering in the room from week 1, and leaving it to week 4 cost us a three-week extension.",
  },
};
