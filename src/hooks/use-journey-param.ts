import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { openJourney } from "@/lib/journey-state";
import { handleJourneyLink, readJourneyId, stripJourneyParam } from "@/lib/journey-link";

/**
 * A shared journey. The link carries only the deliverable's id: whether it
 * opens is decided by the reader's own access, so a coach can send a team the
 * story of one piece of work, and anyone else is told plainly it is not theirs
 * to see. Handled once, then the parameter comes back off the url.
 */
export function useJourneyParam(engagementId: string): void {
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current || typeof window === "undefined") return;
    const itemId = readJourneyId(window.location.search);
    if (!itemId) return;
    handled.current = true;

    void handleJourneyLink({
      itemId,
      engagementId,
      fetchItem: async (id) => {
        const { data, error } = await supabase
          .from("work_items")
          .select("id, title")
          .eq("id", id)
          .maybeSingle();
        if (error || !data) return null;
        return { id: data.id, title: data.title };
      },
      open: (request) => openJourney(request),
      onUnavailable: (line) => toast(line),
    }).finally(() => {
      window.history.replaceState(
        {},
        "",
        stripJourneyParam(`${window.location.pathname}${window.location.search}`),
      );
    });
  }, [engagementId]);
}
