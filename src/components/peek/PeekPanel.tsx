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
import { TypeChip, TypeIcon } from "@/components/work/TypeIcon";
import { vendorLabel } from "@/lib/conversation-shared";
import { isDeliverableType } from "@/lib/lineage-shared";
import { peekFormat } from "@/lib/peek-format";
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
          ? "inline-block rounded-full bg-accent-soft px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-accent-deep"
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
}) {
  const fetchUrl = useServerFn(getWorkFileUrl);
  const items = entry ? entryItems(entry) : [];
  const [tab, setTab] = useState(0);

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

  return (
    <SlideOver
      open={open}
      onOpenChange={onOpenChange}
      title={active.title}
      description="Work item preview"
    >
      <header className="shrink-0 border-b border-border px-6 pb-4 pt-6">
        <div className="flex flex-wrap items-center gap-1.5 pr-8">
          <TypeChip item={active} />
          {vendor ? <Chip tone="accent">{vendorLabel(vendor)}</Chip> : null}
          {active.content_fidelity === "summary" ? <Chip>Summary</Chip> : null}
        </div>
        <div className="mt-2 flex items-start gap-2.5">
          <TypeIcon item={active} />
          <h2 className="page-title min-w-0 break-words text-[19px] leading-snug">
            {active.title}
          </h2>
        </div>
        <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
          {sourceLabel(active.source)} · {formatDate(effectiveWorkDate(active))}
        </p>

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
                <span className="truncate">
                  {item.type === "ai_thread" ? "Transcript" : item.title}
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        {format.kind === "thread" ? (
          <ThreadBody item={active} enabled={open} />
        ) : (
          <RenderedContent item={active} format={format} onDownload={() => void download(active)} />
        )}
        {canEdit ? <AiReads workItemId={active.id} /> : null}
        {isDeliverableType(active.type) ? (
          <>
            <VersionHistory workItemId={active.id} />
            <WhatFedThis workItemId={active.id} canEdit={canEdit} />
          </>
        ) : null}
      </div>

      <footer className="flex shrink-0 flex-wrap items-center gap-4 border-t border-border bg-card px-6 py-4">
        {canEdit && onMap ? (
          <FooterAction primary onClick={() => onMap(active, group)}>
            {active.visibility === "mapped" ? "Remap" : "Map to a task"}
          </FooterAction>
        ) : null}
        {canEdit && onWorkDate ? (
          <FooterAction onClick={() => onWorkDate(active)}>Work date</FooterAction>
        ) : null}
        {canEdit && onMakePrivate && active.visibility !== "private" ? (
          <FooterAction onClick={() => onMakePrivate(active)}>Make private</FooterAction>
        ) : null}
        {canEdit && active.type === "ai_thread" ? (
          <DraftDecisionsButton workItemId={active.id} />
        ) : null}
        {canEdit && active.type === "ai_thread" && onFluency ? (
          <FooterAction onClick={() => onFluency(active)}>Analyse this conversation</FooterAction>
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
    </SlideOver>
  );
}
