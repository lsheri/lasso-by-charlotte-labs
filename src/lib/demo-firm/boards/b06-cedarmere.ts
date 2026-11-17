import type { DemoBoard } from "../types";

/** Closed phased board: integrated behavioral health service line built around collaborative care in primary care. */
export const b06: DemoBoard = {
  key: "b6",
  practice: "Health",
  client: { name: "Cedarmere Regional Health", type: "regional health system, 3 hospitals, 26 primary care clinics" },
  title: "Integrated behavioral health service line",
  pattern: "Service line design",
  shape: "phased",
  start: "2024-05-06",
  weeks: 14,
  fee: "$340k",
  status: "closed",
  sharedWithFirm: true,
  brief:
    "Primary care clinicians at Cedarmere refer thousands of patients a year for behavioral health care, but fewer than half are seen in network and many are never seen at all. Psychiatry and primary care run separately. Design an integrated behavioral health service line with primary care at its center: care model, staffing, payer strategy and a business case the board can approve.",
  team: ["tanaka", "hollis", "reyes", "yilmaz"],
  sections: ["Weeks 1-4: Diagnostic", "Weeks 5-9: Design", "Weeks 10-14: Business case"],
  workstreams: ["Referral leakage analysis", "Care model", "Staffing model", "Payer strategy"],
  items: [
    {
      key: "sow",
      title: "SOW: Cedarmere integrated behavioral health service line",
      type: "document",
      vendor: "google_docs",
      author: "hollis",
      section: "Weeks 1-4: Diagnostic",
      date: "2024-04-29",
      body: `# Statement of work: integrated behavioral health service line

**Client:** Cedarmere Regional Health  **Sponsor:** Chief Operating Officer  **Duration:** 14 weeks from 6 May 2024  **Fee:** $340,000 fixed, expenses capped at 8%

## Objective
Design an integrated behavioral health service line anchored in primary care, with a staffing model, payer strategy and business case ready for board approval in August 2024.

## Scope
1. Referral leakage analysis: primary care behavioral health referrals, completion, wait times and destination.
2. Care model design, including collaborative care in primary care and access to psychiatry.
3. Staffing model by clinic and by year.
4. Payer strategy: fee-for-service codes, value-based arrangements with the two largest Medicare Advantage plans.
5. Business case and implementation roadmap.
6. Twelve interviews with clinicians, operational leaders and payers.

## Out of scope
Inpatient psychiatric capacity, recruitment, EHR build.

## Team
Partner (half a day a week), manager (full time), consultant (full time), analyst (full time).

## Milestones
- Week 4: diagnostic readout (SteerCo 1)
- Week 9: care model and staffing options (SteerCo 2)
- Week 14: final readout and board pre-read`,
      summary:
        "Signed 14-week, $340k fixed-fee SOW to design an integrated behavioral health service line anchored in primary care. Scope covers referral leakage analysis, care model, staffing, payer strategy with two Medicare Advantage plans, a business case and twelve interviews. Inpatient capacity and recruitment are out of scope.",
      decisions: "Inpatient psychiatric capacity out of scope\nBoard approval targeted for August 2024",
      entities: "Cedarmere Regional Health, Chief Operating Officer, behavioral health, primary care, Medicare Advantage",
    },
    {
      key: "problem",
      title: "Problem definition worksheet",
      type: "document",
      vendor: "google_docs",
      author: "tanaka",
      section: "Weeks 1-4: Diagnostic",
      date: "2024-05-07",
      body: `# Problem definition

**Basic question:** How should Cedarmere integrate behavioral health with its 26 primary care clinics so more referred patients are treated in network and sooner, at a cost the system can sustain by year three?

**Situation:** Cedarmere employs 14 outpatient psychiatrists and about 40 therapists, mostly at two hospital-based clinics. Primary care refers patients for depression, anxiety and substance use, and those referrals have grown every year since 2020.

**Complication:** Fewer than half of referrals are completed in network. Waits for a first psychiatry appointment run close to two months. Primary care physicians say they manage behavioral health alone, and payers are asking for measurable outcomes before they will pay more.

**Success looks like:** more referrals completed in network, shorter waits, primary care clinicians who feel supported, and a business case that breaks even within three years.

**Stakeholders:** decides: COO and CFO. Helps: primary care medical director, chair of psychiatry, director of managed care. Can block: the psychiatry department if integration is seen as moving its staff into primary care.

**Emerging hypotheses**
1. Collaborative care in primary care can treat most mild to moderate cases without a specialist referral.
2. Psychiatrists add more value as consultants to primary care teams than in a long first-visit queue.
3. Fee-for-service codes will not cover the model on their own; a payer arrangement is needed to break even.`,
      summary:
        "Problem definition in the firm template: integrate behavioral health with 26 primary care clinics so more referred patients are treated sooner, breaking even by year three. Notes under half of referrals completed in network and near two-month psychiatry waits. Hypotheses on collaborative care, consulting psychiatrists and the need for a payer arrangement.",
      entities: "Cedarmere, primary care, psychiatry, collaborative care, COO, CFO, managed care",
    },
    {
      key: "leakage",
      title: "Referral leakage analysis, 2023 referrals",
      type: "sheet",
      vendor: "upload",
      author: "yilmaz",
      section: "Referral leakage analysis",
      date: "2024-05-24",
      informs: ["steerco1"],
      body: `# Behavioral health referrals from Cedarmere primary care, calendar 2023

## Referral outcomes
| Outcome | Referrals | Share |
|---|---|---|
| Completed in network | 6,810 | 46% |
| Completed out of network | 4,590 | 31% |
| Never completed | 3,400 | 23% |
| **Total referrals** | **14,800** | **100%** |

## Wait for first appointment (in network)
| Service | Median days | 90th percentile days |
|---|---|---|
| Outpatient psychiatry | 52 | 94 |
| Outpatient therapy | 24 | 47 |

## Referral reason (top four)
| Reason | Share of referrals |
|---|---|
| Depression | 38% |
| Anxiety | 29% |
| Substance use | 12% |
| ADHD evaluation | 9% |

## Estimated downstream revenue lost to out-of-network completion
4,590 referrals at an average of $620 in first-year net revenue each: about $2.8M a year.

Source: referral orders and scheduling extract from the EHR, matched to claims for out-of-network completion. Analyst note: 412 referrals had no destination recorded and are counted as never completed.`,
      summary:
        "Analysis of 14,800 primary care behavioral health referrals in 2023: 46 percent completed in network, 31 percent out of network and 23 percent never completed. Median wait is 52 days for psychiatry and 24 for therapy. Out-of-network completion costs about $2.8M a year in downstream revenue.",
      entities: "referral leakage, behavioral health referrals, wait times, depression, anxiety, downstream revenue",
    },
    {
      key: "cocm-chat",
      title: "Research: collaborative care evidence and payment",
      type: "ai_thread",
      vendor: "claude",
      author: "reyes",
      section: "Care model",
      date: "2024-05-15",
      turns: [
        {
          role: "user",
          content:
            "We're designing integrated behavioral health for a regional health system with 26 primary care clinics. Summarize the evidence for the collaborative care model, typical staffing ratios, and how it is paid for (fee-for-service codes and value-based arrangements). Label FACT with dated sources or INFERENCE and flag where sources disagree.",
        },
        {
          role: "assistant",
          content:
            "FACT (systematic reviews, 2012 to 2021): collaborative care, in which a behavioral health care manager and a consulting psychiatrist support the primary care clinician using a patient registry, improves depression and anxiety outcomes compared with usual care in many randomized trials.\n\nFACT (Medicare physician fee schedule, 2017 onward): dedicated billing codes pay for monthly collaborative care management time in primary care.\n\nFACT (implementation guides from academic programs, 2019 to 2023): a full-time care manager typically carries a caseload of about 60 to 80 active patients; a consulting psychiatrist commonly supports several care managers through weekly caseload review.\n\nINFERENCE: fee-for-service codes alone rarely cover full program costs in the first years because enrollment ramps slowly and not all payers reimburse the codes.\n\nINFERENCE: value-based contracts with Medicare Advantage plans are the most likely source of the remaining funding, since the plans carry the cost of untreated depression.\n\nWhere sources disagree: reported program break-even ranges from two to five years depending on payer mix and enrollment ramp, so any single figure should be treated with caution.",
        },
        {
          role: "user",
          content: "Turn this into a two-page care model brief for the COO with the staffing ratios and payment options.",
        },
        {
          role: "assistant",
          content:
            "Done. The brief sets out the model, a staffing ratio of one care manager per two clinics as a starting point, the payment options and the break-even caution.",
        },
      ],
      summary:
        "AI research chat on collaborative care: evidence from trials, dedicated billing codes, care manager caseloads of 60 to 80 and the role of a consulting psychiatrist, labelled FACT or INFERENCE. Notes that fee-for-service rarely covers costs early and break-even estimates vary from two to five years. Produced the care model brief.",
      entities: "collaborative care, care manager, consulting psychiatrist, billing codes, Medicare Advantage, break-even",
    },
    {
      key: "care-model-brief",
      title: "Brief: collaborative care model options for Cedarmere",
      type: "document",
      vendor: "claude",
      author: "reyes",
      section: "Care model",
      date: "2024-05-17",
      madeFrom: "cocm-chat",
      body: `# Care model brief: collaborative care in Cedarmere primary care

## The model
A behavioral health care manager in each primary care team, a consulting psychiatrist who reviews the caseload weekly, and a shared registry tracking symptom scores. Patients who do not improve escalate to outpatient psychiatry or therapy.

## Evidence (FACT, systematic reviews 2012 to 2021)
Improves depression and anxiety outcomes compared with usual care across many randomized trials.

## Staffing starting point (FACT, academic implementation guides 2019 to 2023)
- Care manager caseload: 60 to 80 active patients.
- Proposed for Cedarmere: one care manager per two clinics, so 13 care managers for 26 clinics.
- Consulting psychiatry: about one psychiatrist FTE per four to five care managers, so 3 FTE.

## Payment options
1. Collaborative care billing codes (FACT, Medicare fee schedule, 2017 onward), accepted by Medicare and most commercial plans in the state.
2. Value-based arrangement with the two Medicare Advantage plans (INFERENCE: most likely to fund the gap).
3. Retained downstream revenue from referrals now leaking out of network.

## Caution (where sources disagree)
Break-even ranges from two to five years in published programs. Our model must show the payer arrangement separately so the board can see the case with and without it.

## Questions for clinical leaders
1. Will psychiatrists accept a consulting role for part of their week?
2. Which clinics have space for a care manager now?`,
      summary:
        "Care model brief made from the research chat: care managers in primary care teams, a consulting psychiatrist and a shared registry. Proposes 13 care managers for 26 clinics and 3 psychiatrist FTE, lists billing codes, a Medicare Advantage arrangement and retained revenue as funding, and asks for the case with and without the payer deal.",
      entities: "collaborative care, care manager, consulting psychiatry, registry, billing codes, value-based arrangement",
    },
    {
      key: "int-pcp",
      title: "Interview: Primary care medical director",
      type: "call",
      vendor: "granola",
      author: "tanaka",
      section: "Referral leakage analysis",
      date: "2024-05-14",
      informs: ["steerco1", "final"],
      body: `# Interview: Medical Director, Primary Care
Attendees: Mei Tanaka (Kestrel Bay), Camila Reyes (Kestrel Bay), Medical Director, Primary Care

**Mei:** What happens today when a primary care doctor refers a patient for depression?
**Medical Director:** The referral goes into a queue. The patient waits seven or eight weeks for psychiatry, so most of my doctors end up starting an antidepressant themselves and hoping. Some patients go elsewhere, many just never go.
**Camila:** How much of your doctors' time goes to behavioral health?
**Medical Director:** I would guess a quarter of visits have a behavioral health component. My doctors feel they are doing psychiatry without any backup.
**Mei:** What would help most?
**Medical Director:** Someone in the clinic who can follow up with the patient by phone every couple of weeks, and a psychiatrist I can ask a question without a formal referral.
**Camila:** Where would you start?
**Medical Director:** The six clinics with the highest volume. They have the space and the doctors are asking for it.
**Mei:** What would worry you?
**Medical Director:** If it becomes another program that disappears when a grant ends. My doctors have seen two of those.`,
      summary:
        "Primary care medical director says patients wait seven to eight weeks for psychiatry, so doctors start medication alone and many patients never get seen. About a quarter of visits involve behavioral health. Wants in-clinic follow-up and psychiatric consultation without formal referral, starting in the six highest-volume clinics.",
      decisions: "Pilot in the six highest-volume clinics",
      entities: "primary care medical director, psychiatry wait, care manager, psychiatric consultation, pilot clinics",
    },
    {
      key: "int-psychiatry",
      title: "Interview: Chair of Psychiatry",
      type: "call",
      vendor: "granola",
      author: "reyes",
      section: "Care model",
      date: "2024-05-21",
      informs: ["final"],
      body: `# Interview: Chair of Psychiatry
Attendees: Camila Reyes, Elif Yilmaz (Kestrel Bay), Chair of Psychiatry

**Camila:** How do you see psychiatry's role in an integrated model?
**Chair:** Carefully. My psychiatrists already have a 52-day wait. If you take a third of their time for consulting, the wait for the sickest patients gets longer.
**Elif:** What if consulting meant fewer inappropriate referrals arrived in the queue?
**Chair:** That is the argument, and I believe it in principle. Half of what we see in new visits is mild depression that primary care could manage with support.
**Camila:** How would you want it structured?
**Chair:** Dedicated consulting psychiatrists, not everyone giving a few hours. I would want three FTE funded as new positions, not carved out of existing clinics.
**Elif:** Who should own the service line?
**Chair:** Joint ownership. A primary care lead and a psychiatry lead, with one budget. If it sits only in primary care, my department will not engage.`,
      summary:
        "Chair of Psychiatry supports consulting in principle, since half of new visits are mild depression primary care could manage, but fears carving time from a 52-day queue. Wants three new dedicated consulting psychiatrist FTE and joint primary care and psychiatry ownership with one budget.",
      decisions: "Consulting psychiatrists funded as three new FTE\nJoint primary care and psychiatry leadership",
      entities: "Chair of Psychiatry, consulting psychiatrists, joint ownership, psychiatry wait, mild depression",
    },
    {
      key: "steerco1",
      title: "SteerCo 1: diagnostic readout",
      type: "deck",
      vendor: "google_slides",
      author: "tanaka",
      section: "Weeks 1-4: Diagnostic",
      date: "2024-05-29",
      shown: [{ on: "2024-05-31", occasion: "SteerCo 1" }],
      body: `## Slide 1
Cedarmere integrated behavioral health: diagnostic readout. SteerCo 1, 31 May 2024.

## Slide 2
Fewer than half of primary care behavioral health referrals are completed in network: 46 percent of 14,800 in 2023.
Source: referral leakage analysis.

## Slide 3
Almost a quarter of referred patients are never seen anywhere.
Source: referral leakage analysis.

## Slide 4
Patients wait a median of 52 days for a first psychiatry appointment, so primary care doctors start treatment alone.
Source: referral leakage analysis, primary care medical director interview.

## Slide 5
Out-of-network completion costs Cedarmere about $2.8M a year in downstream revenue.
Source: referral leakage analysis.

## Slide 6
Recommendation: design a collaborative care model in primary care with dedicated consulting psychiatry. Decision needed today: approve this as the design direction.`,
      summary:
        "SteerCo 1 diagnostic deck shown on 31 May 2024. Headlines: 46 percent of 14,800 referrals completed in network, nearly a quarter never seen, a 52-day median psychiatry wait and about $2.8M a year in lost downstream revenue. Asks for approval of collaborative care as the design direction.",
      decisions: "SteerCo approved collaborative care in primary care as the design direction",
      entities: "SteerCo, referral leakage, psychiatry wait, downstream revenue, collaborative care",
    },
    {
      key: "staffing-model",
      title: "Staffing model and service line P&L",
      type: "sheet",
      vendor: "upload",
      author: "yilmaz",
      section: "Staffing model",
      date: "2024-07-12",
      informs: ["final"],
      body: `# Staffing model and service line P&L, v3 (12 July)

## Staffing at full rollout (26 clinics)
| Role | FTE | Loaded cost each | Annual cost |
|---|---|---|---|
| Behavioral health care manager (1 per 2 clinics) | 13 | $78k | $1.01M |
| Consulting psychiatrist (new positions) | 3 | $380k | $1.14M |
| Program management, registry and analytics | 2.5 | $140k | $0.35M |
| **Total** | **18.5** | | **$2.50M** |

## P&L by year
| Line | Year 1 | Year 2 | Year 3 |
|---|---|---|---|
| Clinics live | 6 | 16 | 26 |
| Patients enrolled in collaborative care | 1,800 | 3,000 | 3,900 |
| Collaborative care billing ($330 per enrolled patient) | $0.59M | $0.99M | $1.29M |
| Retained downstream revenue (recaptured referrals x $620) | $0.43M | $0.74M | $0.93M |
| Medicare Advantage value-based payments | $0 | $0 | $0.60M |
| Program cost | $2.10M | $2.50M | $2.50M |
| **Net contribution** | **-$1.08M** | **-$0.77M** | **$0.32M** |

Assumptions: recaptured referrals of 700, 1,200 and 1,500; billing at $55 a month for an average six months; Medicare Advantage payments start in year 3 only if a contract is signed in 2025. Without them, year 3 net is -$0.28M.`,
      summary:
        "Staffing model for full rollout: 13 care managers, 3 consulting psychiatrists and 2.5 program staff costing $2.5M a year. The P&L moves from -$1.08M in year 1 to $0.32M in year 3, but only with $0.6M of Medicare Advantage payments; without them year 3 is -$0.28M.",
      entities: "staffing model, care managers, consulting psychiatrists, P&L, collaborative care billing, Medicare Advantage",
    },
    {
      key: "final-draft",
      title: "Final readout v1 (internal draft)",
      type: "deck",
      vendor: "google_slides",
      author: "reyes",
      section: "Weeks 10-14: Business case",
      date: "2024-07-26",
      body: `## Slide 1
Cedarmere behavioral health service line: recommendation. Internal draft, 26 July.

## Slide 2
Collaborative care improves outcomes in randomized trials.
Source: care model brief.

## Slide 3
Care model overview (14-box diagram of roles and hand-offs).

## Slide 4
Staffing: 18.5 FTE.
Source: staffing model.

## Slide 5
The service line breaks even in year 3.
Source: staffing model.

## Slide 6
Payer strategy: to be confirmed.`,
      summary:
        "Internal first draft of the final readout, not shown to the client. Led with trial evidence instead of Cedarmere's own numbers, used a 14-box care model diagram and claimed year 3 break-even without saying it depends on a Medicare Advantage contract; the partner sent it back.",
      entities: "internal draft, final readout, break-even, payer strategy, partner review",
    },
    {
      key: "final",
      title: "Final readout: integrated behavioral health service line",
      type: "deck",
      vendor: "google_slides",
      author: "tanaka",
      section: "Weeks 10-14: Business case",
      date: "2024-08-06",
      shown: [
        { on: "2024-08-08", occasion: "Final readout" },
        { on: "2024-08-20", occasion: "Board pre-read" },
      ],
      body: `## Slide 1
Cedarmere Integrated Behavioral Health: recommendation and business case. Final readout, 8 August 2024.

## Slide 2
Put behavioral health care inside primary care: 13 care managers across 26 clinics, backed by three consulting psychiatrists.
Source: staffing model, care model brief.

## Slide 3
Start in the six highest-volume clinics in year 1 and reach all 26 by year 3.
Source: primary care medical director interview, staffing model.

## Slide 4
Fund three new consulting psychiatrist positions so the 52-day psychiatry queue does not get longer.
Source: Chair of Psychiatry interview, referral leakage analysis.

## Slide 5
Lead the service line jointly, with a primary care lead and a psychiatry lead sharing one budget.
Source: Chair of Psychiatry interview.

## Slide 6
The service line costs $2.5M a year at full rollout and breaks even in year 3 only if a Medicare Advantage contract is signed in 2025.
Source: staffing model.

## Slide 7
Without a payer contract, year 3 net is -$0.28M, so the payer negotiation is the critical path.
Source: staffing model.

## Slide 8
Next 90 days: name the two leads, post care manager roles for the first six clinics, open talks with both Medicare Advantage plans.`,
      summary:
        "Final readout shown on 8 August 2024 and as the 20 August board pre-read. Recommends 13 care managers and three new consulting psychiatrists, a six-clinic start, joint leadership and a $2.5M annual cost that breaks even in year 3 only with a Medicare Advantage contract. Makes the payer negotiation the critical path.",
      decisions: "Board approved the service line and a six-clinic start\nPayer negotiation named as the critical path",
      entities: "final readout, board pre-read, care managers, consulting psychiatrists, joint leadership, Medicare Advantage",
    },
  ],
  stickies: [
    { section: "Weeks 10-14: Business case", text: "Maren: show the case with and without the payer contract on the same slide. Never hide a dependency in a footnote.", fill: "yellow" },
    { section: "Care model", text: "Psychiatry engages only with joint ownership and new FTE, not carve-outs", fill: "green" },
  ],
  outcome: {
    ranToPlan: false,
    extended: true,
    lesson: "The business case hinged on a payer contract we only started scoping in week 10; Cedarmere extended us four weeks to support the Medicare Advantage talks. Start payer conversations alongside the diagnostic.",
  },
};
