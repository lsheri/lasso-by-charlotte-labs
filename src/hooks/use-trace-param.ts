import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { openProvenanceAudit } from "@/components/provenance/audit-state";
import { supabase } from "@/integrations/supabase/client";
import { handleTrace, readTraceId, stripTraceParam } from "@/lib/trace-link";

/**
 * A shared traced question. The link carries only an id: whether it opens is
 * decided by the reader's own access, so a coach can send the person exactly
 * what they circled and found, and anyone else is told plainly it is not theirs
 * to see. Handled once, then the parameter comes back off the url.
 */
export function useTraceParam(engagementId: string): void {
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current || typeof window === "undefined") return;
    const stitchId = readTraceId(window.location.search);
    if (!stitchId) return;
    handled.current = true;

    void handleTrace({
      stitchId,
      engagementId,
      fetchStitch: async (id) => {
        const { data, error } = await supabase
          .from("span_links")
          .select("id, from_item_id, from_item:work_items!span_links_from_item_id_fkey(title)")
          .eq("id", id)
          .maybeSingle();
        if (error || !data) return null;
        const row = data as unknown as {
          id: string;
          from_item_id: string;
          from_item: { title: string } | null;
        };
        return {
          id: row.id,
          from_item_id: row.from_item_id,
          anchor_title: row.from_item?.title ?? "This work",
        };
      },
      open: (request) =>
        openProvenanceAudit({
          anchorId: request.anchorId,
          anchorTitle: request.anchorTitle,
          engagementId: request.engagementId,
          initialStitchId: request.initialStitchId,
        }),
      onUnavailable: (line) => toast(line),
    }).finally(() => {
      window.history.replaceState(
        {},
        "",
        stripTraceParam(`${window.location.pathname}${window.location.search}`),
      );
    });
  }, [engagementId]);
}
