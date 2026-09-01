/**
 * Pass 150: declared work metadata. People say the shape of their own work at
 * three natural moments. Everything here is a closed vocabulary, never free
 * text, and the guesses exist so the common case is one click.
 */

import { deliverableKindOf, type DeliverableKind } from "./deliverable-kinds";
import { vendorFromSource, type VendorSource } from "./work-taxonomy";

export const OUTPUT_KINDS = ["deck", "model", "memo", "dataset", "analysis", "other"] as const;
export type OutputKind = (typeof OUTPUT_KINDS)[number];

export const DISPOSITIONS = ["shipped", "reworked", "dropped"] as const;
export type Disposition = (typeof DISPOSITIONS)[number];

export const AI_INVOLVEMENTS = ["drafted", "refined", "verified", "none"] as const;
export type AiInvolvement = (typeof AI_INVOLVEMENTS)[number];

export const PROCESS_STEPS = ["scope", "draft", "verify", "synthesize", "review"] as const;
export type ProcessStep = (typeof PROCESS_STEPS)[number];

export const DECLARED_TASK_CLASSES = [
  "draft",
  "summarise",
  "analyse",
  "review",
  "extract",
] as const;
export type DeclaredTaskClass = (typeof DECLARED_TASK_CLASSES)[number];

export const VERDICTS = ["accept", "rework", "reject"] as const;
export type Verdict = (typeof VERDICTS)[number];

export const RUBRIC_BANDS = [1, 2, 3, 4, 5] as const;
export type RubricBand = (typeof RUBRIC_BANDS)[number];

export const OUTPUT_KIND_LABELS: Record<OutputKind, string> = {
  deck: "Deck",
  model: "Model",
  memo: "Memo",
  dataset: "Dataset",
  analysis: "Analysis",
  other: "Other",
};

export const DISPOSITION_LABELS: Record<Disposition, string> = {
  shipped: "Went out",
  reworked: "Came back for rework",
  dropped: "Set aside",
};

export const AI_INVOLVEMENT_LABELS: Record<AiInvolvement, string> = {
  drafted: "AI drafted it",
  refined: "AI refined it",
  verified: "AI helped me check it",
  none: "No AI",
};

export const PROCESS_STEP_LABELS: Record<ProcessStep, string> = {
  scope: "Scope",
  draft: "Draft",
  verify: "Verify",
  synthesize: "Synthesize",
  review: "Review",
};

export const DECLARED_TASK_CLASS_LABELS: Record<DeclaredTaskClass, string> = {
  draft: "Draft",
  summarise: "Summarise",
  analyse: "Analyse",
  review: "Review",
  extract: "Extract",
};

export const VERDICT_LABELS: Record<Verdict, string> = {
  accept: "Accept",
  rework: "Send back for rework",
  reject: "Not usable",
};

/** Copy. People share, choose, and keep: these fields are their own record. */
export const DECLARE_ARTIFACT_TITLE = "Add this to your record";
export const DECLARE_ARTIFACT_HINT = "We filled in our best guess. Change anything that is off.";
export const DECLARE_WORKFLOW_TITLE = "How did you work?";
export const DECLARE_WORKFLOW_HINT = "Keep your record accurate. Pick every step that applies.";
export const COACH_OUTCOME_TITLE = "How did this hold up?";
export const COACH_OUTCOME_HINT = "Your read on the work, kept with the record.";
export const RUBRIC_LABEL = "Where it landed";

export function isOutputKind(value: unknown): value is OutputKind {
  return typeof value === "string" && (OUTPUT_KINDS as readonly string[]).includes(value);
}
export function isDisposition(value: unknown): value is Disposition {
  return typeof value === "string" && (DISPOSITIONS as readonly string[]).includes(value);
}
export function isAiInvolvement(value: unknown): value is AiInvolvement {
  return typeof value === "string" && (AI_INVOLVEMENTS as readonly string[]).includes(value);
}
export function isProcessStep(value: unknown): value is ProcessStep {
  return typeof value === "string" && (PROCESS_STEPS as readonly string[]).includes(value);
}
export function isDeclaredTaskClass(value: unknown): value is DeclaredTaskClass {
  return typeof value === "string" && (DECLARED_TASK_CLASSES as readonly string[]).includes(value);
}
export function isVerdict(value: unknown): value is Verdict {
  return typeof value === "string" && (VERDICTS as readonly string[]).includes(value);
}
export function isRubricBand(value: unknown): value is RubricBand {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5;
}

export type ArtifactDeclaration = {
  output_kind: OutputKind;
  disposition: Disposition;
  ai_involvement: AiInvolvement;
};

export type WorkflowDeclaration = {
  process_steps: ProcessStep[];
  task_class: DeclaredTaskClass;
};

export type CoachOutcome = {
  verdict: Verdict;
  rubric_band: RubricBand;
  rework_needed: boolean;
};

