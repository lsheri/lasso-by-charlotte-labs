/**
 * BR-1: where a branch opens. One config object, so a tool's link is one edit.
 * Gemini has no proven prefill parameter, so it opens bare and the prompt goes
 * to the clipboard. Adding a parameter later is setting `prefill` and `prefix`.
 */
export type BranchTool = "claude" | "chatgpt" | "gemini";
export type BranchVendor = "claude" | "openai" | "gemini";

export const BRANCH_URL_LIMIT = 1800;

export const BRANCH_TARGETS: Record<BranchTool, { label: string; vendor: BranchVendor; prefill: boolean; prefix: string; home: string }> = {
  claude: { label: "Claude", vendor: "claude", prefill: true, prefix: "https://claude.ai/new?q=", home: "https://claude.ai/new" },
  chatgpt: { label: "ChatGPT", vendor: "openai", prefill: true, prefix: "https://chatgpt.com/?q=", home: "https://chatgpt.com/" },
  gemini: { label: "Gemini", vendor: "gemini", prefill: false, prefix: "", home: "https://gemini.google.com/app" },
};

export const BRANCH_TOOLS: readonly BranchTool[] = ["claude", "chatgpt", "gemini"];

export type BranchOpenPlan =
  | { handoff: "link"; url: string }
  | { handoff: "clipboard"; url: string; reason: "no_prefill" | "too_long" };

/** How to open a tool with a prompt: a prefilled link, or the tool's home plus the clipboard. */
export function branchOpenPlan(tool: BranchTool, prompt: string): BranchOpenPlan {
  const target = BRANCH_TARGETS[tool];
  if (!target.prefill) return { handoff: "clipboard", url: target.home, reason: "no_prefill" };
  const url = `${target.prefix}${encodeURIComponent(prompt)}`;
  if (url.length > BRANCH_URL_LIMIT) return { handoff: "clipboard", url: target.home, reason: "too_long" };
  return { handoff: "link", url };
}

export function isBranchTool(value: unknown): value is BranchTool {
  return value === "claude" || value === "chatgpt" || value === "gemini";
}
