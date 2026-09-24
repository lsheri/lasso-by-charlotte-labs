import { useState } from "react";
import { CircleDashed, Lock } from "lucide-react";

import { CardMenu } from "@/components/work/CardMenu";
import { WorkNote } from "@/components/work/WorkNote";
import { WorkCardPreview } from "@/components/work/WorkCardPreview";
import { SourceMark, VendorMark } from "@/components/work/SourceMark";
import { StandAloneAction } from "@/components/work/StandAloneAction";
import { TypeIcon } from "@/components/work/TypeIcon";
import { stampDate } from "@/components/work/card-stamp";
import { attachmentKindLabel, vendorLabel } from "@/lib/conversation-shared";
import { engagementHue, workIdentityLabel } from "@/lib/work-identity";
import { resolveWorkDate } from "@/lib/work-order";
import { formatDate, type ConversationGroup, type WorkItemRow } from "@/lib/work-types";
import type { WorkboardCardPreview, WorkboardDisplayMode } from "@/lib/workboard-card-preview.shared";

/** Pieces beyond this fold away behind a single line, so the card stays a card. */
const PREVIEW = 4;

/**
 * One MCP push reads as one sheet: the transcript on top, and every artifact
 * that came with it listed inside the same card rather than as its own stack of
 * paper. Everything needed to judge the push is legible without opening it.
 */
