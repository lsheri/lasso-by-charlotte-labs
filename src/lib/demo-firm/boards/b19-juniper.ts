import type { DemoBoard } from "../types";

/** Closed research-led board: employer value proposition for Gen Z frontline staff, extended into hiring diagnostics. */
export const b19: DemoBoard = {
  key: "b19",
  practice: "Growth and marketing",
  client: { name: "Juniper Parks and Resorts", type: "family entertainment brand, 70 years old, 6 parks and 2 resorts" },
  title: "Employer value proposition for Gen Z",
  pattern: "Culture and talent revitalization",
  shape: "research",
  start: "2024-08-12",
  weeks: 12,
  fee: "$250k",
  status: "closed",
  sharedWithFirm: true,
  situation: "talent",
  brief:
    "Juniper's turnover is rising for the first time in its history, and young staff are leaving for warehouse, delivery and tech jobs. Understand what Gen Z frontline employees want from work, rebuild the employer value proposition around it, and redesign hiring and early-tenure incentives, in time for the 2025 seasonal hiring campaign.",
  team: ["castellano", "ramaswamy", "eriksen", "costa"],
  sections: ["Plan", "Field research", "Synthesis", "Co-design", "Final"],
  items: [
    {
      key: "sow",
      title: "SOW: Juniper employer value proposition",
      type: "document",
      vendor: "google_docs",
      author: "ramaswamy",
      section: "Plan",
      date: "2024-08-05",
      body: `# Statement of work: employer value proposition for Gen Z

**Client:** Juniper Parks and Resorts  **Sponsor:** Chief People Officer  **Duration:** 12 weeks from 12 August 2024  **Fee:** $250,000 fixed, plus expenses capped at 9% (park travel)

## Objective
Rebuild Juniper's employer value proposition for Gen Z frontline employees and recommend hiring and early-tenure changes ready for the January 2025 seasonal hiring campaign.

## Scope
1. Values diagnostic: what Juniper says about working there, and what employees experience.
2. Employee research: 16 in-depth interviews with frontline staff, leavers and managers, plus field observation at 4 parks.
3. Synthesis: themes, insight statements, personas and an employee journey from application to second season.
4. Co-design: one workshop with frontline employees to shape the value proposition.
5. Value proposition, hiring and incentive recommendations, and a communications plan.

## Out of scope
Pay benchmarking (Juniper's compensation team owns it), recruitment advertising creative, HR system changes.

## Team
Partner (0.5 day a week), principal (full time), consultant (full time), analyst (full time).

## Milestones
- Week 2: research plan approved
- Week 7: synthesis readout (midpoint review)
- Week 12: final value proposition and hiring recommendations`,
      summary:
        "Signed 12-week, $250k fixed-fee SOW to rebuild Juniper's employer value proposition for Gen Z frontline staff. Covers a values diagnostic, 16 interviews and 4 park visits, synthesis, a co-design workshop, and hiring, incentive and communications recommendations for the January 2025 campaign.",
      decisions: "Fixed fee of $250k with expenses capped at 9%\nPay benchmarking stays with Juniper's compensation team",
      entities: "Juniper Parks and Resorts, Chief People Officer, employer value proposition, Gen Z, seasonal hiring",
    },
    {
      key: "problem",
      title: "Problem definition and research plan",
      type: "document",
      vendor: "google_docs",
      author: "castellano",
      section: "Plan",
      date: "2024-08-14",
      body: `# Problem definition and research plan

**Basic question:** What must Juniper offer, say and change so that Gen Z frontline employees join, stay through a full season and come back for a second, starting with the 2025 hiring campaign?

**Situation:** Juniper employs about 4,200 year-round staff and hires about 11,000 seasonal staff a year. People aged 18 to 27 make up 58 percent of seasonal hires.

**Complication:** Year-round voluntary turnover rose from 19 percent in 2021 to 27 percent in 2023. The share of first-year seasonal staff who return for a second season fell from 48 percent to 31 percent. Exit surveys point to schedules, pay and growth, but the current value proposition talks about "family" and "magic".

**Success looks like:** a value proposition frontline staff recognize as true, and a measurable lift in second-season return rate in 2025.

**Stakeholders:** decides: Chief People Officer and COO. Helps: park general managers, talent acquisition lead. Can block: park general managers, if scheduling changes add cost.

**Emerging hypotheses**
1. Schedule predictability matters more to Gen Z staff than an extra dollar an hour.
2. Staff join for the brand but leave because of their direct manager.
3. Skills that transfer to a next job are a stronger draw than the promise of a career at Juniper.

## Research plan
- 16 interviews: 8 current Gen Z frontline staff, 4 recent leavers, 4 managers.
- Field observation at 4 parks across opening, peak and close.
- Recruiting screener via park HR; leavers recruited from exit survey opt-ins.`,
      summary:
        "Problem definition and research plan. Juniper hires about 11,000 seasonal staff, 58 percent aged 18 to 27; year-round turnover rose from 19 to 27 percent and second-season return fell from 48 to 31 percent. Plans 16 interviews and 4 park visits to test hypotheses on schedules, managers and transferable skills.",
      entities: "Juniper, turnover, second-season return, Gen Z, park general managers, research plan",
    },
    {
      key: "research-chat",
      title: "Research: what Gen Z frontline workers want from work",
      type: "ai_thread",
      method: ["desk_research"],
      vendor: "claude",
      author: "costa",
      section: "Plan",
      date: "2024-08-16",
      turns: [
        {
          role: "user",
          content:
            "I'm preparing interviews for a theme park operator losing young frontline staff to warehouses, delivery and tech. Summarize what is known about what Gen Z hourly workers value in a job and why they leave. Label FACT with dated generic sources, or INFERENCE.",
        },
        {
          role: "assistant",
          content:
            "Summary:\n\nFACT (hourly workforce surveys, 2023): schedule control and advance notice of shifts rank near the top of what younger hourly workers value, alongside pay.\n\nFACT (labor market reports, 2022 to 2023): warehouse and delivery employers raised starting wages and offered app-based shift picking, which competes directly with hospitality for the same workers.\n\nFACT (employee engagement studies, 2023): early-tenure attrition in frontline roles is strongly linked to the quality of the first manager relationship.\n\nINFERENCE: a theme park cannot win on pay alone against warehouses, but can win on experience, belonging and skills if those are real and visible.\n\nINFERENCE: younger workers may value credentials they can show a future employer more than internal career ladders.\n\nWhere sources disagree: surveys differ on whether pay or flexibility ranks first. The answer seems to depend on whether respondents already have a second job.",
        },
        { role: "user", content: "Turn this into a short brief with interview probes for each point." },
        {
          role: "assistant",
          content:
            "Done. The brief keeps FACT and INFERENCE labels and adds probes on shift notice, first manager, what they would put on a resume, and what a warehouse job offers that Juniper does not.",
        },
      ],
      summary:
        "AI research chat on what Gen Z hourly workers value and why they leave, labelled FACT or INFERENCE: schedule control, competition from warehouses and delivery, and the first manager. Notes surveys disagree on pay versus flexibility. Produced the interview probes brief.",
      entities: "Gen Z, hourly workers, schedule control, warehouse jobs, first manager, credentials",
    },
    {
      key: "research-brief",
      title: "Brief: Gen Z frontline work expectations and interview probes",
      type: "document",
      method: ["desk_research"],
      vendor: "claude",
      author: "costa",
      section: "Plan",
      date: "2024-08-16",
      madeFrom: "research-chat",
      body: `# Gen Z frontline work expectations: brief and probes

**Schedules (FACT, hourly workforce surveys 2023):** schedule control and advance notice rank near the top with pay.
Probe: How far ahead do you know your shifts? What happens when they change?

**Competition (FACT, labor market reports 2022 to 2023):** warehouses and delivery raised starting pay and offer app-based shift picking.
Probe: What would a warehouse job give you that this one does not?

**First manager (FACT, engagement studies 2023):** early-tenure attrition tracks the first manager relationship.
Probe: Tell me about your first week and your first lead.

**Our view (INFERENCE):** Juniper cannot win on pay alone; it can win on belonging and skills if they are real.

**Credentials (INFERENCE):** visible, transferable skills may beat an internal ladder.
Probe: What from this job would you put on a resume?

**Where sources disagree:** pay versus flexibility ranking depends on whether workers hold a second job. Ask every participant about other jobs.`,
      summary:
        "Interview probes brief made from the research chat, covering schedules, competition from warehouses, the first manager and transferable credentials, with FACT and INFERENCE labels. Asks every participant about second jobs because sources disagree on pay versus flexibility.",
      entities: "interview probes, schedules, warehouse competition, first manager, credentials",
    },
    {
      key: "int-ride-operator",
      title: "Interview: Seasonal ride operator, second season",
      type: "call",
      method: ["customer_research"],
      role: "frontline_staff",
      vendor: "granola",
      author: "eriksen",
      section: "Field research",
      date: "2024-08-29",
      informs: ["evp-final"],
      body: `# Interview: Seasonal ride operator, age 20, second season
Attendees: Nora Eriksen, Beatriz Costa (Kestrel Bay), Ride operator

**Nora:** Why did you come back for a second season?
**Ride operator:** My crew. Honestly that is it. My lead last year was great and half of us came back together.
**Beatriz:** How far ahead do you know your shifts?
**Ride operator:** About four days. Sometimes they post Sunday night for Monday. My friend at the warehouse picks her shifts on an app two weeks out. That is the one thing I am jealous of.
**Nora:** Do you have another job?
**Ride operator:** Weekends at a coffee shop in the off season. During summer just this, but I cannot plan anything else.
**Beatriz:** What from this job would you put on a resume?
**Ride operator:** Safety stuff, I guess. I do evacuation drills and I trained six new people this year. But it is not written down anywhere, so it is hard to say.
**Nora:** What would make you leave?
**Ride operator:** A bad lead. I saw people quit in week two because their lead yelled at them in front of guests.`,
      summary:
        "Seasonal ride operator, age 20: came back because of the crew and a good lead; shifts are posted about four days ahead while a warehouse friend picks shifts two weeks out on an app. Trains new staff and runs safety drills but has nothing written down to show employers. A bad lead is the main reason people quit early.",
      entities: "seasonal staff, crew, shift notice, warehouse, safety training, first lead",
    },
    {
      key: "int-park-gm",
      title: "Interview: Park general manager",
      type: "call",
      method: ["stakeholder_interviews"],
      role: "general_manager",
      vendor: "granola",
      author: "castellano",
      section: "Field research",
      date: "2024-09-04",
      informs: ["evp-final"],
      body: `# Interview: General manager, Juniper's largest park
Attendees: Lucia Castellano, Nora Eriksen (Kestrel Bay), Park general manager

**Lucia:** What has changed in staffing over the last three years?
**GM:** We used to rehire nearly half our seasonal staff. Now it is under a third. I spend May hiring people I trained last May, except they are new people.
**Nora:** Why do you think they leave?
**GM:** Pay is part of it. The distribution center down the highway pays two dollars more. But the exit interviews I sit in, it is usually the schedule or their lead.
**Lucia:** Could you post schedules two weeks out?
**GM:** For about 80 percent of shifts, yes. Weather and group bookings make the rest unpredictable. What I cannot do is promise every shift two weeks out and then call people off when it rains.
**Nora:** What do your leads get trained on?
**GM:** Operations and safety. Nothing on how to manage a 19-year-old in their first week. Most of my leads were promoted because they were good operators.
**Lucia:** What would you want from this project?
**GM:** Something true. The posters say "join the family". The kids laugh at that.`,
      summary:
        "Largest park GM: seasonal rehire fell from nearly half to under a third; leavers cite schedule and their lead more than pay, though a nearby distribution center pays two dollars more. Could post about 80 percent of shifts two weeks out. Leads get no people management training, and staff laugh at the 'join the family' posters.",
      decisions: "Two-week schedule promise limited to a core share of shifts, not all",
      entities: "park general manager, seasonal rehire, schedules, leads, distribution center, family messaging",
    },
    {
      key: "synthesis",
      title: "Synthesis: themes coded across 16 interviews",
      type: "sheet",
      method: ["synthesis"],
      vendor: "upload",
      author: "costa",
      section: "Synthesis",
      date: "2024-09-20",
      body: `# Interview synthesis (16 interviews, 4 park visits)

| Theme | Current staff (8) | Leavers (4) | Managers (4) | Total (16) | Insight statement |
|---|---|---|---|---|---|
| Shift notice too short | 7 | 4 | 3 | 14 | "I can't plan a life around four days' notice." |
| First lead made or broke the season | 6 | 3 | 4 | 13 | "I stayed for my crew, not the company." |
| Skills invisible to future employers | 6 | 2 | 1 | 9 | "I trained six people and have nothing to show for it." |
| Pay gap to warehouse and delivery | 4 | 4 | 4 | 12 | "They pay more, but I'd rather be here." |
| Brand pride is real | 7 | 2 | 4 | 13 | "Families remember us. That matters to me." |
| "Family" messaging rings false | 5 | 3 | 2 | 10 | "Family doesn't call you off when it rains." |

## Personas
- **The returner:** stays for crew and pride, leaves if the lead changes.
- **The stacker:** holds two jobs, chooses whichever gives shifts earliest.
- **The builder:** sees the job as a step, wants proof of skills.

## How Might We
- How might we give most shifts two weeks' notice without breaking weather flexibility?
- How might we make every first lead good at week one?
- How might we turn park skills into credentials a future employer recognizes?`,
      summary:
        "Synthesis of 16 interviews and 4 park visits: short shift notice (14 of 16), the first lead (13 of 16) and brand pride (13 of 16) dominate, with pay gap at 12 and invisible skills at 9. Three personas and three How Might We questions frame the co-design.",
      entities: "synthesis, themes, insight statements, personas, How Might We, shift notice, first lead",
    },
    {
      key: "codesign-notes",
      title: "Co-design workshop notes",
      type: "document",
      method: ["workshop"],
      vendor: "google_docs",
      author: "eriksen",
      section: "Co-design",
      date: "2024-10-03",
      body: `# Co-design workshop, 2 October 2024 (22 frontline employees, 3 parks)

## What we tested
Three value proposition directions, each on one card: "Your crew, your season", "Skills that go with you" and "Plan your life, we'll plan your shifts".

## What happened
- "Plan your life" got the strongest reaction. Votes: 15 of 22 put it first.
- "Skills that go with you" was second; several asked whether it would be a real certificate or a poster.
- "Your crew" felt nice but obvious; people said it describes what already happens despite Juniper, not because of it.

## What participants built
- A **skills passport**: a card listing certified skills (safety lead, guest recovery, trainer), signed by the park, usable on a resume.
- A **two-week core schedule** rule: 80 percent of shifts posted two weeks out, the rest as optional pickups through an app.
- A **first-week buddy** paired with every new hire, chosen by the lead.

## Quotes
- "If you give me the schedule, I'll give you the summer."
- "Put the certificate in my hand on my last day."`,
      summary:
        "Co-design workshop with 22 frontline employees: 'Plan your life, we'll plan your shifts' ranked first for 15 of 22. Participants built a skills passport, a two-week core schedule rule covering 80 percent of shifts, and a first-week buddy.",
      decisions: "Lead the value proposition with schedule predictability\nSkills passport must be a real certificate",
      entities: "co-design workshop, skills passport, two-week core schedule, first-week buddy, value proposition",
    },
    {
      key: "evp-draft",
      title: "EVP deck draft v1 (internal, not shown)",
      type: "deck",
      method: ["synthesis"],
      vendor: "google_slides",
      author: "castellano",
      section: "Co-design",
      date: "2024-10-11",
      body: `## Slide 1
Juniper employer value proposition: draft v1.

## Slide 2
Our new EVP: "Make the magic, build your future."

## Slide 3
Four pillars: magic, family, growth, rewards.

## Slide 4
Messaging house and taglines for each pillar.

## Slide 5
Campaign creative directions.

## Slide 6
Next steps: brand team to develop creative.`,
      summary:
        "Internal first draft of the EVP deck, never shown to the client. Kept 'magic' and 'family' as pillars and jumped to taglines and creative, without the schedule and lead changes the research pointed to. Partner review sent it back.",
      entities: "EVP draft, pillars, messaging house, creative",
    },
    {
      key: "partner-notes",
      title: "Partner review notes on EVP draft v1",
      type: "document",
      vendor: "upload",
      author: "ramaswamy",
      section: "Co-design",
      date: "2024-10-14",
      body: `# Partner review: EVP draft v1

- The research says "family" rings false to 10 of 16 people and the workshop told us the same. It cannot be a pillar.
- An EVP is a promise, so lead with what changes on the ground: the two-week core schedule, the skills passport, lead training. The tagline comes last.
- Every promise needs an owner and a cost, or the GMs will block it. Put the 80 percent schedule rule on a slide with the GM's own words.
- Use the insight statements as slide titles where we can. They are stronger than anything we would write.
- Show the second-season return rate as the measure of success, with the 2023 baseline of 31 percent.`,
      summary:
        "Partner review of EVP draft v1: drop 'family' as a pillar since 10 of 16 found it false, lead with operational changes rather than taglines, give each promise an owner and cost, and measure success by second-season return against the 31 percent baseline.",
      decisions: "Drop 'family' as a pillar\nLead with schedule, skills passport and lead training\nMeasure success by second-season return rate",
      entities: "partner review, EVP, schedule rule, skills passport, second-season return",
    },
    {
      key: "evp-final",
      title: "Final: Gen Z employer value proposition and hiring plan",
      type: "deck",
      method: ["synthesis"],
      vendor: "google_slides",
      author: "castellano",
      section: "Final",
      date: "2024-10-31",
      shown: [
        { on: "2024-11-01", occasion: "Final readout" },
        { on: "2024-11-12", occasion: "Board pre-read" },
      ],
      body: `## Slide 1
Juniper Parks and Resorts: a value proposition Gen Z staff will believe. Final readout, 1 November 2024.

## Slide 2
Juniper's promise to frontline staff should be "Plan your life, we'll plan your shifts", backed by three changes in place for the 2025 season.

## Slide 3
Only 31 percent of first-year seasonal staff came back in 2023, down from 48 percent.
Source: problem definition, HR data.

## Slide 4
"I can't plan a life around four days' notice": 14 of 16 people we interviewed raised shift notice.
Source: interview synthesis.

## Slide 5
"I stayed for my crew, not the company": the first lead made or broke the season for 13 of 16.
Source: interview synthesis, park GM interview.

## Slide 6
Change 1: post 80 percent of shifts two weeks ahead, with the rest as optional app pickups.
Source: park GM interview, co-design workshop.

## Slide 7
Change 2: a skills passport with certified skills staff can put on a resume.
Source: ride operator interview, co-design workshop.

## Slide 8
Change 3: people-leadership training for every lead and a first-week buddy for every new hire.
Source: interview synthesis, co-design workshop.

## Slide 9
Target: lift second-season return from 31 percent to 40 percent in 2025, tracked monthly by park.`,
      summary:
        "Final EVP deck shown on 1 November 2024 and used as a board pre-read. Promise: 'Plan your life, we'll plan your shifts', backed by an 80 percent two-week schedule rule, a skills passport and lead training with a first-week buddy, targeting second-season return of 40 percent from 31.",
      decisions: "COO approved the two-week core schedule rule for 2025\nSkills passport approved for pilot at two parks\nFollow-on engagement on hiring diagnostics agreed",
      entities: "final readout, employer value proposition, skills passport, schedule rule, lead training, second-season return",
    },
  ],
  stickies: [
    { section: "Final", text: "Dev: use the employees' insight statements as slide titles where they are stronger than ours.", fill: "yellow" },
    { section: "Synthesis", text: "Family messaging rings false: 10 of 16", fill: "pink" },
  ],
  outcome: {
    ranToPlan: true,
    extended: true,
    lesson: "The co-design workshop rescued the value proposition from a creative-led draft; GMs signed up once the schedule rule used their own 80 percent figure. Extended for six weeks on hiring diagnostics.",
  },
};
