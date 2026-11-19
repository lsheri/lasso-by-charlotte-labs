/**
 * What an engagement was about and how the team did it, as fixed vocabularies, so the firm brain can stitch threads
 * across boards without a model guessing (Firm Brain Build Spec: Threads and Walk-throughs, step 1). Stored in
 * work_items.meta with no schema change: `meta.situation` on the board's SOW item (one per engagement),
 * `meta.method` (an array) on any item, `meta.call_role` on calls and `meta.stage` on deliverables.
 * Not `meta.role`: that key already marks an item as a brief (use-briefs.ts), and removing a brief deletes it.
 */

/** The kind of problem the client had. One per engagement. */
export const SITUATIONS = [
  "new_offering",
  "growth_move",
  "pricing",
  "operating_model",
  "integration",
  "deal_diligence",
  "fundraising",
  "new_revenue",
  "customer_adoption",
  "marketing_proof",
  "talent",
  "outside_approval",
  "other",
] as const;

export type Situation = (typeof SITUATIONS)[number];

export const SITUATION_LABELS: Record<Situation, string> = {
  new_offering: "Launching a new service or program",
  growth_move: "Choosing where and how to grow",
  pricing: "Setting the right price",
  operating_model: "Changing how the organisation works",
  integration: "Integrating an acquisition",
  deal_diligence: "Testing a deal before signing",
  fundraising: "Raising money from investors",
  new_revenue: "Building new revenue to stay sustainable",
  customer_adoption: "Helping customers start and stay",
  marketing_proof: "Proving what marketing delivers",
  talent: "Attracting, keeping and growing people",
  outside_approval: "Winning approval from outside bodies",
  other: "Other",
};

/** How the team did the work. Several per engagement, any number per item. */
export const METHODS = [
  "stakeholder_interviews",
  "customer_research",
  "expert_calls",
  "survey",
  "desk_research",
  "data_analysis",
  "market_sizing",
  "financial_model",
  "workshop",
  "outreach",
  "operating_model_design",
  "implementation_plan",
  "synthesis",
  "other",
] as const;

export type Method = (typeof METHODS)[number];

export const METHOD_LABELS: Record<Method, string> = {
  stakeholder_interviews: "Stakeholder interviews",
  customer_research: "Customer and user research",
  expert_calls: "Expert calls",
  survey: "Survey",
  desk_research: "Desk research and benchmarks",
  data_analysis: "Data analysis",
  market_sizing: "Market sizing",
  financial_model: "Financial or pricing model",
  workshop: "Co-design workshop",
  outreach: "Outreach campaign",
  operating_model_design: "Operating model design",
  implementation_plan: "Roadmap or implementation plan",
  synthesis: "Synthesis and storyline",
  other: "Other",
};

/** Where a deliverable got to. */
export const STAGES = ["draft", "reviewed", "shown_to_client"] as const;

export type Stage = (typeof STAGES)[number];

export const STAGE_LABELS: Record<Stage, string> = {
  draft: "Draft",
  reviewed: "Reviewed",
  shown_to_client: "Shown to client",
};

/**
 * Who a call was with, as a job title. Never a person's name: an unknown value reads as "other", so a name typed
 * into the field can never reach a firm surface.
 */
