import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Pencil, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AnchorPane } from "@/components/provenance/AnchorPane";
import { StitchTabs } from "@/components/provenance/StitchTabs";
import { SlidesPane } from "@/components/provenance/SlidesPane";
import { ThreadLine } from "@/components/provenance/ThreadLine";
import { UpstreamPane } from "@/components/provenance/UpstreamPane";
import { closeProvenanceAudit, useProvenanceAudit } from "@/components/provenance/audit-state";
import { pageUnitFor } from "@/lib/lasso-geometry";
import { renditionQueryOptions } from "@/lib/rendition-query";
import { getRenditionUrl } from "@/lib/rendition.functions";
import { pickResolvedStitch, runResolveChoreography } from "@/lib/span-replay";
import { stitchNumbers } from "@/lib/span-readability";
import { traceLinkFor } from "@/lib/trace-link";
import { askSpanProvenance, deleteSpanLink, getSpanAudit } from "@/lib/span-provenance.functions";
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
  return (
    <AuditSurface
      key={request.anchorId}
      anchorId={request.anchorId}
      title={request.anchorTitle}
      engagementId={request.engagementId ?? null}
      initialStitchId={request.initialStitchId ?? null}
    />
  );
}

function AuditSurface({
  anchorId,
  title,
  engagementId,
  initialStitchId,
}: {
  anchorId: string;
  title: string;
  engagementId: string | null;
  initialStitchId: string | null;
}) {
  const load = useServerFn(getSpanAudit);
  const ask = useServerFn(askSpanProvenance);
  const rendition = useServerFn(getRenditionUrl);
  const removeStitch = useServerFn(deleteSpanLink);
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [armed, setArmed] = useState(false);
  const [view, setView] = useState<"slides" | "text">("slides");
  /** The question being replayed, from a tab click or a shared trace link. */
  const [replayId, setReplayId] = useState<string | null>(initialStitchId);
  const [thread, setThread] = useState<{
    from: { x: number; y: number };
    targetId: string | null;
    sourced: boolean;
    status: AuditStitch["status"];
  } | null>(null);
  const [focus, setFocus] = useState<{
    itemId: string;
    turnId: string | null;
    token: number;
    status: AuditStitch["status"];
    stitchId: string;
    number?: number;
  } | null>(null);
  const reduceMotion =
    typeof window !== "undefined"
      ? (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false)
      : false;

  const { data, isLoading, error } = useQuery({
    queryKey: ["span-audit", anchorId],
    queryFn: () => load({ data: { work_item_id: anchorId } }),
  });

  const { data: visual, refetch: refetchRendition } = useQuery({
    queryKey: ["span-audit-rendition", anchorId],
    queryFn: () => rendition({ data: { work_item_id: anchorId } }),
    ...renditionQueryOptions,
  });

  const hasVisual = visual?.kind === "pdf";
  const showSlides = hasVisual && view === "slides";
  const unit = pageUnitFor({
    webViewLink: data?.anchor.web_view_link ?? null,
    text: data?.anchor.text ?? null,
  });

  // The pairing numbers: by when a question was asked, never by rail order.
  const numbers = stitchNumbers(data?.stitches ?? []);
  const vendors: Record<string, string | null> = {};
  (data?.upstream ?? []).forEach((item) => {
    vendors[item.id] = item.source_vendor;
  });

  const citations: Record<string, number> = {};
  (data?.stitches ?? []).forEach((stitch) => {
    if (!stitch.to_item_id) return;
    citations[stitch.to_item_id] = (citations[stitch.to_item_id] ?? 0) + 1;
  });

  async function askSpan(locator: SpanLocator, question: string) {
    if (busy) return;
    setBusy(true);
    try {
      await ask({ data: { work_item_id: anchorId, locator, question } });
      await queryClient.invalidateQueries({ queryKey: ["span-audit", anchorId] });
      // The reveal, in order: the thread, then the source itself, but only when
      // the answer actually had one. An unsourced answer opens nothing.
      const fresh = queryClient.getQueryData<{ stitches: AuditStitch[] }>(["span-audit", anchorId]);
      const landed = pickResolvedStitch(fresh?.stitches ?? [], locator.snippet);
      if (landed) {
        setReplayId(landed.id);
        runResolveChoreography(landed, {
          onThread: () => {},
          onFocus: (stitch) => goToSource(stitch),
        });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That question could not be answered.");
    } finally {
      setBusy(false);
    }
  }

  function goToSource(stitch: AuditStitch, origin?: DOMRect | null) {
    if (origin) {
      setThread({
        from: { x: origin.left, y: origin.top + origin.height / 2 },
        targetId: stitch.to_item_id ? `audit-item-${stitch.to_item_id}` : null,
        sourced: Boolean(stitch.to_item_id),
        status: stitch.status,
      });
    }
    if (!stitch.to_item_id) return;
    setFocus({
      itemId: stitch.to_item_id,
      turnId: stitch.to_turn_id,
      token: Date.now(),
      status: stitch.status,
      stitchId: stitch.id,
      ...(numbers[stitch.id] ? { number: numbers[stitch.id] } : {}),
    });
  }

  // A shared trace opens straight onto its answer once the record is read.
  const traced = initialStitchId
    ? (data?.stitches ?? []).find((stitch) => stitch.id === initialStitchId)
    : undefined;
  const tracedKey = traced?.id ?? null;
  useEffect(() => {
    if (!traced) return;
    setReplayId(traced.id);
    goToSource(traced);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracedKey]);

  async function removeOne(stitch: AuditStitch) {
    try {
      await removeStitch({ data: { span_link_id: stitch.id } });
      if (replayId === stitch.id) setReplayId(null);
      await queryClient.invalidateQueries({ queryKey: ["span-audit", anchorId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That question could not be removed.");
    }
  }

  function copyLink(stitch: AuditStitch) {
    if (typeof window === "undefined") return;
    const link = engagementId
      ? traceLinkFor(window.location.origin, engagementId, stitch.id)
      : `${window.location.origin}${window.location.pathname}?trace=${stitch.id}`;
    void navigator.clipboard?.writeText(link);
    toast.success("Link copied.");
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
        <div className="flex items-center gap-2">
          {hasVisual ? (
            <div className="flex overflow-hidden rounded-full border border-border text-xs">
              {(["slides", "text"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setView(option)}
                  className={`px-2.5 py-1 capitalize ${
                    view === option ? "bg-secondary text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {option === "slides" ? (unit === "slide" ? "Slides" : "Pages") : "Text"}
                </button>
              ))}
            </div>
          ) : null}
          {showSlides ? (
            <button
              type="button"
              onClick={() => setArmed((prev) => !prev)}
              aria-label="Lasso a part of the page"
              aria-pressed={armed}
              className={`rounded-full border p-1.5 transition-colors ${
                armed
                  ? "border-accent bg-accent-soft text-accent-deep"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <Pencil className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
          <button
            type="button"
            onClick={closeProvenanceAudit}
            aria-label="Close"
            className="rounded-full border border-border p-1.5 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </header>

      {data && data.stitches.length > 0 ? (
        <StitchTabs
          stitches={data.stitches}
          activeId={replayId}
          canDelete={data.canEdit}
          onSelect={(stitch) => {
            setReplayId(stitch.id);
            goToSource(stitch);
          }}
          onNew={() => {
            setReplayId(null);
            setArmed(true);
          }}
          onCopyLink={copyLink}
          onDelete={(stitch) => void removeOne(stitch)}
        />
      ) : null}

      {isLoading ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">Reading the record…</p>
      ) : error || !data ? (
        <p className="px-4 py-6 text-sm text-destructive">
          {error instanceof Error ? error.message : "This audit could not be opened."}
        </p>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col-reverse lg:flex-row">
          <div className="min-h-0 flex-1 overflow-y-auto border-border px-4 py-4 lg:w-1/2 lg:border-r">
            <UpstreamPane
              items={data.upstream}
              baseline={data.baseline}
              focus={focus}
              citations={citations}
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 lg:w-1/2">
            {showSlides && visual?.kind === "pdf" ? (
              <SlidesPane
                url={visual.url}
                anchorId={anchorId}
                onReload={() => void refetchRendition()}
                unit={unit}
                stitches={data.stitches}
                armed={armed}
                busy={busy}
                canAsk={Boolean(data.viewerProfileId)}
                onAsk={(locator, question) => void askSpan(locator, question)}
                onGoToSource={goToSource}
                replayStitchId={replayId}
                numbers={numbers}
                vendors={vendors}
              />
            ) : (
              <AnchorPane
                anchor={data.anchor}
                canEdit={data.canEdit}
                stitches={data.stitches}
                viewerProfileId={data.viewerProfileId}
                busy={busy}
                onAsk={(locator, question) => void askSpan(locator, question)}
                onGoToSource={(stitch) => goToSource(stitch)}
                numbers={numbers}
                vendors={vendors}
              />
            )}
          </div>
        </div>
      )}

      {thread ? (
        <ThreadLine
          from={thread.from}
          targetId={thread.targetId}
          sourced={thread.sourced}
          status={thread.status}
          reduceMotion={reduceMotion}
          onDone={() => setThread(null)}
        />
      ) : null}
    </div>
  );
}
