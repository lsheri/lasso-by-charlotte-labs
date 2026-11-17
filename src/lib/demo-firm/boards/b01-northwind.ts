import type { DemoBoard } from "../types";

/** Closed sprint board: employer signatory drive for three new industry certifications. */
export const b01: DemoBoard = {
  key: "b1",
  practice: "Education and workforce",
  client: { name: "Northwind Learning Alliance", type: "national education nonprofit serving millions of secondary students" },
  title: "Employer validation for three new industry certifications",
  pattern: "Employer signatory drive",
  shape: "sprint",
  start: "2024-02-05",
  weeks: 6,
  fee: "$140k",
  status: "closed",
  sharedWithFirm: true,
  brief:
    "Northwind wants three new industry certifications for high school students approved by the national credential registry, which requires signed letters from at least 25 employers per certification committing to recognize it in hiring. Northwind has deep school ties but few private-sector relationships. Build the target list, run warm-referral outreach, secure the signatories and leave a playbook Northwind can repeat.",
  team: ["delacroix", "ramaswamy", "singh", "costa"],
  sections: ["Intake", "Weeks 1-2: Targets", "Weeks 3-4: Outreach", "Weeks 5-6: Signatories"],
  items: [
    {
      key: "sow",
      title: "SOW: Northwind employer validation sprint",
      type: "document",
      vendor: "google_docs",
      author: "ramaswamy",
      section: "Intake",
      date: "2024-01-29",
      body: `# Statement of work: employer validation for three certifications

**Client:** Northwind Learning Alliance  **Sponsor:** Vice President, Credentials and Pathways  **Duration:** 6 weeks from 5 February 2024  **Fee:** $140,000 fixed, expenses capped at 6%

## Objective
Secure at least 25 signed employer letters for each of three certifications (advanced manufacturing technician, data analytics fundamentals, healthcare IT support) ahead of the registry's 29 March submission deadline, and leave Northwind a repeatable outreach playbook.

## Scope
1. Target employer list: build, score and prioritize employers by hiring volume, regional fit and existing ties.
2. Warm-referral outreach through Northwind's board, funders and school district partners.
3. Twelve employer interviews to test what each certification must prove.
4. Signatory tracking from first contact to signed letter.
5. Employer insights deck and outreach playbook.

## Out of scope
Writing certification content or assessments, the registry submission itself, paid advertising.

## Team
Partner (half a day a week), manager (full time), consultant (full time), analyst (full time).

## Milestones
- Week 2: prioritized target list and outreach plan
- Week 4: midpoint signatory count
- Week 6: final readout, signatory tracker and playbook`,
      summary:
        "Signed six-week, $140k fixed-fee SOW to secure at least 25 employer letters for each of three certifications before the registry's 29 March deadline. Scope covers target list, warm-referral outreach, twelve employer interviews, signatory tracking and a playbook. Certification content and the submission itself are out of scope.",
      decisions: "Target of 25 signed letters per certification\nRegistry submission stays with Northwind",
      entities: "Northwind Learning Alliance, credential registry, advanced manufacturing technician, data analytics fundamentals, healthcare IT support",
    },
    {
      key: "problem",
      title: "Problem definition worksheet",
      type: "document",
      vendor: "google_docs",
      author: "delacroix",
      section: "Intake",
      date: "2024-02-05",
      body: `# Problem definition

**Basic question:** How can Northwind secure 75 qualifying employer signatures (25 per certification) by 22 March 2024, and build relationships it can reuse for future credentials?

**Situation:** Northwind reaches students in thousands of high schools. Its board and funders include several large employers, but none of its staff own employer relationships.

**Complication:** The registry tightened its rules in 2023: letters must come from a hiring manager or HR leader and name the roles the credential would qualify for. Two earlier Northwind credentials stalled for lack of letters. Six weeks is short for cold outreach.

**Success looks like:** 75 qualifying letters, a list of employers who want to stay involved, and a playbook a two-person Northwind team can run.

**Stakeholders:** decides: VP Credentials and Pathways. Helps: board members with employer roles, district career and technical education directors. Can block: the registry's review panel, which rejects letters that do not name roles.

**Emerging hypotheses**
1. Warm introductions through board and funders will convert far better than cold outreach.
2. Employers will sign if the certification maps to a named entry-level role.
3. Healthcare IT will be hardest, because hospital hiring is centralized and slow.`,
      summary:
        "Problem definition in the firm template: 75 qualifying employer letters by 22 March 2024 plus reusable relationships. Notes the registry's 2023 rule that letters must name qualifying roles and sets three hypotheses, including that healthcare IT will be hardest.",
      entities: "Northwind, credential registry, review panel, board members, career and technical education",
    },
    {
      key: "segment-chat",
      title: "Research: which employers sign credential letters",
      type: "ai_thread",
      vendor: "chatgpt",
      author: "singh",
      section: "Weeks 1-2: Targets",
      date: "2024-02-07",
      turns: [
        {
          role: "user",
          content:
            "We need employer letters supporting three entry-level certifications for high school students: advanced manufacturing technician, data analytics fundamentals and healthcare IT support. What kinds of employers are most likely to sign, what do they usually want in return, and what roles do these credentials map to? Label FACT with a dated source or INFERENCE.",
        },
        {
          role: "assistant",
          content:
            "FACT (labor market postings analysis, 2023): entry-level manufacturing technician and IT support roles are among the most frequently posted jobs that do not require a degree.\n\nFACT (industry association survey, 2023): mid-sized manufacturers report the greatest difficulty filling technician roles, more than the largest firms.\n\nFACT (state workforce agency reports, 2022 to 2023): employers that already run youth apprenticeships or internships are more likely to engage in credential advisory work.\n\nINFERENCE: mid-sized regional employers will sign faster than national firms, because a plant manager or HR director can sign without legal review.\n\nINFERENCE: employers usually want a say in the content and early access to graduates in return.\n\nWhere sources disagree: posting data suggests strong demand for data analytics roles without degrees, but employer surveys show many still screen for a degree in practice.",
        },
        {
          role: "user",
          content: "Turn this into a one-page targeting brief with the segments we should prioritize for each certification.",
        },
        {
          role: "assistant",
          content:
            "Done. The brief ranks mid-sized regional employers first for manufacturing and IT support, flags the degree-screening risk for data analytics, and lists what employers want in return.",
        },
      ],
      summary:
        "AI research chat on which employers sign credential support letters and what they want in return, labelled FACT or INFERENCE. Suggests mid-sized regional employers sign faster than national firms and flags that data analytics employers still screen for degrees. Produced the targeting brief.",
      entities: "employer letters, mid-sized manufacturers, IT support, data analytics, degree screening",
    },
    {
      key: "target-brief",
      title: "Brief: employer segments to prioritize",
      type: "document",
      vendor: "chatgpt",
      author: "singh",
      section: "Weeks 1-2: Targets",
      date: "2024-02-08",
      madeFrom: "segment-chat",
      body: `# Targeting brief: who to ask first

**Advanced manufacturing technician**
- Priority: mid-sized regional manufacturers (200 to 2,000 staff). FACT (industry association survey, 2023): hardest hit by technician shortages.
- Named role: production technician, maintenance technician I.

**Healthcare IT support**
- Priority: regional health systems and large physician groups with in-house service desks.
- Named role: service desk analyst I, clinical applications support associate.
- Risk (INFERENCE): hiring is centralized, so letters may need HR and IT sign-off.

**Data analytics fundamentals**
- Priority: regional banks, insurers and logistics firms with entry-level reporting roles.
- Named role: reporting associate, operations data assistant.
- Risk (where sources disagree): postings suggest openness to non-degree hires, but many employers still screen for degrees.

**What employers want in return (INFERENCE)**
- A seat on a content advisory group.
- Early access to students for internships.
- Recognition in Northwind's annual report.

**Implication:** start with employers who already host youth apprentices or interns (FACT, state workforce agency reports, 2022 to 2023).`,
      summary:
        "Targeting brief made from the research chat: mid-sized regional manufacturers first for manufacturing, health systems with in-house service desks for healthcare IT, banks, insurers and logistics firms for data analytics. Names the qualifying roles and what employers want in return.",
      entities: "mid-sized manufacturers, health systems, regional banks, service desk analyst, production technician",
    },
    {
      key: "target-list",
      title: "Target employer list and signatory tracker",
      type: "sheet",
      vendor: "upload",
      author: "costa",
      section: "Weeks 1-2: Targets",
      date: "2024-02-14",
      body: `# Target employer list (scored) and signatory tracker, as at 15 March 2024

## Funnel by certification
| Stage | Manufacturing | Data analytics | Healthcare IT | Total |
|---|---|---|---|---|
| Employers on long list | 74 | 58 | 48 | 180 |
| Priority targets (score 7+) | 26 | 18 | 16 | 60 |
| Contacted | 44 | 36 | 32 | 112 |
| Meetings held | 25 | 18 | 15 | 58 |
| Letters signed | 31 | 27 | 23 | 81 |
| Registry target | 25 | 25 | 25 | 75 |

## Response rate by channel
| Channel | Contacted | Responded | Rate |
|---|---|---|---|
| Warm introduction (board, funders, districts) | 61 | 28 | 46% |
| Cold email and LinkedIn | 51 | 7 | 14% |

## Scoring rubric
Hiring volume for the named role (0 to 3), regional overlap with Northwind schools (0 to 3), existing tie to Northwind (0 to 2), runs youth internships (0 to 2).

Note: letters signed exceeds meetings held because several employers signed after a referral without a meeting.`,
      summary:
        "Target list and signatory tracker: 180 employers long-listed, 112 contacted, 58 meetings and 81 letters signed against a target of 75. Healthcare IT reached 23 of 25. Warm introductions got a 46 percent response rate against 14 percent for cold outreach.",
      entities: "target list, signatory tracker, warm introduction, response rate, healthcare IT",
    },
    {
      key: "int-manufacturer",
      title: "Interview: VP Talent, regional manufacturer",
      type: "call",
      vendor: "granola",
      author: "delacroix",
      section: "Weeks 3-4: Outreach",
      date: "2024-02-20",
      informs: ["insights-final"],
      body: `# Interview: VP Talent, regional precision manufacturer (about 900 staff)
Attendees: Ines Delacroix (Kestrel Bay), Priya Singh (Kestrel Bay), VP Talent

**Ines:** What would make a high school certification credible to you?
**VP Talent:** That it covers what my supervisors complain about: reading a work instruction, basic measurement, safety habits. If a student can use calipers and follow a lockout procedure, I can train the rest.
**Priya:** Would you name a role in the letter?
**VP Talent:** Production technician, yes. Maintenance is a stretch for an 18-year-old, but production technician is exactly where we hire.
**Ines:** What do you want in return for signing?
**VP Talent:** Two things. A say in the skills list, and first look at students for summer jobs. We hire around 40 entry-level people a year and we lose a third of them in the first six months.
**Priya:** Who else should we talk to?
**VP Talent:** The regional manufacturers' council. If their director sends your note, you will get replies. A cold email from a nonprofit I have never heard of goes straight to the bin.`,
      summary:
        "VP Talent at a 900-person manufacturer will sign for the production technician role if the certification covers measurement, work instructions and safety. Wants input into the skills list and early access to students. Recommends going through the regional manufacturers' council because cold emails get ignored.",
      decisions: "Route manufacturing outreach through the regional manufacturers' council",
      entities: "VP Talent, production technician, manufacturers' council, safety, measurement",
    },
    {
      key: "int-health-it",
      title: "Interview: Director of IT Service Desk, regional health system",
      type: "call",
      vendor: "granola",
      author: "singh",
      section: "Weeks 3-4: Outreach",
      date: "2024-02-27",
      informs: ["insights-final"],
      body: `# Interview: Director of IT Service Desk, regional health system
Attendees: Priya Singh, Beatriz Costa (Kestrel Bay), Director of IT Service Desk

**Priya:** Would a high school healthcare IT certification help you hire?
**Director:** In principle. My service desk analyst I role has a high school diploma minimum and we fill it mostly from retail and call centers. A student who already knows ticketing and privacy basics would be ahead.
**Beatriz:** Can you sign a letter naming that role?
**Director:** I can recommend it. But any letter that mentions hiring has to go through HR and our compliance team. That takes three to four weeks here.
**Priya:** What would make compliance comfortable?
**Director:** Wording that says we recognize the credential, not that we guarantee interviews. And a clear line that students under 18 will not touch patient data.
**Beatriz:** Others like you?
**Director:** Every health system will have the same review. Start now, and send them pre-approved wording.`,
      summary:
        "Health system service desk director supports the certification for the service desk analyst I role, but any hiring letter needs HR and compliance review taking three to four weeks. Advises recognition wording rather than interview guarantees and a clear statement on patient data.",
      decisions: "Draft pre-approved letter wording for health systems",
      entities: "service desk analyst I, health system, compliance review, patient data, letter wording",
    },
    {
      key: "outreach-email",
      title: "Email: warm referral template for board members",
      type: "email",
      vendor: "upload",
      author: "delacroix",
      section: "Weeks 3-4: Outreach",
      date: "2024-02-21",
      body: `**To:** Northwind board members and funder contacts
**Subject:** A short favor: one introduction for Northwind's new certifications

Dear [first name],

Northwind is asking employers to support three new certifications that prepare high school students for entry-level jobs: production technician, service desk analyst and reporting associate. The national registry requires signed letters from employers who would recognize the credential when hiring.

Could you forward the note below to one or two people in your network who hire for these roles? We have drafted it so you can send it as is.

---
Hi [name], I sit on the board of Northwind Learning Alliance, which reaches students in thousands of high schools. They are building a certification for [role] and want employers to shape it. It is a one-page letter and a 20-minute call; nothing is binding. Ines Delacroix at Kestrel Bay Advisory is coordinating and will follow up if you are open to it.
---

For health systems, we have pre-approved wording that avoids interview guarantees, which helps with compliance review. Ines can send it on request.

Thank you,
Ines Delacroix, on behalf of Northwind Learning Alliance`,
      summary:
        "Warm referral email template for Northwind board members and funders to forward to hiring contacts, with a paste-ready introduction. Mentions pre-approved wording for health systems to speed compliance review.",
      entities: "warm referral, board members, funders, introduction template, compliance wording",
    },
    {
      key: "insights-draft",
      title: "Employer insights deck v1 (internal draft)",
      type: "deck",
      vendor: "google_slides",
      author: "singh",
      section: "Weeks 3-4: Outreach",
      date: "2024-03-01",
      body: `## Slide 1
Northwind employer validation: what we are hearing. Internal draft for partner review, 1 March.

## Slide 2
Employer interest is strong across all three certifications.
Source: interviews to date.

## Slide 3
Signatories so far: 38 letters signed out of 75 needed.
Source: signatory tracker.

## Slide 4
Manufacturers want safety, measurement and work instructions in the skills list.
Source: manufacturer interviews.

## Slide 5
Health systems are slow to sign because of compliance review.
Source: health system interviews.

## Slide 6
Next steps: push data analytics outreach, chase health systems.`,
      summary:
        "Internal first draft of the employer insights deck, never shown to the client. Reports 38 of 75 letters signed at 1 March and early themes by sector. Partner sent it back for vague titles and no channel finding.",
      entities: "employer insights, signatory count, internal draft, partner review",
    },
    {
      key: "insights-final",
      title: "Employer insights and signatory results",
      type: "deck",
      vendor: "google_slides",
      author: "delacroix",
      section: "Weeks 5-6: Signatories",
      date: "2024-03-13",
      shown: [{ on: "2024-03-15", occasion: "Final readout" }],
      body: `## Slide 1
Northwind employer validation: results and playbook. Final readout, 15 March 2024.

## Slide 2
Northwind has 81 signed employer letters, above the 75 the registry requires, but healthcare IT is two letters short.
Source: signatory tracker.

## Slide 3
Warm introductions drew a 46 percent response rate; cold outreach drew 14 percent.
Source: signatory tracker, response rate by channel.

## Slide 4
Manufacturers will sign for the production technician role if safety, measurement and work instructions are in the skills list.
Source: VP Talent interview, manufacturer interviews.

## Slide 5
Health systems support the certification but need three to four weeks of compliance review, so pre-approved wording is essential.
Source: Director of IT Service Desk interview.

## Slide 6
Employers ask for two things in return: a say in the content and first access to students for summer roles.
Source: 12 employer interviews.

## Slide 7
Recommendation: submit manufacturing and data analytics now; give healthcare IT three more weeks with pre-approved wording.

## Slide 8
The playbook: a two-person Northwind team, board-led introductions, one standard letter per sector and a shared tracker.`,
      summary:
        "Final readout deck shown on 15 March 2024. Reports 81 signed letters against 75 needed, with healthcare IT at 23 of 25. Shows warm introductions converting at 46 percent against 14 percent cold, sector findings and what employers want in return, and recommends a three-week extension for healthcare IT.",
      decisions: "Submit manufacturing and data analytics certifications in March\nExtend healthcare IT outreach by three weeks",
      entities: "final readout, signatory results, warm introductions, healthcare IT, playbook",
    },
    {
      key: "private-notes",
      title: "My notes: who actually opens doors",
      type: "document",
      vendor: "upload",
      author: "singh",
      section: "Weeks 3-4: Outreach",
      date: "2024-02-23",
      visibility: "private",
      body: `Personal working notes. Two board members promised introductions and have sent nothing after two nudges; one funder program officer has sent eleven. The VP sponsor tends to overstate counts in her updates to the CEO, so I am sending her tracker exports instead of totals in email. The data analytics employers are polite but noncommittal; I think the degree screening point is real and we should say so in the readout rather than paper over it.`,
      summary:
        "Private notes on which board members and funders actually made introductions, the sponsor's habit of overstating counts, and doubts about data analytics employers. Not for the firm.",
    },
  ],
  stickies: [
    { section: "Weeks 3-4: Outreach", text: "Dev: titles state the finding with a number. \"Employer interest is strong\" is not a finding.", fill: "yellow" },
    { section: "Weeks 1-2: Targets", text: "Warm intros only for health systems: cold emails die in compliance", fill: "green" },
  ],
  outcome: {
    ranToPlan: true,
    extended: true,
    lesson: "Warm introductions through the board and funders did the work; health systems needed pre-approved letter wording from week one, which would have avoided the three-week extension.",
  },
};
