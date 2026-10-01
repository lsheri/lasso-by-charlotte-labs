import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";

import { useProfile } from "@/hooks/use-profile";
import { toSafeHtml } from "@/lib/markdown";
import { logEvent } from "@/lib/telemetry";
import { getReferenceRenditionFn } from "@/lib/reference-file.functions";
import {
  renditionMatchLine,
  renditionSourceLine,
  renditionTitle,
  type ReferenceRendition,
} from "@/lib/reference-rendition-shared";
import type { WorkItemRow } from "@/lib/work-types";

/** v1.3 part 2. Shows a placeholder's rendition, always labelled as one. */
export function RenditionPane({ item }: { item: WorkItemRow }) {
  const fetchRendition = useServerFn(getReferenceRenditionFn);
  const query = useQuery({
    queryKey: ["reference-rendition", item.id],
    queryFn: () => fetchRendition({ data: { work_item_id: item.id } }),
    staleTime: 5 * 60 * 1000,
  });
  const [html, setHtml] = useState<string | null>(null);
  const data = query.data;
  const { data: profile } = useProfile();
  const viewedRef = useRef(false);

  useEffect(() => {
    if (viewedRef.current || !data || data.status !== "ok" || !profile?.org_id) return;
    viewedRef.current = true;
    logEvent("work.rendition_viewed", profile.org_id, { method: data.method, match: data.match });
  }, [data, profile?.org_id]);

  useEffect(() => {
    if (!data || data.status !== "ok") return;
    let cancelled = false;
    void toSafeHtml(data.content, data.format === "html" ? "html" : "markdown").then((safe) => {
      if (!cancelled) setHtml(safe);
    });
    return () => {
      cancelled = true;
    };
  }, [data]);

  if (query.isPending) {
    return <p className="mt-4 text-xs text-muted-foreground">Loading the rendition...</p>;
  }
  if (query.isError || data?.status === "failed") {
    return <p className="mt-4 text-xs text-muted-foreground">The rendition could not be opened.</p>;
  }
  if (!data || data.status !== "ok") return null;

  const r: ReferenceRendition = {
    ref: "",
    format: data.format,
    method: data.method,
    match: data.match,
    sha: null,
    chars: null,
  };
  const matchLine = renditionMatchLine(r);
  return (
    <section data-testid="reference-rendition" className="mt-4 space-y-2">
      <p className="text-sm font-medium text-foreground">{renditionTitle(data.filename)}</p>
      <p className="text-xs text-muted-foreground">{renditionSourceLine(r)}</p>
      {matchLine ? <p className="text-xs text-muted-foreground">{matchLine}</p> : null}
      {html === null ? (
        <p className="text-xs text-muted-foreground">Loading the rendition...</p>
      ) : (
        <div className="peek-prose" dangerouslySetInnerHTML={{ __html: html }} />
      )}
    </section>
  );
}
