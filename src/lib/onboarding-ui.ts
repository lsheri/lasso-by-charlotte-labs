/**
 * The only onboarding state we ever store. Step completion is never in here:
 * it is read from the record. These three keys are pure UI memory and live in
 * profiles.onboarding, written through the ordinary profile update path.
 */
export type ChecklistUiState = "open" | "collapsed" | "retired";

export type OnboardingUi = {
  welcome_seen: boolean;
  checklist: ChecklistUiState;
  retired_at?: string;
  /** Unit B2: the Home welcome guide was hidden for good. Present only when true. */
  welcome_board_hidden?: true;
};

export const DEFAULT_ONBOARDING_UI: OnboardingUi = { welcome_seen: false, checklist: "open" };

export function readOnboardingUi(raw: unknown): OnboardingUi {
  const value = (raw ?? {}) as Record<string, unknown>;
  const checklist = value["checklist"];
  return {
    welcome_seen: value["welcome_seen"] === true,
    checklist:
      checklist === "collapsed" || checklist === "retired" || checklist === "open"
        ? checklist
        : "open",
    ...(typeof value["retired_at"] === "string" ? { retired_at: value["retired_at"] } : {}),
    ...(value["welcome_board_hidden"] === true ? { welcome_board_hidden: true as const } : {}),
  };
}
