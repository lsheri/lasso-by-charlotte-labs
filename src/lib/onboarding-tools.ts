import {
  Bot,
  CircleDashed,
  FileText,
  HardDrive,
  Mail,
  MessageSquare,
  Mic,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { fetchProfile } from "@/hooks/use-profile";

/**
 * The tools people actually work with AI in. What they check here decides
 * which setup cards they see next, and nothing else. No tool names ever
 * travel in telemetry.
 */
export type ToolId =
  | "claude"
  | "chatgpt"
  | "gemini"
  | "copilot"
  | "googledrive"
  | "gmail"
  | "granola"
  | "transcripts"
  | "other";

export type ToolMeta = {
  id: ToolId;
  label: string;
  blurb: string;
  icon: LucideIcon;
  /** Reuses the work-identity hue tokens so the grid reads as one system. */
  hue: string;
  /** Which setup surface this tool produces on the next screen. */
  path: "mcp" | "connector" | "export" | "none";
  /**
   * What Lasso reads, and what it does not, shown under the label on the
   * picker. Three are verbatim from the design file. "other" deliberately has
   * none: a scope promise under an option that connects nothing is noise.
   */
  scope?: string;
};

export const TOOLS: Record<ToolId, ToolMeta> = {
  claude: {
    id: "claude",
    label: "Claude",
    blurb: "Push straight from a conversation.",
    icon: MessageSquare,
    hue: "--hue-slate-blue",
    path: "mcp",
    scope: "your conversations, not your account",
  },
  chatgpt: {
    id: "chatgpt",
    label: "ChatGPT",
    blurb: "Push straight from a conversation.",
    icon: Bot,
    hue: "--hue-moss",
    path: "mcp",
    scope: "the conversations you push, not your history",
  },
  gemini: {
    id: "gemini",
    label: "Gemini",
    blurb: "Export your history, bring in what matters.",
    icon: Sparkles,
    hue: "--hue-indigo",
    path: "export",
    scope: "the file you export, not your Google account",
  },
  copilot: {
    id: "copilot",
    label: "Microsoft Copilot",
    blurb: "Export your history, bring in what matters.",
    icon: FileText,
    hue: "--hue-sand",
    path: "export",
    scope: "the file you export, not your Microsoft account",
  },
  googledrive: {
    id: "googledrive",
    label: "Google Drive",
    blurb: "Connect, then pick the files you want.",
    icon: HardDrive,
    hue: "--hue-amber",
    path: "connector",
    scope: "files you touched, not the whole drive",
  },
  granola: {
    id: "granola",
    label: "Granola",
    blurb: "Connect your meeting notes.",
    icon: Mic,
    hue: "--hue-plum",
    path: "connector",
    scope: "meeting notes, never the audio",
  },
  gmail: {
    id: "gmail",
    label: "Gmail",
    blurb: "Connect, then pick the threads you want.",
    icon: Mail,
    hue: "--hue-cyan",
    path: "connector",
    scope: "the threads you pick, not your inbox",
  },
  transcripts: {
    id: "transcripts",
    label: "Call transcripts and dictation (Google Drive)",
    blurb: "Transcripts and Wispr Flow notes, already in Drive.",
    icon: Mic,
    hue: "--hue-clay",
    path: "connector",
    scope: "transcripts, never recordings",
  },
  other: {
    id: "other",
    label: "Something else / skip",
    blurb: "Paste or upload anything, any time.",
    icon: CircleDashed,
    hue: "--hue-neutral",
    path: "none",
  },
};

export const TOOL_ORDER: ToolId[] = [
  "claude",
  "chatgpt",
  "gemini",
  "copilot",
  "googledrive",
  "gmail",
  "granola",
  "transcripts",
  "other",
];

/** The same four categories the Connectors page uses, so the two screens rhyme. */
export const TOOL_CATEGORIES: { title: string; hue: string; tools: ToolId[] }[] = [
  {
    title: "Connect your AI · MCP",
    hue: "--hue-slate-blue",
    tools: ["claude", "chatgpt", "gemini", "copilot"],
  },
  { title: "Documents & files", hue: "--hue-sand", tools: ["googledrive"] },
  { title: "Email", hue: "--hue-cyan", tools: ["gmail"] },
  { title: "Meetings", hue: "--hue-clay", tools: ["granola", "transcripts"] },
  { title: "Anything else", hue: "--hue-neutral", tools: ["other"] },
];

/** 0 · 1-2 · 3+, the only shape of this that ever leaves the browser. */
export function toolCountBucket(n: number): string {
  if (n <= 0) return "0";
  if (n <= 2) return "1-2";
  return "3+";
}

/** Persist the selection into the existing orgs.settings jsonb. */
export async function saveToolsUsed(tools: ToolId[]): Promise<string | null> {
  const profile = await fetchProfile();
  if (!profile) return null;
  const orgId = profile.org_id;
  const { data: org } = await supabase
    .from("orgs")
    .select("settings")
    .eq("id", orgId)
    .maybeSingle();
  const settings = (org?.settings ?? {}) as Record<string, unknown>;
  await supabase
    .from("orgs")
    .update({ settings: { ...settings, tools_used: tools } })
    .eq("id", orgId);
  return orgId;
}

export async function loadToolsUsed(): Promise<ToolId[]> {
  const profile = await fetchProfile();
  if (!profile) return [];
  const orgId = profile.org_id;
  const { data: org } = await supabase
    .from("orgs")
    .select("settings")
    .eq("id", orgId)
    .maybeSingle();
  const settings = (org?.settings ?? {}) as Record<string, unknown>;
  const raw = settings["tools_used"];
  if (!Array.isArray(raw)) return [];
  return raw.filter((id): id is ToolId => typeof id === "string" && id in TOOLS);
}
