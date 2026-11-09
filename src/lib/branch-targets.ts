/**
 * BR-1: where a branch opens. One config object, so a tool's link is one edit.
 * Gemini has no proven prefill parameter, so it opens bare and the prompt goes
 * to the clipboard. Adding a parameter later is setting `prefill` and `prefix`.
 */
export type BranchTool = "claude" | "chatgpt" | "gemini";
export type BranchVendor = "claude" | "openai" | "gemini";

/** The default guard for a tool whose real ceiling has not been measured. */
export const BRANCH_URL_LIMIT = 1800;

/**
 * H7f: claude.ai/new?q= was measured on 9 Nov 2026: links of 16,000 and 32,000 characters
 * filled the new chat whole (not sent). 30,000 keeps a margin under what was seen. At 1,800
 * almost every real chat fell to the clipboard, so Claude opened empty.
 */
export const CLAUDE_URL_LIMIT = 30_000;
/** H7h: chatgpt.com/?q= was measured on 9 Nov 2026: prompts of 16,000 and 32,000 characters (links of about 21,000 and 42,000) filled the composer whole (not sent). 30,000 matches Claude's margin. */
export const CHATGPT_URL_LIMIT = 30_000;

export const BRANCH_TARGETS: Record<BranchTool, { label: string; vendor: BranchVendor; prefill: boolean; prefix: string; home: string; urlLimit: number }> = {
  claude: { label: "Claude", vendor: "claude", prefill: true, prefix: "https://claude.ai/new?q=", home: "https://claude.ai/new", urlLimit: CLAUDE_URL_LIMIT },
  chatgpt: { label: "ChatGPT", vendor: "openai", prefill: true, prefix: "https://chatgpt.com/?q=", home: "https://chatgpt.com/", urlLimit: CHATGPT_URL_LIMIT },
  gemini: { label: "Gemini", vendor: "gemini", prefill: false, prefix: "", home: "https://gemini.google.com/app", urlLimit: BRANCH_URL_LIMIT },
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
  if (url.length > target.urlLimit) return { handoff: "clipboard", url: target.home, reason: "too_long" };
  return { handoff: "link", url };
}

export function isBranchTool(value: unknown): value is BranchTool {
  return value === "claude" || value === "chatgpt" || value === "gemini";
}
