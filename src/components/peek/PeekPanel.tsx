import { useServerFn } from "@tanstack/react-start";
import { ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AiReads } from "@/components/peek/AiReads";
import { RenderedContent } from "@/components/peek/RenderedContent";
import { SlideOver } from "@/components/peek/SlideOver";
import { ThreadBody } from "@/components/peek/ThreadBody";
import { VersionHistory } from "@/components/peek/VersionHistory";
import { WhatFedThis } from "@/components/peek/WhatFedThis";
import { DraftDecisionsButton } from "@/components/decisions/DraftDecisionsButton";
import { MarkBriefDialog } from "@/components/work/MarkBriefDialog";
import { DeleteWorkItemDialog, DELETE_LABEL } from "@/components/work/DeleteWorkItemDialog";
import {
  RemoveFromEngagementDialog,
  REMOVE_LABEL,
} from "@/components/work/RemoveFromEngagementDialog";
import { DeliverableKindSelect } from "@/components/work/DeliverableKindSelect";
import { ShipToFirmDialog } from "@/components/work/ShipToFirmDialog";
import { ChatUrlLink } from "@/components/work/ChatUrlLink";
import { ArtifactNote, SourceMark } from "@/components/work/SourceMark";
import { TypeChip, TypeIcon } from "@/components/work/TypeIcon";
import { setDeliverableKind, useInvalidateWorkItems } from "@/hooks/use-deliverable-kind";
import { usePerfOpenFinish } from "@/hooks/use-perf-timer";
import { isBriefItem } from "@/lib/brief-shared";
import { vendorLabel } from "@/lib/conversation-shared";
import { deliverableKindOf, type DeliverableKind } from "@/lib/deliverable-kinds";
import { isDeliverableType } from "@/lib/lineage-shared";
import { openJourney } from "@/lib/journey-state";
import { peekFormat } from "@/lib/peek-format";
import { SHIP_ACTION_LABEL } from "@/lib/shipped-work-shared";
import { getWorkFileUrl } from "@/lib/work-files.functions";
import {
  effectiveWorkDate,
  formatDate,
  isConversationGroup,
  sourceLabel,
  type ConversationGroup,
  type WorkItemRow,
} from "@/lib/work-types";

export type PeekEntry = WorkItemRow | ConversationGroup;

function entryItems(entry: PeekEntry): WorkItemRow[] {
  if (!isConversationGroup(entry)) return [entry];
  const head = entry.transcript ?? entry.items[0]!;
  return [head, ...entry.items.filter((i) => i !== head)];
}

function Chip({
  children,
  tone = "quiet",
}: {
  children: React.ReactNode;
  tone?: "quiet" | "accent";
}) {
  return (
    <span
      className={
        tone === "accent"
          ? "inline-block rounded-full bg-accent-soft px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-foreground"
          : "inline-block rounded-full border border-border bg-secondary px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground"
      }
    >
      {children}
    </span>
  );
}

function FooterAction({
  onClick,
  children,
  primary = false,
}: {
  onClick: () => void;
  children: React.ReactNode;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        primary
          ? "text-xs font-medium text-accent-deep transition-opacity hover:opacity-70"
          : "text-xs text-muted-foreground transition-colors hover:text-foreground"
      }
    >
      {children}
    </button>
  );
}