/** Rejects anything outside the vocabulary. Callers never coerce. */
export function parseArtifactDeclaration(input: unknown): ArtifactDeclaration {
  const value = (input ?? {}) as Partial<ArtifactDeclaration>;
  if (!isOutputKind(value.output_kind)) throw new Error("output_kind is not one of the choices");
  if (!isDisposition(value.disposition)) throw new Error("disposition is not one of the choices");
  if (!isAiInvolvement(value.ai_involvement)) {
    throw new Error("ai_involvement is not one of the choices");
  }
  return {
    output_kind: value.output_kind,
    disposition: value.disposition,
    ai_involvement: value.ai_involvement,
  };
}

export function parseWorkflowDeclaration(input: unknown): WorkflowDeclaration {
  const value = (input ?? {}) as Partial<WorkflowDeclaration>;
  const steps = Array.isArray(value.process_steps) ? value.process_steps : [];
  if (steps.length === 0) throw new Error("pick at least one step");
  for (const step of steps) {
    if (!isProcessStep(step)) throw new Error("process_steps holds a value outside the choices");
  }
  if (!isDeclaredTaskClass(value.task_class)) {
    throw new Error("task_class is not one of the choices");
  }
  // Stable order, no duplicates: the same work always reads the same way.
  const ordered = PROCESS_STEPS.filter((step) => steps.includes(step));
  return { process_steps: [...ordered], task_class: value.task_class };
}

export function parseCoachOutcome(input: unknown): CoachOutcome {
  const value = (input ?? {}) as Partial<CoachOutcome>;
  if (!isVerdict(value.verdict)) throw new Error("verdict is not one of the choices");
  if (!isRubricBand(value.rubric_band)) throw new Error("rubric_band must be a whole 1 to 5");
  if (typeof value.rework_needed !== "boolean") throw new Error("rework_needed must be true or false");
  return {
    verdict: value.verdict,
    rubric_band: value.rubric_band,
    rework_needed: value.rework_needed,
  };
}

type GuessItem = VendorSource & {
  type?: string | null | undefined;
  title?: string | null | undefined;
  meta?: unknown;
};

const KIND_OUTPUT: Record<DeliverableKind, OutputKind> = {
  proposal: "memo",
  deck: "deck",
  model_or_budget: "model",
  memo_or_report: "memo",
  email_or_comms: "memo",
  code: "other",
  creative_or_design: "other",
  other: "other",
};

const TYPE_OUTPUT: Record<string, OutputKind> = {
  deck: "deck",
  sheet: "model",
  document: "memo",
  email: "memo",
  csv: "dataset",
  ai_thread: "analysis",
};

/** The likeliest answer from what we already hold: chosen kind, then type. */
export function guessOutputKind(item: GuessItem | null | undefined): OutputKind {
  if (!item) return "other";
  const kind = deliverableKindOf(item.meta);
  if (kind) return KIND_OUTPUT[kind];
  const name = (item.title ?? "").toLowerCase();
  if (/\.(csv|tsv|json|parquet)\s*$/.test(name)) return "dataset";
  return TYPE_OUTPUT[(item.type ?? "").toLowerCase()] ?? "other";
}

/** Shipping says it went out; the person can say otherwise in one click. */
export function guessDisposition(): Disposition {
  return "shipped";
}

/** A named AI tool behind the capture reads as drafted, otherwise none. */
export function guessAiInvolvement(item: GuessItem | null | undefined): AiInvolvement {
  if (!item) return "none";
  const vendor = vendorFromSource(item);
  return vendor === "unknown" ? "none" : "drafted";
}

export function guessArtifactDeclaration(item: GuessItem | null | undefined): ArtifactDeclaration {
  return {
    output_kind: guessOutputKind(item),
    disposition: guessDisposition(),
    ai_involvement: guessAiInvolvement(item),
  };
}

const OUTPUT_TASK: Record<OutputKind, DeclaredTaskClass> = {
  deck: "draft",
  model: "analyse",
  memo: "draft",
  dataset: "extract",
  analysis: "analyse",
  other: "draft",
};

export function guessWorkflowDeclaration(item: GuessItem | null | undefined): WorkflowDeclaration {
  const taskClass = OUTPUT_TASK[guessOutputKind(item)];
  const steps: ProcessStep[] =
    taskClass === "analyse"
      ? ["scope", "synthesize"]
      : taskClass === "extract"
        ? ["scope", "verify"]
        : ["draft"];
  return { process_steps: steps, task_class: taskClass };
}

export function guessCoachOutcome(): CoachOutcome {
  return { verdict: "accept", rubric_band: 4, rework_needed: false };
}

/** What the card wears once the person has said it. Read only, never guessed. */
export function declarationOf(meta: unknown): ArtifactDeclaration | null {
  const declared = (meta as { declared?: unknown } | null)?.declared;
  try {
    return parseArtifactDeclaration(declared);
  } catch {
    return null;
  }
}
