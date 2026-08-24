import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AnchorPane } from "@/components/provenance/AnchorPane";
import { UpstreamPane } from "@/components/provenance/UpstreamPane";
import {
  closeProvenanceAudit,
  useProvenanceAudit,
} from "@/components/provenance/audit-state";
import { askSpanProvenance, getSpanAudit } from "@/lib/span-provenance.functions";
import type { AuditStitch } from "@/lib/span-provenance.functions";
import type { SpanLocator } from "@/lib/span-provenance-shared";

/**
 * The provenance audit: the deliverable's captured record beside the work that
 * came before it. Selecting a span asks one question, and the answer is written
 * only when the record actually supports it.
 */
export function ProvenanceAudit() {
  const request = useProvenanceAudit();
  if (!request) return null;
  return <AuditSurface key={request.anchorId} anchorId={request.anchorId} title={request.anchorTitle} />;
}

function AuditSurface({ anchorId, title }: { anchorId: string; title: string }) {
  const load = useServerFn(getSpanAudit);
  const ask = useServerFn(askSpanProvenance);
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [focus, setFocus] = useState<{
    itemId: string;
    turnId: string | null;
    token: number;
  } | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["span-audit", anchorId],
    queryFn: () => load({ data: { work_item_id: anchorId } }),
  });

  async function askSpan(locator: SpanLocator, question: string) {
    if (busy) return;
    setBusy(true);
    try {
      await ask({ data: { work_item_id: anchorId, locator, question } });
      await queryClient.invalidateQueries({ queryKey: ["span-audit", anchorId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That question could not be answered.");
    } finally {
      setBusy(false);
    }
  }

  function goToSource(stitch: AuditStitch) {
    if (!stitch.to_item_id) return;
    setFocus({ itemId: stitch.to_item_id, turnId: stitch.to_turn_id, token: Date.now() });
  }

  return (
    <div className="nb-ask-plain fixed inset-0 z-50 flex flex-col bg-background">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <p className="micro-label micro-label-ai">What fed this</p>
          <h2 className="truncate text-sm font-medium text-foreground">
            {data?.anchor.title ?? title}
          </h2>
        </div>
        <button
          type="button"
          onClick={closeProvenanceAudit}
          aria-label="Close"
          className="rounded-full border border-border p-1.5 text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </header>

      {isLoading ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">Reading the record…</p>
      ) : error || !data ? (
        <p className="px-4 py-6 text-sm text-destructive">
          {error instanceof Error ? error.message : "This audit could not be opened."}
        </p>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col-reverse lg:flex-row">
          <div className="min-h-0 flex-1 overflow-y-auto border-border px-4 py-4 lg:w-1/2 lg:border-r">
            <UpstreamPane items={data.upstream} baseline={data.baseline} focus={focus} />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 lg:w-1/2">
            <AnchorPane
              anchor={data.anchor}
              canEdit={data.canEdit}
              stitches={data.stitches}
              viewerProfileId={data.viewerProfileId}
              busy={busy}
              onAsk={(locator, question) => void askSpan(locator, question)}
              onGoToSource={goToSource}
            />
          </div>
        </div>
      )}
    </div>
  );
}
