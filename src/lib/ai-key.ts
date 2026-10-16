/**
 * ONE place decides which OpenAI key an inference call uses. A school
 * workspace bills to its own key when one is configured, and falls straight
 * back to the default key when it is not, so nothing breaks if the env var is
 * missing.
 */

export type KeyEnv = Record<string, string | undefined>;

export const DEFAULT_KEY_NAME = "OPENAI_API_KEY";
// OPENAI_API_KEY_EDU: school key retired 15 Oct 2026, F4
export const EDU_KEY_NAME = "OPENAI_API_KEY_EDU";

export function openAiKeyFor(
  orgType: string | null | undefined,
  env: KeyEnv,
): { key: string; source: "edu" | "default" } | null {
  void orgType;
  const fallback = env[DEFAULT_KEY_NAME]?.trim();
  return fallback ? { key: fallback, source: "default" } : null;
}
