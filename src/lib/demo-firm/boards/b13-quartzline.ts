import type { DemoBoard } from "../types";

/** Phased board, not shared with the firm: the privacy fixture. Product cycle reset at a fabless chip company. */
export const b13: DemoBoard = {
  key: "b13",
  practice: "Operating model and strategy ops",
  client: { name: "Quartzline Semiconductors", type: "fabless semiconductor company, 1,300 staff, three product lines" },
  title: "Product cycle modernization",
  pattern: "Product cycle reset",
  shape: "phased",
  start: "2025-03-10",
  weeks: 14,
  fee: "$310k",
  status: "closed",
  sharedWithFirm: false,
  brief:
    "Two years of cost cutting left Quartzline's product teams defining chips from internal roadmaps with little customer input, and tape-out dates slip by months. Baseline how product definition and scheduling work today with the engineers who run them, then reset product definition, schedule setting and innovation milestones with input from customers and ecosystem partners.",
  team: ["voss", "lindqvist", "achebe"],
  sections: ["Baseline", "Define", "Schedule", "Embed"],
  workstreams: ["SME baseline", "Product definition", "Schedule setting", "Innovation milestones"],
  items: [
    {
      key: "sow",
      title: "SOW: Quartzline product cycle modernization",
      type: "document",
      vendor: "google_docs",
      author: "lindqvist",
      section: "Baseline",
      date: "2025-03-03",
      body: `# Statement of work: product cycle modernization

**Client:** Quartzline Semiconductors  **Sponsor:** Chief Operating Officer  **Duration:** 14 weeks from 10 March 2025  **Fee:** $310,000 fixed, expenses capped at 7%

## Objective
Reset how Quartzline defines products, sets schedules and protects innovation work, so that new chips reflect customer demand and tape-out dates hold.

## Scope
1. SME baseline: interviews with 12 to 15 engineering, product and operations leads; schedule history for programs taped out since 2020.
2. Product definition: a market requirements process with structured customer and ecosystem partner input.
3. Schedule setting: a commit process with confidence levels and gate reviews.
4. Innovation milestones: a protected budget and review cadence for early-stage work.
5. Operating recommendations and a 6-month adoption plan.

## Out of scope
Headcount reductions, EDA tool selection, foundry negotiations.

## Team
Partner (0.5 day a week), principal (full time), analyst (full time).

## Milestones
- Week 5: baseline findings (SteerCo 1)
- Week 10: draft operating recommendations (SteerCo 2)
- Week 14: final recommendations and adoption plan (final readout)`,
      summary:
        "Signed 14-week, $310k fixed-fee SOW to modernize Quartzline's product cycle. Covers an SME baseline with 12 to 15 interviews and schedule history since 2020, product definition, schedule setting, innovation milestones and an adoption plan. Headcount, EDA tools and foundry terms are out of scope.",
      decisions: "Fixed fee of $310k with expenses capped at 7%\nHeadcount reductions explicitly out of scope",
      entities: "Quartzline Semiconductors, COO, tape-out, market requirements, gate reviews, innovation budget",
    },
    {
      key: "problem",
      title: "Problem definition worksheet",
      type: "document",
      vendor: "google_docs",
      author: "voss",
      section: "Baseline",
      date: "2025-03-12",
      body: `# Problem definition

**Basic question:** How should Quartzline define products and set schedules so that the next six programs are specified with customer input and tape out within four weeks of their committed date, starting with the FY2026 roadmap?

**Situation:** Three product lines (power management, sensor interfaces, connectivity). Eighteen programs taped out since 2020. Engineering headcount down 14 percent since 2023 after two cost programs.

**Complication:** Product definition happens inside engineering from internal roadmaps. Customer input arrives late, usually through field applications engineers after specs are frozen. Schedules are set top down and slip; innovation work is the first thing cut when a program runs late.

**Success looks like:** a definition process product line directors own, schedules the COO can commit to customers, and a protected slice of engineering time for early work.

**Stakeholders:** decides: COO and CEO. Helps: SVP Engineering, product line directors, VP Sales. Can block: SVP Engineering if the process reads as a cost exercise.

**Emerging hypotheses**
1. Slips start at definition: late spec changes drive most of the delay.
2. Committing a date with a confidence level will reduce slips more than tighter tracking.
3. Innovation needs its own budget line or it will keep being raided.`,
      summary:
        "Problem definition in the firm template. Basic question: define the next six programs with customer input and tape out within four weeks of commit, from the FY2026 roadmap. Notes engineering headcount down 14 percent since 2023 and late customer input; flags the SVP Engineering as a possible blocker.",
      entities: "Quartzline, COO, CEO, SVP Engineering, product line directors, field applications engineers, tape-out",
    },
    {
      key: "int-svp-eng",
      title: "Interview: SVP Engineering",
      type: "call",
      vendor: "granola",
      author: "voss",
      section: "SME baseline",
      date: "2025-03-19",
      informs: ["baseline"],
      body: `# Interview: SVP Engineering, Quartzline Semiconductors
Attendees: Anika Voss (Kestrel Bay), Ngozi Achebe (Kestrel Bay), SVP Engineering

**Anika:** Why do schedules slip?
**SVP:** Because the spec moves. We freeze it, then sales comes back with a customer who needs a different package or another interface, and we reopen it. On the last power management part we reopened the spec four times after freeze.
**Ngozi:** How are dates set?
**SVP:** Top down. The roadmap says Q3, so the date is Q3. Nobody asks my leads how confident they are.
**Anika:** What happened to innovation work after the cuts?
**SVP:** It became evenings. We used to hold about 15 percent of design time for exploratory blocks. Now it is close to zero, because every late program pulls people off it.
**Ngozi:** Who should own product definition?
**SVP:** Product line directors, with engineering in the room. But they need customer data before the spec, not after.
**Anika:** What would make you back this work?
**SVP:** If it is not another headcount exercise. My people have been through two of those.`,
      summary:
        "SVP Engineering interview: slips start when specs reopen after freeze, four times on the last power management part. Dates are set top down with no confidence check. Exploratory design time fell from about 15 percent to near zero. Supports product line directors owning definition if it is not a headcount exercise.",
      entities: "SVP Engineering, spec freeze, power management, schedule setting, innovation time, product line directors",
    },
    {
      key: "int-pld",
      title: "Interview: Product line director, sensor interfaces",
      type: "call",
      vendor: "granola",
      author: "achebe",
      section: "Product definition",
      date: "2025-03-26",
      informs: ["baseline"],
      body: `# Interview: Product line director, sensor interfaces
Attendees: Ngozi Achebe, Anika Voss (Kestrel Bay), Product line director

**Ngozi:** How does a new sensor interface part get defined today?
**Director:** Engineering proposes a next-generation part based on the last one. I write a market requirements document afterwards, mostly to justify it.
**Anika:** Where does customer input come in?
**Director:** Through the field applications engineers, once samples exist. By then the spec is frozen. Two of our last three parts needed a respin for features customers had asked for a year earlier.
**Ngozi:** What about ecosystem partners, the reference design houses and module makers?
**Director:** We used to run an annual partner day. It was cut in 2023. Our competitors still do theirs.
**Anika:** If you owned definition, what would you change first?
**Director:** Ten structured customer conversations before any spec, and a partner review at the concept gate. I would also want sales to stop promising features after freeze.`,
      summary:
        "Sensor interfaces product line director interview: definition starts in engineering and the market requirements document is written after the fact. Two of the last three parts needed a respin for features customers had asked for. Wants ten customer conversations before any spec and a partner review at the concept gate.",
      entities: "product line director, market requirements document, field applications engineers, respin, ecosystem partners, concept gate",
    },
    {
      key: "research-chat",
      title: "Research: product definition and schedule practices in fabless semiconductors",
      type: "ai_thread",
      vendor: "chatgpt",
      author: "achebe",
      section: "Product definition",
      date: "2025-03-21",
      turns: [
        {
          role: "user",
          content:
            "For a fabless semiconductor company with three product lines, summarize public sources on how chip companies run product definition, gate reviews and schedule commitments, and how they protect exploratory work. Label each point FACT with a dated source type, or INFERENCE.",
        },
        {
          role: "assistant",
          content:
            "FACT (industry conference papers and product management guides, 2022 to 2024): many chip companies use a staged process with a concept gate, a specification freeze and a tape-out readiness review, with a market requirements document approved before architecture work starts.\n\nFACT (engineering management literature, 2023): late specification changes are one of the most cited causes of tape-out delay and respins.\n\nFACT (company investor materials, 2023 to 2024): several semiconductor firms describe early design-in work with lead customers and reference design partners as part of definition.\n\nINFERENCE: committing dates with a stated confidence level and a re-commit at specification freeze would separate estimating error from scope change.\n\nINFERENCE: a fixed share of design capacity reserved for exploratory work is easier to defend than ad hoc projects.",
        },
        { role: "user", content: "Where do sources disagree? I need to be careful with the COO." },
        {
          role: "assistant",
          content:
            "Where sources disagree: some guides argue for a hard specification freeze with change control, while others, especially from companies serving fast-moving consumer markets, favor a late-binding approach that keeps certain features configurable. Estimates of the share of capacity to reserve for exploration vary from about 5 to 20 percent and are rarely backed by data.",
        },
        { role: "user", content: "Summarize as a short practice note with what it means for Quartzline." },
        { role: "assistant", content: "Done. The note keeps the FACT and INFERENCE labels, the disagreement section and three implications." },
      ],
      summary:
        "AI research chat on product definition, gate reviews, schedule commitments and exploratory budgets in chip companies, labelled FACT or INFERENCE. Notes disagreement between hard spec freeze and late binding, and wide estimates for exploration capacity. Produced the practice note.",
      entities: "concept gate, specification freeze, tape-out readiness, market requirements, design-in, exploratory capacity",
    },
    {
      key: "practice-note",
      title: "Practice note: product definition and schedule commitment",
      type: "document",
      vendor: "chatgpt",
      author: "achebe",
      section: "Product definition",
      date: "2025-03-24",
      madeFrom: "research-chat",
      body: `# Practice note: product definition and schedule commitment

**Staged process (FACT, conference papers and guides 2022 to 2024):** concept gate, specification freeze and tape-out readiness review, with a market requirements document approved before architecture work.

**Spec changes drive delay (FACT, engineering management literature 2023):** late changes are among the most cited causes of tape-out slips and respins.

**Customers and partners in definition (FACT, investor materials 2023 to 2024):** early design-in with lead customers and reference design partners is common.

**Confidence-based commits (INFERENCE):** commit a date with a confidence level at concept, re-commit at freeze.

**Protected exploration (INFERENCE):** a fixed share of design capacity is easier to defend than ad hoc projects.

**Where sources disagree:** hard freeze versus late binding; exploration share estimates from about 5 to 20 percent.

**What it means for Quartzline**
1. Move the market requirements document ahead of architecture, owned by product line directors.
2. Add a partner review at the concept gate.
3. Propose a protected exploration share and test it with the SVP Engineering before SteerCo.`,
      summary:
        "Practice note made from the research chat: staged gates, spec changes as a main delay cause, customers and partners in definition, confidence-based commits and protected exploration. Lists where sources disagree and three implications for Quartzline.",
      entities: "practice note, market requirements document, partner review, confidence-based commit, exploration share",
    },
    {
      key: "schedule-sheet",
      title: "Schedule history: programs taped out since 2020",
      type: "sheet",
      vendor: "upload",
      author: "achebe",
      section: "Schedule setting",
      date: "2025-04-04",
      informs: ["baseline"],
      body: `# Schedule history, 18 programs (2020 to 2025)

| Product line | Programs | Median slip (weeks) | Programs slipping 8+ weeks | Spec reopened after freeze | Respins |
|---|---|---|---|---|---|
| Power management | 7 | 22 | 6 | 5 | 2 |
| Sensor interfaces | 6 | 17 | 4 | 4 | 3 |
| Connectivity | 5 | 15 | 3 | 2 | 1 |
| All | 18 | 19 | 13 | 11 | 6 |

| Cause of slip (primary, by program) | Programs |
|---|---|
| Spec change after freeze | 9 |
| Staff pulled to another program | 4 |
| Foundry or IP vendor delay | 3 |
| Verification underestimate | 2 |

Notes: slip measured from the date committed at concept to actual tape-out. Programs where the spec reopened after freeze slipped a median 24 weeks; the rest slipped a median 9 weeks.`,
      summary:
        "Schedule history for 18 programs since 2020: median slip of 19 weeks from commit to tape-out, 13 programs slipping eight weeks or more and six respins. Spec change after freeze is the primary cause in nine programs; those slipped a median 24 weeks against nine for the rest.",
      entities: "tape-out, schedule slip, spec freeze, respins, power management, sensor interfaces, connectivity",
    },
    {
      key: "baseline",
      title: "SteerCo 1: baseline findings",
      type: "deck",
      vendor: "google_slides",
      author: "voss",
      section: "Define",
      date: "2025-04-10",
      shown: [{ on: "2025-04-14", occasion: "SteerCo 1" }],
      body: `## Slide 1
Quartzline product cycle modernization: baseline findings. SteerCo 1, 14 April 2025.

## Slide 2
Programs tape out a median 19 weeks after their committed date, and 13 of 18 slipped by eight weeks or more.
Source: schedule history, 18 programs since 2020.

## Slide 3
Most delay starts at definition: specs reopened after freeze in 11 programs, and those slipped a median 24 weeks against nine for the rest.
Source: schedule history; SVP Engineering interview.

## Slide 4
Customer input arrives after the spec is frozen: two of the last three sensor interface parts needed a respin for features customers had already asked for.
Source: product line director interview.

## Slide 5
Dates are set top down, with no confidence check from the engineers who will deliver them.
Source: SVP Engineering interview, 9 SME interviews.

## Slide 6
Exploratory design time has fallen from about 15 percent to near zero since the cost programs.
Source: SVP Engineering interview.

## Slide 7
Direction for the next phase: product line directors own definition with customer and partner input before the spec, and dates are committed with a confidence level. Decision needed today: approve this direction.`,
      summary:
        "SteerCo 1 baseline deck shown on 14 April 2025. Median slip of 19 weeks, spec reopening after freeze as the main cause, late customer input driving respins, top-down dates and exploratory time near zero. Asks approval for director-owned definition and confidence-based commits.",
      decisions: "SteerCo approved product line director ownership of definition\nConfidence-based schedule commits to be designed for SteerCo 2",
      entities: "SteerCo, schedule slip, spec freeze, respins, product line directors, exploratory time",
    },
    {
      key: "recs-draft",
      title: "Operating recommendations: internal draft v1",
      type: "deck",
      vendor: "google_slides",
      author: "achebe",
      section: "Schedule",
      date: "2025-05-21",
      body: `## Slide 1
Operating recommendations, draft v1 (internal).

## Slide 2
Product definition process: eight steps from opportunity intake to specification freeze, with RACI.

## Slide 3
Gate reviews: concept, specification freeze, tape-out readiness; entry and exit criteria for each.

## Slide 4
Schedule setting: P50 and P90 dates at concept, re-commit at freeze, change control board for post-freeze changes.

## Slide 5
Innovation milestones: 10 percent of design capacity ring-fenced, quarterly review by the CTO office.

## Slide 6
Customer and partner input: ten structured customer conversations per program, partner review at concept gate, annual partner day restored.

## Slide 7
Adoption plan: pilot on two FY2026 programs, extend to all programs in Q1 FY2027.

Reviewer note: not shown. Process-first; leads with steps instead of the slip it fixes.`,
      summary:
        "Internal first draft of the operating recommendations, not shown to the client. Covers the definition process, gates, P50 and P90 commits, a 10 percent innovation ring-fence and customer and partner input, but leads with process steps rather than findings.",
      entities: "operating recommendations draft, gate reviews, P50 and P90, change control board, innovation ring-fence",
    },
    {
      key: "final",
      title: "Final recommendations and adoption plan",
      type: "deck",
      vendor: "google_slides",
      author: "voss",
      section: "Embed",
      date: "2025-06-24",
      shown: [{ on: "2025-06-27", occasion: "Final readout" }],
      body: `## Slide 1
Quartzline product cycle modernization: final recommendations and adoption plan.

## Slide 2
A median 19-week slip means chips reach customers after their design windows close; fixing definition is the fastest way to win them back.
Source: schedule history; baseline findings.

## Slide 3
Product line directors own definition, with ten customer conversations and a partner review before any spec is written.
Source: product line director interview; practice note.

## Slide 4
Every program commits two dates at concept, one we are confident in and one we will not miss, and re-commits at specification freeze.
Source: schedule history; practice note.

## Slide 5
Changes after freeze go through a single weekly decision by the COO.

## Slide 6
Ten percent of existing design capacity is held for exploratory work, reviewed quarterly.
Source: SVP Engineering interview.

## Slide 7
Adoption: pilot on the next power management and connectivity programs from July, all programs by January 2026.`,
      summary:
        "Final recommendations deck shown at the final readout on 27 June 2025, two weeks after the planned end. Director-owned definition with customer and partner input, two committed dates with re-commit at freeze, one weekly change decision by the COO, 10 percent of existing capacity for exploration and a two-program pilot from July.",
      decisions: "COO approved the pilot on two programs from July 2025\nTen percent of existing design capacity held for exploration",
      entities: "final readout, product definition, schedule commitment, change control, exploration capacity, pilot",
    },
    {
      key: "private-notes",
      title: "My notes: SVP Engineering and the COO",
      type: "document",
      vendor: "upload",
      author: "achebe",
      section: "Define",
      date: "2025-04-16",
      visibility: "private",
      body: `Personal notes after SteerCo 1. The SVP Engineering went quiet when the COO said "efficiency" twice; he thinks this is the third cost program in disguise. Anika should take him for coffee before the schedule workshop. The sensor interfaces director is the strongest ally but oversells; check his respin numbers against the schedule sheet before quoting him again. The COO wants a quick win before the board in July, which is why the timeline keeps getting squeezed. If the schedule workshop slips again, raise the end date with Signe now rather than in week 12.`,
      summary: "Private working notes on stakeholder tension after SteerCo 1. Not for the firm.",
    },
  ],
  stickies: [
    { section: "Schedule", text: "Partner review of draft v1: open with the cost of the slip, trace every recommendation to a SteerCo 1 finding, say \"a date we are confident in, and a date we will not miss\" instead of P50 and P90, titles as full-sentence findings.", fill: "yellow" },
    { section: "Define", text: "Not a headcount exercise. Say it in every room.", fill: "pink" },
  ],
  outcome: {
    ranToPlan: false,
    extended: true,
    lesson: "The schedule history sheet won the argument, but getting it took four weeks instead of two; ask for program data in the SOW, not after kickoff. Winning over the SVP Engineering cost two extra weeks.",
  },
};
