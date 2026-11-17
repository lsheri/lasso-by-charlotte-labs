import type { DemoBoard } from "../types";

/** Closed research board: testing with employers whether a foundational cybersecurity credential would get graduates hired. */
export const b03: DemoBoard = {
  key: "b3",
  practice: "Education and workforce",
  client: { name: "Ridgeway Skills Institute", type: "workforce nonprofit, training about 2,500 young adults a year" },
  title: "Foundational cybersecurity credential for high school graduates",
  pattern: "Credential design with employers",
  shape: "research",
  start: "2025-04-07",
  weeks: 7,
  fee: "$120k",
  status: "closed",
  sharedWithFirm: true,
  brief:
    "Ridgeway wants to launch a foundational cybersecurity credential for recent high school graduates, but its funders want proof that employers will actually hire graduates before they pay for a pilot. Test Ridgeway's hiring hypotheses with 15 employers, benchmark existing entry credentials, co-design the credential with employers and set the outcome metrics the pilot will be judged on.",
  team: ["delacroix", "ramaswamy", "singh"],
  sections: ["Plan", "Field research", "Synthesis", "Co-design", "Final"],
  items: [
    {
      key: "sow",
      title: "SOW: Ridgeway cybersecurity credential design",
      type: "document",
      vendor: "google_docs",
      author: "ramaswamy",
      section: "Plan",
      date: "2025-03-31",
      body: `# Statement of work: foundational cybersecurity credential

**Client:** Ridgeway Skills Institute  **Sponsor:** Chief Program Officer  **Duration:** 7 weeks from 7 April 2025  **Fee:** $120,000 fixed, expenses capped at 5%

## Objective
Determine whether employers will hire recent high school graduates holding a new foundational cybersecurity credential, and design the credential and its outcome metrics with employers so Ridgeway can seek pilot funding in June.

## Scope
1. Secondary research and benchmarks of existing entry-level cybersecurity credentials.
2. Fifteen employer interviews testing three hiring hypotheses.
3. Synthesis of themes and hypothesis results.
4. One co-design workshop with six to eight employers.
5. Employer insights deck, engagement strategy and a pilot roadmap with outcome metrics.

## Out of scope
Curriculum authorship, assessment development, platform selection, fundraising.

## Team
Partner (half a day a week), manager (full time), consultant (full time).

## Milestones
- Week 1: research plan and interview guide approved
- Week 5: employer insights at the midpoint review
- Week 7: final readout with credential design and roadmap`,
      summary:
        "Signed seven-week, $120k fixed-fee SOW to test whether employers will hire high school graduates with a new foundational cybersecurity credential. Scope covers benchmarks, 15 employer interviews, synthesis, a co-design workshop and a pilot roadmap with outcome metrics. Curriculum and assessment development are out of scope.",
      decisions: "Fifteen employer interviews against three hypotheses\nCurriculum and assessments out of scope",
      entities: "Ridgeway Skills Institute, Chief Program Officer, cybersecurity credential, employers, pilot funding",
    },
    {
      key: "problem",
      title: "Problem definition worksheet",
      type: "document",
      vendor: "google_docs",
      author: "delacroix",
      section: "Plan",
      date: "2025-04-08",
      body: `# Problem definition

**Basic question:** Will employers in Ridgeway's region hire recent high school graduates into entry-level security roles on the strength of a new foundational credential, and what must the credential include for them to do so?

**Situation:** Ridgeway trains about 2,500 young adults a year in IT support and healthcare pathways, with strong placement in help desk roles. Funders are interested in cybersecurity because of reported talent shortages.

**Complication:** Shortage headlines are about experienced roles. Entry security jobs often ask for two years of IT experience, and existing entry certifications are not tied to any hiring commitment. A credential nobody hires from would damage Ridgeway's placement record.

**Success looks like:** clear yes or no evidence on each hypothesis, a credential design employers helped shape, and outcome metrics funders accept.

**Stakeholders:** decides: Chief Program Officer and the lead funder's program officer. Helps: Ridgeway employer advisory board, two community colleges. Can block: employers who would need to change experience requirements.

**Emerging hypotheses**
1. Employers will hire 18-year-old graduates into supervised tier-1 security or security-adjacent roles.
2. Employers will trust a credential only if it includes a hands-on lab assessment.
3. Employers would rather see a recognized vendor-neutral certification inside the credential than a new Ridgeway brand alone.`,
      summary:
        "Problem definition in the firm template: will employers hire high school graduates into entry security roles on a new credential, and what must it include. Notes that shortages are mostly in experienced roles and sets three hypotheses on supervised tier-1 hiring, hands-on assessment and including a recognized certification.",
      entities: "Ridgeway, tier-1 security, help desk, vendor-neutral certification, lead funder",
    },
    {
      key: "benchmark-chat",
      title: "Research: entry-level cybersecurity credentials compared",
      type: "ai_thread",
      vendor: "chatgpt",
      author: "singh",
      section: "Plan",
      date: "2025-04-10",
      turns: [
        {
          role: "user",
          content:
            "Compare existing entry-level cybersecurity credentials that a recent high school graduate could earn: format, cost, whether they include hands-on assessment, and how employers view them. Also summarize what entry security roles actually require. Label FACT with dated sources or INFERENCE and note where sources disagree.",
        },
        {
          role: "assistant",
          content:
            "FACT (certification body published exam details, 2024): the main vendor-neutral entry certifications cost between about $150 and $400 per exam attempt and are mostly multiple choice, with a few performance-based items.\n\nFACT (job posting analyses, 2024): most postings for security analyst roles ask for one to three years of IT experience; tier-1 security operations and IT support roles with security duties are the main entry points.\n\nFACT (workforce program evaluations, 2023 to 2024): programs that pair certification with work-based learning report better placement than certification-only programs.\n\nINFERENCE: no widely recognized entry credential includes a supervised work component, which leaves room for a credential built around one.\n\nINFERENCE: help desk roles with security duties are a more realistic first job for an 18-year-old than a security analyst title.\n\nWhere sources disagree: industry workforce studies report large shortages, but posting analyses suggest the gap is concentrated in experienced roles, so entry-level demand may be overstated.",
        },
        {
          role: "user",
          content: "Turn this into a benchmark table and a short memo for the Chief Program Officer.",
        },
        {
          role: "assistant",
          content:
            "Done. The memo includes a benchmark table of five credentials, the work-based gap and the warning that entry-level shortage claims are contested.",
        },
      ],
      summary:
        "AI research chat comparing entry cybersecurity credentials on cost, format and hands-on assessment, labelled FACT or INFERENCE. Finds no recognized credential includes supervised work, and warns that shortage figures are concentrated in experienced roles. Produced the benchmark memo.",
      entities: "entry certifications, security operations, work-based learning, job postings, talent shortage",
    },
    {
      key: "benchmark-memo",
      title: "Memo: competitive benchmark of entry credentials",
      type: "document",
      vendor: "chatgpt",
      author: "singh",
      section: "Plan",
      date: "2025-04-11",
      madeFrom: "benchmark-chat",
      body: `# Memo: entry cybersecurity credentials benchmark

| Credential type | Cost | Hands-on assessment | Work-based component | Employer recognition |
|---|---|---|---|---|
| Vendor-neutral entry security certification | About $400 | Some performance items | None | High |
| Vendor-neutral IT fundamentals certification | About $250 | Minimal | None | Medium |
| Vendor-specific entry security badge | About $150 | Online labs | None | Medium |
| Community college security certificate | $1,800 to $3,000 | Labs in coursework | Optional internship | Varies by college |
| Bootcamp security certificate | $8,000 to $15,000 | Capstone project | Rarely | Low to medium |

Costs and formats from published certification body and provider details, 2024 (FACT).

**Finding (INFERENCE):** nothing in the market combines a recognized exam, a lab portfolio and a supervised work placement. That is the gap Ridgeway could fill.

**Caution (where sources disagree):** shortage headlines describe experienced roles. Our interviews must test whether employers will really hire at entry level, not whether they say there is a shortage.

**Implication for interviews:** ask employers about their last three entry hires, not about the talent market in general.`,
      summary:
        "Benchmark memo made from the research chat, comparing five types of entry credential on cost, hands-on assessment and work-based learning. Concludes nothing combines a recognized exam, lab portfolio and supervised placement, and tells interviewers to ask about real recent hires rather than the shortage.",
      entities: "benchmark, entry certification, bootcamp, community college certificate, lab portfolio",
    },
    {
      key: "int-soc",
      title: "Interview: SOC Manager, managed security provider",
      type: "call",
      vendor: "granola",
      author: "delacroix",
      section: "Field research",
      date: "2025-04-17",
      informs: ["insights-deck"],
      body: `# Interview: Security Operations Center Manager, regional managed security provider
Attendees: Ines Delacroix (Kestrel Bay), Priya Singh (Kestrel Bay), SOC Manager

**Ines:** Tell us about your last three entry-level hires.
**SOC Manager:** Two came from our own help desk after about a year. One was a community college graduate with an internship here. None came straight from high school.
**Priya:** Would you hire an 18-year-old into a tier-1 role?
**SOC Manager:** Into tier-1 monitoring on a supervised day shift, possibly. Not nights, not alone. Honestly the better route is our help desk with security duties, then promotion in 9 to 12 months.
**Ines:** What would a credential need to show you?
**SOC Manager:** That they have actually triaged alerts in a lab. A multiple choice exam tells me they can memorize ports. I want to see a portfolio: tickets they wrote, a log they investigated.
**Priya:** Does the recognized entry certification matter?
**SOC Manager:** It gets them past HR's filter. So yes, include it. But it is the lab work that gets them hired.
**Ines:** What pay would a starter get?
**SOC Manager:** Help desk with security duties starts at about $20 an hour here.`,
      summary:
        "SOC Manager has never hired straight from high school; entry hires come via the help desk. Would consider supervised day-shift tier-1 roles but prefers help desk with security duties, then promotion in 9 to 12 months. Wants a lab portfolio, values the recognized certification to pass HR filters, and quotes starting pay of about $20 an hour.",
      entities: "SOC Manager, tier-1 monitoring, help desk, lab portfolio, entry certification, starting wage",
    },
    {
      key: "int-county-it",
      title: "Interview: IT Director, county government",
      type: "call",
      vendor: "granola",
      author: "singh",
      section: "Field research",
      date: "2025-04-24",
      informs: ["insights-deck"],
      body: `# Interview: IT Director, county government (about 3,200 employees)
Attendees: Priya Singh (Kestrel Bay), Dev Ramaswamy (Kestrel Bay), IT Director, HR business partner

**Priya:** Where would a graduate of this credential fit in your team?
**IT Director:** IT support technician I. It is a civil service title with a high school diploma minimum. We added security duties last year: account lockouts, phishing reports, patch checks.
**Dev:** What stops you hiring 18-year-olds today?
**HR business partner:** Nothing formal. But they rarely pass our practical test because they have never worked a ticket queue.
**Priya:** Would an internship change that?
**IT Director:** Completely. If Ridgeway placed interns with us for six weeks, we would hire the good ones. We do it with the community college already.
**Dev:** Would you help design the credential?
**IT Director:** Yes, if the time ask is small. Two workshops, not a standing committee.
**HR business partner:** And give us a way to verify it. We have had fake certificates before.`,
      summary:
        "County IT Director would hire graduates as IT support technician I, a civil service role that now includes security duties, but 18-year-olds rarely pass the practical test. A six-week internship would change that. Willing to co-design if the ask is two workshops, and HR wants a way to verify the credential.",
      decisions: "County willing to host interns and join two design workshops",
      entities: "county government, IT support technician, civil service, internship, credential verification",
    },
    {
      key: "synthesis",
      title: "Interview synthesis: hypothesis results across 15 employers",
      type: "sheet",
      vendor: "upload",
      author: "singh",
      section: "Synthesis",
      date: "2025-05-01",
      informs: ["insights-deck", "final-deck"],
      body: `# Synthesis matrix: 15 employer interviews (closed 30 April)

## Interviews by segment
| Segment | Interviews |
|---|---|
| Managed security and SOC providers | 5 |
| IT services and managed service providers | 4 |
| Public sector (county, city, school district) | 3 |
| Healthcare and financial services IT | 3 |

## Hypothesis results
| Hypothesis | Supported | Supported with conditions | Not supported |
|---|---|---|---|
| H1: will hire 18-year-old graduates into supervised entry roles | 9 | 4 (only after an internship) | 2 |
| H2: hands-on lab assessment required for trust | 13 | 2 | 0 |
| H3: want a recognized certification inside the credential | 11 | 3 | 1 |

## Top themes (count of employers raising each)
| Theme | Count |
|---|---|
| First job is help desk with security duties, not analyst | 12 |
| A supervised work placement would change hiring decisions | 11 |
| Need a way to verify the credential | 7 |
| Starting pay quoted between $19 and $23 an hour | 10 |
| Willing to host interns in a pilot | 8 |`,
      summary:
        "Synthesis of 15 employer interviews across four segments. H1 supported by 9 employers and conditionally by 4 more after an internship; H2 supported by 13; H3 by 11. Twelve employers say the first job is help desk with security duties, and eight would host pilot interns.",
      entities: "synthesis matrix, hypotheses, help desk, work placement, starting pay, interns",
    },
    {
      key: "insights-draft",
      title: "Employer insights deck v1 (internal draft)",
      type: "deck",
      vendor: "google_slides",
      author: "singh",
      section: "Synthesis",
      date: "2025-05-02",
      body: `## Slide 1
Ridgeway cybersecurity credential: employer insights. Internal draft, 2 May.

## Slide 2
There is a large cybersecurity talent shortage, which creates an opportunity for Ridgeway.
Source: industry workforce studies.

## Slide 3
Employers like the idea of a credential.
Source: 15 interviews.

## Slide 4
Hands-on labs matter.
Source: synthesis matrix.

## Slide 5
Next steps: design the credential.`,
      summary:
        "Internal first draft of the employer insights deck, not shown to the client. Opened with the general talent shortage, which the benchmark memo had flagged as contested, and used vague titles; the partner had it rebuilt around the hypothesis results.",
      entities: "employer insights, internal draft, talent shortage, partner review",
    },
    {
      key: "insights-deck",
      title: "Employer insights: midpoint review",
      type: "deck",
      vendor: "google_slides",
      author: "delacroix",
      section: "Synthesis",
      date: "2025-05-07",
      shown: [{ on: "2025-05-09", occasion: "Midpoint review" }],
      body: `## Slide 1
Ridgeway foundational cybersecurity credential: what 15 employers told us. Midpoint review, 9 May 2025.

## Slide 2
Employers will hire graduates, but into help desk roles with security duties, not analyst titles: 12 of 15 said so.
Source: interview synthesis.

## Slide 3
Nine employers would hire 18-year-old graduates into supervised roles now; four more would after an internship.
Source: interview synthesis, hypothesis H1.

## Slide 4
A lab portfolio, not an exam score, is what earns trust: 13 of 15 require hands-on assessment.
Source: interview synthesis, SOC Manager interview.

## Slide 5
The recognized entry certification still matters because it gets candidates past HR filters.
Source: interview synthesis, hypothesis H3.

## Slide 6
No existing credential combines a recognized exam, a lab portfolio and a supervised placement.
Source: competitive benchmark memo.

## Slide 7
Starting pay for these roles is $19 to $23 an hour.
Source: interview synthesis.

## Slide 8
Next: co-design the credential with eight employers who offered to host interns.`,
      summary:
        "Midpoint deck shown on 9 May 2025. Employers will hire graduates into help desk roles with security duties; 9 of 15 would hire 18-year-olds now and 4 after an internship; 13 require hands-on assessment; the recognized certification passes HR filters. Notes the market gap and $19 to $23 an hour starting pay.",
      decisions: "Ridgeway agreed to frame the credential around help desk with security duties\nCo-design with the eight employers offering internships",
      entities: "midpoint review, employer insights, help desk, lab portfolio, entry certification, internships",
    },
    {
      key: "codesign-notes",
      title: "Co-design workshop notes",
      type: "document",
      vendor: "google_docs",
      author: "delacroix",
      section: "Co-design",
      date: "2025-05-14",
      body: `# Co-design workshop: Ridgeway Cyber Foundations (14 May 2025)
Participants: 7 employers (2 SOC providers, 2 managed service providers, county IT, a hospital IT team, a credit union), Ridgeway program staff, Kestrel Bay team

## What we agreed
1. **Structure:** 12 weeks of training, then a 6-week paid internship with an employer partner.
2. **Exam:** learners sit the recognized vendor-neutral entry security certification, paid by Ridgeway.
3. **Portfolio:** an 80-hour lab portfolio with ticket write-ups, a log investigation and a phishing triage exercise, reviewed by an employer volunteer.
4. **Verification:** a digital credential with a public verification link, at the county HR team's request.
5. **Job title:** market the outcome as "IT support with security duties", with a promotion path to tier-1 security.

## Where employers disagreed
- SOC providers wanted Linux and log analysis; managed service providers cared more about Microsoft account administration. We agreed both appear in the portfolio at a basic level.
- Two employers wanted 21 as the minimum age for internships; the rest were fine at 18 with day-shift supervision.

## Commitments
- Seven employers will host interns in the pilot, an average of about 6 each. Ridgeway will recruit an eighth.`,
      summary:
        "Notes from the co-design workshop with seven employers. Agreed a 12-week program plus a 6-week paid internship, the recognized entry certification, an 80-hour lab portfolio and a verifiable digital credential. Employers split on Linux versus Microsoft skills and minimum internship age; seven committed to host pilot interns.",
      decisions: "12 weeks of training plus a 6-week paid internship\n80-hour lab portfolio reviewed by employers\nDigital credential with public verification",
      entities: "co-design workshop, Ridgeway Cyber Foundations, internship, lab portfolio, digital credential",
    },
    {
      key: "final-deck",
      title: "Credential design, engagement strategy and pilot roadmap",
      type: "deck",
      vendor: "google_slides",
      author: "delacroix",
      section: "Final",
      date: "2025-05-21",
      shown: [{ on: "2025-05-23", occasion: "Final readout" }],
      body: `## Slide 1
Ridgeway Cyber Foundations: credential design and pilot roadmap. Final readout, 23 May 2025.

## Slide 2
Ridgeway should launch a credential employers helped design: 12 weeks of training, a recognized exam, a lab portfolio and a 6-week paid internship.
Source: co-design workshop notes.

## Slide 3
The pitch to learners and funders is a first job in IT support with security duties and a path to tier-1 security, not an analyst title.
Source: interview synthesis.

## Slide 4
Seven employers have committed to host pilot interns, enough for a first cohort of 40 learners.
Source: co-design workshop notes.

## Slide 5
Keep employers engaged with two workshops a year and portfolio reviews, not a standing committee.
Source: county IT Director interview, co-design workshop notes.

## Slide 6
The pilot will be judged on three metrics: 60 percent placed within six months, a median starting wage of at least $20 an hour, and 75 percent still employed at twelve months.
Source: interview synthesis (pay range), partner review.

## Slide 7
Roadmap: funding decision in June, recruit in August, first cohort September to January, placement results by July 2026.`,
      summary:
        "Final readout deck shown on 23 May 2025. Recommends Ridgeway Cyber Foundations: 12 weeks of training, a recognized exam, an 80-hour lab portfolio and a paid internship, positioned as IT support with security duties. Seven employers host a first cohort of 40, and the pilot is judged on placement, starting wage and twelve-month retention.",
      decisions: "Pilot of 40 learners with seven employer hosts\nOutcome metrics: 60% placement in six months, $20 an hour median wage, 75% twelve-month retention",
      entities: "final readout, Ridgeway Cyber Foundations, pilot roadmap, outcome metrics, employer engagement",
    },
  ],
  stickies: [
    { section: "Synthesis", text: "Dev: never open with the shortage headline. Open with what employers said about their last three hires.", fill: "yellow" },
    { section: "Field research", text: "Ask about real recent hires, not the talent market", fill: "blue" },
  ],
  outcome: {
    ranToPlan: true,
    extended: false,
    lesson: "Asking employers about their last three entry hires, not the shortage, gave honest answers and reframed the credential around help desk roles; the funder approved the pilot without a follow-on phase from us.",
  },
};
