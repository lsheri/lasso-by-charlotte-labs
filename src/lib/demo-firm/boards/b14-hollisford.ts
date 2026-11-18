import type { DemoBoard } from "../types";

/** Active research-shaped board: a peer learning pilot at an engineering firm, with the red pen demo deck. */
export const b14: DemoBoard = {
  key: "b14",
  practice: "Operating model and strategy ops",
  client: { name: "Hollisford Engineering", type: "engineering services firm, 2,400 staff, 11 offices" },
  title: "Community-led technical learning",
  pattern: "Technical learning community",
  shape: "research",
  start: "2026-10-05",
  weeks: 8,
  fee: "$150k",
  status: "active",
  sharedWithFirm: true,
  situation: "talent",
  brief:
    "Hollisford's engineers say they cannot find the people or the content to learn from. The LMS catalog is large and little used, and senior experts are close to retirement. Research how engineers actually learn, run a four-week peer learning pilot in two disciplines, and recommend a platform and operating model the Chief Engineer can take to the executive team in December.",
  team: ["sorensen", "lindqvist", "moreau", "achebe"],
  sections: ["Plan", "Field research", "Synthesis", "Pilot", "Final"],
  items: [
    {
      key: "sow",
      title: "SOW: Hollisford community-led technical learning",
      type: "document",
      vendor: "google_docs",
      author: "lindqvist",
      section: "Plan",
      date: "2026-09-28",
      body: `# Statement of work: community-led technical learning

**Client:** Hollisford Engineering  **Sponsor:** Chief Engineer  **Duration:** 8 weeks from 5 October 2026  **Fee:** $150,000 fixed, expenses capped at 6%

## Objective
Find out how Hollisford engineers learn today, test a peer learning community with real engineers, and recommend a platform and operating model for a firm-wide rollout.

## Scope
1. Learning diagnostic: LMS usage, learning spend, expert directory and internal channels.
2. Field research: 10 interviews across disciplines and career stages, plus a firm-wide survey.
3. A four-week pilot with two discipline communities, run with a named facilitator in each.
4. Platform options: extend current tools, a dedicated Q&A tool, or a community platform, with three-year costs.
5. Operating model: roles, time allowance and how communities link to the LMS and to promotion criteria.

## Out of scope
Platform procurement and build, LMS content rewrite, HR policy changes.

## Team
Partner (0.5 day a week), manager (full time), consultant (full time), analyst (full time).

## Milestones
- Week 1: kickoff and research plan
- Week 4: research synthesis
- Week 7: midpoint review of pilot results
- Week 8: pilot readout and platform recommendation`,
      summary:
        "Signed 8-week, $150k fixed-fee SOW for Hollisford Engineering. Covers a learning diagnostic, 10 interviews and a survey, a four-week pilot in two discipline communities, platform options with three-year costs, and an operating model. Platform build and HR policy are out of scope.",
      decisions: "Fixed fee of $150k with expenses capped at 6%\nPilot limited to two discipline communities\nProcurement and build out of scope",
      entities: "Hollisford Engineering, Chief Engineer, LMS, peer learning pilot, platform options",
    },
    {
      key: "problem",
      title: "Problem definition worksheet",
      type: "document",
      vendor: "google_docs",
      author: "sorensen",
      section: "Plan",
      date: "2026-10-06",
      body: `# Problem definition

**Basic question:** What peer learning model and platform should Hollisford adopt so that any engineer can find the right person or answer within a day, with a rollout decision by December 2026?

**Situation:** About 1,850 engineers across six disciplines and 11 offices. Learning runs through an LMS with a large catalog, informal lunch-and-learns and Teams channels set up office by office.

**Complication:** Engineers say they learn from colleagues but cannot find them. The expert directory is out of date, most Teams channels are inactive, and a wave of senior engineers will retire in the next five years. Early-career engineers name learning as a reason they might leave.

**Success looks like:** a pilot that shows questions answered within a day, a platform choice the CIO can support, and a time allowance the operations director will fund.

**Stakeholders:** decides: Chief Engineer and COO. Helps: Head of L&D, discipline leads, CIO. Can block: office operations directors (billable time).

**Emerging hypotheses**
1. The problem is finding people, not a lack of content.
2. A named facilitator per community matters more than the platform.
3. Existing tools can carry a pilot; a dedicated tool may be needed at scale.`,
      summary:
        "Problem definition in the firm template. Basic question: what peer learning model and platform lets any engineer find the right person or answer within a day, decided by December 2026. Names office operations directors as possible blockers and sets three hypotheses, led by finding people rather than content.",
      entities: "Chief Engineer, COO, Head of L&D, CIO, discipline leads, expert directory, Teams",
    },
    {
      key: "kickoff",
      title: "Kickoff deck",
      type: "deck",
      vendor: "google_slides",
      author: "sorensen",
      section: "Plan",
      date: "2026-10-06",
      shown: [{ on: "2026-10-07", occasion: "Kickoff" }],
      body: `## Slide 1
Hollisford community-led technical learning. Kickoff, 7 October 2026.

## Slide 2
Our question: how can any Hollisford engineer find the right person or answer within a day?

## Slide 3
Eight weeks in four steps: diagnose how engineers learn, hear from them directly, run a four-week pilot in two disciplines, recommend a platform and operating model.

## Slide 4
What we need from you this week: LMS and learning spend data, the expert directory export, Teams channel statistics and ten interview slots.

## Slide 5
Pilot communities proposed: Geotechnical and foundations, and Electrical grid connections. Decision needed today: confirm the two disciplines and name a facilitator for each.`,
      summary:
        "Kickoff deck shown to the client on 7 October 2026. Sets the question, an eight-week plan in four steps and the data needed in week 1. Proposes geotechnical and electrical grid connection communities for the pilot.",
      decisions: "Pilot disciplines confirmed: Geotechnical and foundations, Electrical grid connections\nEach pilot community gets a named facilitator",
      entities: "kickoff, pilot communities, geotechnical, electrical grid connections, facilitator",
    },
    {
      key: "data-request",
      title: "Email: data request to Head of L&D",
      type: "email",
      vendor: "upload",
      author: "achebe",
      section: "Plan",
      date: "2026-10-07",
      body: `**To:** Head of Learning and Development, Hollisford Engineering
**Cc:** Erik Sorensen
**Subject:** Data request for the learning diagnostic

Hello,

Thank you for the time at kickoff. To start the diagnostic, could your team share the following by Wednesday 14 October?

1. LMS export for FY2026: course catalog with last-opened dates, completions by engineer (anonymized ID, discipline, office, years of service).
2. Learning and development spend for FY2026, split by external courses, conferences, LMS licenses and internal events.
3. The current expert directory export, with the last-updated date for each entry.
4. Teams channel statistics for technical channels: member counts and posts in the last 90 days.
5. Headcount by discipline and age band (we only need counts, not names).

If any of these are hard to pull, a rough version is fine for now and we can refine later. I am happy to jump on a call with whoever owns the LMS.

Best,
Ngozi Achebe
Kestrel Bay Advisory`,
      summary:
        "Data request email to Hollisford's Head of L&D asking for the FY2026 LMS export, learning spend, expert directory, Teams channel statistics and headcount by discipline and age band, due 14 October.",
      entities: "Head of L&D, LMS export, learning spend, expert directory, Teams channels, headcount",
    },
    {
      key: "learning-data",
      title: "Learning diagnostic data: LMS, spend, directory and channels",
      type: "sheet",
      method: ["data_analysis"],
      vendor: "upload",
      author: "achebe",
      section: "Field research",
      date: "2026-10-16",
      informs: ["midpoint"],
      body: `# Learning diagnostic, FY2026 (summary tab)

| Measure | Value | Source |
|---|---|---|
| Engineers (all disciplines) | 1,850 | HR headcount |
| Engineers aged 60 or over | 140 | HR headcount |
| Learning and development spend | $3.2M | Finance |
| Spend per engineer | $1,730 | Calculated |
| LMS courses in catalog | 1,140 | LMS export |
| Courses not opened in 12 months | 468 (41%) | LMS export |
| Engineers completing at least one course | 62% | LMS export |
| Median LMS hours per engineer per year | 3.1 | LMS export |
| Expert directory entries | 610 | Directory export |
| Directory entries last updated in 2023 or earlier | 38% | Directory export |
| Technical Teams channels | 230 | Teams statistics |
| Channels with no post in 90 days | 164 (71%) | Teams statistics |

Notes: the directory was last refreshed in a single exercise in 2023. Spend excludes engineers' billable time spent at internal events.`,
      summary:
        "Diagnostic data sheet: 1,850 engineers, 140 aged 60 or over, $3.2M learning spend ($1,730 per engineer). 41 percent of 1,140 LMS courses were not opened in a year, 62 percent of engineers completed at least one course, 38 percent of directory entries date from 2023 or earlier and 71 percent of 230 technical Teams channels are inactive.",
      entities: "LMS, learning spend, expert directory, Teams channels, headcount, FY2026",
    },
    {
      key: "int-chief",
      title: "Interview: Chief Engineer",
      type: "call",
      method: ["stakeholder_interviews"],
      role: "engineering_leader",
      vendor: "granola",
      author: "sorensen",
      section: "Field research",
      date: "2026-10-13",
      informs: ["midpoint"],
      body: `# Interview: Chief Engineer, Hollisford Engineering
Attendees: Erik Sorensen (Kestrel Bay), Julien Moreau (Kestrel Bay), Chief Engineer

**Erik:** What made you start this now?
**Chief Engineer:** Two retirements last year. Both were the people everyone called about deep foundations and grid studies. When they left, three projects stalled for weeks while teams worked out who else knew. We have about 140 engineers over 60. That is our knowledge, and most of it is not written down.
**Julien:** How do engineers find an expert today?
**Chief Engineer:** They ask their manager, who asks someone they went to school with. The directory exists but nobody trusts it. I tried it myself last month and the first two names had left the firm.
**Erik:** What has been tried before?
**Chief Engineer:** We bought more LMS content in 2024. Usage barely moved. Content is not the problem. People want to ask someone who has done it.
**Julien:** What would success look like in a year?
**Chief Engineer:** An engineer in any office posts a question and gets a useful answer the same day. And I want our senior people to see teaching as part of the job, not a favor.
**Erik:** What will the operations directors say?
**Chief Engineer:** They will ask who pays for the hours. If you cannot answer that, it dies in the office budget meetings.`,
      summary:
        "Chief Engineer interview: two retirements stalled three projects; about 140 engineers are over 60 and the expert directory is not trusted. More LMS content in 2024 did not move usage. Wants same-day answers and warns operations directors will ask who pays for the hours.",
      decisions: "Funding of facilitator and expert time must be answered before the executive meeting",
      entities: "Chief Engineer, retirements, expert directory, LMS content, operations directors, billable hours",
    },
    {
      key: "int-discipline-lead",
      title: "Interview: Structural discipline lead",
      type: "call",
      method: ["stakeholder_interviews"],
      role: "engineering_leader",
      vendor: "granola",
      author: "moreau",
      section: "Field research",
      date: "2026-10-15",
      informs: ["midpoint"],
      body: `# Interview: Structural discipline lead
Attendees: Julien Moreau, Ngozi Achebe (Kestrel Bay), Structural discipline lead

**Julien:** How does learning happen in structural today?
**Lead:** Lunch-and-learns once a month. We get about 15 people, mostly from the head office. The other offices dial in and drop off.
**Ngozi:** And the Teams channels?
**Lead:** We have four structural channels and one is alive. The others were set up by someone who moved on. People post a question, nobody answers for two days, so they stop posting.
**Julien:** What would make a community work?
**Lead:** Someone whose job it is to keep it going. Not a full-time role, but real hours. And recognition, so it counts at promotion time.
**Ngozi:** Would your senior engineers answer questions from other offices?
**Lead:** Most would, if they saw the question. The problem is they never see it. They are on project channels all day.
**Julien:** What should we avoid?
**Lead:** Another tool with another login. We tried a wiki in 2022 and it was empty by the summer.`,
      summary:
        "Structural discipline lead interview: monthly lunch-and-learns draw about 15 people; one of four structural channels is active and unanswered questions wait two days. Says a community needs someone with real hours to run it and promotion credit, and warns against another tool with another login.",
      entities: "structural discipline, lunch-and-learns, Teams channels, facilitator, promotion criteria, wiki",
    },
    {
      key: "int-early-career",
      title: "Group interview: early-career engineers",
      type: "call",
      method: ["stakeholder_interviews"],
      role: "frontline_staff",
      vendor: "granola",
      author: "moreau",
      section: "Field research",
      date: "2026-10-20",
      informs: ["midpoint"],
      body: `# Group interview: early-career engineers (0 to 5 years)
Attendees: Julien Moreau, Ngozi Achebe (Kestrel Bay), five engineers from civil, electrical and water

**Julien:** When you are stuck on a technical question, what do you do?
**Engineer (civil, 2 years):** Ask the person next to me. If they do not know, I search old project files. That can take half a day.
**Engineer (electrical, 4 years):** I message three people I know and hope one answers. Usually it is two or three days.
**Ngozi:** Have you used the expert directory?
**Engineer (water, 1 year):** Once. The person had moved to another office and did not cover that topic any more.
**Julien:** What would you want from a community?
**Engineer (electrical, 4 years):** Somewhere I can ask without feeling stupid, and where someone senior actually replies.
**Engineer (civil, 3 years):** Short sessions where someone walks through a real project. Not slides about a standard.
**Ngozi:** Does learning affect whether you stay?
**Engineer (water, 1 year):** Honestly, yes. Friends at other firms have mentors assigned. Here you find your own.`,
      summary:
        "Group interview with five early-career engineers: stuck questions mean searching old project files or waiting two to three days for replies; the directory sent one engineer to the wrong person. They want a safe place to ask, senior replies and short project walkthroughs, and say learning affects whether they stay.",
      entities: "early-career engineers, project files, expert directory, mentoring, retention",
    },
    {
      key: "research-chat",
      title: "Research: peer learning communities and platforms in engineering firms",
      type: "ai_thread",
      method: ["desk_research"],
      vendor: "claude",
      author: "moreau",
      section: "Field research",
      date: "2026-10-14",
      turns: [
        {
          role: "user",
          content:
            "I'm helping a 2,400-person engineering services firm design a peer learning community. Summarize what practitioner research says makes communities of practice last in technical firms, and what platform types firms use. Label every point FACT with a dated source type, or INFERENCE.",
        },
        {
          role: "assistant",
          content:
            "FACT (practitioner studies on communities of practice, 2023): communities with a named facilitator and a regular meeting rhythm sustain participation longer than those left to self-organize.\n\nFACT (knowledge management surveys, 2024): the most common reason internal Q&A spaces fail is slow or missing answers in the first weeks, which teaches people not to ask.\n\nFACT (vendor and analyst platform reviews, 2025): firms use three broad platform types: extending collaboration suites they already own, dedicated Q&A tools with expert routing, and full community platforms with events and content.\n\nINFERENCE: for a firm already on a collaboration suite, a pilot on existing tools isolates the effect of facilitation from the effect of a new platform.\n\nINFERENCE: linking contributions to recognition or promotion criteria is likely to matter more for senior engineers than any feature.",
        },
        {
          role: "user",
          content: "What do the sources disagree on? And can you add rough cost ranges per platform type?",
        },
        {
          role: "assistant",
          content:
            "Where sources disagree: vendor reviews claim dedicated tools double answer rates, but independent surveys find facilitation explains most of the difference. Treat vendor uplift figures as marketing.\n\nCost ranges (FACT, published list prices, 2025): dedicated Q&A tools are typically priced per user per month in the mid-teens to low twenties of dollars; community platforms are usually annual contracts in the low to mid six figures for a firm this size. Extending existing tools mainly costs configuration and facilitator time.\n\nINFERENCE: at 1,850 users, per-seat pricing makes a dedicated tool a six-figure annual decision, so the pilot should test whether it is needed at all.",
        },
        { role: "user", content: "Turn this into a short brief for the team with questions for the pilot." },
        {
          role: "assistant",
          content: "Done. The brief keeps the FACT and INFERENCE labels, the disagreement note and ends with four questions the pilot should answer.",
        },
      ],
      summary:
        "AI research chat on what keeps communities of practice alive in technical firms and the three platform types, labelled FACT or INFERENCE. Notes that vendor uplift claims conflict with independent surveys. Produced the peer learning research brief.",
      entities: "communities of practice, facilitation, Q&A tools, community platforms, collaboration suite, per-seat pricing",
    },
    {
      key: "research-brief",
      title: "Brief: what makes peer learning communities last",
      type: "document",
      method: ["desk_research"],
      vendor: "claude",
      author: "moreau",
      section: "Synthesis",
      date: "2026-10-14",
      madeFrom: "research-chat",
      informs: ["midpoint"],
      body: `# What makes peer learning communities last: team brief

**Facilitation (FACT, practitioner studies 2023):** communities with a named facilitator and a regular rhythm sustain participation longer than self-organized ones.

**First weeks decide it (FACT, knowledge management surveys 2024):** slow or missing early answers are the most common reason internal Q&A spaces fail.

**Three platform types (FACT, platform reviews 2025):** extend the collaboration suite, a dedicated Q&A tool with expert routing, or a full community platform.

**Pilot on what we own (INFERENCE):** running the pilot on Teams separates the effect of facilitation from the effect of a new tool.

**Recognition (INFERENCE):** promotion credit will matter more to senior engineers than features.

**Where sources disagree:** vendors claim dedicated tools double answer rates; independent surveys credit facilitation. We do not quote vendor uplift figures.

**Questions the pilot must answer**
1. Can we get a median first answer inside one working day?
2. Do senior engineers answer when a facilitator routes questions to them?
3. Do other offices join sessions, not just head office?
4. What does a facilitator actually spend per week?`,
      summary:
        "Team brief made from the research chat: facilitation and fast early answers keep communities alive; three platform types; pilot on Teams to isolate facilitation. Flags that vendor uplift claims are not to be quoted and sets four questions for the pilot.",
      entities: "facilitation, platform types, Teams pilot, recognition, vendor claims",
    },
    {
      key: "survey",
      title: "Engineer learning survey results",
      type: "sheet",
      method: ["survey"],
      vendor: "upload",
      author: "achebe",
      section: "Synthesis",
      date: "2026-10-28",
      informs: ["midpoint"],
      body: `# Engineer learning survey (fielded 14 to 26 October 2026)

Responses: 612 of 1,850 engineers (33%).

| Question | Result |
|---|---|
| I learn most from colleagues (agree) | 71% |
| I learn most from LMS courses (agree) | 12% |
| I often cannot find the right person to ask (agree) | 58% |
| Hours a week spent searching for information or people (mean) | 2.4 |
| I would answer questions from other offices if asked (agree) | 64% |
| Early-career (0 to 5 years) citing lack of learning as a top reason they might leave | 29% |
| Prefer a community inside Teams over a new tool | 68% |

Cuts by office and discipline are on the detail tab. Senior engineers (20+ years) are 9% of respondents, below their 14% share of headcount.`,
      summary:
        "Survey of 612 engineers (33 percent response): 71 percent learn most from colleagues against 12 percent from LMS courses, 58 percent often cannot find the right person, and engineers spend a mean of 2.4 hours a week searching. 29 percent of early-career respondents cite lack of learning as a top reason they might leave; 68 percent prefer a community inside Teams.",
      entities: "engineer survey, colleagues, LMS, search time, early-career retention, Teams",
    },
    {
      key: "pilot-tracker",
      title: "Pilot tracker: weeks 1 to 4",
      type: "sheet",
      method: ["data_analysis"],
      vendor: "upload",
      author: "achebe",
      section: "Pilot",
      date: "2026-11-13",
      informs: ["midpoint"],
      body: `# Pilot tracker (19 October to 13 November 2026)

| Measure | Geotechnical and foundations | Electrical grid connections | Total |
|---|---|---|---|
| Members joined | 86 | 64 | 150 |
| Offices represented | 9 | 7 | 10 |
| Questions posted | 67 | 45 | 112 |
| Median time to first answer (hours) | 3.8 | 4.9 | 4.2 |
| Answered within 24 hours | 82% | 74% | 79% |
| Weekly active members (week 4) | 61% | 53% | 58% |
| Live sessions held | 5 | 4 | 9 |
| Average session attendance | 34 | 27 | 31 |
| Facilitator hours per week (mean) | 5.5 | 6.0 | 5.75 |

Notes: weekly active means posted, replied or reacted in the week. Week 1 activity was inflated by launch posts; week 4 is the fairer read. Two questions in electrical went unanswered for more than three days.`,
      summary:
        "Four-week pilot tracker for the two communities: 150 members from 10 offices posted 112 questions, with a 4.2-hour median time to first answer and 79 percent answered within 24 hours. Weekly active members were 58 percent in week 4; nine live sessions averaged 31 attendees and facilitators spent about 5.75 hours a week.",
      entities: "pilot tracker, geotechnical, electrical grid connections, time to first answer, weekly active, facilitator hours",
    },
    {
      key: "platform-options",
      title: "Platform options: three-year cost comparison",
      type: "sheet",
      method: ["financial_model"],
      vendor: "upload",
      author: "moreau",
      section: "Pilot",
      date: "2026-11-11",
      informs: ["midpoint"],
      body: `# Platform options for 1,850 engineers (three-year view)

| | A: Extend Teams and SharePoint | B: Dedicated Q&A tool | C: Community platform |
|---|---|---|---|
| Setup and configuration | $40k | $55k | $60k |
| License per year | $0 (already owned) | $400k ($18 per user per month) | $210k |
| Facilitators (12 at 10% time) per year | $260k | $260k | $260k |
| Three-year total | $820k | $2.0M | $1.47M |
| Expert routing | Manual, by facilitator | Automatic | Partial |
| New login | No | Yes | Yes |

License prices are list prices from vendor quotes received 6 November; discounts not yet negotiated. Facilitator cost uses a loaded rate and assumes six disciplines with two facilitators each.`,
      summary:
        "Three-year cost comparison for 1,850 engineers: extending Teams and SharePoint costs $820k, a dedicated Q&A tool $2.0M ($400k a year in licenses) and a community platform $1.47M. Facilitator time of $260k a year is the same in every option; only the tools add a new login.",
      entities: "Teams, SharePoint, Q&A tool, community platform, license cost, facilitators",
    },
    {
      key: "midpoint",
      title: "Pilot readout: midpoint draft",
      type: "deck",
      method: ["synthesis"],
      vendor: "google_slides",
      author: "sorensen",
      section: "Synthesis",
      date: "2026-11-13",
      body: `## Slide 1
Hollisford community-led technical learning: pilot readout, midpoint draft for the 18 November review.

## Slide 2
Engineers learn from each other, not from the LMS: 71 percent say they learn most from colleagues, against 12 percent from courses.
Source: engineer learning survey (612 responses).

## Slide 3
The LMS is large and little used: 41 percent of 1,140 courses were not opened in the last year, and only 62 percent of engineers completed at least one course.
Source: learning diagnostic data.

## Slide 4
Hollisford spends $3.2M a year on learning, about $1,730 per engineer, mostly on content engineers do not open.
Source: learning diagnostic data.

## Slide 5
The real problem is finding people: 58 percent of engineers often cannot find the right person to ask. Engineers spend 6 hours a week searching for information or people.
Source: engineer learning survey.

## Slide 6
The tools meant to connect people have gone stale: 38 percent of expert directory entries date from 2023 or earlier and 71 percent of 230 technical Teams channels had no post in 90 days. The internal expert directory was last refreshed in 2021.
Source: learning diagnostic data, Chief Engineer interview.

## Slide 7
Knowledge is at risk: about 140 engineers are over 60, and two retirements last year stalled three projects.
Source: Chief Engineer interview, HR headcount.

## Slide 8
Early-career engineers feel it most: 29 percent cite lack of learning as a top reason they might leave, and unanswered questions wait two to three days.
Source: engineer learning survey, early-career group interview.

## Slide 9
The pilot worked where it mattered: 150 engineers from 10 offices joined and posted 112 questions in four weeks.
Source: pilot tracker.

## Slide 10
Answers now arrive the same day: median time to first answer was 4.2 hours and 79 percent of questions were answered within 24 hours. Weekly active participation in the pilot reached 74 percent.
Source: pilot tracker.

## Slide 11
Facilitation, not the tool, made the difference: the pilot ran on Teams, which 68 percent of engineers prefer to a new tool, and facilitators spent about 5.75 hours a week. Peer learning communities cut onboarding time for new engineers by 40 percent.
Source: pilot tracker, survey, research brief.

## Slide 12
Extending Teams and SharePoint is the right first platform: $820k over three years, against $2.0M for a dedicated Q&A tool and $1.47M for a community platform.
Source: platform options cost comparison.

## Slide 13
Recommendation: roll out to all six disciplines on Teams with two funded facilitators each, at a facilitator cost of $260k a year. The pilot will pay back its cost within nine months.
Source: platform options cost comparison.

## Slide 14
Decisions needed on 18 November: approve the six-discipline rollout on Teams, agree who funds facilitator hours, and add community contribution to promotion criteria.`,
      summary:
        "Midpoint draft of the pilot readout for the 18 November review, not yet shown. Argues engineers learn from colleagues not the LMS, that finding people is the real problem, and that the four-week pilot delivered same-day answers on Teams. Recommends a six-discipline rollout on Teams at $820k over three years with funded facilitators.",
      decisions: "Draft recommendation: extend Teams and SharePoint rather than buy a new tool",
      entities: "pilot readout, LMS, expert directory, Teams, facilitators, platform options, promotion criteria",
      unsupported: [
        "Engineers spend 6 hours a week searching for information or people.",
        "The internal expert directory was last refreshed in 2021.",
        "Weekly active participation in the pilot reached 74 percent.",
        "Peer learning communities cut onboarding time for new engineers by 40 percent.",
        "The pilot will pay back its cost within nine months.",
      ],
    },
  ],
  stickies: [
    { section: "Synthesis", text: "Partner: one number per headline, and every number must match the sheet it came from. No vendor uplift claims.", fill: "yellow" },
    { section: "Pilot", text: "Ops directors will ask who pays for facilitator hours. Answer it on the recommendation slide.", fill: "pink" },
    { section: "Final", text: "Readout 25 Nov with Chief Engineer and COO. Platform recommendation plus 90-day rollout plan.", fill: "blue" },
  ],
};
