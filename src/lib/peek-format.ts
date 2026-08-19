import type { WorkItemRow } from "@/lib/work-types";

/** How a work item's stored content should be shown inside the peek panel. */
export type PeekFormat =
  | { kind: "thread" }
  | { kind: "markdown" }
  | { kind: "code"; language: string | null }
  | { kind: "text" }
  | { kind: "html" }
  | { kind: "svg" }
  | { kind: "image" }
  | { kind: "pdf" }
  | { kind: "none" }
  | { kind: "unsupported"; label: string };

const MARKDOWN_EXT = new Set(["md", "markdown", "mdx"]);
const TEXT_EXT = new Set(["txt", "log", "text", "csv", "tsv"]);
const IMAGE_EXT = new Set(["png", "jpg", "jpeg", "gif", "webp", "avif", "bmp"]);
const CODE_EXT: Record<string, string> = {
  ts: "typescript",
  tsx: "tsx",
  js: "javascript",
  jsx: "jsx",
  py: "python",
  rb: "ruby",
  go: "go",
  rs: "rust",
  java: "java",
  kt: "kotlin",
  swift: "swift",
  c: "c",
  h: "c",
  cpp: "cpp",
  cs: "csharp",
  php: "php",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  sql: "sql",
  json: "json",
  yml: "yaml",
  yaml: "yaml",
  toml: "ini",
  ini: "ini",
  css: "css",
  scss: "scss",
  xml: "xml",
};

const FORMAT_LABELS: Record<string, string> = {
  doc: "Word document",
  docx: "Word document",
  ppt: "PowerPoint deck",
  pptx: "PowerPoint deck",
  key: "Keynote deck",
  xls: "Excel spreadsheet",
  xlsx: "Excel spreadsheet",
  numbers: "Numbers spreadsheet",
  pages: "Pages document",
  zip: "Archive",
  eml: "Email file",
  odt: "OpenDocument document",
  ods: "OpenDocument spreadsheet",
  odp: "OpenDocument presentation",
};

export function fileNameFor(item: WorkItemRow): string {
  return item.source_meta?.filename ?? item.title;
}

function extensionOf(name: string): string {
  const parts = name.split(".");
  return parts.length > 1 ? (parts.pop() as string).toLowerCase() : "";
}

/**
 * Attachment kind (from an MCP push) wins over file extension, because pushed
 * artifacts carry their real shape in `source_meta` and often have no suffix.
 */
export function peekFormat(item: WorkItemRow): PeekFormat {
  if (item.type === "ai_thread") return { kind: "thread" };

  const meta = item.source_meta ?? null;
  const language = meta?.language ?? null;
  switch (meta?.kind) {
    case "artifact_markdown":
    case "canvas_document":
    case "research_report":
      return { kind: "markdown" };
    case "artifact_html":
      return { kind: "html" };
    case "artifact_svg":
      return { kind: "svg" };
    case "artifact_code":
    case "artifact_react":
    case "canvas_code":
      return { kind: "code", language };
    default:
      break;
  }

  if (!item.content_ref) return { kind: "none" };

  const mime = item.meta?.mime_type ?? null;
  if (mime) {
    if (mime.startsWith("image/"))
      return mime === "image/svg+xml" ? { kind: "svg" } : { kind: "image" };
    if (mime === "application/pdf") return { kind: "pdf" };
    if (mime === "text/markdown") return { kind: "markdown" };
    if (mime === "text/html") return { kind: "html" };
    if (mime.startsWith("text/")) return { kind: "text" };
    if (mime.startsWith("application/vnd.google-apps")) {
      return { kind: "unsupported", label: "Google Workspace file" };
    }
  }

  const ext = extensionOf(fileNameFor(item));
  if (MARKDOWN_EXT.has(ext)) return { kind: "markdown" };
  if (IMAGE_EXT.has(ext)) return { kind: "image" };
  if (ext === "svg") return { kind: "svg" };
  if (ext === "pdf") return { kind: "pdf" };
  if (ext === "html" || ext === "htm") return { kind: "html" };
  if (CODE_EXT[ext]) return { kind: "code", language: CODE_EXT[ext] ?? null };
  if (TEXT_EXT.has(ext)) return { kind: "text" };

  return {
    kind: "unsupported",
    label: FORMAT_LABELS[ext] ?? (ext ? `.${ext} file` : "this format"),
  };
}

/** True when the panel needs to download the bytes to render them. */
export function needsTextFetch(format: PeekFormat): boolean {
  return ["markdown", "code", "text", "html", "svg"].includes(format.kind);
}
