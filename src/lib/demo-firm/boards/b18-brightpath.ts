import type { DemoBoard } from "../types";

/** Closed six-week pricing sprint: membership plan for uninsured dental patients, a proposal comparable. */
export const b18: DemoBoard = {
  key: "b18",
  practice: "Growth and marketing",
  client: { name: "Brightpath Dental Group", type: "dental service organization, 46 practices in 3 states" },
  title: "Membership plan pricing",
  pattern: "Pricing strategy",
  shape: "sprint",
  start: "2025-04-07",
  weeks: 6,
  fee: "$120k",
  status: "closed",
  sharedWithFirm: true,
  situation: "pricing",
  brief:
    "More than a third of Brightpath's patients have no dental insurance, and they defer cleanings until something hurts. Design and price an in-house membership plan for uninsured patients: what it covers, what it costs per month, how front desks sell it and how it affects practice revenue, ready to pilot in 8 practices.",
  team: ["kowalski", "hollis", "lund"],
  sections: ["Week 1", "Week 2", "Week 3", "Week 4", "Week 5", "Week 6"],
  items: [
    {
      key: "sow",
      title: "SOW: Brightpath membership plan pricing",
      type: "document",
      vendor: "google_docs",
      author: "hollis",
      section: "Week 1",
      date: "2025-03-31",
      body: `# Statement of work: membership plan pricing

**Client:** Brightpath Dental Group  **Sponsor:** Chief Financial Officer  **Duration:** 6 weeks from 7 April 2025  **Fee:** $120,000 fixed, plus expenses capped at 5%

## Objective
Design and price an in-house dental membership plan for uninsured patients and a pilot plan for 8 practices starting July 2025.

## Scope
1. Patient base analysis: insured versus self-pay mix, visit frequency and treatment acceptance by practice.
2. Patient research: 10 interviews with self-pay patients, office managers and dentists, plus a willingness-to-pay survey of existing patients.
3. Plan design: tiers, inclusions, discount on other treatment, terms.
4. Pricing and revenue model, including cannibalization of existing self-pay visits.
5. Front desk sales script and pilot plan.

## Out of scope
Regulatory review by state (handled by Brightpath counsel), software configuration, marketing creative.

## Team
Partner (0.5 day a week), manager (full time), analyst (full time).

## Milestones
- Week 1: kickoff and data request
- Week 3: patient findings and plan options (working session with CFO)
- Week 6: final pricing recommendation and pilot plan`,
      summary:
        "Signed six-week, $120k fixed-fee SOW to design and price a membership plan for Brightpath's uninsured patients. Covers patient base analysis, 10 interviews and a willingness-to-pay survey, plan design, a revenue model and a pilot in 8 practices from July 2025.",
      decisions: "Fixed fee of $120k with expenses capped at 5%\nState regulatory review stays with Brightpath counsel",
      entities: "Brightpath Dental Group, CFO, membership plan, uninsured patients, willingness to pay, pilot",
    },
    {
      key: "problem",
      title: "Problem definition worksheet",
      type: "document",
      vendor: "google_docs",
      author: "kowalski",
      section: "Week 1",
      date: "2025-04-08",
      body: `# Problem definition

**Basic question:** What membership plan, at what monthly price, will bring Brightpath's uninsured patients in for regular preventive care and lift practice revenue, piloted in 8 practices from July 2025?

**Situation:** Brightpath runs 46 practices in three states. About 38 percent of active patients are self-pay. Several competing practices in our markets already advertise membership plans.

**Complication:** Self-pay patients come back for a recall visit far less often than insured patients, so problems are found late and treated as emergencies. Front desks quote fee-schedule prices that feel high, and treatment acceptance among self-pay patients is low.

**Success looks like:** a plan a front desk can explain in under a minute, a price at least 60 percent of target patients find acceptable, and a revenue model the CFO trusts.

**Stakeholders:** decides: CFO and Chief Operating Officer. Helps: regional directors, office managers. Can block: the dentist advisory council, if the plan discount feels like undervaluing their work.

**Emerging hypotheses**
1. A monthly price below $30 for adults is the threshold that changes behavior.
2. Members will accept more treatment because they get a discount and feel looked after.
3. Cannibalization of current self-pay cleaning revenue will be smaller than the uplift in treatment.`,
      summary:
        "Problem definition in the firm template. About 38 percent of Brightpath's active patients are self-pay and they return for recall visits far less than insured patients. Success is a one-minute front desk pitch and a price 60 percent find acceptable. The dentist advisory council could block.",
      entities: "Brightpath, self-pay patients, recall visits, front desk, dentist advisory council, CFO",
    },
    {
      key: "data-request",
      title: "Email: patient and practice data request",
      type: "email",
      vendor: "upload",
      author: "lund",
      section: "Week 1",
      date: "2025-04-08",
      body: `**To:** Director of revenue cycle, Brightpath Dental Group
**Cc:** Piotr Kowalski
**Subject:** Membership plan: data request

Thanks for the kickoff yesterday. To build the patient base view and revenue model we would like the following by Monday 14 April:

1. Active patients by practice for the last 24 months, flagged insured or self-pay.
2. Visits by patient and procedure code (cleanings, exams, x-rays, fillings, crowns, periodontal treatment), with fee charged and amount collected.
3. Recall compliance by practice, as your practice management system defines it.
4. Treatment plans presented and accepted, by payer type.
5. Any current discount schemes front desks offer to self-pay patients.

Patient identifiers can be replaced with a random ID; we do not need names or contact details.

Thanks,
Felix Lund
Analyst, Kestrel Bay Advisory`,
      summary:
        "Data request to Brightpath's revenue cycle director for 24 months of patient, visit, recall and treatment acceptance data by payer type, with patient identifiers replaced by random IDs.",
      entities: "data request, revenue cycle, recall compliance, treatment acceptance, procedure codes",
    },
    {
      key: "research-chat",
      title: "Research: dental membership plan designs and pricing",
      type: "ai_thread",
      method: ["desk_research", "financial_model"],
      vendor: "claude",
      author: "lund",
      section: "Week 1",
      date: "2025-04-10",
      turns: [
        {
          role: "user",
          content:
            "I'm helping a dental service organization design an in-house membership plan for uninsured patients. What do these plans usually include, how are they priced, and what is known about their effect on visits and treatment? Label FACT with dated generic sources, or INFERENCE.",
        },
        {
          role: "assistant",
          content:
            "Summary:\n\nFACT (dental industry surveys, 2023 to 2024): in-house plans typically include two cleanings, two exams and routine x-rays a year, plus a discount of 10 to 25 percent on other treatment. Many offer adult, child and periodontal tiers.\n\nFACT (practice consultant publications, 2024): monthly prices for adult plans commonly sit in a band from the low twenties to the high thirties of dollars, with an annual prepay discount.\n\nFACT (vendor case studies, 2023): practices report members visit more often than other self-pay patients, though these are self-reported by plan software vendors.\n\nINFERENCE: the discount on treatment matters more to acceptance than the monthly price, because it changes the size of the bill patients fear.\n\nINFERENCE: a periodontal tier is needed, or patients with gum disease will join the basic plan and cost more than they pay.\n\nWhere sources disagree: vendor case studies report much larger revenue gains than independent surveys. Treat vendor figures as upper bounds.",
        },
        { role: "user", content: "Make a short brief with a benchmark table I can use to frame the survey price points." },
        {
          role: "assistant",
          content:
            "Done. The brief has a benchmark table for inclusions, monthly price bands and discounts, suggests testing price points from $19 to $39 a month, and keeps the warning about vendor figures.",
        },
      ],
      summary:
        "AI research chat on in-house dental membership plan inclusions, price bands and effects on visits, labelled FACT or INFERENCE. Warns that vendor case studies overstate gains compared with independent surveys. Produced the benchmark brief used to set survey price points.",
      entities: "membership plans, dental pricing, periodontal tier, treatment discount, vendor case studies",
    },
    {
      key: "benchmark-brief",
      title: "Brief: membership plan benchmarks",
      type: "document",
      method: ["desk_research"],
      vendor: "claude",
      author: "lund",
      section: "Week 1",
      date: "2025-04-10",
      madeFrom: "research-chat",
      body: `# Dental membership plan benchmarks

| Element | Typical market practice | Source |
|---|---|---|
| Preventive inclusions | 2 cleanings, 2 exams, routine x-rays a year | FACT, industry surveys 2023 to 2024 |
| Discount on other treatment | 10 to 25 percent | FACT, industry surveys 2023 to 2024 |
| Adult monthly price | low $20s to high $30s | FACT, consultant publications 2024 |
| Tiers | adult, child, periodontal | FACT, consultant publications 2024 |
| Annual prepay | usually one month free | FACT, consultant publications 2024 |

**What we infer (INFERENCE):** the treatment discount drives acceptance more than the monthly price; a periodontal tier protects margin.

**Where sources disagree:** vendor case studies show far larger revenue gains than independent surveys. Use vendor figures only as an upper bound.

**Survey design:** test adult price points at $19, $24, $29, $34 and $39 a month with a Van Westendorp question set, and test 15 versus 20 percent treatment discounts.`,
      summary:
        "Benchmark brief made from the research chat: typical inclusions, 10 to 25 percent treatment discounts and adult prices from the low $20s to high $30s a month. Sets survey price points from $19 to $39 and flags vendor figures as upper bounds.",
      entities: "benchmarks, Van Westendorp, treatment discount, periodontal tier, annual prepay",
    },
    {
      key: "int-office-manager",
      title: "Interview: Office manager, high self-pay practice",
      type: "call",
      method: ["customer_research"],
      role: "practice_manager",
      vendor: "granola",
      author: "kowalski",
      section: "Week 2",
      date: "2025-04-15",
      informs: ["final-deck"],
      body: `# Interview: Office manager, Brightpath practice with 52 percent self-pay patients
Attendees: Piotr Kowalski, Felix Lund (Kestrel Bay), Office manager

**Piotr:** What happens when a self-pay patient calls for a cleaning?
**Office manager:** We quote the fee schedule: cleaning, exam and x-rays come to about $310. A lot of them go quiet at that point. The ones who book often cancel the day before.
**Felix:** What do they say?
**Office manager:** That they will come in when something hurts. Then they come in with a broken tooth and the bill is $1,800 instead of $310.
**Piotr:** If you could offer a plan for a monthly fee, how would you pitch it?
**Office manager:** Keep it to one sentence. Two cleanings, exams, x-rays, and a discount on anything else, for one monthly price. If I need a brochure to explain it, it will not sell.
**Felix:** What price would feel right to your patients?
**Office manager:** Under $30 a month. When I say thirty-something, I can see faces change.
**Piotr:** What worries you?
**Office manager:** That the dentists see it as cheapening the work. And people signing up, getting the free cleaning, and cancelling.`,
      summary:
        "Office manager at a practice with 52 percent self-pay patients: preventive visit quotes of about $310 put patients off and many return only with emergencies costing around $1,800. The pitch must fit one sentence and adult price should stay under $30 a month. Worries about dentist reaction and sign-and-cancel behavior.",
      decisions: "Plan must be explainable in one sentence at the front desk",
      entities: "office manager, self-pay, fee schedule, cancellations, front desk pitch, price threshold",
    },
    {
      key: "int-dentist",
      title: "Interview: Dentist advisory council chair",
      type: "call",
      method: ["stakeholder_interviews"],
      role: "clinician",
      vendor: "granola",
      author: "hollis",
      section: "Week 2",
      date: "2025-04-17",
      informs: ["final-deck"],
      body: `# Interview: Chair of the dentist advisory council
Attendees: Maren Hollis, Piotr Kowalski (Kestrel Bay), Council chair (practicing dentist)

**Maren:** How does the council feel about a membership plan?
**Chair:** Mixed. Some of us ran plans in private practice and loved them. Others think a 20 percent discount tells patients our fees were padded.
**Piotr:** What would make it acceptable to the skeptics?
**Chair:** Keep the discount at 15 percent, not 20. Exclude implants and orthodontics. And show us that members accept more treatment, not just that they come in for cheap cleanings.
**Maren:** What about patients with gum disease?
**Chair:** They need a separate plan. Periodontal maintenance is three or four visits a year, not two. If they join the basic plan we lose money on every one of them.
**Piotr:** Would the council support a pilot?
**Chair:** Yes, if we see the numbers after six months and can change the discount.`,
      summary:
        "Dentist advisory council chair: council is split; skeptics would accept a 15 percent discount rather than 20, with implants and orthodontics excluded, and evidence that members accept more treatment. Wants a separate periodontal plan and a six-month review of the pilot.",
      decisions: "Treatment discount set at 15 percent to win council support\nPeriodontal patients need their own tier\nPilot reviewed at six months",
      entities: "dentist advisory council, treatment discount, periodontal maintenance, implants, orthodontics, pilot review",
    },
    {
      key: "wtp-model",
      title: "Model: willingness to pay survey and plan revenue",
      type: "sheet",
      method: ["survey", "financial_model"],
      vendor: "upload",
      author: "lund",
      section: "Week 4",
      date: "2025-05-02",
      body: `# Willingness to pay and revenue model v3 (2 May)

## Survey (1,150 self-pay patients, Van Westendorp)
| Measure | Adult monthly price |
|---|---|
| Too cheap to trust | $17 |
| Acceptable range | $24 to $34 |
| Optimal price point | $27 |
| Share finding $29 acceptable | 64% |
| Share finding $34 acceptable | 41% |

## Recommended plans
| Plan | Monthly | Annual prepay | Includes |
|---|---|---|---|
| Adult | $29 | $319 | 2 cleanings, 2 exams, x-rays, 15% off other treatment |
| Child (under 14) | $22 | $242 | same, plus fluoride and sealants |
| Gum health | $45 | $495 | 4 periodontal maintenance visits, exams, x-rays, 15% off |

## Pilot revenue (8 practices, 12 months)
| Line | Value |
|---|---|
| Members at month 12 | 2,100 |
| Membership revenue | $640k |
| Lost fee-schedule preventive revenue | -$210k |
| Treatment uplift (acceptance 38% to 52%) | $470k |
| Net revenue impact | $900k |

Scaled to 46 practices: about 12,000 members and $5.2M net revenue impact a year.`,
      summary:
        "Survey of 1,150 self-pay patients puts the acceptable adult range at $24 to $34 a month, with 64 percent accepting $29. Recommends Adult $29, Child $22 and Gum health $45. Pilot model: 2,100 members in 8 practices and $900k net revenue impact; about $5.2M a year across 46 practices.",
      entities: "willingness to pay, Van Westendorp, adult plan, child plan, gum health plan, pilot revenue, cannibalization",
    },
    {
      key: "draft-deck",
      title: "Pricing deck draft v1 (internal, not shown)",
      type: "deck",
      method: ["financial_model", "synthesis"],
      vendor: "google_slides",
      author: "kowalski",
      section: "Week 4",
      date: "2025-05-05",
      body: `## Slide 1
Brightpath membership plan: pricing options. Draft v1.

## Slide 2
Options overview: three pricing scenarios at $24, $29 and $34.

## Slide 3
Survey results: Van Westendorp chart.
Source: survey.

## Slide 4
Plan inclusions.

## Slide 5
Revenue scenarios by price point.
Source: model v2.

## Slide 6
Next steps.`,
      summary:
        "First internal draft of the pricing deck, never shown to the client. Presented three price scenarios without a recommendation and used topic titles rather than findings. Partner review sent it back.",
      entities: "pricing deck draft, price scenarios, Van Westendorp",
    },
    {
      key: "partner-notes",
      title: "Partner review notes on pricing draft v1",
      type: "document",
      vendor: "upload",
      author: "hollis",
      section: "Week 4",
      date: "2025-05-06",
      body: `# Partner review: pricing draft v1

- The CFO hired us to pick a price. Three scenarios with no recommendation is a menu, not advice. Recommend $29 and show why.
- Titles are labels ("Survey results", "Plan inclusions"). Rewrite every title as the finding: "64 percent of self-pay patients find $29 a month acceptable."
- Put the cannibalization number on the revenue slide. The CFO will ask for it first, and the council will ask second.
- The council chair gave us the 15 percent discount and the gum health tier. Say so; it shows the plan was built with them.
- Source line on every slide naming the survey, model version or interview.`,
      summary:
        "Partner review of pricing draft v1: recommend $29 rather than presenting a menu, rewrite titles as findings, show cannibalization on the revenue slide and credit the council for the 15 percent discount and gum health tier.",
      decisions: "Recommend a single price of $29\nShow cannibalization explicitly\nFull-sentence finding titles with sources",
      entities: "partner review, CFO, cannibalization, dentist advisory council, slide titles",
    },
    {
      key: "final-deck",
      title: "Final pricing recommendation and pilot plan",
      type: "deck",
      method: ["financial_model", "implementation_plan", "synthesis"],
      vendor: "google_slides",
      author: "kowalski",
      section: "Week 6",
      date: "2025-05-27",
      shown: [{ on: "2025-05-29", occasion: "Final readout" }],
      body: `## Slide 1
Brightpath membership plan: pricing recommendation and pilot plan. Final readout, 29 May 2025.

## Slide 2
Brightpath should launch an Adult plan at $29 a month, with Child and Gum health tiers, in 8 pilot practices from July 2025.

## Slide 3
Self-pay patients put off care because the first quote is about $310, and many return only for emergencies costing around $1,800.
Source: office manager interview.

## Slide 4
64 percent of self-pay patients find $29 a month acceptable; at $34 that falls to 41 percent.
Source: willingness to pay survey, 1,150 patients.

## Slide 5
A 15 percent treatment discount and a separate Gum health tier have the dentist advisory council's support for a pilot.
Source: council chair interview.

## Slide 6
The pilot adds $900k net revenue in 12 months after $210k of lost preventive fees.
Source: revenue model v3.

## Slide 7
At full rollout across 46 practices the plan is worth about $5.2M a year.
Source: revenue model v3.

## Slide 8
Pilot plan: one-sentence front desk script, 8 practices in July, council review at six months.`,
      summary:
        "Final pricing deck shown on 29 May 2025. Recommends Adult $29, Child $22 and Gum health $45 tiers piloted in 8 practices from July 2025, with $900k net pilot revenue after cannibalization and about $5.2M a year at full rollout.",
      decisions: "CFO approved the $29 Adult plan and an 8-practice pilot from July 2025",
      entities: "final readout, adult plan, gum health tier, pilot, front desk script, revenue model",
    },
  ],
  stickies: [
    { section: "Week 5", text: "Maren: recommend one price. Titles state the finding; cannibalization on the revenue slide.", fill: "yellow" },
    { section: "Week 2", text: "Council will back 15 percent, not 20", fill: "green" },
  ],
  outcome: {
    ranToPlan: false,
    extended: false,
    lesson: "Visit-level data arrived in week 3 instead of week 1, so the readout slipped two weeks; we absorbed the time. Ask for a data sample before the SOW is signed.",
  },
};
