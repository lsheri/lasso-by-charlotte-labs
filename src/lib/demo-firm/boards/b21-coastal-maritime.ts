import type { DemoBoard } from "../types";

/** Closed social impact board: repositioning a museum for sponsors and grants, with a toolkit the staff keep using. */
export const b21: DemoBoard = {
  key: "b21",
  practice: "Social impact",
  client: { name: "Coastal Maritime Museum", type: "nonprofit museum, working boatyard, $4.6M budget" },
  title: "Sponsorship and grant revenue",
  pattern: "Revenue diversification",
  shape: "phased",
  start: "2024-04-08",
  weeks: 8,
  fee: "$70k",
  status: "closed",
  sharedWithFirm: true,
  situation: "new_revenue",
  brief:
    "Individual giving at the museum has fallen for three years running and the development team of three cannot replace it alone. Reposition the museum so corporate sponsors and grant makers see more than a heritage attraction, prioritize which grants to chase, design sponsorship tiers and leave a toolkit the team can run without us.",
  team: ["mbeki", "ramaswamy", "galloway", "doyle"],
  sections: ["Assess", "Prioritize", "Build"],
  workstreams: ["Positioning assessment", "Grant prioritization", "Sponsorship tiers", "Toolkit"],
  items: [
    {
      key: "sow",
      title: "SOW: Coastal Maritime Museum sponsorship and grant revenue",
      type: "document",
      vendor: "google_docs",
      author: "ramaswamy",
      section: "Assess",
      date: "2024-04-01",
      body: `# Statement of work: sponsorship and grant revenue

**Client:** Coastal Maritime Museum  **Sponsor:** Executive Director  **Duration:** 8 weeks from 8 April 2024  **Fee:** $70,000 fixed, nonprofit rate, expenses included

## Objective
Grow the museum's corporate sponsorship and grant revenue from about $600,000 a year to $1.0M within two years, and leave the development team with tools to do it.

## Scope
1. Positioning assessment: how funders and sponsors see the museum today, and which of its programs carry the strongest case.
2. Grant prioritization: screen foundation, government and corporate grant prospects; build a 12-month calendar.
3. Sponsorship tiers: design packages, benefits and pricing for local and regional companies.
4. Toolkit: case for support, theory of change, sponsor deck, grant calendar and a one-page pitch.
5. 7 interviews with museum leaders, trustees, current and prospective sponsors and one program officer.

## Out of scope
Writing grant applications, donor database cleanup, capital campaign planning.

## Team
Partner (2 hours a week), manager (full time), consultant (full time), analyst (half time).

## Milestones
- Week 3: positioning findings
- Week 8: toolkit handover and board presentation`,
      summary:
        "Signed 8-week, $70k nonprofit-rate SOW for Coastal Maritime Museum to grow sponsorship and grant revenue from about $600k to $1.0M in two years. Covers positioning, grant prioritization, sponsorship tiers, a toolkit and 7 interviews; writing applications is out of scope.",
      decisions: "Nonprofit rate of $70k with expenses included\nGrant writing and database cleanup out of scope",
      entities: "Coastal Maritime Museum, Executive Director, sponsorship, grants, toolkit, nonprofit rate",
    },
    {
      key: "problem",
      title: "Problem definition worksheet",
      type: "document",
      vendor: "google_docs",
      author: "mbeki",
      section: "Assess",
      date: "2024-04-09",
      body: `# Problem definition

**Basic question:** How should the museum present itself and organize its development effort so that corporate sponsorship and grant revenue reach $1.0M a year by 2026?

**Situation:** The museum has a $4.6M budget, about 140,000 visitors a year and 22,000 school visits. It runs a working boatyard with a boatbuilding apprenticeship that trains 18 apprentices a year. Corporate sponsorship brings in about $180,000 and grants about $420,000.

**Complication:** Individual giving fell from $1.9M in 2021 to $1.4M in 2023 as long-time members age out. Sponsors see the museum as a nice local attraction, and the grant list is whatever the development director had time to apply for.

**Success looks like:** a case for support funders respond to, a prioritized grant calendar, three sponsorship tiers priced and tested, and a team that can run all of it.

**Stakeholders:** decides: Executive Director and board finance committee. Helps: development director, education director. Can block: trustees who worry that workforce and climate framing dilutes the heritage mission.

**Emerging hypotheses**
1. The apprenticeship and school programs are the museum's strongest funding story, not the collection.
2. Workforce and climate resilience funders are a better fit than arts funders.
3. Local maritime and marine businesses will sponsor programs rather than galleries.`,
      summary:
        "Problem definition in the firm template. Individual giving fell from $1.9M in 2021 to $1.4M in 2023; sponsorship is about $180k and grants about $420k. Hypotheses: the apprenticeship and school programs are the strongest story, workforce and climate funders fit better than arts funders, and sponsors prefer programs to galleries.",
      entities: "Coastal Maritime Museum, individual giving, apprenticeship, school visits, trustees, case for support",
    },
    {
      key: "research-chat",
      title: "Research: museum funding trends and funder fit",
      type: "ai_thread",
      method: ["desk_research"],
      vendor: "chatgpt",
      author: "galloway",
      section: "Grant prioritization",
      date: "2024-04-12",
      turns: [
        {
          role: "user",
          content:
            "I'm helping a small maritime museum with a working boatyard and apprenticeship program diversify revenue. Summarize trends in corporate sponsorship of museums, and which grant maker types fund workforce, STEM education and coastal resilience work that a museum could credibly do. Label FACT with dated generic sources, or INFERENCE.",
        },
        {
          role: "assistant",
          content:
            "Summary:\n\nFACT (nonprofit sector surveys, 2023): corporate support for cultural organizations has shifted from general sponsorship toward program-specific partnerships with measurable community outcomes.\n\nFACT (foundation giving reports, 2022 to 2023): workforce development and STEM education receive substantially more foundation funding than history museums as a category.\n\nFACT (government program notices, 2023): state and federal programs fund coastal resilience education and skilled trades training, often requiring a nonprofit or education partner.\n\nINFERENCE: a museum that trains boatbuilders and teaches coastal science can compete for workforce and resilience funding that arts-only museums cannot reach.\n\nINFERENCE: local marine businesses facing a skilled trades shortage have a direct reason to sponsor the apprenticeship.\n\nWhere sources disagree: some surveys show overall corporate giving to the arts recovering after 2021, others show it flat. The shift toward program funding appears in both.",
        },
        {
          role: "user",
          content: "Good. Write a brief that screens funder types for fit and suggests how to score individual grant prospects.",
        },
        {
          role: "assistant",
          content:
            "Done. The brief ranks five funder types by fit and proposes scoring each prospect on mission fit, award size, effort and odds, each from 1 to 5, keeping the FACT and INFERENCE labels.",
        },
      ],
      summary:
        "AI research chat on museum sponsorship trends and which grant makers fund workforce, STEM and coastal resilience work, labelled FACT or INFERENCE. Notes sources disagree on whether corporate arts giving is recovering. Produced the funder fit brief and scoring method.",
      entities: "corporate sponsorship, foundation giving, workforce development, STEM, coastal resilience, grant scoring",
    },
    {
      key: "funder-brief",
      title: "Brief: funder fit and grant scoring method",
      type: "document",
      method: ["desk_research"],
      vendor: "chatgpt",
      author: "galloway",
      section: "Grant prioritization",
      date: "2024-04-12",
      madeFrom: "research-chat",
      body: `# Funder fit and grant scoring

## Funder types ranked by fit
1. **Workforce and skilled trades funders** (FACT, foundation giving reports 2022 to 2023: well funded). Fit: apprenticeship.
2. **STEM education funders.** Fit: school programs, 22,000 visits a year.
3. **Coastal resilience programs** (FACT, government notices 2023: need nonprofit partners). Fit: shoreline and climate education.
4. **Local corporate foundations.** Fit: program sponsorship.
5. **Arts and humanities funders.** Fit: collection care; small awards, crowded field.

**What we infer (INFERENCE):** the museum's training and teaching work opens funding arts-only museums cannot reach.

**Where sources disagree:** corporate arts giving trend is contested; program funding shift is not.

## Scoring each prospect (1 to 5)
| Criterion | What a 5 looks like |
|---|---|
| Mission fit | funder priority names our program type |
| Award size | above $50,000 |
| Effort | short application, no match required |
| Odds | prior relationship or past award to a peer |

Prioritize prospects scoring 15 or more out of 20.`,
      summary:
        "Brief made from the research chat ranking five funder types by fit, with workforce and STEM funders ahead of arts funders. Sets a 1 to 5 scoring method on mission fit, size, effort and odds, prioritizing prospects at 15 or more out of 20.",
      entities: "funder fit, workforce funders, STEM funders, coastal resilience, grant scoring",
    },
    {
      key: "int-development",
      title: "Interview: Development director",
      type: "call",
      method: ["stakeholder_interviews"],
      role: "fundraising_leader",
      vendor: "granola",
      author: "mbeki",
      section: "Positioning assessment",
      date: "2024-04-16",
      informs: ["sponsor-deck"],
      body: `# Interview: Development director, Coastal Maritime Museum
Attendees: Ayanda Mbeki, Owen Galloway (Kestrel Bay), Development director

**Ayanda:** How do you decide which grants to apply for?
**Director:** Whatever lands in my inbox with a deadline I can make. Last year I wrote 21 applications and won 6. Most were small arts grants for $5,000 to $15,000.
**Owen:** How do sponsors see the museum?
**Director:** As the place their kids went on a field trip. Our sponsorship menu is a logo on the summer festival banner for $2,500 or $5,000. The biggest sponsor gives $40,000, and that is because their founder loves boats.
**Ayanda:** What do funders respond to when you talk about the boatyard?
**Director:** They light up. When I bring a program officer to the shop floor and they meet an apprentice, the conversation changes. But I never get to put that in writing, there is no case for support that leads with it.
**Owen:** What would help most?
**Director:** A list of the 10 or 12 grants worth my time, in date order. And a sponsor deck that does not start with the 1890s.`,
      summary:
        "Development director: wrote 21 applications last year and won 6, mostly small arts grants of $5,000 to $15,000. Sponsors see a field trip venue, the sponsorship menu tops out at festival banners, and the largest sponsor gives $40,000. Funders respond to the boatyard and apprentices, but no case for support leads with it.",
      decisions: "Toolkit to include a dated list of 10 to 12 priority grants",
      entities: "development director, grant applications, sponsorship menu, boatyard, apprentices, case for support",
    },
    {
      key: "int-sponsor",
      title: "Interview: Community relations head, regional marine services company",
      type: "call",
      method: ["customer_research"],
      role: "community_giving_leader",
      vendor: "granola",
      author: "galloway",
      section: "Sponsorship tiers",
      date: "2024-04-25",
      informs: ["sponsor-deck"],
      body: `# Interview: Head of community relations, regional marine services company (prospective sponsor)
Attendees: Owen Galloway, Rosa Doyle (Kestrel Bay), Head of community relations

**Owen:** What does your company look for in a sponsorship?
**Head:** A link to our business and something our people can be part of. We repair and maintain commercial vessels and we cannot hire enough marine technicians.
**Rosa:** Did you know the museum trains boatbuilding apprentices?
**Head:** I knew they had a boat shop. I did not know it was a training program. That changes the conversation completely.
**Owen:** What kind of package would interest you?
**Head:** Naming a cohort of apprentices, getting to meet them, maybe offering a placement. I would put $25,000 a year into that more easily than $5,000 into a festival banner.
**Rosa:** Over what term?
**Head:** Three years. I need to show my leadership it builds a pipeline, and one year does not.
**Owen:** Anything that would put you off?
**Head:** If it is just a logo. And if I cannot see what happened to the money at the end of the year.`,
      summary:
        "Prospective sponsor from a marine services company short of technicians: unaware the boat shop is a training program; would put $25,000 a year over three years into naming an apprentice cohort with placements, rather than $5,000 for a festival banner. Wants annual outcome reporting, not just a logo.",
      decisions: "Sponsorship tiers built around programs with three-year terms and outcome reports",
      entities: "marine services company, apprentice cohort, placements, three-year sponsorship, outcome reporting",
    },
    {
      key: "grant-calendar",
      title: "Grant prioritization and 12-month calendar",
      type: "sheet",
      method: ["outreach"],
      vendor: "upload",
      author: "doyle",
      section: "Grant prioritization",
      date: "2024-05-10",
      body: `# Grant prioritization (34 prospects screened, 12 prioritized at 15+ of 20)

| # | Funder type | Program fit | Score | Ask | Odds | Weighted | Deadline |
|---|---|---|---|---|---|---|---|
| 1 | State workforce board | Apprenticeship | 18 | $150,000 | 50% | $75,000 | Jul 2024 |
| 2 | Regional community foundation | School programs | 18 | $60,000 | 60% | $36,000 | Aug 2024 |
| 3 | Federal coastal education program | Resilience education | 17 | $200,000 | 30% | $60,000 | Sep 2024 |
| 4 | Marine industry trade foundation | Apprenticeship | 17 | $75,000 | 50% | $37,500 | Sep 2024 |
| 5 | STEM education foundation | School programs | 16 | $100,000 | 40% | $40,000 | Oct 2024 |
| 6 | Bank corporate foundation | Field trip fund | 16 | $40,000 | 60% | $24,000 | Oct 2024 |
| 7 | State humanities council | Collection care | 15 | $25,000 | 50% | $12,500 | Nov 2024 |
| 8 | Family foundation | Apprenticeship | 15 | $80,000 | 40% | $32,000 | Jan 2025 |
| 9 | State coastal program | Shoreline education | 15 | $120,000 | 35% | $42,000 | Feb 2025 |
| 10 | Utility community fund | Climate education | 15 | $50,000 | 50% | $25,000 | Mar 2025 |
| 11 | National maritime heritage fund | Vessel restoration | 15 | $90,000 | 35% | $31,500 | Apr 2025 |
| 12 | Local port authority | Apprenticeship | 15 | $60,000 | 50% | $30,000 | May 2025 |

**Total ask:** $1,050,000. **Weighted expected value:** $445,500, against $420,000 of grants won in 2023 from 21 applications. Twelve applications instead of 21, at roughly double the average award.`,
      summary:
        "Grant prioritization: 34 prospects screened, 12 prioritized at 15 or more out of 20, led by workforce and school program funders. Total ask $1.05M with weighted expected value of $445,500 from 12 applications, against $420k from 21 in 2023.",
      entities: "grant calendar, workforce board, community foundation, coastal education, weighted pipeline",
    },
    {
      key: "theory-of-change",
      title: "Theory of change: working waterfront learning",
      type: "document",
      method: ["synthesis"],
      vendor: "google_docs",
      author: "mbeki",
      section: "Toolkit",
      date: "2024-05-17",
      body: `# Theory of change: Coastal Maritime Museum as a working waterfront learning center

**Problem:** coastal communities are short of skilled marine trades workers, and young people rarely see the waterfront as a place to build a career or understand climate risk.

**Inputs:** working boatyard, master boatbuilders, collection, 22,000 school visits a year, waterfront site.

**Activities**
- Boatbuilding apprenticeship: 18 apprentices a year, two-year program.
- School programs: maritime science and coastal resilience field trips, grades 4 to 12.
- Public programs: restoration open days, shoreline walks.

**Outputs:** apprentices completing the program; students reached; sponsor and employer placements.

**Short-term outcomes:** apprentices gain certified skills; students can explain local coastal change.

**Long-term outcomes:** apprentices employed in regional marine trades; a pipeline of local talent for marine businesses; a community better prepared for coastal change.

**Measures for funders and sponsors:** completion rate, employment at 6 months, students reached by grade, pre and post knowledge checks.

**Assumptions to test:** employers will offer placements; schools will keep field trip time as budgets tighten.`,
      summary:
        "Theory of change repositioning the museum as a working waterfront learning center: inputs, apprenticeship and school activities, outcomes for apprentices, students and marine employers, and measures funders and sponsors can track.",
      entities: "theory of change, apprenticeship, school programs, coastal resilience, outcomes, measures",
    },
    {
      key: "sponsor-draft",
      title: "Sponsorship deck draft v1 (internal, not shown)",
      type: "deck",
      method: ["synthesis"],
      vendor: "google_slides",
      author: "galloway",
      section: "Sponsorship tiers",
      date: "2024-05-14",
      body: `## Slide 1
Partner with the Coastal Maritime Museum. Draft v1.

## Slide 2
Our history: founded in 1952 to preserve the region's seafaring heritage.

## Slide 3
Our collection: 4,000 objects and 11 historic vessels.

## Slide 4
Sponsorship levels: Gold $10,000, Silver $5,000, Bronze $2,500.

## Slide 5
Benefits: logo placement, event tickets, newsletter mention.

## Slide 6
Contact the development office.`,
      summary:
        "Internal first draft of the sponsor deck, never shown. Led with history and the collection and kept generic metal-named logo tiers, ignoring what the prospective sponsor said about programs and three-year terms. Partner review sent it back.",
      entities: "sponsor deck draft, history, collection, logo tiers",
    },
    {
      key: "sponsor-deck",
      title: "Sponsorship deck and tiers",
      type: "deck",
      method: ["synthesis"],
      vendor: "google_slides",
      author: "mbeki",
      section: "Build",
      date: "2024-05-24",
      shown: [
        { on: "2024-05-29", occasion: "Final readout" },
        { on: "2024-06-18", occasion: "Board pre-read" },
      ],
      body: `## Slide 1
Build the waterfront workforce with the Coastal Maritime Museum. Sponsorship partnerships 2024 to 2027.

## Slide 2
The museum trains 18 boatbuilding apprentices a year and teaches 22,000 school children about the coast.
Source: problem definition, theory of change.

## Slide 3
Marine businesses cannot hire enough technicians, and sponsors want to back a pipeline they can see.
Source: prospective sponsor interview.

## Slide 4
Harbor partner, $50,000 a year for three years: name an apprentice cohort, offer placements, receive an annual outcomes report.
Source: sponsor interview, theory of change.

## Slide 5
Navigator, $25,000 a year for three years: sponsor the school field trip fund or a shoreline education season.

## Slide 6
Deckhand, $10,000 a year: sponsor a restoration open day and meet the apprentices.

## Slide 7
Every partner gets a year-end report on completion, employment and students reached.
Source: theory of change measures.

## Slide 8
Twelve prioritized grants worth $445,500 in expected value, plus four Harbor or Navigator partners, take the museum past $1.0M by 2026.
Source: grant calendar, sponsorship tiers.`,
      summary:
        "Final sponsorship deck shown at the readout on 29 May 2024 and as the June board pre-read. Leads with apprentices and school programs, sets Harbor ($50k), Navigator ($25k) and Deckhand ($10k) tiers on three-year terms with outcome reports, and shows the path past $1.0M by 2026 with the grant calendar.",
      decisions: "Board approved the three program-based sponsorship tiers\nDevelopment director to pitch two Harbor prospects by September",
      entities: "sponsorship tiers, Harbor partner, Navigator, Deckhand, apprentices, outcomes report, board pre-read",
    },
    {
      key: "partner-notes",
      title: "Partner review notes on sponsor deck draft v1",
      type: "document",
      vendor: "upload",
      author: "ramaswamy",
      section: "Sponsorship tiers",
      date: "2024-05-15",
      body: `# Partner review: sponsor deck draft v1

- The sponsor we interviewed told us what he would buy: a named apprentice cohort, placements, three years, a report. The draft sells him a logo. Start again from his words.
- Lead with apprentices and school children, not 1952. History goes on the last slide if anywhere.
- Name tiers after the waterfront, not metals; price the top tier at $50,000 because a $25,000 offer was volunteered unprompted.
- Every tier needs a measurable outcome the museum already tracks or can track by year end.
- Titles must say the finding. A trustee should get the case from the titles alone.`,
      summary:
        "Partner review of the sponsor draft: rebuild around what the interviewed sponsor said he would buy, lead with apprentices and students, rename and reprice tiers with a $50,000 top tier, attach a measurable outcome to each tier, and write titles as findings.",
      decisions: "Top tier priced at $50,000\nTiers tied to programs and outcomes, not logos\nFull-sentence finding titles",
      entities: "partner review, sponsor deck, apprentice cohort, tier pricing, outcomes",
    },
  ],
  stickies: [
    { section: "Build", text: "Dev: a trustee should get the whole case from the slide titles alone.", fill: "yellow" },
    { section: "Positioning assessment", text: "Funders light up at the boatyard; lead with apprentices, not the collection", fill: "green" },
  ],
  outcome: {
    ranToPlan: false,
    extended: false,
    lesson: "Two trustees resisted the workforce framing and the board slot moved three weeks; meeting them one to one in week 2 would have saved the delay.",
  },
};
