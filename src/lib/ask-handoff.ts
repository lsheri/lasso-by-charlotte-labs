import { BRANCH_TARGETS, BRANCH_TOOLS, branchOpenPlan, isBranchTool, type BranchTool } from "@/lib/branch-targets";
import { MCP_PUSH_PHRASE } from "@/lib/mcp-setup-steps";

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export type HandoffVendor = "claude" | "chatgpt";
export type HandoffDestination = { vendor: HandoffVendor; url?: string };
export const HANDOFF_VENDORS: { id: HandoffVendor; label: string; newChat: string }[] = [
  { id: "claude", label: "Claude", newChat: "https://claude.ai/new" },
  { id: "chatgpt", label: "ChatGPT", newChat: "https://chatgpt.com/" },
];
export const HANDOFF_NUDGE_EVERY = 6;

function cleanDestination(value: unknown): HandoffDestination {
  if (!value || typeof value !== "object") return { vendor: "claude" };
  const parsed = value as Partial<HandoffDestination>;
  const vendor = parsed.vendor === "chatgpt" ? "chatgpt" : "claude";
  if (typeof parsed.url === "string") {
    try {
      const url = new URL(parsed.url);
      const domain = vendor === "claude" ? "claude.ai" : "chatgpt.com";
      if (url.protocol === "https:" && (url.hostname === domain || url.hostname.endsWith(`.${domain}`))) {
        return { vendor, url: parsed.url };
      }
    } catch { /* Invalid project links are left out. */ }
  }
  return { vendor };
}

export function readHandoffDestination(engagementId: string, store: Store | null): HandoffDestination {
  try { return cleanDestination(JSON.parse(store?.getItem(`lasso.ask-handoff.${engagementId}`) ?? "null")); }
  catch { return { vendor: "claude" }; }
}

export function writeHandoffDestination(engagementId: string, dest: HandoffDestination, store: Store | null): void {
  try { store?.setItem(`lasso.ask-handoff.${engagementId}`, JSON.stringify(cleanDestination(dest))); }
  catch { /* Storage unavailable. */ }
}

export function handoffUrl(dest: HandoffDestination): string {
  return dest.url ?? HANDOFF_VENDORS.find((vendor) => vendor.id === dest.vendor)?.newChat ?? HANDOFF_VENDORS[0]?.newChat ?? "https://claude.ai/new";
}

export function handoffPrompt(input: { boardTitle: string; messages: { role: string; content: string }[] }): string {
  const prefix = `I was working on the Lasso board "${input.boardTitle}". Here is the conversation so far. Carry it on from here.\n\n`;
  const suffix = `\n\nWhen we are done, say: ${MCP_PUSH_PHRASE}`;
  const marker = "(earlier turns left out)\n";
  const messages = input.messages.slice(-12);
  let transcript = messages.map((message) => `${message.role === "user" ? "You" : "Lasso"}: ${message.content}`).join("\n\n");
  const cut = input.messages.length > 12 || prefix.length + transcript.length + suffix.length > 6000;
  const budget = Math.max(0, 6000 - prefix.length - suffix.length - (cut ? marker.length : 0));
  if (transcript.length > budget) transcript = transcript.slice(-budget);
  return `${prefix}${cut ? marker : ""}${transcript}${suffix}`;
}

export function shouldNudge(turns: number, dismissedAt: number | null): boolean {
  return turns > 0 && turns % HANDOFF_NUDGE_EVERY === 0 && (dismissedAt === null || turns > dismissedAt);
}
/* ------------------------------------------------------------------------ */
/* H7 (ask-v2): one "Continue in <AI>" button. Nothing here runs until the  */
/* person continues, nothing calls an AI, and no line mentions cost.        */
/* ------------------------------------------------------------------------ */

export type H7Tool = BranchTool;
export type H7Choice = "chat_and_used" | "answer_used" | "full_board";
export type H7Route = "connector" | "link" | "clipboard" | "file";

export const H7_CHOICES: { id: H7Choice; label: string }[] = [
  { id: "chat_and_used", label: "This Lasso chat + what it used" },
  { id: "answer_used", label: "What this answer used" },
  { id: "full_board", label: "The full board" },
];

/** Above this the text goes as a file you drop into the chat, not a paste. */
export const H7_FILE_LIMIT = 60_000;

/** A push's source_vendor, or a connection's client name, as one of the AIs Lasso can open. */
export function toolFromVendor(value: string | null | undefined): H7Tool | null {
  const v = (value ?? "").toLowerCase();
  if (!v) return null;
  if (v.includes("claude") || v.includes("anthropic")) return "claude";
  if (v.includes("chatgpt") || v.includes("openai") || v === "gpt") return "chatgpt";
  if (v.includes("gemini") || v.includes("google")) return "gemini";
  return null;
}

export type H7Signals = {
  /** Pushes of work on this board, any order. */
  boardPushes: { vendor: string | null; at: string }[];
  /** This person's pushes anywhere. */
  myPushes: { vendor: string | null }[];
  /** Client names of this person's live connections. */
  connected: (string | null)[];
  /** The answer to "ask once", if it was asked. */
  asked: H7Tool | null;
};

