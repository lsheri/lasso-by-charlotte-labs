import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
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

const sessionCache = new Map<string, WorkboardFilePreview>();
let queue = Promise.resolve();

function enqueue<T>(work: () => Promise<T>): Promise<T> {
  const next = queue.then(work, work);
  queue = next.then(() => undefined, () => undefined);
  return next;
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
  if (artifactPreviewKind(item) && item.content_ref && readArtifact) {
    try {
      const artifact = await readArtifact({ data: { work_item_id: item.id } });
      if (artifact.html !== null) {
        return { workItemId: item.id, kind: "html", url: null, html: artifact.html, lines: [], slideTitle: null, versionCount };
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
    const signed = await supabase.storage.from("work-files").createSignedUrl(item.content_ref, 600);
    if (!signed.error && signed.data?.signedUrl) {
      return { workItemId: item.id, kind: "pdf", url: signed.data.signedUrl, lines: [], slideTitle: null, versionCount };
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
  const [previews, setPreviews] = useState<WorkboardFilePreviewMap>(() => Object.fromEntries(sessionCache));
  const items = useMemo(
    () => visibleItems.filter(isWorkboardFilePreviewItem),
    [visibleItems],
  );
  const key = items.map((item) => `${item.id}/${item.content_fidelity ?? ""}`).sort().join(":");

  useEffect(() => {
    if (!enabled || !profileId) return;
    let cancelled = false;
    for (const item of items) {
      if (sessionCache.has(item.id)) continue;
      void enqueue(() => loadWorkboardFilePreview(item, profileId, readText, readArtifact)).then((preview) => {
        sessionCache.set(item.id, preview);
        if (!cancelled) setPreviews(Object.fromEntries(sessionCache));
      });
    }
    return () => { cancelled = true; };
  }, [enabled, key, profileId, readArtifact, readText]);

  return previews;
}