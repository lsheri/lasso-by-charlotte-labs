import type { Json } from "@/integrations/supabase/types";
import type { WorkboardFilePreview } from "@/lib/workboard-card-preview.shared";
import { peekFormat } from "@/lib/peek-format";
import type { WorkItemRow } from "@/lib/work-types";

export function isWorkboardFilePreviewItem(item: WorkItemRow): boolean {
  return item.type === "document" || item.type === "deck" || item.type === "sheet";
}

export function firstTwentyLines(text: string | null | undefined): string[] {
  if (!text) return [];
  return text.split(/\r?\n/).map((line) => line.trimEnd()).filter(Boolean).slice(0, 20);
}

type SlideShape = { title: string | null; lines: string[] };

function stringsIn(value: Json, out: string[]): void {
  if (typeof value === "string") {
    if (value.trim()) out.push(value.trim());
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) stringsIn(entry, out);
    return;
  }
  if (value && typeof value === "object") {
    for (const entry of Object.values(value)) {
      if (entry !== undefined) stringsIn(entry, out);
    }
  }
}

export function firstSlideFromMap(value: Json | null): SlideShape | null {
  return slidesFromMap(value)[0] ?? null;
}

export function slidesFromMap(value: Json | null): SlideShape[] {
  if (!value) return [];
  const root = value as unknown;
  const slides = Array.isArray(root)
    ? root
    : root && typeof root === "object" && "slides" in root && Array.isArray((root as { slides?: unknown[] }).slides)
      ? (root as { slides: unknown[] }).slides
      : [root];
  return slides.flatMap((slide) => {
    if (!slide) return [];
    const lines: string[] = [];
    stringsIn(slide as Json, lines);
    return lines.length > 0 ? [{ title: lines[0] ?? null, lines: lines.slice(1, 12) }] : [];
  });
}

export function fallbackFilePreview(item: WorkItemRow, versionCount = 0): WorkboardFilePreview {
  return {
    workItemId: item.id,
    kind: "fallback",
    url: null,
    lines: [],
    slideTitle: null,
    versionCount,
  };
}

export function filePreviewKind(item: WorkItemRow): "pdf" | "text" {
  return peekFormat(item).kind === "pdf" ? "pdf" : "text";
}

export function artifactPreviewKind(item: { source_meta?: unknown }): "html" | "svg" | null {
  const meta = item.source_meta;
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null;
  const kind = (meta as Record<string, unknown>)["kind"];
  if (kind === "artifact_html") return "html";
  if (kind === "artifact_svg") return "svg";
  return null;
}

export function wrapSvgArtifact(svg: string): string {
  return `<!doctype html><html><head><style>svg { max-width: 100%; height: auto; }</style></head><body>${svg}</body></html>`;
}