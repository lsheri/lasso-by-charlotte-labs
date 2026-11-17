import type { DemoBoard } from "../types";

/** Closed phased board: the evidence case for a community college bachelor of applied science in radiologic technology. */
export const b02: DemoBoard = {
  key: "b2",
  practice: "Education and workforce",
  client: { name: "Cascade Valley College", type: "public community college, about 11,000 students" },
  title: "Bachelor of applied science case for radiologic technology",
  pattern: "Program expansion case",
  shape: "phased",
  start: "2024-09-09",
  weeks: 8,
  fee: "$95k",
  status: "closed",
  sharedWithFirm: true,
  brief:
    "Cascade Valley runs a well-regarded associate degree in radiologic technology and wants to add a bachelor of applied science so working technologists can move into CT, MRI and lead roles without leaving the region. The state board will only approve a bachelor's that proves workforce demand, student demand, employer support and no unnecessary duplication. Build that evidence and draft the proposal sections.",
  team: ["adeyemi", "ramaswamy", "costa"],
  sections: ["Mobilize", "Evidence", "Proposal"],
  workstreams: ["Student and alumni surveys", "Clinical partner demand", "Competency map", "Board proposal sections"],
  items: [
    {
      key: "sow",
      title: "SOW: Cascade Valley BAS evidence case",
      type: "document",
      vendor: "google_docs",
      author: "ramaswamy",
      section: "Mobilize",
      date: "2024-09-03",
      body: `# Statement of work: bachelor of applied science evidence case

**Client:** Cascade Valley College  **Sponsor:** Vice President of Instruction  **Duration:** 8 weeks from 9 September 2024  **Fee:** $95,000 fixed, expenses capped at 5%

## Objective
Produce the demand evidence and draft proposal sections for a bachelor of applied science in radiologic and imaging sciences, ready for the college's submission to the state board in its winter cycle.

## Scope
1. Survey of current students and alumni of the associate program.
2. Ten interviews with clinical partners, faculty and working technologists.
3. Labor market and duplication analysis against existing bachelor's programs in the state.
4. Competency map from the associate degree to the bachelor's outcomes.
5. Draft proposal sections: need, demand, employer support, duplication and enrollment projections.

## Out of scope
Curriculum writing, accreditation filings, the financial pro forma (owned by the college's business office).

## Team
Partner (half a day a week), principal (full time), analyst (full time).

## Milestones
- Week 3: survey launched and interviews under way
- Week 6: demand findings at the midpoint review
- Week 8: draft proposal sections`,
      summary:
        "Signed eight-week, $95k fixed-fee SOW to build the demand evidence and draft state board proposal sections for a bachelor of applied science in radiologic and imaging sciences. Covers a student and alumni survey, ten interviews, labor market and duplication analysis and a competency map. Financial pro forma stays with the college.",
      decisions: "Financial pro forma owned by the college business office\nDraft proposal sections due week 8",
      entities: "Cascade Valley College, Vice President of Instruction, state board, bachelor of applied science, radiologic technology",
    },
    {
      key: "problem",
      title: "Problem definition worksheet",
      type: "document",
      vendor: "google_docs",
      author: "adeyemi",
      section: "Mobilize",
      date: "2024-09-10",
      body: `# Problem definition

**Basic question:** Can Cascade Valley show the state board enough workforce demand, student demand and employer support to win approval for a bachelor of applied science in radiologic and imaging sciences in the winter 2025 cycle?

**Situation:** The associate program graduates 24 technologists a year with a 96 percent first-time registry pass rate. Graduates are hired quickly by regional hospitals and imaging centers.

**Complication:** Technologists who want CT, MRI or lead roles increasingly need a bachelor's, and the nearest in-person program is 160 miles away. The state board rejected two community college bachelor's proposals last year for weak evidence of student demand.

**Success looks like:** a proposal that answers each of the board's five criteria with local evidence, and support letters from most clinical partners.

**Stakeholders:** decides: state board, on the college president's recommendation. Helps: VP of Instruction, program director, clinical partners. Can block: the regional university, which may argue duplication.

**Emerging hypotheses**
1. Working technologists will enroll if the program is part-time and mostly online.
2. Clinical partners need bachelor's-prepared leads and will write letters.
3. The regional university's online program does not serve the same students, because of price and clinical placement.`,
      summary:
        "Problem definition in the firm template: can the college prove demand and employer support to win state board approval in winter 2025. Notes 24 graduates a year at a 96 percent pass rate, the nearest program 160 miles away and two rejected proposals last year. Names the regional university as a possible blocker on duplication.",
      entities: "state board, regional university, registry pass rate, CT, MRI, duplication",
    },
    {
      key: "labor-chat",
      title: "Research: imaging workforce and BAS approval criteria",
      type: "ai_thread",
      vendor: "claude",
      author: "costa",
      section: "Clinical partner demand",
      date: "2024-09-13",
      turns: [
        {
          role: "user",
          content:
            "I'm building the evidence for a community college bachelor of applied science in radiologic and imaging sciences. Summarize (1) what state boards typically require for community college bachelor's approval and (2) workforce trends for imaging technologists, especially demand for bachelor's-prepared staff in CT, MRI and lead roles. Label FACT with dated sources or INFERENCE.",
        },
        {
          role: "assistant",
          content:
            "FACT (state community college system policies, 2022 to 2024): approval criteria commonly include documented workforce demand, student demand, employer support, evidence the program does not unnecessarily duplicate existing offerings, and financial sustainability.\n\nFACT (state labor department projections, 2023): radiologic and imaging technologist employment in the state is projected to grow about 9 percent over ten years, faster than the average for all occupations.\n\nFACT (professional society workforce survey, 2023): a rising share of advanced modality and supervisory postings list a bachelor's as preferred or required.\n\nINFERENCE: hospitals facing vacancies in CT and MRI will value a local pathway that lets them upskill existing staff instead of recruiting from outside the region.\n\nWhere sources disagree: posting data shows bachelor's preferences rising, but several hospital surveys report that experience still outweighs degree level in actual hiring decisions.",
        },
        {
          role: "user",
          content: "Write this up as a short brief I can map to each of the board's criteria, and note what local evidence we still need.",
        },
        {
          role: "assistant",
          content:
            "Done. The brief maps findings to the five criteria, keeps the FACT and INFERENCE labels and lists the local evidence still needed: survey results, partner letters and a duplication comparison.",
        },
      ],
      summary:
        "AI research chat on state board criteria for community college bachelor's degrees and imaging workforce trends, labelled FACT or INFERENCE. Notes projected 9 percent ten-year growth and rising bachelor's preferences, but that experience still outweighs degree in some hiring. Produced the criteria brief.",
      entities: "state board criteria, imaging technologists, labor projections, bachelor's preferred, duplication",
    },
    {
      key: "criteria-brief",
      title: "Brief: board criteria and the evidence we need",
      type: "document",
      vendor: "claude",
      author: "costa",
      section: "Board proposal sections",
      date: "2024-09-16",
      madeFrom: "labor-chat",
      body: `# State board criteria: what we have and what we need

| Criterion | What the literature says | Local evidence still needed |
|---|---|---|
| Workforce demand | FACT (state labor department projections, 2023): about 9 percent growth over ten years | Partner vacancy counts, lead role needs |
| Student demand | (no external source) | Student and alumni survey |
| Employer support | FACT (professional society survey, 2023): bachelor's increasingly preferred for advanced roles | Signed partner letters |
| No unnecessary duplication | (no external source) | Comparison with the regional university's online program |
| Financial sustainability | Out of our scope | College business office pro forma |

**Where sources disagree:** postings show bachelor's preferences rising, but hospital surveys say experience still drives hiring. We should let partners say in their own words why they want bachelor's-prepared leads, rather than lean on posting data.

**INFERENCE:** the duplication argument is strongest on price and location. Working technologists cannot relocate and are price-sensitive.

**Next steps**
1. Launch the student and alumni survey by 23 September.
2. Book interviews with all seven clinical partners.
3. Pull tuition and delivery format for every bachelor's program in the state.`,
      summary:
        "Brief made from the research chat that maps findings to the board's five criteria and lists missing local evidence: survey results, partner letters and a duplication comparison. Advises letting partners explain bachelor's demand in their own words because sources disagree on degree versus experience.",
      entities: "state board criteria, workforce demand, student demand, employer support, duplication",
    },
    {
      key: "int-imaging-director",
      title: "Interview: Director of Imaging Services, regional hospital",
      type: "call",
      vendor: "granola",
      author: "adeyemi",
      section: "Clinical partner demand",
      date: "2024-09-26",
      informs: ["demand-deck", "proposal"],
      body: `# Interview: Director of Imaging Services, largest clinical partner hospital
Attendees: Folake Adeyemi (Kestrel Bay), Beatriz Costa (Kestrel Bay), Director of Imaging Services

**Folake:** Where are your hardest gaps?
**Director:** CT and MRI. I have 11 open technologist positions today, and six of them are CT or MRI. I pay travelers to cover, at roughly double the cost of staff.
**Beatriz:** Do those roles need a bachelor's?
**Director:** Not to start. But my lead technologists and anyone I promote into supervision will need one. I have four leads retiring in the next three years and nobody internal with the degree to replace them.
**Folake:** Would your staff enroll in a Cascade Valley bachelor's?
**Director:** If it is part-time and they can do clinical work here, yes. I would guess eight to ten of my people would start in the first two years. The online university option costs too much and they have to find their own clinical site.
**Beatriz:** Would you write a support letter?
**Director:** Yes. And I would consider tuition support for staff who commit to stay two years.`,
      summary:
        "Largest partner hospital has 11 open technologist positions, six in CT or MRI, covered by travelers at about double the cost. Four lead technologists retire within three years with no bachelor's-prepared replacements. Expects eight to ten staff to enroll if part-time, will write a letter and may offer tuition support.",
      decisions: "Largest partner will write a support letter",
      entities: "Director of Imaging Services, CT, MRI, travelers, lead technologists, tuition support",
    },
    {
      key: "int-program-director",
      title: "Interview: Radiologic Technology Program Director",
      type: "call",
      vendor: "granola",
      author: "costa",
      section: "Competency map",
      date: "2024-10-01",
      informs: ["proposal"],
      body: `# Interview: Program Director, Radiologic Technology (Cascade Valley)
Attendees: Beatriz Costa, Folake Adeyemi (Kestrel Bay), Program Director, lead clinical coordinator

**Beatriz:** What does the associate degree already cover that a bachelor's would build on?
**Program Director:** All the registry content: positioning, radiation protection, patient care, image evaluation. What it does not cover is cross-sectional anatomy in depth, CT and MRI physics, leadership, quality improvement and research literacy.
**Folake:** Could you staff upper-division courses?
**Program Director:** Two of my faculty have master's degrees and could teach the leadership and quality courses. CT and MRI physics would need an adjunct or a shared hire with the hospital.
**Beatriz:** How would clinical hours work for working technologists?
**Clinical coordinator:** At their own employer where possible. We already have agreements with seven sites, so we would add modality rotations to those agreements rather than start new ones.
**Folake:** Biggest risk?
**Program Director:** Faculty load. If the bachelor's pulls my faculty away from the associate program, my pass rate suffers, and that is our reputation.`,
      summary:
        "Program Director maps what the associate degree covers and what a bachelor's adds: cross-sectional anatomy, CT and MRI physics, leadership, quality improvement and research literacy. Two faculty can teach leadership courses; physics needs an adjunct. Clinical hours can run at existing partner sites. Main risk is faculty load harming the associate pass rate.",
      entities: "program director, competency map, CT physics, MRI physics, clinical agreements, faculty load",
    },
    {
      key: "survey-results",
      title: "Student and alumni survey results",
      type: "sheet",
      vendor: "upload",
      author: "costa",
      section: "Student and alumni surveys",
      date: "2024-10-07",
      informs: ["demand-deck", "proposal"],
      body: `# Student and alumni survey (closed 4 October 2024)

| Measure | Value |
|---|---|
| Invited (current students and alumni since 2014) | 540 |
| Responses | 212 (39%) |
| Would enroll if offered part-time and mostly online | 68% |
| Would enroll if offered full-time and in person | 21% |
| Working technologists who say a bachelor's is needed for CT, MRI or lead roles | 74% |
| Considered the regional university's online program | 31% |
| Of those, did not enroll because of cost | 63% |
| Preferred start | Fall 2026 or earlier: 57% |

## Enrollment projection (used in proposal)
| | Year 1 | Year 2 | Year 3 |
|---|---|---|---|
| New students | 20 | 24 | 26 |
| FTE enrolled | 14 | 24 | 30 |

## Tuition comparison
| Program | Format | Annual tuition |
|---|---|---|
| Cascade Valley BAS (estimated upper-division rate) | Part-time, hybrid | $5,600 |
| Regional university online bachelor's | Online, find own clinical site | $14,200 |
| Nearest in-person bachelor's (160 miles) | Full-time, in person | $11,900 |`,
      summary:
        "Survey of 540 students and alumni drew 212 responses: 68 percent would enroll in a part-time, mostly online bachelor's and 74 percent of working technologists say a bachelor's is needed for advanced roles. Projects 30 FTE by year 3. Cascade Valley's estimated $5,600 tuition compares with $14,200 for the regional university's online program.",
      entities: "student survey, alumni survey, enrollment projection, tuition comparison, regional university",
    },
    {
      key: "survey-coding",
      title: "Scratch: open-text coding of survey comments",
      type: "sheet",
      vendor: "upload",
      author: "costa",
      section: "Student and alumni surveys",
      date: "2024-10-08",
      placed: false,
      body: `# Open-text coding, first pass (not cleaned)

| Code | Count | Example (paraphrased) |
|---|---|---|
| Cost of current options | 41 | Online program costs more than I make in two months |
| Clinical placement | 33 | Could not find a CT site that would take me |
| Schedule | 29 | Need evening or weekend classes |
| Career ceiling | 24 | Passed over for lead because no degree |
| Family obligations | 12 | Cannot relocate |
| Not interested | 9 | Happy in general radiography |

To do: second coder on 30 comments to check agreement before anything goes in a deck.`,
      summary:
        "Unplaced scratch sheet with a first-pass coding of open-text survey comments: cost, clinical placement and schedule are the most common barriers. Not yet checked by a second coder.",
      entities: "open-text coding, survey comments, clinical placement, cost",
    },
    {
      key: "demand-draft",
      title: "Demand findings deck v1 (internal draft)",
      type: "deck",
      vendor: "google_slides",
      author: "costa",
      section: "Evidence",
      date: "2024-10-11",
      body: `## Slide 1
Cascade Valley BAS: demand findings. Internal draft, 11 October.

## Slide 2
Survey results
- 212 responses
- 68 percent would enroll part-time online

## Slide 3
Partner interviews
- Hospitals have vacancies
- Lead roles need degrees

## Slide 4
Labor market
- 9 percent growth projected

## Slide 5
Duplication
- Regional university has an online program

## Slide 6
Next steps`,
      summary:
        "Internal first draft of the demand findings deck, not shown to the client. Topic titles rather than findings and no answer to the duplication question; the partner asked for a rewrite before the midpoint review.",
      entities: "demand findings, internal draft, survey, duplication",
    },
    {
      key: "demand-deck",
      title: "Demand findings: midpoint review",
      type: "deck",
      vendor: "google_slides",
      author: "adeyemi",
      section: "Evidence",
      date: "2024-10-16",
      shown: [{ on: "2024-10-18", occasion: "Midpoint review" }],
      body: `## Slide 1
Cascade Valley bachelor of applied science in radiologic and imaging sciences: demand findings. Midpoint review, 18 October 2024.

## Slide 2
The evidence meets the state board's demand criteria: two in three alumni and students would enroll if the program is part-time and mostly online.
Source: student and alumni survey, 212 responses.

## Slide 3
Partners need bachelor's-prepared leads: the largest partner has four leads retiring in three years and no internal replacements with the degree.
Source: Director of Imaging Services interview.

## Slide 4
CT and MRI gaps are costly: six of the largest partner's 11 open positions are advanced modality roles covered by travelers.
Source: Director of Imaging Services interview.

## Slide 5
The program does not duplicate the regional university's offer: Cascade Valley would cost $5,600 a year against $14,200, with clinical sites arranged.
Source: survey tuition comparison.

## Slide 6
Statewide, imaging technologist employment is projected to grow about 9 percent over ten years.
Source: criteria brief, state labor projections 2023.

## Slide 7
Decision needed: confirm a fall 2026 start and ask all seven partners for letters by 1 November.`,
      summary:
        "Midpoint review deck shown on 18 October 2024. Headlines: 68 percent of respondents would enroll part-time, the largest partner faces four lead retirements and six advanced modality vacancies, and the program is cheaper than the regional university's online option. Asks for a fall 2026 start and partner letters by 1 November.",
      decisions: "College confirmed a fall 2026 target start\nPartner letters requested by 1 November",
      entities: "midpoint review, state board criteria, survey, lead technologists, duplication, tuition",
    },
    {
      key: "proposal",
      title: "State board proposal: draft need, demand and duplication sections",
      type: "document",
      vendor: "google_docs",
      author: "adeyemi",
      section: "Proposal",
      date: "2024-11-12",
      shown: [{ on: "2024-11-15", occasion: "Final readout" }],
      body: `# Draft proposal sections: Bachelor of Applied Science in Radiologic and Imaging Sciences

## 1. Workforce need
Radiologic and imaging technologist employment in the state is projected to grow about 9 percent over ten years (state labor department, 2023). Cascade Valley's largest clinical partner reports 11 open technologist positions, six of them in CT or MRI, and four lead technologists retiring within three years.

## 2. Student demand
Of 212 current students and alumni surveyed in October 2024, 68 percent would enroll in a part-time, mostly online bachelor's, and 74 percent of working technologists said a bachelor's is needed for CT, MRI or lead roles. We project 20 new students in year one and 30 FTE by year three.

## 3. Employer support
Six of seven clinical partners have provided signed letters of support. The largest partner is considering tuition support for staff who commit to two years of service.

## 4. No unnecessary duplication
The nearest in-person bachelor's is 160 miles away. The regional university's online program costs $14,200 a year and requires students to find their own clinical site; 63 percent of respondents who considered it did not enroll because of cost. Cascade Valley's estimated tuition is $5,600 a year with clinical placements at existing partner sites.

## 5. Program design
The bachelor's builds on the associate degree with cross-sectional anatomy, CT and MRI physics, leadership, quality improvement and research literacy (see competency map appendix).`,
      summary:
        "Draft state board proposal sections shown at the final readout on 15 November 2024. Covers workforce need, student demand, employer support with six of seven partner letters, the duplication argument on price and clinical placement, and program design built on the associate degree.",
      decisions: "Six of seven partner letters included\nProposal handed to the college for the winter cycle",
      entities: "state board proposal, workforce need, student demand, employer support, duplication, competency map",
    },
  ],
  stickies: [
    { section: "Evidence", text: "Dev: every title answers one board criterion in a full sentence. No topic titles like \"Survey results\".", fill: "yellow" },
    { section: "Clinical partner demand", text: "Let partners say why they need bachelor's leads in their own words; posting data is contested", fill: "blue" },
  ],
  outcome: {
    ranToPlan: false,
    extended: false,
    lesson: "Partner letters took three weeks longer than planned because each hospital routed them through legal; we absorbed a two-week overrun rather than extend. Ask for letters in week two, not after the midpoint.",
  },
};
