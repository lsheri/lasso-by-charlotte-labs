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