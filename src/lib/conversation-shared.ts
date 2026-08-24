/** Attachment kinds a client may push alongside a conversation transcript. */
export const ATTACHMENT_KINDS = [
  "artifact_code",
  "artifact_react",
  "artifact_html",
  "artifact_svg",
  "artifact_mermaid",
  "artifact_markdown",
  "canvas_document",
  "canvas_code",
  "image_description",
  "research_report",
  "page",
  "file",
  "other",
] as const;

export type AttachmentKind = (typeof ATTACHMENT_KINDS)[number];

const KIND_LABELS: Record<AttachmentKind, string> = {
  artifact_code: "Artifact · Code",
  artifact_react: "Artifact · React",
  artifact_html: "Artifact · HTML",
  artifact_svg: "Artifact · SVG",
  artifact_mermaid: "Artifact · Diagram",
  artifact_markdown: "Artifact · Markdown",
  canvas_document: "Canvas · Doc",
  canvas_code: "Canvas · Code",
  image_description: "Image",
  research_report: "Research report",
  page: "Page",
  file: "File",
  other: "Attachment",
};

export function attachmentKindLabel(kind: string | null | undefined): string {
  if (!kind) return "Attachment";
  return KIND_LABELS[kind as AttachmentKind] ?? "Attachment";
}

export const CONVERSATION_VENDORS = ["claude", "chatgpt", "gemini", "copilot", "other"] as const;
export type ConversationVendor = (typeof CONVERSATION_VENDORS)[number];

const VENDOR_LABELS: Record<string, string> = {
  claude: "Claude",
  chatgpt: "ChatGPT",
  gemini: "Gemini",
  copilot: "Copilot",
  other: "AI",
};

export function vendorLabel(vendor: string | null | undefined): string {
  if (!vendor) return "AI";
  return VENDOR_LABELS[vendor] ?? vendor;
}

/** Content-free size band for telemetry. */
export function attachmentBucket(n: number): "0" | "1-3" | "4+" {
  if (n <= 0) return "0";
  if (n <= 3) return "1-3";
  return "4+";
}

/** What one MCP push produced: the transcript plus its attachments. */
export type SourceMeta = {
  vendor?: string;
  model?: string | null;
  kind?: string;
  language?: string | null;
  role?: "transcript" | "attachment";
  skills_used?: string[];
  thinking_level?: string;
  research_mode?: string;
  notes?: string;
  filename?: string;
  /** The conversation URL in the source app, validated against a host allowlist. */
  url?: string;
  /** Set when the pushed attachment was substantially already in the transcript. */
  duplicate_of_transcript?: boolean;
};
