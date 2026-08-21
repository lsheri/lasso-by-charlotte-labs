import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { draftEngagementLineage } from "@/lib/lineage.functions";

/**
 * Engagement-wide equivalent of "Find what fed this". Every proposal is a
 * draft the owner reviews inside each deliverable's peek panel.
 */
export function EngagementLineage({
  engagementId,
  profileId,
}: {
  engagementId: string;
  profileId: string;
}) {
  const run = useServerFn(draftEngagementLineage);
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);

  async function start() {
    setPending(true);
    try {
      const result = await run({
        data: { engagement_id: engagementId, profile_id: profileId },
      });
      await queryClient.invalidateQueries({ queryKey: ["deliverable-evidence"] });
      toast.success(
        result.deliverables === 0
          ? "No documents, decks or sheets in this engagement yet"
          : `${result.drafted} link${result.drafted === 1 ? "" : "s"} proposed across ${result.deliverables} deliverable${result.deliverables === 1 ? "" : "s"}, from ${result.considered} item${result.considered === 1 ? "" : "s"} considered`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't look for lineage");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-[var(--radius)] border border-border bg-card px-5 py-5 shadow-card">
      <h2 className="micro-label micro-label-section">Lineage</h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Lasso can look across this engagement and propose what fed each document, deck and sheet.
        Every proposal is a draft you confirm or discard.
      </p>
      <Button className="mt-4" onClick={() => void start()} disabled={pending}>
        {pending ? "Looking…" : "Find what fed these deliverables"}
      </Button>
    </section>
  );
}
