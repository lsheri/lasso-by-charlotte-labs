import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";

import { RenderedContent } from "@/components/peek/RenderedContent";
import { AnchorPane } from "@/components/provenance/AnchorPane";
import { SlidesPane } from "@/components/provenance/SlidesPane";
import { SourceMark } from "@/components/work/SourceMark";
import { Button } from "@/components/ui/button";
import type { LabComment, LabNode } from "@/components/canvas-lab/canvas-lab-model";
import type { DecisionRow } from "@/hooks/use-decisions";
import { srcsOf } from "@/hooks/use-decisions";
import { getSpanAudit } from "@/lib/span-provenance.functions";
import { pageUnitFor } from "@/lib/lasso-geometry";
import { renditionQueryOptions } from "@/lib/rendition-query";
import { getRenditionUrl } from "@/lib/rendition.functions";
import type { WorkItemRow } from "@/lib/work-types";

type TrailGroup = "context" | "ai_work" | "human_judgment" | "decisions";

export function CanvasLabReview({ item, profileId, decisions, nodes, comments, onTrailSelect, onClose }: { item: WorkItemRow; profileId?: string | undefined; decisions: DecisionRow[]; nodes: LabNode[]; comments: LabComment[]; onTrailSelect: (group: TrailGroup, focus: "exact" | "item") => void; onClose: () => void }) {
  const load = useServerFn(getSpanAudit);
  const rendition = useServerFn(getRenditionUrl);
  const { data, isLoading, isError } = useQuery({ queryKey: ["canvas-lab-review", item.id, profileId], queryFn: () => load({ data: { work_item_id: item.id, ...(profileId ? { profile_id: profileId } : {}) } }) });
  const { data: visual } = useQuery({ queryKey: ["canvas-lab-review-rendition", item.id], queryFn: () => rendition({ data: { work_item_id: item.id } }), ...renditionQueryOptions });
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ turnNo?: number; text?: string } | undefined>();
  const [activeStitchId, setActiveStitchId] = useState<string | null>(null);
  const sourceIds = useMemo(() => new Set([item.id, ...(data?.upstream ?? []).map((entry) => entry.id)]), [data, item.id]);
  const relatedDecisions = decisions.filter((decision) => srcsOf(decision).some((source) => sourceIds.has(source.work_item_id)));
  const focusedSource = (data?.upstream ?? []).find((entry) => entry.id === sourceId) ?? null;
  const groups = [
    { id: "context" as const, label: "Context", rows: (data?.upstream ?? []).filter((entry) => entry.type !== "ai_thread") },
    { id: "ai_work" as const, label: "AI work", rows: (data?.upstream ?? []).filter((entry) => entry.type === "ai_thread") },
  ];
  return <div className="fixed inset-0 z-[60] flex flex-col bg-background" data-testid="canvas-lab-review">
    <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3"><div><p className="font-mono text-[9px] uppercase tracking-[0.08em] text-green">What fed this</p><h1 className="truncate font-serif text-[26px] text-foreground">{item.title}</h1></div><Button type="button" variant="ghost" onClick={onClose}>Back to the workboard</Button></header>
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <aside className="w-full shrink-0 overflow-y-auto border-b border-border bg-[var(--nb-paper)] p-3 lg:w-[280px] lg:border-b-0 lg:border-r">
        {isLoading ? <p className="text-[12px] text-muted-foreground">Reading the record…</p> : null}
        {isError ? <p className="text-[12px] text-muted-foreground">This reasoning trail could not be opened.</p> : null}
        {groups.map((group) => <section key={group.id} className="mb-4"><h2 className="font-hand text-[16px] text-green">{group.label}</h2>{group.rows.length === 0 ? <p className="mt-1 text-[11.5px] text-muted-foreground">Nothing attached here.</p> : <ul className="mt-1 space-y-1">{group.rows.map((entry) => <li key={entry.id}><Button type="button" variant="ghost" size="sm" className="h-auto w-full justify-start whitespace-normal text-left text-[11.5px]" onClick={() => { const firstTurn = entry.turns[0]; setSourceId(entry.id); setFocus(firstTurn ? { turnNo: firstTurn.turn_no, text: firstTurn.content } : undefined); setActiveStitchId(null); onTrailSelect(group.id, firstTurn ? "exact" : "item"); }}><SourceMark item={{ source_vendor: entry.source_vendor }} size={12} />{entry.title}</Button></li>)}</ul>}</section>)}
        <section className="mb-4"><h2 className="font-hand text-[16px] text-green">Human judgment</h2><ul className="mt-1 space-y-1">{(data?.stitches ?? []).map((stitch) => <li key={stitch.id}><Button type="button" variant="ghost" size="sm" className="h-auto w-full justify-start whitespace-normal text-left text-[11.5px]" onClick={() => { setActiveStitchId(stitch.id); setSourceId(null); setFocus(undefined); onTrailSelect("human_judgment", stitch.locator?.snippet ? "exact" : "item"); }}>{stitch.question || stitch.quote || "Recorded question"}</Button></li>)}{nodes.filter((node) => node.kind === "judgment").map((node) => <li key={node.id} className="border-l-2 border-[var(--nb-green)] pl-2 text-[11.5px]">{node.title} · Not saved</li>)}{comments.map((comment) => <li key={comment.id} className="border-l-2 border-[var(--nb-green)] pl-2 text-[11.5px]">{comment.body} · Not saved</li>)}</ul></section>
        <section><h2 className="font-hand text-[16px] text-green">Decisions</h2>{relatedDecisions.length === 0 ? <p className="mt-1 text-[11.5px] text-muted-foreground">No decision with an attached source appears here.</p> : <ul className="mt-1 space-y-1">{relatedDecisions.map((decision) => <li key={decision.id}><Button type="button" variant="ghost" size="sm" className="h-auto w-full justify-start whitespace-normal text-left text-[11.5px]" onClick={() => { const source = srcsOf(decision).find((entry) => sourceIds.has(entry.work_item_id)); if (source) { const sourceItem = (data?.upstream ?? []).find((entry) => entry.id === source.work_item_id); const turn = sourceItem?.turns.find((entry) => entry.id === source.turn_id); setSourceId(source.work_item_id); setFocus(turn ? { turnNo: turn.turn_no, text: turn.content } : undefined); } onTrailSelect("decisions", source?.turn_id ? "exact" : "item"); }}>{decision.call_text}</Button></li>)}</ul>}</section>
        {sourceId && !focus ? <p className="mt-4 border-t border-border pt-2 font-hand text-[14px] text-green">No exact passage is attached. The whole item is open.</p> : null}
        {focusedSource ? <section className="mt-3 border-t border-border pt-3" aria-label="Focused source"><h2 className="text-[12px] font-medium text-foreground">{focusedSource.title}</h2>{focusedSource.turns.length > 0 ? <ul className="mt-2 space-y-2">{focusedSource.turns.map((turn) => <li key={turn.id} className={`border-l-2 px-2 py-1 text-[11.5px] leading-[17px] ${focus?.turnNo === turn.turn_no ? "border-[var(--nb-green)] bg-[var(--nb-green-wash)] text-foreground" : "border-border text-muted-foreground"}`}>Turn {turn.turn_no} · {turn.content}</li>)}</ul> : <p className="mt-2 whitespace-pre-wrap text-[11.5px] leading-[17px] text-foreground">{focusedSource.text ?? focusedSource.text_note ?? "Only this item's record is available."}</p>}</section> : null}
      </aside>
      <main className="min-h-0 flex-1 overflow-y-auto p-5">{data && activeStitchId ? (visual?.kind === "pdf" ? <SlidesPane url={visual.url} anchorId={item.id} unit={pageUnitFor({ webViewLink: data.anchor.web_view_link, text: data.anchor.text })} stitches={data.stitches} armed={false} busy={false} canAsk={false} onAsk={() => undefined} onGoToSource={() => undefined} replayStitchId={activeStitchId} /> : <AnchorPane anchor={data.anchor} canEdit={false} stitches={data.stitches.filter((stitch) => stitch.id === activeStitchId)} viewerProfileId={null} busy={false} onAsk={() => undefined} onGoToSource={() => undefined} />) : <RenderedContent item={item} onDownload={() => undefined} canEdit={false} />}</main>
    </div>
  </div>;
}