export function PeekPanel({
  entry,
  focusId,
  open,
  onOpenChange,
  canEdit,
  onMap,
  onWorkDate,
  onMakePrivate,
  onFluency,
  engagementId,
  viewerProfileId,
}: {
  entry: PeekEntry | null;
  focusId?: string | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEdit: boolean;
  onMap?: ((item: WorkItemRow, group?: WorkItemRow[]) => void) | undefined;
  onWorkDate?: ((item: WorkItemRow) => void) | undefined;
  onMakePrivate?: ((item: WorkItemRow) => void) | undefined;
  onFluency?: ((item: WorkItemRow) => void) | undefined;
  /** Set when the peek is read inside one engagement. */
  engagementId?: string | undefined;
  viewerProfileId?: string | null | undefined;
}) {
  const fetchUrl = useServerFn(getWorkFileUrl);
  const items = entry ? entryItems(entry) : [];
  const [tab, setTab] = useState(0);
  const [briefOpen, setBriefOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [shipOpen, setShipOpen] = useState(false);
  const invalidateWork = useInvalidateWorkItems();
  const [kindDraft, setKindDraft] = useState<DeliverableKind | null>(null);
  // Gesture anchored: the panel mounts closed, so its own mount is not the
  // start of anything. The click that opens the peek records the start; a
  // finish with no recorded start emits nothing, which is the honest answer.
  usePerfOpenFinish("peek.open", open && Boolean(entry));

  useEffect(() => {
    setKindDraft(null);
  }, [entry, focusId]);

  useEffect(() => {
    if (!entry) return;
    const index = focusId ? entryItems(entry).findIndex((i) => i.id === focusId) : 0;
    setTab(index < 0 ? 0 : index);
  }, [entry, focusId]);

  const active = items[Math.min(tab, Math.max(items.length - 1, 0))] ?? null;
  const group = entry && isConversationGroup(entry) ? entry.items : undefined;

  async function download(item: WorkItemRow) {
    try {
      const { url } = await fetchUrl({ data: { work_item_id: item.id } });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  if (!active) {
    return (
      <SlideOver open={open} onOpenChange={onOpenChange} title="Preview">
        {null}
      </SlideOver>
    );
  }

  const format = peekFormat(active);
  const vendor = active.source_vendor ?? active.source_meta?.vendor ?? null;
  const link = active.meta?.web_view_link ?? null;
  // Ownership truth: removing and deleting belong to the person whose work it
  // is, never to a coach or another member reading it.
  const owned = canEdit && Boolean(viewerProfileId) && active.owner_id === viewerProfileId;

  return (
    <SlideOver
      open={open}
      onOpenChange={onOpenChange}
      title={active.title}
      description="Work item preview"
    >
      <header className="shrink-0 border-b border-border px-4 pb-4 pt-[calc(1.5rem+env(safe-area-inset-top))] sm:px-6">
        <div className="flex flex-wrap items-center gap-1.5 pr-12">
          <TypeChip item={active} />
          {vendor ? <Chip tone="accent">{vendorLabel(vendor)}</Chip> : null}
          {active.content_fidelity === "summary" ? <Chip>Summary</Chip> : null}
        </div>
        <div className="mt-2 flex items-start gap-2.5">
          <TypeIcon item={active} />
          <h2 className="page-title flex min-w-0 flex-wrap items-center gap-1.5 break-words text-[19px] leading-snug">
            <SourceMark item={active} size={15} />
            <span className="min-w-0 break-words">{active.title}</span>
            <ArtifactNote item={active} />
          </h2>
        </div>
        {isBriefItem(active) ? (
          <p className="mt-2">
            <Chip tone="accent">The brief</Chip>
          </p>
        ) : null}
        <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
          {sourceLabel(active.source)} · {formatDate(effectiveWorkDate(active))}
        </p>
        <p className="mt-1">
          <ChatUrlLink item={active} />
        </p>

        {canEdit && isDeliverableType(active.type) ? (
          <div className="mt-3">
            <DeliverableKindSelect
              id={`peek-kind-${active.id}`}
              label="Kind of deliverable"
              value={kindDraft ?? deliverableKindOf(active.meta)}
              onChange={(next) => {
                setKindDraft(next);
                void setDeliverableKind(active.id, next)
                  .then(() => invalidateWork())
                  .catch((error: unknown) => toast.error((error as Error).message));
              }}
            />
          </div>
        ) : null}

        {items.length > 1 ? (
          <div className="-mb-4 mt-3 flex gap-1 overflow-x-auto">
            {items.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(index)}
                className={
                  index === tab
                    ? "flex max-w-[180px] shrink-0 items-center gap-1.5 border-b-2 border-accent-deep px-2 pb-2 text-xs font-medium text-foreground"
                    : "flex max-w-[180px] shrink-0 items-center gap-1.5 border-b-2 border-transparent px-2 pb-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
                }
              >
                <TypeIcon item={item} size="sm" />
                <SourceMark item={item} size={12} />
                <span className="truncate">
                  {item.type === "ai_thread" ? "Transcript" : item.title}
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        {format.kind === "thread" ? (
          <ThreadBody item={active} enabled={open} />
        ) : (
          <RenderedContent
            item={active}
            format={format}
            canEdit={canEdit}
            onDownload={() => void download(active)}
          />
        )}
        {canEdit ? <AiReads workItemId={active.id} /> : null}
        {isDeliverableType(active.type) ? (
          <>
            <VersionHistory workItemId={active.id} />
            <WhatFedThis workItemId={active.id} itemType={active.type} canEdit={canEdit} />
          </>
        ) : null}
      </div>

      <footer className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-t border-border bg-card px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 sm:px-6 sm:pt-4">
        {engagementId && isDeliverableType(active.type) ? (
          <FooterAction
            onClick={() =>
              openJourney({
                anchorId: active.id,
                anchorTitle: active.title,
                engagementId,
              })
            }
          >
            Work Artifact
          </FooterAction>
        ) : null}
        {owned && isDeliverableType(active.type) ? (
          <FooterAction onClick={() => setShipOpen(true)}>{SHIP_ACTION_LABEL}</FooterAction>
        ) : null}
        {canEdit && onMap ? (
          <FooterAction primary onClick={() => onMap(active, group)}>
            {active.visibility === "mapped" ? "Remap" : "Map to a workstream"}
          </FooterAction>
        ) : null}
        {canEdit && onWorkDate ? (
          <FooterAction onClick={() => onWorkDate(active)}>Work date</FooterAction>
        ) : null}
        {canEdit && onMakePrivate && active.visibility !== "private" ? (
          <FooterAction onClick={() => onMakePrivate(active)}>Make private</FooterAction>
        ) : null}
        {canEdit ? (
          <FooterAction onClick={() => setBriefOpen(true)}>
            {isBriefItem(active) ? "Change what this briefs" : "Mark as the brief"}
          </FooterAction>
        ) : null}
        {canEdit && ["ai_thread", "document", "deck", "sheet"].includes(active.type) ? (
          <DraftDecisionsButton workItemId={active.id} />
        ) : null}
        {canEdit &&
        ["ai_thread", "document", "deck", "sheet"].includes(active.type) &&
        onFluency ? (
          <FooterAction onClick={() => onFluency(active)}>
            {active.type === "ai_thread" ? "Analyse this conversation" : "Analyse this work"}
          </FooterAction>
        ) : null}
        {owned && engagementId ? (
          <FooterAction onClick={() => setRemoveOpen(true)}>{REMOVE_LABEL}</FooterAction>
        ) : null}
        {owned ? (
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="text-xs text-destructive transition-opacity hover:opacity-70"
          >
            {DELETE_LABEL}
          </button>
        ) : null}
        <div className="ml-auto">
          {link ? (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-accent-deep transition-opacity hover:opacity-70"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden /> Open original
            </a>
          ) : active.content_ref ? (
            <FooterAction primary onClick={() => void download(active)}>
              Open original
            </FooterAction>
          ) : null}
        </div>
      </footer>
      <MarkBriefDialog item={active} open={briefOpen} onOpenChange={setBriefOpen} />
      {owned && isDeliverableType(active.type) ? (
        <ShipToFirmDialog
          workItemId={active.id}
          title={active.title}
          engagementId={engagementId ?? null}
          open={shipOpen}
          onOpenChange={setShipOpen}
        />
      ) : null}
      {owned && engagementId ? (
        <RemoveFromEngagementDialog
          workItemId={active.id}
          title={active.title}
          engagementId={engagementId}
          open={removeOpen}
          onOpenChange={setRemoveOpen}
          onDone={() => onOpenChange(false)}
        />
      ) : null}
      {owned ? (
        <DeleteWorkItemDialog
          workItemId={active.id}
          title={active.title}
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          onDone={() => onOpenChange(false)}
        />
      ) : null}
    </SlideOver>
  );
}