export const ROLES = [
  "chief_executive_officer",
  "chief_financial_officer",
  "chief_operating_officer",
  "chief_medical_officer",
  "chief_nursing_officer",
  "chief_marketing_officer",
  "chief_digital_officer",
  "chief_revenue_officer",
  "chief_strategy_officer",
  "founder",
  "executive_director",
  "general_manager",
  "business_unit_leader",
  "operations_leader",
  "engineering_leader",
  "product_leader",
  "it_leader",
  "marketing_leader",
  "analytics_leader",
  "sales_leader",
  "hr_leader",
  "fundraising_leader",
  "community_giving_leader",
  "clinical_department_chief",
  "medical_director",
  "clinical_service_director",
  "clinician",
  "academic_leader",
  "school_district_leader",
  "practice_manager",
  "buyer",
  "frontline_staff",
  "customer",
  "industry_expert",
  "investment_partner",
  "investor",
  "other",
] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  chief_executive_officer: "Chief Executive Officer",
  chief_financial_officer: "Chief Financial Officer",
  chief_operating_officer: "Chief Operating Officer",
  chief_medical_officer: "Chief Medical Officer",
  chief_nursing_officer: "Chief Nursing Officer",
  chief_marketing_officer: "Chief Marketing Officer",
  chief_digital_officer: "Chief Digital Officer",
  chief_revenue_officer: "Chief Revenue Officer",
  chief_strategy_officer: "Chief Strategy Officer",
  founder: "Founder",
  executive_director: "Executive Director",
  general_manager: "General or Regional Manager",
  business_unit_leader: "Business Unit Leader",
  operations_leader: "Operations Director",
  engineering_leader: "Engineering Leader",
  product_leader: "Product Leader",
  it_leader: "IT or Security Leader",
  marketing_leader: "Marketing Leader",
  analytics_leader: "Analytics Leader",
  sales_leader: "Sales or Customer Leader",
  hr_leader: "HR or Talent Leader",
  fundraising_leader: "Development Director",
  community_giving_leader: "Corporate Giving or Community Lead",
  clinical_department_chief: "Clinical Department Chief",
  medical_director: "Medical Director",
  clinical_service_director: "Clinical Service Director",
  clinician: "Clinician",
  academic_leader: "Dean or Program Director",
  school_district_leader: "Superintendent",
  practice_manager: "Office or Practice Manager",
  buyer: "Buyer",
  frontline_staff: "Frontline Staff",
  customer: "Customer or Patient",
  industry_expert: "Former Industry Executive",
  investment_partner: "Investment Partner",
  investor: "Investor or Limited Partner",
  other: "Other",
};

function metaOf(meta: unknown): Record<string, unknown> {
  return meta && typeof meta === "object" && !Array.isArray(meta) ? (meta as Record<string, unknown>) : {};
}

/**
 * Where a board lead's correction is kept (Firm Brain Build Spec, step 5): one object beside the tags Charlotte read,
 * holding only the tags the lead set. The extractor never writes this key, so a re-extract cannot undo a correction.
 * A tag set to null or to an empty list here means "none", and still wins.
 */
export const TAG_CORRECTION_KEY = "tags_lead";

/** The four tag keys a correction may hold; anything else in the object (who, when) is not a tag. */
export const TAG_KEYS = ["situation", "method", "call_role", "stage"] as const;

export type TagKey = (typeof TAG_KEYS)[number];

/** The lead's correction on an item, or null when there is none. */
export function tagCorrectionOf(meta: unknown): Record<string, unknown> | null {
  const value = metaOf(meta)[TAG_CORRECTION_KEY];
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

/** One tag as stored: the lead's value when the lead set that tag, else what Charlotte or the seed wrote. */
function tagValue(meta: unknown, key: TagKey): unknown {
  const correction = tagCorrectionOf(meta);
  return correction && Object.prototype.hasOwnProperty.call(correction, key) ? correction[key] : metaOf(meta)[key];
}

/** A string from a fixed list; any other string reads as "other", anything that is not a string as null. */
function inList<T extends string>(list: readonly T[], value: unknown): T | null {
  if (typeof value !== "string" || !value.trim()) return null;
  return (list as readonly string[]).includes(value) ? (value as T) : ("other" as T);
}

export function situationOf(meta: unknown): Situation | null {
  return inList(SITUATIONS, tagValue(meta, "situation"));
}

/** `meta.method` as a deduplicated list in vocabulary order. A single string is read as a list of one. */
export function methodsOf(meta: unknown): Method[] {
  const raw = tagValue(meta, "method");
  const values = Array.isArray(raw) ? raw : raw === undefined || raw === null ? [] : [raw];
  const found = new Set(values.map((value) => inList(METHODS, value)).filter((value): value is Method => value !== null));
  return METHODS.filter((method) => found.has(method));
}

export function roleOf(meta: unknown): Role | null {
  return inList(ROLES, tagValue(meta, "call_role"));
}

export function stageOf(meta: unknown): Stage | null {
  const value = tagValue(meta, "stage");
  return typeof value === "string" && (STAGES as readonly string[]).includes(value) ? (value as Stage) : null;
}
