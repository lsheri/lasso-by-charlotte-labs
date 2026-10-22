import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { signWorkboardFileUrl } from "@/lib/workboard-file-sign";
import { getItemTextPane } from "@/lib/item-text.functions";
import { getWorkboardArtifactPreview } from "@/lib/workboard-artifact-preview.functions";
import {
  artifactPreviewKind,
  fallbackFilePreview,
  filePreviewKind,
  slidesFromMap,
  firstTwentyLines,
  isWorkboardFilePreviewItem,
} from "@/lib/workboard-file-preview";
import type { WorkboardFilePreview, WorkboardFilePreviewMap } from "@/lib/workboard-card-preview.shared";
import type { WorkItemRow } from "@/lib/work-types";

/** Signed preview URLs live 600s; re-mint well before that so a card never shows a dead one. */
const PDF_URL_TTL_MS = 480_000;
const PDF_REFRESH_INTERVAL_MS = 120_000;

export type CachedFilePreview = { preview: WorkboardFilePreview; mintedAt: number };

/** Only pdf previews carry a signed URL, so only they can go stale. */
export function isStalePreview(entry: CachedFilePreview, now: number): boolean {
  return entry.preview.kind === "pdf" && now - entry.mintedAt > PDF_URL_TTL_MS;
}

const sessionCache = new Map<string, CachedFilePreview>();
let queue = Promise.resolve();

function enqueue<T>(work: () => Promise<T>): Promise<T> {
  const next = queue.then(work, work);
  queue = next.then(() => undefined, () => undefined);
  return next;
}

function freshPreviews(now: number): WorkboardFilePreviewMap {
  const out: WorkboardFilePreviewMap = {};
  for (const [id, entry] of sessionCache) {
    if (!isStalePreview(entry, now)) out[id] = entry.preview;
  }
  return out;
}

/** P1b: drop one item's cached preview so it is computed again after its file is added. */
export function forgetWorkboardFilePreview(workItemId: string): void {
  sessionCache.delete(workItemId);
}

export async function loadWorkboardFilePreview(
  item: WorkItemRow,
  profileId: string,
  readText: (input: { data: { work_item_id: string; profile_id?: string } }) => Promise<{ text: string | null }>,
  readArtifact?: (input: { data: { work_item_id: string } }) => Promise<{ html: string | null }>,
): Promise<WorkboardFilePreview> {
  const { data: versions, error: versionError } = await supabase
    .from("document_versions")
    .select("slide_map, version_no")
    .eq("work_item_id", item.id)
    .order("version_no", { ascending: false });
  const versionCount = versionError ? 0 : versions?.length ?? 0;
  const artifactKind = artifactPreviewKind(item);
  if (artifactKind && item.content_ref && readArtifact) {
    try {
      const artifact = await readArtifact({ data: { work_item_id: item.id } });
      if (artifact.html !== null) {
        return { workItemId: item.id, kind: artifactKind === "mermaid" ? "mermaid" : "html", url: null, html: artifact.html, lines: [], slideTitle: null, versionCount };
      }
    } catch {
      // The existing extracted-text preview remains the fallback.
    }
  }
  if (versionError) return fallbackFilePreview(item);
  const pages = item.type === "deck" ? slidesFromMap(versions?.[0]?.slide_map ?? null) : [];
  const slide = pages[0] ?? null;
  if (slide) {
    return { workItemId: item.id, kind: "slide", url: null, lines: slide.lines, slideTitle: slide.title, pages, versionCount };
  }

  if (filePreviewKind(item) === "pdf" && item.content_ref) {
    const signedUrl = await signWorkboardFileUrl(item.content_ref, 600);
    if (signedUrl) {
      return { workItemId: item.id, kind: "pdf", url: signedUrl, lines: [], slideTitle: null, versionCount };
    }
    return fallbackFilePreview(item, versionCount);
  }

  try {
    const pane = await readText({ data: { work_item_id: item.id, profile_id: profileId } });
    const lines = firstTwentyLines(pane.text);
    if (lines.length > 0) return { workItemId: item.id, kind: "text", url: null, lines, slideTitle: null, versionCount };
  } catch {
    // The card quietly keeps its existing excerpt when reading is refused.
  }
  return fallbackFilePreview(item, versionCount);
}

export function useWorkboardFilePreviews(
  profileId: string | undefined,
  enabled: boolean,
  visibleItems: readonly WorkItemRow[],
): WorkboardFilePreviewMap {
  const readText = useServerFn(getItemTextPane);
  const readArtifact = useServerFn(getWorkboardArtifactPreview);
  const [previews, setPreviews] = useState<WorkboardFilePreviewMap>(() => freshPreviews(Date.now()));
  const items = useMemo(
    () => visibleItems.filter(isWorkboardFilePreviewItem),
    [visibleItems],
  );
  const key = items.map((item) => `${item.id}/${item.content_fidelity ?? ""}`).sort().join(":");

  useEffect(() => {
    if (!enabled || !profileId) return;
    let cancelled = false;
    const inFlight = new Set<string>();
    const load = (item: WorkItemRow) => {
      inFlight.add(item.id);
      void enqueue(() => loadWorkboardFilePreview(item, profileId, readText, readArtifact)).then((preview) => {
        inFlight.delete(item.id);
        sessionCache.set(item.id, { preview, mintedAt: Date.now() });
        if (!cancelled) setPreviews(freshPreviews(Date.now()));
      }, () => { inFlight.delete(item.id); });
    };
    const now = Date.now();
    for (const item of items) {
      const entry = sessionCache.get(item.id);
      if (entry && !isStalePreview(entry, now)) continue;
      load(item);
    }
    const timer = setInterval(() => {
      if (cancelled) return;
      const at = Date.now();
      for (const item of items) {
        const entry = sessionCache.get(item.id);
        if (!entry || entry.preview.kind !== "pdf" || inFlight.has(item.id)) continue;
        if (isStalePreview(entry, at)) load(item);
      }
    }, PDF_REFRESH_INTERVAL_MS);
    return () => { cancelled = true; clearInterval(timer); };
  }, [enabled, key, profileId, readArtifact, readText]);

  return previews;
}
