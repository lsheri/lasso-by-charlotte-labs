import { GraphiteIcon, type GraphiteIconName } from "@/components/notebook/icons";
import { ArtifactNote, SourceMark, sourceVendorKey, VendorMark } from "@/components/work/SourceMark";
import { colourKey, noteHue, notePaper } from "@/components/work/note-paper";
import { cardSizeTier, ownerLabel, type LabNode } from "@/components/canvas-lab/canvas-lab-model";
import { workIdentityLabel } from "@/lib/work-identity";
import { effectiveWorkDate, formatDate, type WorkItemRow } from "@/lib/work-types";
import { cn } from "@/lib/utils";
import { previewWheelConsumesScroll, type WorkboardCardPreview, type WorkboardDisplayMode } from "@/lib/workboard-card-preview.shared";

const KIND_ICON: Record<Exclude<LabNode["kind"], "work" | "task">, GraphiteIconName> = {
  brief: "engagement",
  decision: "decisions",
  chat: "messages",
  source: "attach",
  ai_work: "ai-record",
  judgment: "reflect",
  deliverable: "work",
};

function nodeIcon(node: LabNode): GraphiteIconName {
  if (node.kind === "task") return "work";
  if (node.kind === "work") return "work";
  return KIND_ICON[node.kind];
}

function clientAndEngagement(item: WorkItemRow): { clientId: string | null; engagementId: string | null } {
  const mapping = item.work_item_tasks?.[0]?.tasks ?? null;
  return {
    clientId: mapping?.engagements?.clients?.id ?? item.client_id ?? null,
    engagementId: mapping?.engagement_id ?? null,
  };
}

export function LabPaper({
  node,
  item,
  selected,
  onEdit,
  onEditCommitted,
  commentCount = 0,
  onOpenComments,
  displayMode = "sticky",
  preview,
  focused = false,
  onPreviewScroll,
}: {
  node: LabNode;
  item?: WorkItemRow | undefined;
  selected: boolean;
  onEdit: (text: string) => void;
  onEditCommitted: () => void;
  /** Slice 2a unit 2: live top-level comments on this card's item. */
  commentCount?: number;
  onOpenComments?: (() => void) | undefined;
  displayMode?: WorkboardDisplayMode;
  preview?: WorkboardCardPreview | undefined;
  focused?: boolean;
  onPreviewScroll?: (() => void) | undefined;
}) {
  const tier = cardSizeTier(node);
  const identity = item ? workIdentityLabel(item) : null;
  const date = item ? formatDate(effectiveWorkDate(item)) : null;
  const colour = item ? clientAndEngagement(item) : null;
  const summary = item ? identity : node.summary;
  const needsSourceFallback = item ? sourceVendorKey(item) === null : false;
  const chatPreview = displayMode === "preview" && item?.type === "ai_thread";
  const excerptPreview = displayMode === "preview" && item && item.type !== "ai_thread";
  const excerpt = item?.work_item_extracts?.find((extract) => extract.summary)?.summary ?? summary;
  const vendorKey = item ? sourceVendorKey(item) : null;
  const vendorTone = vendorKey === "claude" || vendorKey === "chatgpt" || vendorKey === "gemini" ? vendorKey : "other";

  return (
    <div
      className={cn("nb-paper canvas-lab-paper", `canvas-lab-paper-${node.ownership}`, displayMode === "preview" && item && "canvas-lab-paper-preview")}
      data-paper-state={item?.visibility}
      data-tier={tier}
      style={{
        ...notePaper(node.id),
        ...(colour ? noteHue(colourKey(colour)) : {}),
        ...(displayMode === "preview" && item ? { "--canvas-preview-vendor": `var(--vendor-${vendorTone})` } : {}),
      }}
    >
      <div className="canvas-lab-paper-body">
        <div className={cn("canvas-lab-paper-header shrink-0", selected && "canvas-lab-context-header")}>
          <span className="canvas-lab-paper-source">
            {item ? (
              <>
                <SourceMark item={item} size={12} />
                {needsSourceFallback ? <GraphiteIcon name="work" size={13} animate={false} /> : null}
              </>
            ) : <GraphiteIcon name={nodeIcon(node)} size={13} animate={false} />}
            <span className="min-w-0 shrink overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
              {item ? <><VendorMark item={item} />{tier !== "compact" && date ? <>{" · "}{date}</> : null}</> : node.typeLabel}
            </span>
            {node.deliverable ? <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">Deliverable</span> : null}
          </span>
          {node.linkedItemRemovedAt ? <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">Item deleted</span> : null}
          {commentCount > 0 ? (
            <button
              type="button"
              data-testid="lab-comment-chip"
              aria-label={`${commentCount} ${commentCount === 1 ? "comment" : "comments"}`}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => { event.stopPropagation(); onOpenComments?.(); }}
              className="inline-flex shrink-0 items-center gap-0.5 font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground"
            >
              <GraphiteIcon name="messages" size={11} animate={false} />
              {commentCount}
            </button>
          ) : null}
          <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">{ownerLabel(node)}</span>
        </div>

        <p className={cn("canvas-lab-paper-title shrink-0 font-hand text-[16px] leading-[18px] text-foreground", selected && "canvas-lab-context-title")}>
          {node.title} {item ? <ArtifactNote item={item} /> : null}
        </p>

        {chatPreview ? (
          <div
            data-testid="workboard-chat-preview"
            data-focused={focused}
            className="canvas-lab-chat-preview"
            onWheel={(event) => {
              if (!focused) return;
              const element = event.currentTarget;
              const canScroll = previewWheelConsumesScroll(focused, event.deltaY, element.scrollTop, element.clientHeight, element.scrollHeight);
              if (canScroll) onPreviewScroll?.();
            }}
          >
            {(preview?.turns ?? []).map((turn) => (
              <div key={turn.turnNo} className="canvas-lab-preview-turn">
                <span>{turn.role}</span>
                <p>{turn.content}</p>
              </div>
            ))}
          </div>
        ) : node.local ? (
          <textarea
            aria-label={`Edit ${node.title} note`}
            value={node.summary}
            onChange={(event) => onEdit(event.target.value)}
            onBlur={onEditCommitted}
            onPointerDown={(event) => event.stopPropagation()}
            className="canvas-lab-paper-edit min-h-0 w-full flex-1 basis-0 resize-none overflow-auto border border-[var(--nb-rule)] bg-card px-2 py-1 text-[11.5px] leading-[17px] text-foreground outline-none focus:border-[var(--nb-green)]"
          />
        ) : (excerptPreview ? excerpt : summary) && (!item || tier !== "compact" || excerptPreview) ? (
          <p className={cn("canvas-lab-paper-summary text-[11.5px] leading-[17px] text-muted-foreground", excerptPreview ? "line-clamp-6" : tier === "compact" ? "line-clamp-2" : "line-clamp-3")}>{excerptPreview ? excerpt : summary}</p>
        ) : null}

        {chatPreview ? (
          <div className="canvas-lab-paper-footer canvas-lab-preview-footer font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
            <VendorMark item={item} />
            <span>{preview?.model ?? "Model"}</span>
            <span>{preview?.turnCount ?? 0} turns</span>
          </div>
        ) : tier === "expanded" && item ? (
          <div className="canvas-lab-paper-footer font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
            <VendorMark item={item} />
            <span>{date}</span>
          </div>
        ) : null}
        {selected ? <span className="mt-auto block font-hand text-[13px] leading-none text-[var(--nb-green)]">in context</span> : null}
      </div>
    </div>
  );
}