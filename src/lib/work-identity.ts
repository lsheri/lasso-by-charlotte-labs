import {
  BookOpen,
  Code2,
  File,
  FileText,
  Image as ImageIcon,
  Mail,
  MessageSquare,
  Phone,
  Presentation,
  Table2,
  type LucideIcon,
} from "lucide-react";

import { attachmentKindLabel } from "./conversation-shared";
import type { WorkItemRow, WorkType } from "./work-types";

/**
 * One source of truth for what a piece of work LOOKS like. Every surface that
 * shows a work item — rows, peek panel, map dialog, task workflow, packets —
 * reads its icon, hue and label from here, so a deck is the same clay-coloured
 * thing everywhere it appears.
 */
export type WorkIdentity = {
  icon: LucideIcon;
  /** CSS custom property name holding the hue. */
  hue: string;
  label: string;
};

const BY_TYPE: Record<WorkType, WorkIdentity> = {
  ai_thread: { icon: MessageSquare, hue: "--hue-slate-blue", label: "Conversation" },
  document: { icon: FileText, hue: "--hue-sand", label: "Document" },
  deck: { icon: Presentation, hue: "--hue-clay", label: "Deck" },
  sheet: { icon: Table2, hue: "--hue-sage", label: "Sheet" },
  call: { icon: Phone, hue: "--hue-plum", label: "Call" },
  email: { icon: Mail, hue: "--hue-cyan", label: "Email" },
  message: { icon: MessageSquare, hue: "--hue-slate-blue", label: "Message" },
  image: { icon: ImageIcon, hue: "--hue-amber", label: "Image" },
};

/** Attachment kinds override the coarse work type when a client pushed one. */
const BY_KIND: Record<string, WorkIdentity> = {
  artifact_code: { icon: Code2, hue: "--hue-moss", label: "Code" },
  artifact_react: { icon: Code2, hue: "--hue-moss", label: "Code" },
  artifact_html: { icon: Code2, hue: "--hue-moss", label: "Code" },
  artifact_svg: { icon: ImageIcon, hue: "--hue-amber", label: "Image" },
  artifact_mermaid: { icon: Code2, hue: "--hue-moss", label: "Diagram" },
  artifact_markdown: { icon: FileText, hue: "--hue-sand", label: "Markdown" },
  canvas_code: { icon: Code2, hue: "--hue-moss", label: "Code" },
  canvas_document: { icon: FileText, hue: "--hue-sand", label: "Document" },
  image_description: { icon: ImageIcon, hue: "--hue-amber", label: "Image" },
  research_report: { icon: BookOpen, hue: "--hue-indigo", label: "Research report" },
  page: { icon: File, hue: "--hue-neutral", label: "Page" },
  file: { icon: File, hue: "--hue-neutral", label: "File" },
  other: { icon: File, hue: "--hue-neutral", label: "Attachment" },
};

const FALLBACK: WorkIdentity = { icon: File, hue: "--hue-neutral", label: "Item" };

export function workIdentity(
  item: Pick<WorkItemRow, "type"> & { source_meta?: WorkItemRow["source_meta"] },
): WorkIdentity {
  const kind = item.source_meta?.kind;
  if (kind && BY_KIND[kind]) return BY_KIND[kind];
  return BY_TYPE[item.type] ?? FALLBACK;
}

/** The human name for a row: the attachment kind if there is one, else the type. */
export function workIdentityLabel(
  item: Pick<WorkItemRow, "type"> & {
    source_meta?: WorkItemRow["source_meta"];
  },
): string {
  const kind = item.source_meta?.kind;
  if (kind) return attachmentKindLabel(kind);
  return workIdentity(item).label;
}

/** `var(--hue-x)` and a 12% wash of it, ready for inline styles. */
export function hueStyles(hue: string): { color: string; background: string; border: string } {
  return {
    color: `var(${hue})`,
    background: `color-mix(in oklab, var(${hue}) 12%, transparent)`,
    border: `color-mix(in oklab, var(${hue}) 28%, transparent)`,
  };
}

const ENGAGEMENT_HUES = 8;

/** A stable colour per engagement, derived from its id — no schema needed. */
export function engagementHue(engagementId: string | null | undefined): string {
  if (!engagementId) return "--hue-neutral";
  let hash = 0;
  for (let i = 0; i < engagementId.length; i += 1) {
    hash = (hash * 31 + engagementId.charCodeAt(i)) % 100000;
  }
  return `--engagement-${(hash % ENGAGEMENT_HUES) + 1}`;
}

/**
 * Vendor tones: each source gets a brand-adjacent colour at chip scale, so a
 * Claude thread and a Drive deck are told apart before the label is read.
 */
const VENDOR_HUES: Record<string, string> = {
  claude: "--vendor-claude",
  chatgpt: "--vendor-chatgpt",
  openai: "--vendor-chatgpt",
  gemini: "--vendor-gemini",
  copilot: "--vendor-copilot",
  gdrive: "--vendor-gdrive",
  googledrive: "--vendor-gdrive",
  "google drive": "--vendor-gdrive",
  granola: "--vendor-granola",
  notion: "--vendor-notion",
  slack: "--vendor-slack",
  onedrive: "--vendor-microsoft",
  sharepoint: "--vendor-microsoft",
  gmail: "--vendor-gmail",
};

export function vendorHue(vendor: string | null | undefined): string | null {
  if (!vendor) return null;
  return VENDOR_HUES[vendor.trim().toLowerCase()] ?? null;
}
