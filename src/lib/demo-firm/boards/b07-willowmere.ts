import type { DemoBoard } from "../types";

/** Active radar demo: a four-week cardiometabolic opportunity assessment, in week 3 on 16 Nov 2026, with the red pen deck. */
export const b07: DemoBoard = {
  key: "b7",
  practice: "Health",
  client: { name: "Willowmere Community Health", type: "community health system, 2 hospitals, 19 primary care clinics" },
  title: "Cardiometabolic service line opportunity",
  pattern: "Service line design",
  shape: "phased",
  start: "2026-11-02",
  weeks: 4,
  fee: "$90k",
  status: "active",
  sharedWithFirm: true,
  brief:
    "Diabetes, obesity and heart disease care at Willowmere is split across cardiology, endocrinology, nephrology, nutrition and 19 primary care clinics, with no single front door. Specialist referrals leak out of network, waits are long and GLP-1 prescribing is rising without a care model behind it. Before committing to a full service line design, size the opportunity, hear from internal leaders and frame two or three options for the January board.",
  team: ["tanaka", "hollis", "reyes"],
  sections: ["Discover", "Diagnose", "Options", "Readout"],
  workstreams: ["Market sizing", "Internal interviews", "Options"],
  items: [
    {
      key: "sow",
      title: "SOW: Willowmere cardiometabolic opportunity assessment",
      type: "document",
      vendor: "google_docs",
      author: "hollis",
      section: "Discover",
      date: "2026-10-26",
      body: `# Statement of work: cardiometabolic service line opportunity assessment

**Client:** Willowmere Community Health  **Sponsor:** VP Strategy and Planning  **Duration:** 4 weeks from 2 November 2026  **Fee:** $90,000 fixed, expenses capped at 6%

## Objective
Determine whether there is a case for a cardiometabolic service line (type 2 diabetes, obesity, hypertension and related heart and kidney disease) and, if so, frame the options the board should fund for a full design in 2027.

## Scope
1. Market sizing for the primary service area: prevalence, Willowmere's attributed patients, specialist referral flows and out-of-network leakage.
2. Six internal interviews with clinical, operational and finance leaders.
3. A directional three-year financial view with low, base and high cases.
4. Two or three service line options with a recommendation.

## Out of scope
Detailed care model design, clinical protocols, staffing plans, patient or employer interviews (proposed for the design phase).

## Team
Partner (0.5 day a week), manager (full time), consultant (full time).

## Milestones
- Day 2: kickoff with the sponsor group
- Week 2: data in hand, interviews complete
- Week 3: options working session
- Week 4: opportunity readout to the executive team, ahead of the January board`,
      summary:
        "Signed four-week, $90k fixed-fee SOW to test whether Willowmere has a case for a cardiometabolic service line. Covers market sizing, six internal interviews, a directional three-year financial view and two or three options. Care model design and patient interviews are held for a later design phase.",
      decisions: "Fixed fee of $90k, expenses capped at 6%\nPatient and employer research deferred to the design phase",
      entities: "Willowmere Community Health, VP Strategy and Planning, cardiometabolic, service line, opportunity assessment",
    },
    {
      key: "kickoff",
      title: "Kickoff deck: cardiometabolic opportunity assessment",
      type: "deck",
      vendor: "google_slides",
      author: "tanaka",
      section: "Discover",
      date: "2026-11-02",
      shown: [{ on: "2026-11-03", occasion: "Kickoff" }],
      body: `## Slide 1
Willowmere Community Health cardiometabolic service line: opportunity assessment. Kickoff, 3 November 2026.

## Slide 2
The question for the next four weeks: is there a case for a cardiometabolic service line, and what should the board fund in January?

## Slide 3
What we will deliver: a market sizing, findings from six internal interviews, a directional three-year financial view and two or three options with a recommendation.

## Slide 4
How we will work: weekly check-in with the VP Strategy and Planning every Thursday, options working session in week 3, readout to the executive team in week 4.

## Slide 5
What we need from Willowmere this week: the data request (EHR registry extract, referral report, payer mix) and interview slots with the CMO, chief of cardiology, primary care medical director and CFO.

## Slide 6
Starting hypotheses, to be proven or killed: care has no front door; referral leakage is material; primary care should lead; value-based contracts make prevention pay.`,
      summary:
        "Kickoff deck shown to the sponsor group on 3 November 2026. Sets the question, deliverables, weekly rhythm and data needs, and lists four starting hypotheses: no front door, material leakage, primary care should lead and value-based contracts make prevention pay.",
      decisions: "Weekly Thursday check-in with the VP Strategy and Planning\nOptions working session set for week 3",
      entities: "kickoff, VP Strategy and Planning, data request, hypotheses, primary care, value-based contracts",
    },
    {
      key: "problem",
      title: "Problem definition worksheet",
      type: "document",
      vendor: "google_docs",
      author: "tanaka",
      section: "Discover",
      date: "2026-11-03",
      body: `# Problem definition

**Basic question:** Is there a financially sound case for Willowmere to organize diabetes, obesity and related heart and kidney care into one cardiometabolic service line, and which option should the board fund for full design in January 2027?

**Situation:** Willowmere runs two hospitals and 19 primary care clinics. Cardiology is the strongest specialty brand. Endocrinology has three physicians. GLP-1 prescribing in primary care has grown quickly over the past year.

**Complication:** No one owns the cardiometabolic patient. Referrals bounce between cardiology, endocrinology and nutrition, a large share leave the network, and new endocrinology appointments take months. Two local employers have asked for a diabetes program that Willowmere cannot offer today.

**Success looks like:** a sized opportunity the CFO trusts, an option the CMO and chief of cardiology can both support, and a clear funding ask for the January board.

**Stakeholders:** decides: CEO and CFO. Helps: CMO, primary care medical director, VP Strategy and Planning. Can block: chief of cardiology.

**Emerging hypotheses**
1. Care has no front door, and that is what drives waits and leakage.
2. Recapturing out-of-network referrals funds a meaningful part of the program.
3. Primary care should own intake and maintenance; specialists own escalation.
4. Medicare shared savings contracts make prevention financially worthwhile.`,
      summary:
        "Problem definition in the firm template. Basic question: is there a sound case for one cardiometabolic service line and which option should the January board fund. Names the CEO and CFO as deciders, the chief of cardiology as a possible blocker and four emerging hypotheses.",
      entities: "Willowmere, CEO, CFO, CMO, chief of cardiology, primary care, front door, GLP-1, shared savings",
    },
    {
      key: "data-request",
      title: "Email: data request for the opportunity sizing",
      type: "email",
      vendor: "upload",
      author: "reyes",
      section: "Discover",
      date: "2026-11-03",
      body: `**To:** Director of Decision Support, Willowmere Community Health
**Cc:** VP Strategy and Planning; Mei Tanaka
**Subject:** Cardiometabolic assessment: data request (needed by Monday 9 November)

Thank you for joining the kickoff this morning. As discussed, here is what we need to size the opportunity. Anything de-identified and aggregated is fine; we do not need patient-level records.

1. **Registry extract:** count of active primary care patients (seen in the last 24 months) with type 2 diabetes, BMI of 35 or more, or both, split by clinic, payer and risk tier.
2. **Referral report:** FY2026 referrals from primary care to cardiology, endocrinology, nephrology and nutrition, with the share completed in network and out of network.
3. **Access:** third next available appointment for new patients in endocrinology, preventive cardiology and nutrition.
4. **Payer mix and contracts:** share of attributed lives in the Medicare shared savings ACO and any commercial value-based arrangements.
5. **Staffing:** care manager and dietitian FTEs by site.

If any item will take longer than a week, a rough cut now and the clean version later works for us.

Thanks,
Camila Reyes, Kestrel Bay Advisory`,
      summary:
        "Data request email to Willowmere decision support after kickoff. Asks for a de-identified registry extract, FY2026 referral and leakage report, new patient access times, payer mix and ACO attribution, and care manager and dietitian staffing by site, due 9 November.",
      entities: "data request, decision support, registry extract, referral report, ACO, care managers, dietitians",
    },
    {
      key: "research-chat",
      title: "Research: cardiometabolic programs and service area prevalence",
      type: "ai_thread",
      vendor: "claude",
      author: "reyes",
      section: "Market sizing",
      date: "2026-11-04",
      turns: [
        {
          role: "user",
          content:
            "I'm sizing a cardiometabolic service line opportunity for a community health system with two hospitals. First, what do formal cardiometabolic programs typically include and how common are they outside academic centers? Second, what prevalence rates should I use for adult type 2 diabetes and severe obesity (BMI 35+) at county level? Label every point FACT with a dated source or INFERENCE, and flag where sources disagree.",
        },
        {
          role: "assistant",
          content:
            "Here is a structured answer.\n\n**Program design**\nFACT (cardiology society consensus statement, 2023): cardiometabolic programs typically combine cardiology, endocrinology, nephrology, nutrition and behavioral support under shared protocols, with a navigator or care manager coordinating the patient.\nFACT (hospital association survey, 2025): most formal cardiometabolic programs sit in academic medical centers; a small minority of community systems report one.\nINFERENCE: community systems are more likely to compete on access and convenience than on subspecialty depth, so a primary-care-led front door fits them better than a standalone institute.\n\n**Prevalence**\nFACT (state behavioral risk factor survey, 2024 release): county-level adult diabetes prevalence in the region you named is about 11.8 percent; adults with a BMI of 35 or more are about 17 percent.\nFACT (federal diabetes surveillance report, 2024): roughly 1 in 9 US adults has diabetes, and a meaningful share is undiagnosed.\nINFERENCE: survey prevalence understates true need because undiagnosed patients are not counted.\n\n**Economics**\nINFERENCE: Medicare shared savings and other value-based contracts are where avoided admissions show up as income; under fee for service the case rests on specialist volume and recaptured referrals.\n\n**Where sources disagree:** published program evaluations do not agree on admissions. Some report fewer heart failure admissions within two years; others find no significant change in the first 24 months. Treat any admissions saving as upside, not base case.",
        },
        {
          role: "user",
          content: "Good. Turn this into a one-page market brief for the team, keep the labels, and add what it means for our sizing model.",
        },
        {
          role: "assistant",
          content:
            "Done. The brief keeps the FACT and INFERENCE labels, recommends 11.8 percent and 17 percent as the base prevalence inputs, and recommends leaving admissions savings out of the base case because the evidence is mixed.",
        },
      ],
      summary:
        "AI research chat on what cardiometabolic programs include, how rare they are in community systems, and county prevalence rates (11.8 percent diabetes, 17 percent BMI 35+), labelled FACT or INFERENCE. Flags that evidence on admissions savings is mixed. Produced the market brief.",
      entities: "cardiometabolic program, prevalence, type 2 diabetes, obesity, behavioral risk factor survey, shared savings, heart failure admissions",
    },
    {
      key: "market-brief",
      title: "Brief: cardiometabolic market and prevalence inputs",
      type: "document",
      vendor: "claude",
      author: "reyes",
      section: "Market sizing",
      date: "2026-11-04",
      madeFrom: "research-chat",
      informs: ["sizing-model", "opportunity-deck"],
      body: `# Cardiometabolic market brief (one page)

**What programs include (FACT, cardiology society consensus statement 2023):** cardiology, endocrinology, nephrology, nutrition and behavioral support under shared protocols, coordinated by a navigator or care manager.

**How common they are (FACT, hospital association survey 2025):** most formal programs sit in academic medical centers; few community systems run one.

**Prevalence inputs (FACT, state behavioral risk factor survey 2024 release):**
- Adult type 2 diabetes: 11.8 percent of adults in the county
- Adult BMI of 35 or more: 17 percent

**What it means for Willowmere (INFERENCE):**
- A community system competes on access, not subspecialty depth. A primary-care-led front door is a better fit than a standalone institute.
- Survey prevalence understates need because undiagnosed adults are not counted; our sizing is conservative.
- The financial case under fee for service rests on specialist volume and recaptured referrals. Shared savings contracts are where avoided admissions become income.

**Where sources disagree:** evaluations split on whether programs cut heart failure admissions within the first 24 months. We leave admissions savings out of the base case and show them as upside.

**Inputs for the sizing model:** 11.8 percent diabetes and 17 percent BMI 35+ applied to the 2025 adult population estimate for the primary service area; de-duplicate for adults with both.`,
      summary:
        "One-page market brief made from the research chat. Most cardiometabolic programs are in academic centers; county prevalence of 11.8 percent diabetes and 17 percent BMI 35+ set the sizing inputs. Admissions savings are left out of the base case because evaluations disagree.",
      decisions: "Use 11.8 percent and 17 percent as base prevalence inputs\nKeep admissions savings out of the base case",
      entities: "market brief, prevalence, academic medical centers, community systems, front door, shared savings",
    },
    {
      key: "int-cmo",
      title: "Interview: Chief Medical Officer",
      type: "call",
      vendor: "granola",
      author: "tanaka",
      section: "Internal interviews",
      date: "2026-11-05",
      informs: ["opportunity-deck"],
      body: `# Interview: Chief Medical Officer, Willowmere Community Health
Attendees: Mei Tanaka (Kestrel Bay), Camila Reyes (Kestrel Bay), Chief Medical Officer

**Mei:** When a primary care patient has diabetes that is getting worse, what happens next?
**CMO:** It depends entirely on which doctor they see. Some refer to endocrinology, some to cardiology if there is any heart history, some to nutrition, some just add another medicine. There is no front door. Nobody owns the patient.
**Camila:** How long does a new endocrinology visit take?
**CMO:** Too long. The last access report said 74 days to the third next available new patient slot. Call it ten weeks or more.
**Mei:** And how many of those referrals stay with Willowmere?
**CMO:** Not enough. The referral report says 34 percent of cardiometabolic specialist referrals are completed outside our network. Roughly a third. Some go to the university system, some to the independent cardiology group across the river.
**Camila:** If there were one intake team, where should it sit?
**CMO:** With primary care. If cardiology owns it, every patient becomes a cardiology patient. Primary care sees them first and sees them most.
**Mei:** What would make cardiology comfortable with that?
**CMO:** A real role. Co-leadership, clear escalation criteria, and their name on it. Our cardiology brand is the strongest thing we have in the market; we would be foolish not to use it.
**Camila:** What worries you most about GLP-1 prescribing?
**CMO:** Starts without follow-up. We prescribe, the patient stalls on the first dose or stops because of side effects, and nobody calls them.`,
      summary:
        "CMO interview: there is no front door and nobody owns the cardiometabolic patient. New endocrinology visits take 74 days and 34 percent of cardiometabolic specialist referrals leave the network. Wants intake under primary care with cardiology as co-lead, and worries about GLP-1 starts without follow-up.",
      decisions: "Intake should sit with primary care, cardiology as co-lead",
      entities: "CMO, front door, endocrinology access, referral leakage, primary care, cardiology, GLP-1",
    },
    {
      key: "int-cardiology",
      title: "Interview: Chief of cardiology",
      type: "call",
      vendor: "granola",
      author: "reyes",
      section: "Internal interviews",
      date: "2026-11-09",
      informs: ["opportunity-deck", "options-memo"],
      body: `# Interview: Chief of cardiology, Willowmere Community Health
Attendees: Camila Reyes (Kestrel Bay), Maren Hollis (Kestrel Bay), Chief of cardiology

**Camila:** How do cardiometabolic patients show up in cardiology today?
**Chief:** Late. About 4 in 10 of my new heart failure patients have diabetes that nobody is managing well. By the time they reach me, we are treating the consequence.
**Maren:** Do you run anything preventive now?
**Chief:** A preventive cardiology clinic, one half day a week, one physician. It is full for months. We have never had the staff or the space to grow it.
**Camila:** The CMO suggested primary care should own intake. Where do you land?
**Chief:** I can live with that if cardiology co-leads the service line. I do not want a primary care program that sends us patients when it is too late.
**Maren:** What would co-leadership mean in practice?
**Chief:** A seat and a vote on the council, shared escalation criteria, and the cardiometabolic clinic physically at the main campus next to the heart center, so patients see the brand they trust.
**Camila:** Any worry about a service line pulling volume away from cardiology?
**Chief:** Some of my partners will worry about procedures. I do not. Better-managed patients still need us; they just need us earlier.`,
      summary:
        "Chief of cardiology says about 4 in 10 new heart failure patients have poorly managed diabetes and preventive cardiology runs only one half day a week. Will support a primary-care-led intake if cardiology co-leads with a vote and the clinic sits at the main campus.",
      decisions: "Cardiology co-leadership with a vote is a condition of support",
      entities: "chief of cardiology, heart failure, preventive cardiology, co-leadership, main campus, heart center",
    },
    {
      key: "int-primary-care",
      title: "Interview: Primary care medical director",
      type: "call",
      vendor: "granola",
      author: "tanaka",
      section: "Internal interviews",
      date: "2026-11-10",
      informs: ["opportunity-deck", "options-memo"],
      body: `# Interview: Primary care medical director, Willowmere Community Health
Attendees: Mei Tanaka (Kestrel Bay), Camila Reyes (Kestrel Bay), Primary care medical director

**Mei:** How much of the cardiometabolic workload already sits in primary care?
**Director:** Most of it. In the last 12 months our clinicians started 1,900 patients on GLP-1 medicines. Follow-up is uneven. Some clinics titrate well, some never see the patient again until the annual visit.
**Camila:** What support do clinics have today?
**Director:** Not much. Only 6 of our 19 clinics have a care manager, and nutrition has 3.5 dietitian FTEs for the whole system. A doctor with a 15-minute slot cannot do diet, medication and follow-up.
**Mei:** If Willowmere created a central intake team, would your clinicians refer into it?
**Director:** Yes, if it is ours. A team that sits with primary care, takes the referral, sorts the patient and sends the complex ones to cardiology or endocrinology. Not another specialty queue.
**Camila:** What would you want measured?
**Director:** Time to first contact, A1c and weight at six months, and how many patients stay on therapy past three months.
**Mei:** Anything that would make this fail?
**Director:** Launching without staff. If it is a new name on the same workload, my clinicians will ignore it.`,
      summary:
        "Primary care medical director: clinicians started 1,900 patients on GLP-1 medicines in 12 months with uneven follow-up. Only 6 of 19 clinics have a care manager and nutrition has 3.5 dietitian FTEs system-wide. Will refer into a central intake team only if it sits with primary care and comes with staff.",
      decisions: "Intake team must sit with primary care and be staffed before launch",
      entities: "primary care medical director, GLP-1, care managers, dietitians, central intake, A1c, retention on therapy",
    },
    {
      key: "int-cfo",
      title: "Interview: Chief Financial Officer",
      type: "call",
      vendor: "granola",
      author: "tanaka",
      section: "Internal interviews",
      date: "2026-11-11",
      informs: ["opportunity-deck", "sizing-model"],
      body: `# Interview: Chief Financial Officer, Willowmere Community Health
Attendees: Mei Tanaka (Kestrel Bay), Maren Hollis (Kestrel Bay), Chief Financial Officer

**Mei:** What would the board need to see to fund a full service line design?
**CFO:** A credible path to break-even by year 3, and no new building. Capital is committed to the emergency department expansion through 2028.
**Maren:** How do you think about value-based income here?
**CFO:** It matters more than people think. 36 percent of our attributed lives sit in the Medicare shared savings ACO. If this keeps diabetic patients out of the hospital, we see it in the shared savings check. But I will not underwrite the base case on it.
**Mei:** Have payers or employers asked for anything like this?
**CFO:** Two of the area's largest employers have asked us about a diabetes program for their staff. We had nothing to offer. Neither has made a commitment.
**Maren:** What is the payer mix for these patients?
**CFO:** Older and more Medicare-heavy than the system overall. Decision support can give you the split; I would expect Medicare in the mid forties.
**Mei:** What would worry you in our numbers?
**CFO:** Enrollment ramps that look like a hockey stick, and any revenue that depends on new specialists we have not hired. Show me a low case I can defend.`,
      summary:
        "CFO interview: the board needs a path to break-even by year 3 and no new building, since capital is committed through 2028. 36 percent of attributed lives are in the Medicare shared savings ACO, but shared savings should not carry the base case. Two large local employers have asked about a diabetes program.",
      decisions: "Base case must break even by year 3 without new capital\nShared savings shown as upside only",
      entities: "CFO, break-even, capital, Medicare shared savings ACO, employers, payer mix, low case",
    },
    {
      key: "sizing-model",
      title: "Sizing model: cardiometabolic opportunity v3",
      type: "sheet",
      vendor: "upload",
      author: "reyes",
      section: "Market sizing",
      date: "2026-11-12",
      informs: ["opportunity-deck"],
      body: `# Cardiometabolic opportunity model v3, summary tab

## Market and patients
| Row | Line | Value | Source |
|---|---|---|---|
| 1 | Adults, primary service area (2025 estimate) | 318,000 | census estimate |
| 2 | Adults with type 2 diabetes (11.8%) | 37,500 | market brief |
| 3 | Adults with BMI 35+ (17%) | 54,100 | market brief |
| 4 | Adults with diabetes, BMI 35+ or both (de-duplicated) | 71,000 | model |
| 5 | Of these, attributed to Willowmere primary care | 29,800 (42%) | registry extract |
| 6 | Addressable for a structured program (moderate or high risk) | 11,200 | registry extract, risk tier |
| 7 | Cardiometabolic specialist referrals per year (FY2026) | 8,600 | referral report |
| 8 | Completed out of network | 34% (2,920) | referral report |
| 9 | Recaptured at 50% | 1,460 referrals, $1.9M downstream revenue | model, $1,300 per referral |
| 10 | Payer mix of addressable patients | Medicare 44%, Medicaid 19%, commercial 37% | registry extract |

## Three-year view, base case
| Line | Year 1 | Year 2 | Year 3 |
|---|---|---|---|
| Patients enrolled | 1,600 | 3,300 | 4,800 |
| Net revenue per enrolled patient | $2,150 | $2,150 | $2,150 |
| Net revenue | $3.4M | $7.1M | $10.3M |
| Program cost | $4.1M | $6.2M | $7.9M |
| Contribution margin | -$0.7M | $0.9M | $2.4M |

## Year 3 scenarios
| Case | Enrolled | Contribution margin |
|---|---|---|
| Low | 3,100 | $0.8M |
| Base | 4,800 | $2.4M |
| High | 6,400 | $4.0M |

Version log: v1 used state prevalence; v2 swapped in county rates from the market brief; v3 (12 Nov) adds the registry extract and the CFO's guidance to exclude shared savings from the base case. Shared savings and employer contracts are not modeled.`,
      summary:
        "Opportunity model v3: 71,000 adults in the service area have diabetes, BMI 35+ or both; 29,800 are attributed to Willowmere and 11,200 are addressable. 34 percent of 8,600 annual specialist referrals leave the network. Base case enrolls 4,800 patients by year 3 for a $2.4M contribution margin, with a low case of $0.8M and a high case of $4.0M.",
      decisions: "Shared savings and employer contracts excluded from the base case",
      entities: "sizing model, prevalence, registry extract, referral leakage, contribution margin, scenarios, payer mix",
    },
    {
      key: "options-memo",
      title: "Options memo: three ways to organize cardiometabolic care",
      type: "document",
      vendor: "google_docs",
      author: "tanaka",
      section: "Options",
      date: "2026-11-13",
      informs: ["opportunity-deck"],
      body: `# Options memo (draft for the week 3 working session)

## Option A: coordinated referral pathway
Shared referral criteria and a scheduling queue across cardiology, endocrinology and nutrition. No new team.
- Cost: about $0.6M a year (two schedulers, a part-time navigator)
- Impact: modest. Shortens some waits; does not fix ownership or the care manager gap.

## Option B: primary care front door plus a cardiometabolic clinic (recommended)
A central intake team that sits with primary care takes every cardiometabolic referral, enrolls moderate and high risk patients in a structured program and escalates to a weekly multispecialty cardiometabolic clinic at the main campus, co-led by cardiology and endocrinology.
- Cost: matches the base case in the sizing model ($4.1M in year 1 rising to $7.9M in year 3)
- No new building: uses existing clinic space next to the heart center
- Timing: about 6 months from design approval to the first enrolled patients
- Meets the CFO's test of break-even by year 3 in the base and low cases

## Option C: standalone cardiometabolic institute
A branded institute with its own building, dedicated specialists and research arm.
- Capital: about $14M; three years to open
- Fails the CFO's no-new-building constraint

## Why B
It answers what we heard: the CMO and primary care director want intake under primary care, the chief of cardiology wants co-leadership and a main campus clinic, and the CFO wants break-even by year 3 without capital.

## Open questions for the working session
1. Who chairs the service line council in year 1?
2. Should employer programs be in the first design phase or the second?`,
      summary:
        "Draft options memo: A, a coordinated referral pathway (about $0.6M a year, modest impact); B, a primary care front door plus a weekly cardiometabolic clinic at the main campus (recommended, no new building, about 6 months to first patients); C, a standalone institute needing about $14M of capital.",
      decisions: "Recommend Option B for the readout, pending the working session",
      entities: "options, referral pathway, central intake, cardiometabolic clinic, standalone institute, service line council",
    },
    {
      key: "partner-debrief",
      title: "Debrief call: Mei and Maren after the CFO and cardiology interviews",
      type: "call",
      vendor: "granola",
      author: "tanaka",
      section: "Diagnose",
      date: "2026-11-13",
      body: `# Internal debrief: storyline for the opportunity deck
Attendees: Mei Tanaka, Maren Hollis (Kestrel Bay)

**Mei:** The interviews line up more than I expected. CMO and primary care both want intake in primary care, cardiology will support it with co-leadership, and the CFO gave us a clear test: break-even by year 3, no building.
**Maren:** Then the storyline writes itself. Lead with the answer: yes, there is a case, and it starts in primary care. Then need, then the broken front door, then the money, then options.
**Mei:** The model has the base case at $2.4M in year 3 and the low case still positive.
**Maren:** Good. Put the low case on its own slide; the CFO said he wants one he can defend. And keep shared savings off the base case, exactly as he asked.
**Mei:** Camila is drafting the deck tonight from the model and the interview notes.
**Maren:** Tell her every number needs a source line naming where it came from. I will red-pen it Monday before it goes to the VP Strategy and Planning on Thursday.
**Mei:** One risk: the chief of cardiology's partners may see this as a volume grab.
**Maren:** Then the deck says co-led, and the clinic sits next to the heart center. Say it on the options slide, not in a footnote.`,
      summary:
        "Internal debrief between the manager and partner on the opportunity deck storyline: answer first, then need, front door, economics and options. Low case gets its own slide, shared savings stay out of the base case and every number needs a source line. Partner will review the draft on Monday.",
      decisions: "Answer-first storyline\nLow case on its own slide\nSource line on every number",
      entities: "debrief, storyline, low case, shared savings, cardiology co-leadership, partner review",
    },
    {
      key: "opportunity-deck",
      title: "Opportunity deck: draft v1 for partner review",
      type: "deck",
      vendor: "google_slides",
      author: "reyes",
      section: "Readout",
      date: "2026-11-16",
      body: `## Slide 1
Willowmere Community Health cardiometabolic service line: opportunity assessment. Working draft v1 for partner review, 16 November 2026.

## Slide 2
There is a case for a cardiometabolic service line, and it starts with primary care.
- About 11,200 Willowmere primary care patients have diabetes, severe obesity or both at moderate or high risk.
- 34 percent of cardiometabolic specialist referrals are completed outside the network.
- The base case reaches a $3.1M contribution margin in year 3.
- Decision needed in January: fund a 12-week service line design.
Source: sizing model, CMO interview.

## Slide 3
The need is large: 71,000 adults in the service area have diabetes, severe obesity or both.
- 318,000 adults live in the primary service area.
- 11.8 percent have type 2 diabetes (37,500) and 17 percent have a BMI of 35 or more (54,100).
- Statewide, diabetes prevalence has been flat at 9.6 percent for five years.
Source: sizing model rows 1 to 4, market brief.

## Slide 4
Willowmere already cares for 42 percent of these adults, but no one owns their care.
- 29,800 of the 71,000 are attributed to Willowmere primary care.
- Care is split across cardiology, endocrinology, nephrology, nutrition and 19 clinics, with no front door.
- Cardiometabolic patients account for 46 percent of Willowmere's inpatient spend.
Source: sizing model row 5, CMO interview.

## Slide 5
Patients wait too long: a new endocrinology visit takes 74 days.
- Preventive cardiology runs one half-day clinic a week and is booked for months.
- About 4 in 10 new heart failure patients arrive with poorly managed diabetes.
Source: CMO interview, chief of cardiology interview.

## Slide 6
A third of specialist referrals leave the network, about 2,920 a year.
- Willowmere makes 8,600 cardiometabolic specialist referrals a year.
- Recapturing half would bring back 1,460 referrals and about $1.9M in downstream revenue.
Source: sizing model rows 7 to 9.

## Slide 7
Clinicians want one front door, led by primary care and co-led by cardiology.
- The CMO and the primary care medical director both want intake to sit with primary care.
- The chief of cardiology will support it if cardiology co-leads with a vote.
Source: CMO, primary care and cardiology interviews.

## Slide 8
Primary care is already doing the work but is not staffed for it.
- Primary care started 1,900 patients on GLP-1 medicines in the last 12 months, with uneven follow-up.
- Only 6 of 19 clinics have a care manager; nutrition has 3.5 dietitian FTEs system-wide.
Source: primary care medical director interview.

## Slide 9
The base case turns positive in year 2.
- Enrollment of 1,600, 3,300 and 4,800 patients in years 1 to 3 at $2,150 net revenue per patient.
- Net revenue of $3.4M, $7.1M and $10.3M against program cost of $4.1M, $6.2M and $7.9M.
- Contribution margin of -$0.7M in year 1 and $0.9M in year 2.
Source: sizing model, three-year view.

## Slide 10
Even the low case is positive by year 3.
- Low case: 3,100 patients and a $0.8M contribution margin in year 3. High case: 6,400 patients and $4.0M.
- 36 percent of attributed lives sit in the Medicare shared savings ACO, so avoided admissions are upside, not base case.
- Two of the area's largest employers have asked about a diabetes program.
Source: sizing model scenarios, CFO interview.

## Slide 11
Few community systems run a program like this, which is an opening for Willowmere.
- Most formal cardiometabolic programs sit in academic medical centers.
- Peer community systems that launched a cardiometabolic program grew specialist volume 38 percent within two years.
- Evidence on heart failure admissions is mixed in the first 24 months.
Source: market brief.

## Slide 12
We recommend a primary care front door with a cardiometabolic clinic at the main campus.
- Option A, a coordinated referral pathway, costs about $0.6M a year but leaves ownership unsolved.
- Option B, a primary care front door plus a weekly co-led cardiometabolic clinic, needs no new building and breaks even by year 3.
- Option C, a standalone institute, needs about $14M of capital and fails the no-new-building test.
- Option B can launch within 60 days of approval.
Source: options memo, CFO interview.

## Slide 13
Next step: the January board funds a 12-week service line design for Option B.
- Design phase adds patient and employer research, the care model, staffing and governance.
Source: SOW, options memo.`,
      summary:
        "Draft v1 of the opportunity readout deck, 13 slides, written for partner review before it goes to the client. Argues there is a case for a primary-care-led cardiometabolic service line with 11,200 addressable patients, 34 percent referral leakage and a base case positive from year 2, and recommends Option B. Contains five claims no other item supports.",
      entities: "opportunity deck, red pen, sizing model, referral leakage, contribution margin, Option B, cardiometabolic clinic",
      unsupported: [
        "The base case reaches a $3.1M contribution margin in year 3.",
        "Statewide, diabetes prevalence has been flat at 9.6 percent for five years.",
        "Cardiometabolic patients account for 46 percent of Willowmere's inpatient spend.",
        "Peer community systems that launched a cardiometabolic program grew specialist volume 38 percent within two years.",
        "Option B can launch within 60 days of approval.",
      ],
    },
  ],
  stickies: [
    { section: "Readout", text: "Partner: answer on slide 2, a source line naming the board item under every number, low case on its own slide.", fill: "yellow" },
    { section: "Internal interviews", text: "Cardiology co-leadership is the price of the chief's support", fill: "green" },
    { section: "Options", text: "CFO test: break-even by year 3, no new building", fill: "blue" },
  ],
};
