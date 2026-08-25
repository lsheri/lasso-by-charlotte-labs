import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { ChaliceMark, GraphiteRule, JourneyStem, StitchLoop } from "@/components/notebook/marks";
import { WorkArtifactPanel } from "@/components/journey/WorkArtifactPanel";
import { SourceMark } from "@/components/work/SourceMark";
import { useEngagementPage } from "@/hooks/use-engagement-page";
import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import {
  JOURNEY_THIN_LINE,
  JOURNEY_TITLE,
  JOURNEY_VIEWER_LINE,
  buildJourney,
  journeyDelayMs,
  journeySpineMs,
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

  const { data: profile } = useProfile();
  const anchorOwnerId = useMemo(() => {
    for (const task of page.data?.tasks ?? []) {
      for (const link of task.work_item_tasks ?? []) {
        if (link.work_items?.id === anchorId) return link.work_items.owner_id ?? null;
      }
    }
    return null;
  }, [page.data, anchorId]);
  const isOwner = Boolean(
    profile && profile.role !== "coach" && anchorOwnerId && anchorOwnerId === profile.id,
  );
  const reducedMotion =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
          <div className="flex min-w-0 items-start gap-2.5">
            <ChaliceMark size={28} className="mt-1" />
            <div className="min-w-0">
            <p className="micro-label text-muted-foreground">{JOURNEY_TITLE}</p>
            <h1 className="page-title mt-1 break-words text-[22px] leading-snug">
              {engagementTitle}
            </h1>
            </div>
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
              aria-label="Close the Work Artifact"
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

        {!loading && journey.enough ? (
          <WorkArtifactPanel
            anchorId={anchorId}
            anchorTitle={anchorTitle}
            canEdit={isOwner}
            orgId={profile?.org_id}
            profileId={profile?.id}
            drawing={!reducedMotion}
            startMs={journeySpineMs(journey.nodes.length)}
          />
        ) : null}
      </div>
    </div>
  );
}

/**
 * The drawing itself, pure. It takes a built journey and nothing else, so what
 * it renders can only ever be what the record holds.
 *
 * Pass 114: the spine winds. One seeded serpentine route, an arrowhead into
 * every arrival, each work item announced as its own card with its real logo,
 * and the stitches hanging off the run in the author's own words.
 */