/**
 * The AI, per person, in the 8 Nov order: the last push to this board, else the
 * most-pushed, else the only connected AI, else the answer they gave once.
 * Null means ask once.
 */
export function pickHandoffTool(signals: H7Signals): H7Tool | null {
  const last = [...signals.boardPushes]
    .map((push) => ({ tool: toolFromVendor(push.vendor), at: push.at }))
    .filter((push): push is { tool: H7Tool; at: string } => push.tool !== null)
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))[0];
  if (last) return last.tool;
  const counts = new Map<H7Tool, number>();
  for (const push of signals.myPushes) {
    const tool = toolFromVendor(push.vendor);
    if (tool) counts.set(tool, (counts.get(tool) ?? 0) + 1);
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1] || BRANCH_TOOLS.indexOf(a[0]) - BRANCH_TOOLS.indexOf(b[0]));
  if (ranked[0]) return ranked[0][0];
  const live = new Set(signals.connected.map(toolFromVendor).filter((tool): tool is H7Tool => tool !== null));
  if (live.size === 1) return [...live][0]!;
  return signals.asked;
}

const ASKED_KEY = (profileId: string) => `lasso.handoff-tool.${profileId}`;

export function readAskedTool(profileId: string, store: Store | null): H7Tool | null {
  try { const value = store?.getItem(ASKED_KEY(profileId)); return isBranchTool(value) ? value : null; } catch { return null; }
}

export function writeAskedTool(profileId: string, tool: H7Tool, store: Store | null): void {
  try { store?.setItem(ASKED_KEY(profileId), tool); } catch { /* Storage unavailable: we ask again next time. */ }
}

export type H7Piece = { title: string; kind: string };
export type H7Input = {
  choice: H7Choice;
  boardTitle: string;
  messages: { role: string; content: string }[];
  /** What the last answer used (cited and read). */
  used: H7Piece[];
  /** Everything on the board, for "The full board". */
  board: H7Piece[];
  /** A signed-in Lasso connector in that AI can read the board itself. */
  viaConnector: boolean;
};

function pieceLines(pieces: H7Piece[]): string {
  return pieces.map((piece) => `- ${piece.title} (${piece.kind})`).join("\n");
}

/** Builds the text only when called, which is only on the person's click. */
export function packageHandoff(input: H7Input): string {
  const head = `I was working on the Lasso board "${input.boardTitle}". Carry it on from here.`;
  const connector = input.viaConnector
    ? `\n\nUse the Lasso connector to open the board "${input.boardTitle}" and read the pieces named below in full.`
    : "";
  const lastAnswer = [...input.messages].reverse().find((m) => m.role !== "user")?.content ?? "";
  const suffix = `\n\nWhen we are done, say: ${MCP_PUSH_PHRASE}`;
  if (input.choice === "full_board") {
    return `${head}${connector}\n\nEverything on the board:\n${pieceLines(input.board)}${suffix}`;
  }
  const used = input.used.length > 0 ? `\n\nWhat Lasso used:\n${pieceLines(input.used)}` : "";
  if (input.choice === "answer_used") {
    return `${head}${connector}\n\nLasso's answer:\n${lastAnswer}${used}${suffix}`;
  }
  const transcript = input.messages.map((m) => `${m.role === "user" ? "You" : "Lasso"}: ${m.content}`).join("\n\n");
  return `${head}${connector}\n\nOur conversation:\n${transcript}${used}${suffix}`;
}

/** Connector when the AI can read the board itself; else a filled-in link, the clipboard, or a file. */
export function handoffRoute(tool: H7Tool, text: string, viaConnector: boolean): { route: H7Route; url: string } {
  if (text.length > H7_FILE_LIMIT) return { route: "file", url: BRANCH_TARGETS[tool].home };
  const plan = branchOpenPlan(tool, text);
  if (plan.handoff === "link") return { route: viaConnector ? "connector" : "link", url: plan.url };
  return { route: "clipboard", url: plan.url };
}

/**
 * H7c: take out the pieces the question points at, so words inside a card's name
 * ("@Research-->Presentation", "@Q3 plan") never count as what the person asked for.
 * Known names go first, longest first, so a name with spaces comes out whole; any
 * other @word is dropped too.
 */
export function stripMentions(question: string, names: readonly string[] = []): string {
  let text = question;
  const sorted = [...new Set(names.map((n) => n.trim()).filter(Boolean))].sort((a, b) => b.length - a.length);
  for (const name of sorted) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    text = text.replace(new RegExp(`@${escaped}`, "gi"), " ");
  }
  return text.replace(/@\S+/g, " ");
}

/** The line under an answer: research, drafting and planning questions only. Names of pointed-at pieces never count. */
export function handoffLineFits(question: string, names: readonly string[] = []): boolean {
  return /\b(research|look into|dig into|find out|explore|investigate|compare|draft|write|rewrite|outline|plan|planning|roadmap|next steps|strategy|proposal|memo)\b/i.test(stripMentions(question, names));
}

export function handoffLine(tool: H7Tool, usedPhrase: string | null): string {
  const label = BRANCH_TARGETS[tool].label;
  const what = usedPhrase ? usedPhrase.replace(/^used /, "") : null;
  return what ? `Continue in ${label} with this chat and the ${what} it used.` : `Continue in ${label} with this chat.`;
}
