import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { GraphiteRule, JourneyStem, StitchLoop } from "@/components/notebook/marks";
import { SourceMark } from "@/components/work/SourceMark";
import { useEngagementPage } from "@/hooks/use-engagement-page";
import { supabase } from "@/integrations/supabase/client";
import {
  JOURNEY_THIN_LINE,
  JOURNEY_TITLE,
  JOURNEY_VIEWER_LINE,
  buildJourney,
  journeyDelayMs,
  type Journey,
  type JourneyItemInput,
  type JourneyNode,
  type JourneyStitchInput,
} from "@/lib/journey";
import { journeyLinkFor } from "@/lib/journey-link";
import { closeJourney, useJourneyRequest } from "@/lib/journey-state";
import { spanStatusClass } from "@/lib/span-status-style";
import { spanStatusPhrase } from "@/lib/span-readability";
import { formatDate } from "@/lib/work-types";

/**
 * Pass 110: the journey. A vertical stem showing how one deliverable grew out
 * of the record: the sources, the conversations, the questions actually asked
 * of them, and the finished thing last. It reads only rows that exist, and it
 * is never about the person who did the work.
 */
export function JourneyView() {
  const request = useJourneyRequest();
  if (!request) return null;
  return (
    <JourneySurface
      key={request.anchorId}
      anchorId={request.anchorId}
      anchorTitle={request.anchorTitle}
      engagementId={request.engagementId}
    />
  );
}