export function JourneySpine({
  journey,
  animate = true,
  notShared = false,
  width,
}: {
  journey: Journey;
  animate?: boolean;
  /** The record loaded and holds nothing for this viewer, so it is not theirs. */
  notShared?: boolean;
  /** Test seam: the measured content width the path is laid out inside. */
  width?: number | undefined;
}) {
  const [skipped, setSkipped] = useState(false);
  const holder = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState(width ?? 640);

  useEffect(() => {
    if (width) return;
    const node = holder.current;
    if (!node) return;
    const read = () => setMeasured(node.clientWidth || 640);
    read();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(read);
    observer.observe(node);
    return () => observer.disconnect();
  }, [width]);

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

  const ids = journey.nodes.map((node) => node.id);
  const path = useMemo(
    () => buildJourneyPath({ ids: ids, width: width ?? measured }),
    [ids.join("|"), width, measured],
  );

  if (!journey.enough) {
    return (
      <p className="max-w-[46ch] text-sm text-muted-foreground">
        {notShared ? JOURNEY_VIEWER_LINE : JOURNEY_THIN_LINE}
      </p>
    );
  }

  const drawing = animate && !skipped;
  const count = journey.nodes.length;
  const tendrilFor = new Map(path.tendrils.map((t) => [t.nodeId, t] as const));
  const segmentFor = new Map(path.segments.map((s) => [s.toId, s] as const));

  return (
    <div
      ref={holder}
      className={`nb-journey ${drawing ? "" : "is-skipped"}`}
      data-testid="journey-spine"
      style={{ height: path.height }}
    >
      <svg
        className="nb-journey-svg"
        width={path.width}
        height={path.height}
        viewBox={`0 0 ${path.width} ${path.height}`}
        aria-hidden
      >
        {journey.nodes.map((node, index) => {
          const segment = segmentFor.get(node.id);
          const tendril = tendrilFor.get(node.id);
          const beat = beatMs(nodeBeatS(index, count));
          return (
            <g key={node.id}>
              {segment ? (
                <>
                  <path
                    className="nb-journey-seg"
                    d={segment.stroke.d}
                    data-length={segment.stroke.length}
                    style={
                      drawing
                        ? {
                            strokeDasharray: segment.stroke.length,
                            strokeDashoffset: 0,
                            animationDelay: `${beat + beatMs(NODE_SEGMENT_OFFSET_S)}ms`,
                            ["--nb-len" as string]: `${segment.stroke.length}`,
                          }
                        : undefined
                    }
                  />
                  {segment.arrow.map((stroke, k) => (
                    <path
                      key={`a${k}`}
                      className="nb-journey-arrow"
                      d={stroke.d}
                      style={
                        drawing
                          ? {
                              animationDelay: `${beat + beatMs(NODE_ARROW_OFFSET_S) + k * 80}ms`,
                              ["--nb-len" as string]: `${stroke.length}`,
                            }
                          : undefined
                      }
                    />
                  ))}
                </>
              ) : null}
              {tendril && node.stitches.length > 0 ? (
                <path
                  className="nb-journey-tendril"
                  d={tendril.stroke.d}
                  style={
                    drawing
                      ? {
                          animationDelay: `${beat + beatMs(NODE_STITCH_OFFSET_S)}ms`,
                          ["--nb-len" as string]: `${tendril.stroke.length}`,
                        }
                      : undefined
                  }
                />
              ) : null}
            </g>
          );
        })}
      </svg>

      <ol className="nb-journey-nodes list-none">
        {journey.nodes.map((node, index) => {
          const place = path.nodes[index];
          const tendril = tendrilFor.get(node.id);
          const beat = beatMs(nodeBeatS(index, count));
          const left = place ? place.x - place.w / 2 : 0;
          const top = place ? place.y - place.h / 2 : 0;
          return (
            <li
              key={node.id}
              className="nb-journey-item"
              style={{ left, top, width: place?.w }}
              data-kind={node.kind}
            >
              <NodeCard
                node={node}
                drawing={drawing}
                beatMsValue={beat}
                last={index === count - 1}
              />
              {node.stitches.length > 0 && tendril ? (
                <div
                  className="nb-journey-stitches"
                  style={{
                    left: tendril.end.x - left,
                    top: tendril.end.y - top,
                    transform: tendril.end.x > path.width / 2 ? "translateX(-100%)" : undefined,
                  }}
                >
                  <ul className="list-none space-y-2">
                    {node.stitches.map((stitch, i) => (
                      <li
                        key={stitch.id}
                        className="nb-journey-quote"
                        style={
                          drawing
                            ? {
                                animationDelay: `${beat + beatMs(NODE_STITCH_OFFSET_S) + 150 + i * 90}ms`,
                              }
                            : undefined
                        }
                      >
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
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** One arrival: the tool announces itself, with its own logo and a small burst. */
function NodeCard({
  node,
  drawing,
  beatMsValue,
  last,
}: {
  node: JourneyNode;
  drawing: boolean;
  beatMsValue: number;
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
      style={drawing ? { animationDelay: `${beatMsValue + beatMs(NODE_CARD_OFFSET_S)}ms` } : undefined}
      data-kind={node.kind}
    >
      <div className="flex items-start gap-2.5">
        <span className="nb-journey-logo relative shrink-0">
          <SourceMark item={{ source_vendor: node.sourceVendor }} size={28} />
          <PencilFirework
            nodeId={node.id}
            drawing={drawing}
            delayMs={beatMsValue + beatMs(NODE_FIREWORK_OFFSET_S)}
          />
        </span>
        <div className="min-w-0">
          <span
            className={
              last
                ? "page-title block break-words text-[17px] leading-snug"
                : "block break-words text-sm font-medium text-foreground"
            }
          >
            {node.title}
          </span>
          {last ? <GraphiteRule className="mt-1 h-[6px] w-[140px] text-muted-foreground" /> : null}
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
            {[
              node.typeLabel,
              node.date ? formatDate(node.date) : null,
              node.turnCount ? `${node.turnCount} turns` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </div>
    </div>
  );
}