export function ConversationCard({
  group,
  variant,
  onOpen,
  actions,
  footerFor,
  dense = false,
  primaryAction,
  onFluency,
  displayMode = "sticky",
  preview,
}: {
  group: ConversationGroup;
  variant: "mapped" | "unmapped" | "private";
  onOpen: (item: WorkItemRow) => void;
  actions: React.ReactNode;
  footerFor?: (item: WorkItemRow) => React.ReactNode;
  /**
   * Figma 22:220 draws a conversation in the AI column as the same three lines
   * every other card gets. The pieces inside it and the actions on it are still
   * there — they wait for hover, for keyboard focus, or for a touch screen.
   *
   * Off by default, so every existing caller renders exactly as before.
   */
  dense?: boolean;
  /** Dense only: the one act that stays on the card face, e.g. claiming. */
  primaryAction?: React.ReactNode;
  /** Dense only: passed through to the card menu's shared item actions. */
  onFluency?: ((item: WorkItemRow) => void) | undefined;
  displayMode?: WorkboardDisplayMode;
  preview?: WorkboardCardPreview | undefined;
}) {
  const head = group.transcript ?? group.items[0]!;
  const pieces = group.transcript ? group.attachments : group.items.slice(1);
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? pieces : pieces.slice(0, PREVIEW);
  const hidden = pieces.length - shown.length;

  const vendor = head.source_vendor ?? head.source_meta?.vendor ?? null;
  const mapping = head.work_item_tasks[0]?.tasks ?? null;
  const state = head.visibility;

  const shell =
    state === "mapped"
      ? "border-border bg-card shadow-card"
      : state === "private"
        ? "border-border/70"
        : "border-dashed";
  const wash =
    state === "unmapped"
      ? {
          backgroundColor: "var(--state-amber-wash)",
          borderColor: "color-mix(in oklab, var(--state-amber) 45%, transparent)",
        }
      : state === "private"
        ? { backgroundColor: "var(--state-indigo-wash)" }
        : {};
  const spine =
    state === "mapped"
      ? {
          borderLeftWidth: "3px",
          borderLeftStyle: "solid" as const,
          borderLeftColor: `var(${engagementHue(mapping?.engagement_id)})`,
        }
      : {};

  /**
   * "MH-042 · CLAIMED · 3 PIECES" in the frame's shape.
   *
   * Deliberate deviation: Figma stamps a turn count ("19 TURNS"). Nothing in the
   * record counts turns, so the piece count — which is true — takes its place
   * rather than a number nobody can stand behind.
   */
  const stateStamp = [
    variant === "mapped"
      ? [mapping?.engagements?.code, "claimed"].filter(Boolean).join(" · ")
      : variant === "private"
        ? "private"
        : "unmapped",
    `${group.items.length} piece${group.items.length === 1 ? "" : "s"}`,
  ].join(" · ");

  if (dense) {
    return (
      <WorkNote
        item={head}
        onOpen={() => onOpen(head)}
        displayMode="preview"
        chatPreview={preview}
        actions={(
          <CardMenu item={head} onFluency={onFluency}>
            {primaryAction}
            {actions}
            <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-soft">{stateStamp}</span>
            {pieces.map((piece) => <span key={piece.id}>{footerFor?.(piece)}</span>)}
          </CardMenu>
        )}
      />
    );
  }

  return (
    <div
      className={`nb-card-surface rounded-[var(--radius)] ${displayMode === "preview" ? "nb-preview-card" : ""} ${shell} transition-colors`}
      style={{ ...wash, ...spine }}
    >
      <div className="px-3 pt-3 sm:px-4">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <SourceMark item={head} />
            {vendor ? vendorLabel(vendor) : "Conversation"}
          </span>
          <span aria-hidden>·</span>
          <span>
            {group.items.length} piece{group.items.length === 1 ? "" : "s"}
          </span>
          {state === "unmapped" ? (
            <span
              className="ml-auto inline-flex items-center gap-1 rounded-full border border-dashed px-2 py-0.5 font-medium"
              style={{
                color: "var(--state-amber)",
                borderColor: "color-mix(in oklab, var(--state-amber) 50%, transparent)",
              }}
            >
              <CircleDashed className="h-3 w-3" aria-hidden />
              Needs mapping
            </span>
          ) : null}
          {state === "private" ? (
            <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2 py-0.5">
              <Lock className="h-2.5 w-2.5" aria-hidden />
              Private
            </span>
          ) : null}
        </p>

        <button
          type="button"
          onClick={() => onOpen(head)}
          className="mt-1.5 block w-full text-left"
        >
          <span className="line-clamp-2 break-words text-sm font-semibold text-foreground">
            {head.title}
          </span>
        </button>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
          <span>{workIdentityLabel(head)}</span>
          <span aria-hidden>·</span>
          <VendorMark item={head} />
          <span aria-hidden>·</span>
          <span>
            {resolveWorkDate(head).byArrival
              ? `added ${formatDate(resolveWorkDate(head).iso)}`
              : formatDate(resolveWorkDate(head).iso)}
          </span>
        </p>
      </div>

      {pieces.length > 0 ? (
        <ul className="mt-2.5 divide-y divide-border/60 border-y border-border/60">
          {shown.map((piece) => (
            <li key={piece.id}>
              <button
                type="button"
                onClick={() => onOpen(piece)}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-secondary/60 sm:px-4"
              >
                <TypeIcon item={piece} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-1 break-all text-[13px] text-foreground">
                    {piece.title}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                    {attachmentKindLabel(piece.source_meta?.kind)}
                  </span>
                </span>
                <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.08em] text-accent-deep">
                  Open
                </span>
              </button>
              {/* W2: sometimes one of these artifacts is the work. */}
              <div className="flex justify-end px-3 pb-2 sm:px-4">
                <StandAloneAction item={piece} />
              </div>
              {footerFor?.(piece) ? (
                <div className="px-3 pb-2 sm:px-4">{footerFor(piece)}</div>
              ) : null}
            </li>
          ))}
          {hidden > 0 ? (
            <li>
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className="w-full px-3 py-2 text-left font-mono text-[10px] uppercase tracking-[0.08em] text-accent-deep transition-opacity hover:opacity-70 sm:px-4"
              >
                Show {hidden} more piece{hidden === 1 ? "" : "s"}
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 sm:px-4">{actions}</div>
    </div>
  );
}