function JourneySurface({
  anchorId,
  anchorTitle,
  engagementId,
}: {
  anchorId: string;
  anchorTitle: string;
  engagementId: string;
}) {
  const page = useEngagementPage(engagementId);

  const items = useMemo<JourneyItemInput[]>(() => {
    const byId = new Map<string, JourneyItemInput>();
    for (const task of page.data?.tasks ?? []) {
      for (const link of task.work_item_tasks ?? []) {
        const item = link.work_items;
        if (!item || byId.has(item.id)) continue;
        byId.set(item.id, {
          id: item.id,
          title: item.title,
          type: item.type,
          source_vendor: item.source_vendor ?? null,
          work_date: item.work_date ?? null,
          created_at_source: item.created_at_source ?? null,
          captured_at: item.captured_at,
        });
      }
    }
    return [...byId.values()];
  }, [page.data]);

  const ids = items.map((item) => item.id).sort();

  const extra = useQuery({
    queryKey: ["journey", anchorId, ids],
    enabled: ids.length > 0,
    queryFn: async () => {
      const [turns, links] = await Promise.all([
        supabase.from("turns").select("work_item_id").in("work_item_id", ids),
        supabase
          .from("span_links")
          .select("id, status, quote, to_item_id, to_turn_id, created_at")
          .eq("from_item_id", anchorId)
          .order("created_at", { ascending: true }),
      ]);
      const counts: Record<string, number> = {};
      for (const row of turns.data ?? []) {
        const key = row.work_item_id as string;
        counts[key] = (counts[key] ?? 0) + 1;
      }
      const turnIds = (links.data ?? []).map((l) => l.to_turn_id).filter(Boolean) as string[];
      const turnNos = turnIds.length
        ? await supabase.from("turns").select("id, turn_no").in("id", turnIds)
        : { data: [] as { id: string; turn_no: number }[] };
      const noById = new Map((turnNos.data ?? []).map((t) => [t.id, t.turn_no] as const));
      const stitches: JourneyStitchInput[] = (links.data ?? []).map((l) => ({
        id: l.id,
        status: l.status as JourneyStitchInput["status"],
        quote: l.quote,
        to_item_id: l.to_item_id,
        to_turn_no: l.to_turn_id ? (noById.get(l.to_turn_id) ?? null) : null,
        created_at: l.created_at,
      }));
      return { counts, stitches };
    },
  });

  const journey = useMemo(
    () =>
      buildJourney({
        anchorId,
        items: items.map((item) => ({
          ...item,
          turn_count: extra.data?.counts[item.id] ?? null,
        })),
        order: page.data?.stepOrder ?? {},
        stitches: extra.data?.stitches ?? [],
      }),
    [anchorId, items, page.data, extra.data],
  );

  const engagementTitle = page.data?.engagement?.title ?? anchorTitle;
  const loading = page.isLoading || (ids.length > 0 && extra.isLoading);

  function copyLink() {
    const url = journeyLinkFor(window.location.origin, engagementId, anchorId);
    void navigator.clipboard
      .writeText(url)
      .then(() => toast("Link copied"))
      .catch(() => toast("Could not copy that link"));
  }

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-background">
      <div className="mx-auto w-full max-w-[720px] px-5 pb-24 pt-[calc(1.5rem+env(safe-area-inset-top))]">
        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="micro-label text-muted-foreground">{JOURNEY_TITLE}</p>
            <h1 className="page-title mt-1 break-words text-[22px] leading-snug">
              {engagementTitle}
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={copyLink}
              className="rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Copy link
            </button>
            <button
              type="button"
              aria-label="Close the journey"
              onClick={closeJourney}
              className="grid h-9 w-9 place-items-center rounded-md text-foreground/70 transition-colors hover:bg-secondary"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </header>

        <div className="mt-8">
          {loading ? (
            <p className="text-sm text-muted-foreground">Reading the record...</p>
          ) : (
            <JourneySpine journey={journey} notShared={items.length === 0} />
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * The drawing itself, pure. It takes a built journey and nothing else, so what
 * it renders can only ever be what the record holds.
 */
export function JourneySpine({
  journey,
  animate = true,
  notShared = false,
}: {
  journey: Journey;
  animate?: boolean;
  /** The record loaded and holds nothing for this viewer, so it is not theirs. */
  notShared?: boolean;
}) {
  const [skipped, setSkipped] = useState(false);

  useEffect(() => {
    if (!animate || skipped) return;
    const done = () => setSkipped(true);
    window.addEventListener("click", done);
    window.addEventListener("keydown", done);
    return () => {
      window.removeEventListener("click", done);
      window.removeEventListener("keydown", done);
    };
  }, [animate, skipped]);

  if (!journey.enough) {
    return (
      <p className="max-w-[46ch] text-sm text-muted-foreground">
        {notShared ? JOURNEY_VIEWER_LINE : JOURNEY_THIN_LINE}
      </p>
    );
  }

  const drawing = animate && !skipped;
  const count = journey.nodes.length;

  return (
    <ol className="list-none space-y-0" data-testid="journey-spine">
      {journey.nodes.map((node, index) => (
        <li key={node.id} className="relative">
          {index > 0 ? (
            <div className="h-10 pl-[9px]">
              <JourneyStem
                className="h-full w-[6px]"
                drawing={drawing}
                delayMs={journeyDelayMs(index, count)}
              />
            </div>
          ) : null}
          <NodeRow
            node={node}
            drawing={drawing}
            delayMs={journeyDelayMs(index, count)}
            last={index === count - 1}
          />
        </li>
      ))}
    </ol>
  );
}

function NodeRow({
  node,
  drawing,
  delayMs,
  last,
}: {
  node: JourneyNode;
  drawing: boolean;
  delayMs: number;
  last: boolean;
}) {
  const classes = [
    "nb-journey-node",
    drawing ? "" : "nb-journey-node-static",
    last ? "nb-journey-final" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={classes}
      style={drawing ? { animationDelay: `${delayMs}ms` } : undefined}
      data-kind={node.kind}
    >
      <div className="flex items-start gap-2.5">
        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-foreground/70" aria-hidden />
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <SourceMark item={{ source_vendor: node.sourceVendor }} size={14} />
            <span
              className={
                last
                  ? "page-title break-words text-[19px] leading-snug"
                  : "break-words text-sm font-medium text-foreground"
              }
            >
              {node.title}
            </span>
          </div>
          {last ? <GraphiteRule className="mt-1 h-[6px] w-[180px] text-muted-foreground" /> : null}
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
            {[
              node.typeLabel,
              node.date ? formatDate(node.date) : null,
              node.turnCount ? `${node.turnCount} turns` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>

          {node.stitches.length > 0 ? (
            <ul className="mt-3 list-none space-y-2 border-l border-border pl-3">
              {node.stitches.map((stitch, i) => (
                <li key={stitch.id} className="flex items-start gap-2">
                  <StitchLoop drawing={drawing} delayMs={delayMs + 120 + i * 90} />
                  <div className={`${spanStatusClass(stitch.status)} rounded-md px-2 py-1.5`}>
                    <p className="text-[13px] leading-snug text-foreground">
                      {stitch.quote ? `"${stitch.quote}"` : spanStatusPhrase(stitch.status)}
                    </p>
                    <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                      {[
                        spanStatusPhrase(stitch.status),
                        stitch.to_turn_no ? `turn ${stitch.to_turn_no}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  );
}
