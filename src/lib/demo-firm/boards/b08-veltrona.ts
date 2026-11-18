import type { DemoBoard } from "../types";

/** Closed research-led board: home infusion patient journey for a biopharma client, overran on recruiting and was extended. */
export const b08: DemoBoard = {
  key: "b8",
  practice: "Health",
  client: { name: "Veltrona Therapeutics", type: "mid-size biopharma company, rare neuroimmunology portfolio" },
  title: "At-home infusion patient journey",
  pattern: "Human-centered patient journey",
  shape: "research",
  start: "2025-04-07",
  weeks: 12,
  fee: "$290k",
  status: "closed",
  sharedWithFirm: true,
  situation: "customer_adoption",
  brief:
    "Veltrona's IV biologic for a rare autoimmune neuropathy can be given at home, but many patients prescribed home infusion never complete a first home dose or slip back to hospital infusion within six months. Map the journey from hospital discharge to steady home infusion through patient, caregiver and clinician research, then co-design an ecosystem of support the company can roll out region by region.",
  team: ["nakamura", "hollis", "fairbanks", "yilmaz"],
  sections: ["Plan", "Field research", "Synthesis", "Co-design", "Final"],
  items: [
    {
      key: "sow",
      title: "SOW: Veltrona home infusion patient journey",
      type: "document",
      vendor: "google_docs",
      author: "hollis",
      section: "Plan",
      date: "2025-03-31",
      body: `# Statement of work: at-home infusion patient journey

**Client:** Veltrona Therapeutics  **Sponsor:** VP Patient Services  **Duration:** 12 weeks from 7 April 2025  **Fee:** $290,000 fixed, plus expenses capped at 10% (travel for in-home research)

## Objective
Understand why patients prescribed home infusion drop off between hospital discharge and steady home treatment, and co-design a support ecosystem Veltrona can pilot in one region and then roll out.

## Scope
1. Research plan, screener and recruiting through the patient support hub and specialty pharmacy partners.
2. 16 to 20 in-depth interviews with patients, caregivers, home infusion nurses, hub staff and prescribers, including in-home visits where patients agree.
3. Journey map and synthesis: themes, insight statements, How Might We questions, personas.
4. One co-design workshop with patients, nurses and Veltrona teams; concept testing of two to three support concepts.
5. Design playbook and change management plan for a first regional rollout.

## Out of scope
Changes to the drug label or dosing, payer contracting, building digital tools.

## Research ethics
All participants consent in writing; patient interviews are reviewed by Veltrona's medical and compliance teams before fieldwork; no adverse event information is solicited, and any reported is passed to pharmacovigilance within 24 hours.

## Milestones
- Week 2: research plan approved
- Week 7: midpoint review of the journey map
- Week 12: final readout, playbook and change plan`,
      summary:
        "Signed 12-week, $290k fixed-fee SOW to map the home infusion journey for Veltrona's IV biologic and co-design a support ecosystem. Covers 16 to 20 interviews including in-home visits, a journey map, a co-design workshop, and a playbook and change plan. Sets research ethics and adverse event rules.",
      decisions: "Fixed fee of $290k with expenses capped at 10%\nAdverse events reported to pharmacovigilance within 24 hours",
      entities: "Veltrona Therapeutics, VP Patient Services, home infusion, patient support hub, specialty pharmacy, pharmacovigilance",
    },
    {
      key: "problem",
      title: "Problem definition worksheet",
      type: "document",
      vendor: "google_docs",
      author: "nakamura",
      section: "Plan",
      date: "2025-04-08",
      body: `# Problem definition

**Basic question:** What support would get patients prescribed home infusion from hospital discharge to a steady home routine, and how can Veltrona roll it out region by region within 12 months?

**Situation:** Veltrona's biologic is given by IV every three weeks. Since the home infusion option launched, most new patients are prescribed it at discharge, with a patient support hub and three specialty pharmacy partners handling benefits, delivery and nursing.

**Complication:** Far fewer patients reach steady home infusion than are prescribed it. The hub sees the paperwork but not the experience, and the specialty pharmacies each report differently. Nobody can say where or why patients drop off.

**Success looks like:** a journey map the patient services team recognizes, a support model the specialty pharmacies will adopt, and a first region live with a measurable rise in six-month retention.

**Stakeholders:** decides: VP Patient Services. Helps: hub operations lead, medical affairs, specialty pharmacy account leads. Can block: compliance (patient contact rules), regional sales directors.

**Emerging hypotheses**
1. The largest drop-off happens before the first home dose, in benefits verification and scheduling.
2. The first nurse visit decides whether a patient trusts home infusion.
3. Caregivers carry most of the logistics and are not supported.`,
      summary:
        "Problem definition in the firm template. Basic question: what support gets home infusion patients from discharge to a steady routine and how to roll it out region by region. Names compliance and regional sales as possible blockers and three hypotheses about the pre-dose gap, the first nurse visit and caregivers.",
      entities: "Veltrona, home infusion, patient support hub, specialty pharmacy, compliance, caregivers, first nurse visit",
    },
    {
      key: "research-chat",
      title: "Research: home infusion adoption and drop-off",
      type: "ai_thread",
      method: ["desk_research"],
      vendor: "chatgpt",
      author: "fairbanks",
      section: "Plan",
      date: "2025-04-10",
      turns: [
        {
          role: "user",
          content:
            "I'm planning patient research for a biopharma client whose IV biologic can be given at home. Summarize what is known about why patients move from hospital or clinic infusion to home infusion, and why some stop or revert. Label each point FACT with a dated source or INFERENCE, and note where sources disagree.",
        },
        {
          role: "assistant",
          content:
            "Here is a summary.\n\nFACT (home infusion trade association report, 2023): home infusion use for specialty biologics grew steadily after 2020, helped by payer interest in lower site-of-care costs.\nFACT (peer-reviewed patient preference survey, 2022): most surveyed patients on chronic infusions preferred home when offered, citing travel time and infection worries; a minority preferred a clinic for the nurse relationship and monitoring.\nFACT (payer site-of-care policy reviews, 2024): many commercial plans now steer eligible biologic infusions away from hospital outpatient departments, which can force a switch the patient did not choose.\nINFERENCE: patients pushed to home by payer policy rather than choice are more likely to revert after a bad first experience.\nINFERENCE: the gap between discharge and first home dose is a high-risk window, because no single organization owns the patient during benefits verification, drug shipment and nurse scheduling.\n\nWhere sources disagree: published reversion rates from home to clinic range widely, partly because studies define reversion differently (any clinic dose versus a permanent switch). Avoid quoting one rate.",
        },
        {
          role: "user",
          content: "Make this a one-page landscape brief for the team and add the questions it suggests for our interview guide.",
        },
        {
          role: "assistant",
          content:
            "Done. The brief keeps the FACT and INFERENCE labels, adds the definition problem on reversion, and ends with five interview guide questions on choice, the first visit and the discharge gap.",
        },
      ],
      summary:
        "AI research chat on why patients move to home infusion and why some revert, labelled FACT or INFERENCE with dated sources. Notes payer site-of-care steering and the discharge-to-first-dose gap, and warns that published reversion rates disagree because definitions differ. Produced the landscape brief.",
      entities: "home infusion, site of care, payer policy, patient preference, reversion, discharge gap",
    },
    {
      key: "landscape-brief",
      title: "Brief: home infusion landscape and interview questions",
      type: "document",
      method: ["desk_research"],
      vendor: "chatgpt",
      author: "fairbanks",
      section: "Plan",
      date: "2025-04-11",
      madeFrom: "research-chat",
      body: `# Home infusion landscape: one-page brief

**Growth (FACT, home infusion trade association report 2023):** home infusion of specialty biologics grew steadily after 2020, helped by payer interest in lower site-of-care costs.

**Preference (FACT, patient preference survey 2022):** most chronic infusion patients prefer home when offered; a minority prefer a clinic for the nurse relationship.

**Payer steering (FACT, site-of-care policy reviews 2024):** many commercial plans steer eligible infusions away from hospital outpatient departments, so some patients move home without choosing it.

**What it suggests (INFERENCE):**
- Patients moved by policy rather than choice are more likely to revert after a poor first experience.
- The discharge-to-first-dose window is the riskiest stretch, because no one organization owns the patient.

**Where sources disagree:** reversion rates vary widely because studies define reversion differently. We will define it ourselves from the hub data (any hospital dose after a completed home dose).

**Questions for the interview guide**
1. Who first told you about home infusion, and did it feel like a choice?
2. Walk me through the days between leaving hospital and your first dose at home.
3. Tell me about the first nurse visit. What made it feel safe, or not?
4. Who in your household handles the deliveries, calls and paperwork?
5. Was there a moment you thought about going back to the hospital for infusions?`,
      summary:
        "One-page landscape brief made from the research chat: home infusion growth, patient preference and payer site-of-care steering, labelled FACT or INFERENCE. Defines reversion for this project and sets five interview guide questions.",
      decisions: "Reversion defined as any hospital dose after a completed home dose",
      entities: "landscape brief, payer steering, reversion definition, interview guide",
    },
    {
      key: "funnel-sheet",
      title: "Hub data: discharge to steady home infusion funnel, 2024",
      type: "sheet",
      method: ["data_analysis"],
      vendor: "upload",
      author: "yilmaz",
      section: "Field research",
      date: "2025-04-25",
      informs: ["midpoint", "final"],
      body: `# Home infusion funnel, patients prescribed at discharge, Jan to Dec 2024

Source: patient support hub case data joined to specialty pharmacy dispensing reports (three partners). De-identified, aggregated by Veltrona hub analytics.

| Stage | Patients | % of prescribed |
|---|---|---|
| Prescribed home infusion at discharge | 1,240 | 100% |
| Enrolled in the hub | 1,090 | 88% |
| Benefits verified | 960 | 77% |
| First home infusion completed | 690 | 56% |
| Still on home infusion at month 6 | 470 | 38% |

| Measure | Value |
|---|---|
| Median days, discharge to first home infusion | 19 (hub target: 7) |
| Patients who reverted to hospital infusion within 6 months | 210 |
| Benefits re-verification lapses at month 3 to 6 | 74 patients |

## Month 6 retention by region
| Region | Prescribed | On home infusion at month 6 | Retention |
|---|---|---|---|
| Northeast | 340 | 150 | 44% |
| Midwest | 290 | 113 | 39% |
| West | 280 | 101 | 36% |
| Southeast | 330 | 106 | 32% |

Notes: the largest single loss (270 patients) is between benefits verification and the first home dose. Specialty pharmacy B does not report scheduling dates, so the median days figure excludes about a fifth of patients.`,
      summary:
        "Hub funnel for 1,240 patients prescribed home infusion in 2024: 56 percent complete a first home dose and 38 percent are still at home at month 6. Median time from discharge to first dose is 19 days against a 7-day target, and the biggest loss (270 patients) is between benefits verification and first dose.",
      entities: "patient support hub, funnel, benefits verification, first home infusion, retention, specialty pharmacy, regions",
    },
    {
      key: "int-patient",
      title: "Interview: patient and caregiver, in-home visit",
      type: "call",
      method: ["customer_research"],
      role: "customer",
      vendor: "granola",
      author: "fairbanks",
      section: "Field research",
      date: "2025-04-29",
      informs: ["midpoint", "synthesis"],
      body: `# In-home interview: patient (50s, eight months on home infusion) and spouse caregiver
Attendees: Leah Fairbanks, Elif Yilmaz (Kestrel Bay), patient, caregiver. Consent on file; no adverse events reported.

**Leah:** Take us back to the day you left hospital. What did you know about home infusion?
**Patient:** That a nurse would come. That was it. The neurologist said it would be easier.
**Leah:** And the days after?
**Caregiver:** Chaos. Over about two weeks we had calls from the hub, the pharmacy, the insurer and a nursing agency, all from numbers we did not know. I missed two because I thought they were spam.
**Elif:** How long until the first dose at home?
**Caregiver:** Just under three weeks. The drug arrived before anyone had booked the nurse, so it sat in our fridge and I was afraid it would spoil.
**Leah:** Tell us about the first nurse visit.
**Patient:** She was wonderful, but she was not the nurse who came the second time, or the third. Every visit I explained my veins again.
**Elif:** Was there a moment you thought about going back to hospital?
**Patient:** At month three. The insurance had to be approved again and a dose was late by a week. I felt the weakness come back in my hands. I told my wife: if this happens again, I am going back to the infusion center.
**Leah:** What would have made the first month easier?
**Caregiver:** One person. One name and one number for everything until the first dose was done.`,
      summary:
        "In-home interview with a patient eight months on home infusion and their caregiver. Describes about two weeks of calls from unknown numbers, drug delivered before a nurse was booked, a different nurse each visit and a late dose at month three after re-authorization. The caregiver asks for one named contact until the first dose.",
      entities: "patient, caregiver, in-home interview, nurse continuity, re-authorization, first dose, hub",
    },
    {
      key: "int-nurse",
      title: "Interview: home infusion nurse, specialty pharmacy partner",
      type: "call",
      method: ["customer_research"],
      role: "clinician",
      vendor: "granola",
      author: "yilmaz",
      section: "Field research",
      date: "2025-05-06",
      informs: ["synthesis"],
      body: `# Interview: home infusion nurse, specialty pharmacy partner A
Attendees: Elif Yilmaz, Ren Nakamura (Kestrel Bay), home infusion nurse (nine years in home infusion)

**Elif:** What does a first visit for this therapy look like from your side?
**Nurse:** Long. Two to three hours, because it is a first dose with a slow rate. I check the home, the fridge, the line, teach the caregiver what to watch for. If I have time, I sit with them afterwards. That hour after is when they decide whether they trust it.
**Ren:** How often do you see the same patient again?
**Nurse:** Less than I would like. Scheduling assigns whoever is free in the territory. In rural areas it is better because there are only two of us.
**Elif:** Where do you see patients struggle?
**Nurse:** Before I ever meet them. I get a referral with half the information. Sometimes I arrive and the patient did not know I was coming today.
**Ren:** What would you change?
**Nurse:** Let the first nurse own the first three visits. And give me a direct line to someone at the hub who knows the case, not a general queue.
**Elif:** Anything about re-authorization?
**Nurse:** Every few months a patient's next delivery just does not come. The patient thinks the nurse forgot. It is almost always paperwork.`,
      summary:
        "Home infusion nurse: first visits take two to three hours and the hour after the dose is when patients decide to trust home infusion. Nurse continuity is rare outside rural areas, referrals arrive incomplete, and re-authorization lapses look to patients like missed visits. Asks for the first nurse to own the first three visits and a direct hub line.",
      entities: "home infusion nurse, specialty pharmacy, first visit, nurse continuity, hub, re-authorization",
    },
    {
      key: "synthesis",
      title: "Synthesis: themes, insights and How Might We questions",
      type: "document",
      method: ["synthesis"],
      vendor: "google_docs",
      author: "nakamura",
      section: "Synthesis",
      date: "2025-05-16",
      informs: ["midpoint", "final"],
      body: `# Research synthesis (18 interviews)

**Who we heard from:** 9 patients and caregivers (6 in-home visits), 5 home infusion nurses across all three specialty pharmacies, 2 hub case managers, 2 prescribing neurologists.

## Themes and insight statements
1. **The handoff gap.** Between discharge and first dose, patients receive calls from three to five organizations and no one owns them. Insight: patients do not drop off because they reject home infusion; they drop off because nobody is holding them.
2. **The first visit sets trust.** Patients described the first nurse visit as the moment they decided whether home infusion was safe. Insight: continuity with the first nurse matters more than visit length.
3. **Caregivers carry the logistics.** In 7 of 9 households a caregiver handled calls, deliveries and the fridge. Insight: the real customer for logistics support is the caregiver.
4. **Re-authorization feels like abandonment.** Lapses at month three to six look to patients like a missed visit. Insight: a paperwork problem becomes a trust problem.

## How Might We
- How might we give every patient one named person from discharge until the first dose is done?
- How might we keep the first nurse with a patient for the first three visits?
- How might we warn patients and caregivers before re-authorization, not after a missed delivery?

## Personas
- **The pushed transferee:** moved home by insurer policy, anxious, most likely to revert.
- **The organizing caregiver:** runs the household logistics, wants one number and a calendar.
- **The capable self-manager:** wants fewer calls and control over scheduling.`,
      summary:
        "Synthesis of 18 interviews into four themes: the handoff gap, the first visit setting trust, caregivers carrying logistics and re-authorization feeling like abandonment. Adds three How Might We questions and three personas, including the pushed transferee most likely to revert.",
      decisions: "Design work will focus on the discharge-to-first-dose gap and nurse continuity",
      entities: "synthesis, insight statements, How Might We, personas, caregivers, nurse continuity, re-authorization",
    },
    {
      key: "midpoint",
      title: "Midpoint review: the home infusion journey",
      type: "deck",
      method: ["synthesis"],
      vendor: "google_slides",
      author: "nakamura",
      section: "Synthesis",
      date: "2025-05-21",
      shown: [{ on: "2025-05-22", occasion: "Midpoint review" }],
      body: `## Slide 1
Veltrona home infusion patient journey: midpoint review, 22 May 2025.

## Slide 2
Only 38 percent of patients prescribed home infusion are still at home six months later.
Source: hub funnel, 2024 (1,240 patients prescribed).

## Slide 3
The biggest loss happens before the first dose: 270 patients fall away between benefits verification and a first home infusion.
Source: hub funnel, 2024.

## Slide 4
Patients wait a median of 19 days for a first home dose, against a 7-day target.
Source: hub funnel, 2024; patient and caregiver interviews.

## Slide 5
In those days, families field calls from three to five organizations and no one owns the patient.
Source: research synthesis, 18 interviews; in-home patient and caregiver interview.

## Slide 6
The first nurse visit is when patients decide whether home infusion is safe, yet few see the same nurse twice.
Source: research synthesis; home infusion nurse interview.

## Slide 7
Re-authorization at month three to six turns a paperwork delay into a reason to go back to hospital.
Source: hub funnel (74 lapses); patient interview.

## Slide 8
Where we go next: co-design workshop on 5 June around one named contact, first-nurse continuity and early re-authorization warnings. Decision needed today: confirm the Midwest as the pilot region.`,
      summary:
        "Midpoint review deck shown on 22 May 2025. Headlines: 38 percent of prescribed patients are still at home at month 6, 270 are lost before a first dose, the median wait is 19 days against a 7-day target, nobody owns the patient in the gap, nurse continuity is rare and re-authorization lapses drive reversion.",
      decisions: "Midwest confirmed as the pilot region\nCo-design workshop set for 5 June",
      entities: "midpoint review, journey map, funnel, first dose, nurse continuity, re-authorization, Midwest pilot",
    },
    {
      key: "playbook-draft",
      title: "Playbook draft v1 (internal, after co-design workshop)",
      type: "deck",
      method: ["workshop", "implementation_plan", "synthesis"],
      vendor: "google_slides",
      author: "fairbanks",
      section: "Co-design",
      date: "2025-06-10",
      body: `## Slide 1
Home infusion support playbook: internal draft v1. Not for client circulation.

## Slide 2
Co-design workshop, 5 June: 4 patients, 3 caregivers, 4 nurses, 6 Veltrona staff. Three concepts tested: transition coordinator, first-nurse continuity, re-authorization early warning.

## Slide 3
Transition coordinator: every patient gets one named coordinator from discharge until the first home dose is done. Rated most valuable by every patient and caregiver group.

## Slide 4
First-nurse continuity: the nurse who gives the first dose also gives the second and third. Two of three specialty pharmacies said yes in principle; one says territory scheduling makes it hard.

## Slide 5
Re-authorization early warning: a call to the caregiver at day 60 with the date the next approval is due.

## Slide 6
Rollout: Midwest pilot from July, measured on days to first dose and month 6 retention.

## Slide 7
Open: who employs the transition coordinator (hub or specialty pharmacy)? Cost per patient not yet estimated.`,
      summary:
        "Internal playbook draft after the 5 June co-design workshop, not shown to the client. Sets out the three tested concepts (transition coordinator, first-nurse continuity, re-authorization early warning) and a Midwest pilot, but leaves the coordinator's employer and cost open. Partner sent it back for an answer-first rewrite with costs.",
      entities: "playbook, co-design workshop, transition coordinator, nurse continuity, re-authorization, Midwest pilot",
    },
    {
      key: "final",
      title: "Final readout: home infusion journey, playbook and change plan",
      type: "deck",
      method: ["implementation_plan", "synthesis"],
      vendor: "google_slides",
      author: "nakamura",
      section: "Final",
      date: "2025-06-24",
      shown: [{ on: "2025-06-26", occasion: "Final readout" }],
      body: `## Slide 1
Veltrona home infusion: journey, support playbook and change plan. Final readout, 26 June 2025.

## Slide 2
Give every patient one named transition coordinator from discharge to first dose, keep the first nurse for three visits, and warn caregivers before re-authorization. Pilot in the Midwest from August.

## Slide 3
Only 56 percent of prescribed patients complete a first home dose and 38 percent are still at home at month 6.
Source: hub funnel, 2024.

## Slide 4
Patients drop off because nobody holds them between discharge and first dose, not because they reject home infusion.
Source: research synthesis, 18 interviews.

## Slide 5
The transition coordinator sits in the hub, owns up to 40 active patients, and hands over only after the first dose.
Source: co-design workshop; hub operations working session.

## Slide 6
First-nurse continuity starts with the two specialty pharmacies that agreed; the third joins once territory scheduling is redesigned.
Source: co-design workshop; specialty pharmacy account leads.

## Slide 7
A day-60 call to the caregiver names the date the next approval is due, aimed at the 74 lapses seen in 2024.
Source: hub funnel; research synthesis.

## Slide 8
Pilot targets for the Midwest: median days to first dose from 19 to 10, month 6 retention from 39 percent to 50 percent.
Source: hub funnel (Midwest baseline 39 percent).

## Slide 9
Change plan: train hub coordinators in July, align specialty pharmacy contracts in August, review pilot data at day 90 before a national rollout decision.`,
      summary:
        "Final readout shown on 26 June 2025. Recommends a hub-based transition coordinator from discharge to first dose, first-nurse continuity for three visits and a day-60 re-authorization call, piloted in the Midwest from August with targets of 10 days to first dose and 50 percent month 6 retention.",
      decisions: "Transition coordinator to sit in the hub\nMidwest pilot from August\nDay 90 review before national rollout",
      entities: "final readout, transition coordinator, nurse continuity, re-authorization, Midwest pilot, change plan",
    },
  ],
  stickies: [
    { section: "Co-design", text: "Partner on playbook v1: lead with the recommendation, then the patient story; every concept needs an owner and a cost before it goes to the client.", fill: "yellow" },
    { section: "Field research", text: "Recruiting via the hub is slow; ask specialty pharmacy nurses to introduce patients", fill: "pink" },
  ],
  outcome: {
    ranToPlan: false,
    extended: true,
    lesson: "Recruiting patients through the hub took three weeks longer than planned and squeezed synthesis; specialty pharmacy nurses were the better route in. Veltrona extended us for the Midwest pilot setup.",
  },
};
