import { GraphiteIcon, type GraphiteIconName } from "@/components/notebook/icons";
import { WorkboardFilePreview } from "@/components/canvas-lab/WorkboardFilePreview";
import { ArtifactNote, SourceMark, sourceVendorKey, VendorMark } from "@/components/work/SourceMark";
import { ChatPreviewWindow } from "@/components/work/ChatPreviewWindow";
import { colourKey, noteHue, notePaper } from "@/components/work/note-paper";
import { cardSizeTier, ownerLabel, type LabNode } from "@/components/canvas-lab/canvas-lab-model";
import { workIdentityLabel } from "@/lib/work-identity";
import { effectiveWorkDate, formatDate, type WorkItemRow } from "@/lib/work-types";
import { cn } from "@/lib/utils";
import { useState } from "react";

import type { WorkboardCardPreview, WorkboardDisplayMode, WorkboardFilePreview as FilePreview } from "@/lib/workboard-card-preview.shared";

const KIND_ICON: Record<Exclude<LabNode["kind"], "work" | "task">, GraphiteIconName> = {
  brief: "engagement",
  decision: "decisions",
  chat: "messages",
  source: "attach",
  ai_work: "ai-record",
  judgment: "reflect",
  deliverable: "work",
  shape: "work",
  text: "work",
  answer: "ask-lasso",
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
  filePreview,
  focused = false,
  onPreviewScroll: _onPreviewScroll,
  showOwnership = true,
  onOpenTrail,
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
  filePreview?: FilePreview | undefined;
  focused?: boolean;
  onPreviewScroll?: ((kind: "chat" | "document" | "deck" | "html") => void) | undefined;
  /** The sample board has no owner, so it shows no ownership label. */
  showOwnership?: boolean;
  /** Deliverable cards only: opens the card's trail, the same path the menu uses. */
  onOpenTrail?: (() => void) | undefined;
}) {
  const tier = cardSizeTier(node);
  const identity = item ? workIdentityLabel(item) : null;
  const date = item ? formatDate(effectiveWorkDate(item)) : null;
  const colour = item ? clientAndEngagement(item) : null;
  const summary = item ? identity : node.summary;
  const needsSourceFallback = item ? sourceVendorKey(item) === null : false;
  const chatPreview = displayMode === "preview" && item?.type === "ai_thread";
  const excerptPreview = displayMode === "preview" && item && item.type !== "ai_thread";
  const [filePreviewFailed, setFilePreviewFailed] = useState(false);
  const showFilePreview = Boolean(excerptPreview && filePreview && filePreview.kind !== "fallback" && !filePreviewFailed);
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
        ...(displayMode === "preview" && item ? { "--canvas-preview-vendor": `var(--canvas-vendor-${vendorTone})` } : {}),
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
            {item && (item.type === "document" || item.type === "deck") && (filePreview?.versionCount ?? 0) > 0 ? <span data-testid="workboard-version-chip" className="canvas-lab-version-chip">v{filePreview?.versionCount}</span> : null}
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
          {showOwnership ? <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">{ownerLabel(node)}</span> : null}
        </div>

        <p className={cn("canvas-lab-paper-title shrink-0 font-hand text-[16px] leading-[18px] text-foreground", selected && "canvas-lab-context-title")}>
          {node.title} {item ? <ArtifactNote item={item} /> : null}
        </p>

        {chatPreview ? (
          <div className="nb-preview-content min-h-0 flex-1" data-preview-shape="portrait">
            <ChatPreviewWindow testId="workboard-chat-preview" vendorKey={vendorKey} turns={preview?.turns ?? []} />
          </div>
        ) : showFilePreview && filePreview ? (
          <div className="nb-preview-content min-h-0 flex-1" data-preview-shape={filePreview.kind === "slide" ? "slide" : "portrait"}>
            <div className="nb-document-preview-body min-h-0 flex-1 overflow-hidden">
              <WorkboardFilePreview preview={filePreview} title={item?.title ?? node.title} focused={focused} onFailure={() => setFilePreviewFailed(true)} />
            </div>
          </div>
        ) : node.local ? (
          <textarea
            aria-label={`Edit ${node.title} note`}
            value={node.summary}
            onChange={(event) => onEdit(event.target.value)}
            onBlur={onEditCommitted}
            onPointerDown={(event) => event.stopPropagation()}
            className="canvas-lab-paper-edit min-h-0 w-full flex-1 basis-0 resize-none overflow-auto border border-[var(--nb-rule)] bg-card px-2 py-1 nb-type-small leading-[17px] text-foreground outline-none focus:border-[var(--nb-green)]"
          />
        ) : (excerptPreview ? excerpt : summary) && (!item || tier !== "compact" || excerptPreview) ? (
          <p className={cn("canvas-lab-paper-summary nb-type-small leading-[17px] text-muted-foreground", excerptPreview ? "line-clamp-6" : tier === "compact" ? "line-clamp-2" : "line-clamp-3")}>{excerptPreview ? excerpt : summary}</p>
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
        {node.deliverable && onOpenTrail ? (
          <button
            type="button"
            data-testid="lab-what-fed-this"
            aria-label={`What fed ${node.title}`}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => { event.stopPropagation(); onOpenTrail(); }}
            className={cn(
              "mt-auto self-start font-mono text-[9px] uppercase tracking-[0.08em] text-[var(--nb-green)] underline-offset-2 hover:underline",
              "opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100",
              selected && "opacity-100",
            )}
          >
            What fed this
          </button>
        ) : null}
      </div>
    </div>
  );
}