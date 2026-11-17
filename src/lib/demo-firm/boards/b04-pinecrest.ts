import type { DemoBoard } from "../types";

/** Active sprint board: teacher apprenticeship demand and funding, with the midpoint deck the red pen checks. */
export const b04: DemoBoard = {
  key: "b4",
  practice: "Education and workforce",
  client: { name: "Pinecrest Teaching Collaborative", type: "regional education consortium, 14 member school districts" },
  title: "Teacher apprenticeship demand and funding model",
  pattern: "Program expansion case",
  shape: "sprint",
  start: "2026-10-19",
  weeks: 6,
  fee: "$110k",
  status: "active",
  sharedWithFirm: true,
  brief:
    "Pinecrest's 14 member districts cannot fill special education and secondary math and science posts, and the consortium wants to launch a paid teacher apprenticeship that turns paraprofessionals into certified teachers. Size demand across the districts, line up a university partner and model how the program is funded, so the consortium board can vote on a fall 2027 launch in January.",
  team: ["adeyemi", "ramaswamy", "singh", "costa"],
  sections: ["Intake", "Week 1", "Week 2", "Week 3", "Week 4", "Week 5", "Week 6"],
  items: [
    {
      key: "sow",
      title: "SOW: Pinecrest teacher apprenticeship demand and funding",
      type: "document",
      vendor: "google_docs",
      author: "ramaswamy",
      section: "Intake",
      date: "2026-10-12",
      body: `# Statement of work: teacher apprenticeship demand and funding model

**Client:** Pinecrest Teaching Collaborative  **Sponsor:** Executive Director  **Duration:** 6 weeks from 19 October 2026  **Fee:** $110,000 fixed, expenses capped at 5%

## Objective
Give the consortium board the evidence it needs to vote in January 2027 on launching a paid teacher apprenticeship in fall 2027.

## Scope
1. District demand survey across all 14 member districts: vacancies, permits, paraprofessional workforce, hosting capacity.
2. Paraprofessional interest survey and one focus group.
3. Eight interviews with superintendents, HR directors, a university partner and union leadership.
4. Funding model: cost per apprentice, public funding sources, district share, three-year cohort scenarios.
5. Midpoint check-in (week 5) and final readout with a board-ready recommendation (week 6).

## Out of scope
Drafting the state apprenticeship registration, negotiating the union memorandum, curriculum design.

## Team
Partner (half a day a week), principal (full time), consultant (full time), analyst (half time).

## Milestones
- Week 1: kickoff with the superintendents' council
- Week 5: midpoint check-in with the Executive Director
- Week 6: final readout and board pre-read`,
      summary:
        "Signed six-week, $110k fixed-fee SOW to size demand and model funding for a Pinecrest teacher apprenticeship. Scope covers a 14-district demand survey, a paraprofessional survey and focus group, eight interviews and a three-year funding model. Midpoint check-in in week 5 and a board-ready readout in week 6.",
      decisions: "Fixed fee of $110k, expenses capped at 5%\nState registration and union negotiation out of scope",
      entities: "Pinecrest Teaching Collaborative, Executive Director, superintendents' council, teacher apprenticeship",
    },
    {
      key: "problem",
      title: "Problem definition worksheet",
      type: "document",
      vendor: "google_docs",
      author: "adeyemi",
      section: "Intake",
      date: "2026-10-19",
      body: `# Problem definition

**Basic question:** Is there enough district demand, paraprofessional interest and stable funding for Pinecrest to launch a paid teacher apprenticeship in fall 2027, and what share would each district pay?

**Situation:** Pinecrest coordinates professional learning and shared services for 14 districts. Several districts already run small grow-your-own programs, each with fewer than ten participants.

**Complication:** Special education and secondary math and science posts sit empty or are filled on emergency permits. Paraprofessionals want to become teachers but cannot afford unpaid student teaching. No single district can fund a program alone, and the state grant rules changed in 2025.

**Success looks like:** a demand number the superintendents believe, a university partner with a price, and a district share small enough to pass local school boards.

**Stakeholders:** decides: consortium board (the 14 superintendents). Helps: Executive Director, district HR directors, Harlow State University College of Education. Can block: teachers' union locals, which must agree an apprentice wage step.

**Emerging hypotheses**
1. Paraprofessionals are a large, willing pipeline if they are paid from day one.
2. State, workforce and federal sources can cover most of the cost per apprentice.
3. The district share is affordable in year one but grows with each cohort.`,
      summary:
        "Problem definition in the firm template. Basic question: is there enough demand, interest and funding to launch a paid apprenticeship in fall 2027, and what does each district pay. Names the union locals as the likely blocker and sets three hypotheses about the paraprofessional pipeline, public funding and the district share.",
      entities: "Pinecrest, superintendents, Harlow State University, teachers' union, paraprofessionals, grow-your-own",
    },
    {
      key: "kickoff",
      title: "Kickoff deck: superintendents' council",
      type: "deck",
      vendor: "google_slides",
      author: "adeyemi",
      section: "Week 1",
      date: "2026-10-21",
      shown: [{ on: "2026-10-22", occasion: "Kickoff" }],
      body: `## Slide 1
Pinecrest teacher apprenticeship: demand and funding. Kickoff with the superintendents' council, 22 October 2026.

## Slide 2
The question for the next six weeks: is there enough demand, interest and funding to launch in fall 2027?
Source: problem definition worksheet.

## Slide 3
What we need from each district by 30 October: the demand survey, completed by HR, and a named contact.
Source: data request email.

## Slide 4
We will speak with superintendents, HR directors, Harlow State and paraprofessionals themselves.
Source: SOW.

## Slide 5
Timeline: survey closes week 2, funding model in week 4, midpoint check-in in week 5, readout in week 6.`,
      summary:
        "Kickoff deck shown to the superintendents' council on 22 October 2026. Sets the six-week question, asks each district for the demand survey and a named contact by 30 October, and lays out interviews and the timeline.",
      decisions: "Each district names an HR contact for the survey\nSurvey deadline 30 October",
      entities: "superintendents' council, demand survey, Harlow State, timeline",
    },
    {
      key: "data-request",
      title: "Email: district demand survey and data request",
      type: "email",
      vendor: "upload",
      author: "singh",
      section: "Week 1",
      date: "2026-10-22",
      body: `**To:** District HR directors (14)
**Cc:** Executive Director, Pinecrest Teaching Collaborative
**Subject:** Teacher apprenticeship: 20-minute survey by Friday 30 October

Dear colleagues,

Thank you for the time at this morning's council. As agreed, we are asking each district's HR office to complete a short survey so the consortium can size demand for a paid teacher apprenticeship. It should take about 20 minutes and needs figures you already hold.

The survey asks for:
1. Unfilled teaching positions as of 1 October 2026, by subject area.
2. Teachers currently working on emergency or provisional permits.
3. Number of paraprofessionals employed, and how many hold an associate degree or more.
4. Whether you would host apprentices in the first cohort (fall 2027), and roughly how many.
5. Teachers you consider eligible to mentor an apprentice, and a stipend you think would work.

Separately, we will send a link you can forward to paraprofessionals asking about their interest. It is anonymous and takes five minutes.

If any figure is hard to pull, send your best estimate and flag it. We will not publish district-level numbers outside the consortium.

Best regards,
Priya Singh
Kestrel Bay Advisory`,
      summary:
        "Data request email to all 14 district HR directors asking for vacancies, permit counts, paraprofessional numbers, hosting capacity and mentor capacity by 30 October. Also announces an anonymous paraprofessional interest survey.",
      entities: "district HR directors, demand survey, paraprofessional survey, emergency permits, mentors",
    },
    {
      key: "funding-chat",
      title: "Research: funding sources for teacher apprenticeships",
      type: "ai_thread",
      vendor: "claude",
      author: "singh",
      section: "Week 1",
      date: "2026-10-23",
      turns: [
        {
          role: "user",
          content:
            "I'm building a funding model for a regional teacher apprenticeship that pays paraprofessionals while they earn a bachelor's degree and certification. List the public funding sources that can cover apprentice wages, tuition and mentor stipends, with typical amounts. Label each point FACT with a dated source or INFERENCE, and flag where sources disagree.",
        },
        {
          role: "assistant",
          content:
            "Here is a first pass.\n\nFACT (US Department of Labor guidance, 2022): K-12 teaching is recognized as a registered apprenticeship occupation, which opens workforce funding to teacher apprentices.\n\nFACT (state education department grant guidance, 2025): the state teacher apprenticeship grant pays up to $7,500 per apprentice per year to a registered program sponsor, renewable for up to three years.\n\nFACT (local workforce board policies, 2024 to 2025): WIOA individual training accounts are capped by each local board, commonly between $3,000 and $7,500 per participant.\n\nFACT (federal student aid data, 2025): Pell grants are need-based; eligibility among working adults varies widely by household income.\n\nFACT (federal program guidance, 2024): Title II-A funds may be used for teacher preparation and residency costs.\n\nINFERENCE: wage costs are the hardest piece to fund from public sources, so districts will carry most of the remaining gap.\n\nWhere sources disagree: published retention results for grow-your-own and apprenticeship programs vary a lot by program and are mostly early cohorts, so I would not quote a single retention rate.",
        },
        {
          role: "user",
          content:
            "Our region's workforce board caps individual training accounts at $5,000. Rewrite this as a one-page brief I can use for the model, with the regional cap and questions for district finance staff.",
        },
        {
          role: "assistant",
          content:
            "Done. The brief keeps the FACT and INFERENCE labels, uses the $5,000 regional cap, notes that wages are the hardest cost to fund, and ends with three questions for district finance staff.",
        },
      ],
      summary:
        "AI research chat on public funding for teacher apprenticeships, labelled FACT or INFERENCE: state grant up to $7,500 per apprentice per year, WIOA accounts capped locally, Pell and Title II-A. Warns that retention results vary and no single rate should be quoted. Produced the funding sources brief.",
      entities: "state teacher apprenticeship grant, WIOA, Pell, Title II-A, registered apprenticeship, retention",
    },
    {
      key: "funding-brief",
      title: "Brief: public funding sources for the apprenticeship",
      type: "document",
      vendor: "claude",
      author: "singh",
      section: "Week 1",
      date: "2026-10-23",
      madeFrom: "funding-chat",
      body: `# Public funding sources: one-page brief

**State teacher apprenticeship grant (FACT, state education department guidance, 2025):** up to $7,500 per apprentice per year, paid to a registered sponsor, renewable for three years. Pinecrest would need to be the registered sponsor.

**WIOA individual training accounts (FACT, regional workforce board policy, 2025):** our regional board caps accounts at $5,000 per participant. Boards elsewhere range from $3,000 to $7,500, and caps can change each program year.

**Pell grants (FACT, federal student aid data, 2025):** need-based; expected value depends on how many apprentices qualify.

**Title II-A (FACT, federal program guidance, 2024):** districts can redirect part of their allocation to teacher preparation.

**Wages (INFERENCE):** the hardest cost to fund publicly; expect districts to carry most of the gap.

**Retention (where sources disagree):** program results vary and most cohorts are recent. Do not quote a single retention rate.

**Questions for district finance staff**
1. How much Title II-A could you redirect per apprentice without cutting existing programs?
2. Would your board treat the district share as a recurring line or a pilot cost?
3. What is the most your board would approve per year without a separate vote?`,
      summary:
        "One-page funding brief made from the research chat. State grant up to $7,500 per apprentice per year, regional WIOA cap of $5,000, Pell and Title II-A, with wages flagged as the hardest cost to fund. Explicitly says not to quote a single retention rate.",
      entities: "state grant, WIOA, regional workforce board, Pell, Title II-A, district finance",
    },
    {
      key: "int-superintendent",
      title: "Interview: Superintendent, large member district",
      type: "call",
      vendor: "granola",
      author: "adeyemi",
      section: "Week 2",
      date: "2026-10-28",
      informs: ["midpoint"],
      body: `# Interview: Superintendent, one of the three largest member districts
Attendees: Folake Adeyemi (Kestrel Bay), Priya Singh (Kestrel Bay), Superintendent

**Folake:** How did you open the school year on staffing?
**Superintendent:** With 23 vacancies. Nine of those are special education. We covered most of them with long-term subs and two contract agencies.
**Priya:** Where would apprentices help first?
**Superintendent:** Special education, no question. Then secondary math. I would rather have a trained apprentice in a resource room than a rotating sub.
**Folake:** Who would you want in the first cohort?
**Superintendent:** Paras who already have an associate degree and a few years with us. They know our kids and they stay.
**Priya:** What would your board accept as a district contribution?
**Superintendent:** If the district share is under $25,000 a year, I can get it through my board as part of the professional learning line. Above that it becomes a separate vote and a much harder conversation.
**Folake:** What would make you skeptical of the program?
**Superintendent:** If it depends on one grant that disappears in year two. I have seen that before.`,
      summary:
        "Superintendent of a large district opened the year with 23 vacancies, 9 in special education, and wants apprentices in special education first. Prefers paraprofessionals with an associate degree. Can pass a district share under $25,000 a year without a separate board vote and is wary of single-grant dependence.",
      decisions: "Superintendent threshold for district share: under $25,000 a year",
      entities: "superintendent, special education, long-term substitutes, district share, paraprofessionals",
    },
    {
      key: "int-hr",
      title: "Interview: HR Director, mid-sized member district",
      type: "call",
      vendor: "granola",
      author: "singh",
      section: "Week 2",
      date: "2026-10-30",
      informs: ["midpoint"],
      body: `# Interview: HR Director, mid-sized member district
Attendees: Priya Singh (Kestrel Bay), Beatriz Costa (Kestrel Bay), HR Director

**Priya:** How stable is your paraprofessional workforce?
**HR Director:** Not very. Para turnover runs about 28 percent a year. They leave for retail and warehouse jobs that pay more.
**Beatriz:** How many of them could start a bachelor's program?
**HR Director:** About one in five of our paras already has an associate degree or more. Those are the ones who ask me about teaching.
**Priya:** What does early teacher turnover cost you?
**HR Director:** We worked it out last year: about $11,000 for every teacher who leaves in their first three years, counting recruiting, onboarding and sub coverage.
**Beatriz:** What should an apprentice be paid?
**HR Director:** Our paras average $27,500. An apprentice at $34,000 would be a real step up and still well below a first-year teacher. But that wage step has to be agreed with the union local through a memorandum. We cannot just create it.
**Priya:** Would the union support it?
**HR Director:** The local president likes the idea. They will want apprentices kept out of the count when classes are sized.`,
      summary:
        "HR Director reports paraprofessional turnover of about 28 percent a year and says about one in five paras hold an associate degree or more. Early teacher turnover costs about $11,000 per leaver. Suggests an apprentice wage of $34,000 against average para pay of $27,500, which needs a union memorandum.",
      decisions: "Model apprentice wage at $34,000 against para pay of $27,500",
      entities: "HR Director, paraprofessional turnover, union memorandum, apprentice wage, teacher turnover cost",
    },
    {
      key: "int-dean",
      title: "Interview: Dean, Harlow State University College of Education",
      type: "call",
      vendor: "granola",
      author: "adeyemi",
      section: "Week 3",
      date: "2026-11-03",
      informs: ["midpoint", "funding-model"],
      body: `# Interview: Dean, Harlow State University College of Education
Attendees: Folake Adeyemi, Dev Ramaswamy (Kestrel Bay), Dean, Associate Dean for Partnerships

**Folake:** Could Harlow State deliver a degree and certification pathway for working paraprofessionals?
**Dean:** Yes. We would run it as a cohort with evening and online courses and clinical hours in their own schools, so they never stop working.
**Dev:** What would tuition be?
**Dean:** For a consortium cohort we can do $9,800 a year per apprentice. That is below our standard rate because you bring us the students and the placements.
**Folake:** How large could the first cohort be?
**Associate Dean:** We would cap the first cohort at 70 seats, starting fall 2027. If it goes well we can grow to 100 seats a year by year three.
**Dev:** What has to happen first?
**Dean:** State program approval for the pathway. That takes about six months, so we need a signed agreement by February to make fall 2027.
**Folake:** What do you need from districts?
**Dean:** Named mentor teachers for every apprentice, and a commitment that apprentices get release time for coursework.`,
      summary:
        "Harlow State can deliver a cohort-based degree and certification pathway at $9,800 a year per apprentice. First cohort capped at 70 seats in fall 2027, growing to 100 seats a year by year three. State program approval takes about six months, so an agreement is needed by February.",
      decisions: "Tuition modeled at $9,800 per apprentice per year\nFirst cohort cap of 70 seats",
      entities: "Harlow State University, College of Education, tuition, cohort cap, state program approval, mentors",
    },
    {
      key: "focus-group",
      title: "Paraprofessional focus group",
      type: "call",
      vendor: "granola",
      author: "costa",
      section: "Week 3",
      date: "2026-11-05",
      informs: ["midpoint"],
      body: `# Focus group: paraprofessionals from four member districts
Attendees: Beatriz Costa, Priya Singh (Kestrel Bay), 8 paraprofessionals (special education, general classroom, bilingual support)

**Beatriz:** How many of you have thought about becoming a teacher?
**Participants:** All eight raised hands.
**Priya:** What has stopped you?
**Para (special education):** Student teaching. It is a full semester unpaid. I have two kids. I cannot go without a paycheck for four months.
**Para (bilingual support):** Same. I started a program once and dropped out at the student teaching step.
**Beatriz:** If the program paid you at least what you earn now, the whole way through, would you apply?
**Participants:** Six of the eight said yes. The other two said it depended on childcare and evening class times.
**Priya:** What would make you trust the program?
**Para (general classroom):** Knowing there is a job at the end, in my district. And that the classes fit around the school day.
**Beatriz:** Anything else?
**Para (special education):** Mentors who actually have time for us. Our teachers are stretched already.`,
      summary:
        "Focus group of eight paraprofessionals: all have considered teaching, and unpaid student teaching is the main barrier. Six of eight would apply if paid at least their current wage throughout. They want a job guarantee in their district, classes that fit the school day and mentors with real time.",
      entities: "paraprofessionals, focus group, student teaching, childcare, mentors, job guarantee",
    },
    {
      key: "survey-results",
      title: "District demand survey results",
      type: "sheet",
      vendor: "upload",
      author: "costa",
      section: "Week 3",
      date: "2026-11-06",
      informs: ["midpoint"],
      body: `# District demand survey: consortium summary (11 of 14 districts responded)

| Measure | Value |
|---|---|
| Districts responding | 11 of 14 |
| Unfilled teaching positions, 1 October 2026 | 186 |
| of which special education | 71 |
| of which secondary math and science | 41 |
| Teachers on emergency or provisional permits | 214 |
| Paraprofessionals employed | 2,140 |
| Paraprofessional survey responses | 618 |
| Paraprofessionals very interested in a paid pathway | 253 (41% of respondents) |
| Districts willing to host apprentices in year 1 | 9 of 11 |
| Year 1 apprentice seats offered (indicative) | 64 |
| Eligible mentor teachers identified | 120 |
| Mentor stipend districts consider workable | $2,500 a year |

## Seats offered by district size
| District size | Districts hosting | Seats offered |
|---|---|---|
| Large (over 10,000 students) | 3 | 34 |
| Mid-sized (3,000 to 10,000) | 4 | 22 |
| Small (under 3,000) | 2 | 8 |

Notes: three districts had not responded by the 6 November cutoff. Seat counts are indicative and not board-approved.`,
      summary:
        "Survey results from 11 of 14 districts: 186 unfilled positions (71 special education, 41 secondary math and science), 214 teachers on emergency permits and 2,140 paraprofessionals, of whom 253 respondents are very interested. Nine districts would host 64 apprentices in year 1, with 120 eligible mentors and a $2,500 stipend.",
      entities: "district demand survey, vacancies, special education, emergency permits, paraprofessionals, mentors",
    },
    {
      key: "funding-model",
      title: "Funding model v2: cost per apprentice and cohort scenarios",
      type: "sheet",
      vendor: "upload",
      author: "singh",
      section: "Week 4",
      date: "2026-11-11",
      informs: ["midpoint"],
      body: `# Funding model v2 (11 Nov), summary tab

## Cost per apprentice per year
| Line | Amount |
|---|---|
| Wage uplift over para pay ($34,000 vs $27,500) | $6,500 |
| Tuition, Harlow State consortium rate | $9,800 |
| Mentor stipend | $2,500 |
| Program coordination, consortium hub | $1,200 |
| **Total cost per apprentice** | **$20,000** |

## Funding sources per apprentice per year (base case)
| Source | Amount |
|---|---|
| State teacher apprenticeship grant | $7,500 |
| WIOA individual training account (regional cap) | $5,000 |
| Pell grant, expected value (60% eligible x $4,200) | $2,500 |
| Title II-A reallocation | $2,000 |
| **Total identified sources** | **$17,000** |
| **District gap per apprentice** | **$3,000** |

## Cohort scenarios
| | Year 1 (2027-28) | Year 2 | Year 3 |
|---|---|---|---|
| New apprentices | 64 | 80 | 90 |
| Apprentices enrolled | 64 | 144 | 234 |
| Total program cost | $1.28M | $2.88M | $4.68M |
| District gap, base | $0.19M | $0.43M | $0.70M |
| District gap, low case (WIOA at $2,500) | $0.35M | $0.79M | $1.29M |

Version log: v1 (6 Nov) used a $10,500 tuition placeholder; v2 uses the Harlow State rate. Year 1 base gap spread over 9 hosting districts is about $21,000 each.`,
      summary:
        "Funding model v2: a fully loaded apprentice costs $20,000 a year and identified public sources cover $17,000, leaving a $3,000 district gap. Total program cost rises from $1.28M in year 1 to $4.68M in year 3; the base district gap goes from $0.19M (about $21,000 per hosting district) to $0.70M.",
      entities: "funding model, cost per apprentice, state grant, WIOA, Pell, Title II-A, district gap, cohort scenarios",
    },
    {
      key: "midpoint",
      title: "Midpoint deck: demand and funding findings (draft)",
      type: "deck",
      vendor: "google_slides",
      author: "adeyemi",
      section: "Week 4",
      date: "2026-11-13",
      body: `## Slide 1
Pinecrest teacher apprenticeship: midpoint findings. Working draft for the 18 November check-in with the Executive Director.

## Slide 2
Member districts can fill a first cohort of 64 apprentices and grow to 90 new apprentices a year by year three.
- The 11 responding districts reported 186 unfilled teaching positions on 1 October.
- 253 paraprofessionals said they are very interested in a paid pathway.
- A fully loaded apprentice costs $20,000 a year, and identified public sources cover $17,000.
Source: district demand survey results, funding model v2.

## Slide 3
Vacancies are concentrated in special education and secondary math and science.
- 71 of the 186 unfilled positions are in special education.
- 41 are in secondary math and science.
- 214 teachers are working on emergency or provisional permits.
- Vacancies are up 33 percent on last fall, when member districts reported 140 unfilled positions.
Source: district demand survey results.

## Slide 4
Superintendents want special education apprentices first.
- One large district opened the year with 23 vacancies, 9 of them in special education.
- It covers most of them with long-term substitutes and contract agencies.
Source: superintendent interview.

## Slide 5
Paraprofessionals are the natural pipeline: 2,140 already work in member districts.
- 41 percent of the 618 paraprofessionals who answered the survey are very interested.
- About one in five paraprofessionals already holds an associate degree or more.
- Paraprofessional turnover runs about 28 percent a year in one mid-sized district.
Source: district demand survey results, HR Director interview.

## Slide 6
Lost income, not interest, is the barrier, so apprentices must be paid from day one.
- Six of eight focus group participants would apply if paid at least their current wage.
- We propose an apprentice wage of $34,000 against average paraprofessional pay of $27,500.
- The wage step needs a memorandum with each union local.
Source: paraprofessional focus group, HR Director interview.

## Slide 7
Districts have the seats and the mentors for year one.
- 9 of 11 responding districts would host apprentices in the first cohort.
- 120 eligible mentor teachers have been identified, enough for 64 apprentices.
- Districts consider a $2,500 annual mentor stipend workable.
Source: district demand survey results.

## Slide 8
Harlow State can deliver the degree at $9,800 a year per apprentice, starting fall 2027.
- The first cohort is capped at 70 seats, growing to 100 seats a year by year three.
- State program approval takes about six months, so the agreement must be signed by February.
Source: Harlow State dean interview.

## Slide 9
A fully loaded apprentice costs $20,000 a year.
- Wage uplift $6,500, tuition $9,800, mentor stipend $2,500, program coordination $1,200.
Source: funding model v2.

## Slide 10
Public sources cover $17,000 of the $20,000, leaving a $3,000 district gap per apprentice.
- State teacher apprenticeship grant: $7,500 per apprentice per year.
- WIOA individual training account: $5,000 at the regional cap.
- Pell grant expected value $2,500 and Title II-A reallocation $2,000.
- A regional foundation has indicated it will cover the first-year district gap.
Source: funding sources brief, funding model v2.

## Slide 11
The district share fits superintendents' limits in year one but not at scale.
- The year one gap is $0.19M, about $21,000 per hosting district, under the $25,000 a board will pass without a separate vote.
- By year three the program costs $3.9M a year across all cohorts.
- If the WIOA cap falls to $2,500, the year one gap rises to $0.35M.
Source: funding model v2, superintendent interview.

## Slide 12
Retention is where the program earns its keep.
- Each teacher who leaves in the first three years costs a district about $11,000.
- Nationally, apprentice-trained teachers stay in the profession at a 92 percent rate after five years.
Source: HR Director interview, funding sources brief.

## Slide 13
Decisions needed by the January board meeting.
- Agree a cost-sharing formula for the district gap from year two.
- Authorize Pinecrest to register as the apprenticeship sponsor.
- Open union conversations on the apprentice wage step.`,
      summary:
        "Draft midpoint deck for the 18 November check-in, not yet shown. Argues districts can fill a first cohort of 64 apprentices, that a $20,000 apprentice is 85 percent publicly funded with a $3,000 district gap, and that the gap fits superintendents' limits in year one but not at scale. Ends with three decisions for the January board.",
      decisions: "Lead the check-in with special education demand\nAsk the board for a cost-sharing formula from year two",
      entities: "midpoint deck, vacancies, paraprofessionals, Harlow State, funding model, district gap, retention",
      unsupported: [
        "Vacancies are up 33 percent on last fall, when member districts reported 140 unfilled positions.",
        "A regional foundation has indicated it will cover the first-year district gap.",
        "By year three the program costs $3.9M a year across all cohorts.",
        "Nationally, apprentice-trained teachers stay in the profession at a 92 percent rate after five years.",
      ],
    },
    {
      key: "partner-review",
      title: "Partner review notes on the midpoint draft",
      type: "document",
      vendor: "google_docs",
      author: "ramaswamy",
      section: "Week 5",
      date: "2026-11-16",
      body: `# Partner review: midpoint draft (16 Nov)

- Slide 2 is right: lead with the cohort number. The Executive Director will forward slide 2 and nothing else.
- Every number needs a source line naming the survey, the model or the interview. If it came from an interview, say which role.
- Slides 11 and 12 are where the superintendents will push. Check every figure on them against model v2 before Wednesday, not v1.
- Do not let one district's story stand for the region. Slide 4 is fine as color, but keep the consortium totals on the slides around it.
- The ask on slide 13 should be one decision, not three. The cost-sharing formula is the one that matters.
- Keep titles as full sentences that state the finding. "Funding" is not a title.
- Remove anything we cannot defend in the room. If a number is not on the board, it does not go on a slide.`,
      summary:
        "Partner's review of the midpoint draft: lead with the cohort number, a source line on every figure, and check slides 11 and 12 against model v2 before the check-in. Asks for one decision on slide 13 and for every number on a slide to trace to something on the board.",
      decisions: "One ask on the final slide: the cost-sharing formula\nCheck slides 11 and 12 against model v2",
      entities: "partner review, Executive Director, source lines, funding model v2, slide titles",
    },
    {
      key: "private-notes",
      title: "My notes: council dynamics",
      type: "document",
      vendor: "upload",
      author: "singh",
      section: "Week 2",
      date: "2026-10-29",
      visibility: "private",
      body: `Personal working notes after the first week of calls. The two largest districts are already competing over who hosts the hub, and that will color how they answer the seat question. The Executive Director is keen but nervous about asking small districts for money in an election year for two school boards. The union local president in the mid-sized district is more supportive than the HR Director thinks. Keep the survey results at consortium level when we present, so no district feels named.`,
      summary:
        "Private working notes on council dynamics: rivalry between the two largest districts, the Executive Director's caution about asking small districts for money, and a more supportive union local than expected. Not for the firm.",
    },
  ],
  stickies: [
    { section: "Week 4", text: "Dev: every slide number needs a source line that names the survey, the model or the interview role.", fill: "yellow" },
    { section: "Week 2", text: "District share must stay under $25,000 a year to avoid a separate board vote", fill: "green" },
  ],
};
