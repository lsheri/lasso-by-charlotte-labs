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
    for (const entry of Object.values(value)) stringsIn(entry, out);
  }
}

export function firstSlideFromMap(value: Json | null): SlideShape | null {
  if (!value) return null;
  const root = value as unknown;
  const first = Array.isArray(root)
    ? root[0]
    : root && typeof root === "object" && "slides" in root && Array.isArray((root as { slides?: unknown[] }).slides)
      ? (root as { slides: unknown[] }).slides[0]
      : root;
  if (!first) return null;
  const lines: string[] = [];
  stringsIn(first as Json, lines);
  if (lines.length === 0) return null;
  return { title: lines[0] ?? null, lines: lines.slice(1, 12) };
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