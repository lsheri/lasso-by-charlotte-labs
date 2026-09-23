import { CircleDashed, Lock } from "lucide-react";

import { REFERENCE_INBOX_STATUS } from "@/lib/reference-file-shared";
import { CardMenu } from "@/components/work/CardMenu";
import { EngagementChip, TypeBadge, TypeIcon } from "@/components/work/TypeIcon";
import { ArtifactNote, SourceMark, VendorMark } from "@/components/work/SourceMark";
import { WorkNote } from "@/components/work/WorkNote";
import { UNREAD_MARKER_LINE, contentsUnread, textStatusReason } from "@/lib/text-status";
import { engagementHue, workIdentityLabel } from "@/lib/work-identity";
import { effectiveWorkDate, formatDate, type WorkItemRow } from "@/lib/work-types";
import type { WorkboardCardPreview, WorkboardDisplayMode, WorkboardFilePreview } from "@/lib/workboard-card-preview.shared";

export function WorkRow({
  item,
  actions,
  onOpen,
  chips,
  nested = false,
  dense = false,
  lead,
  footer,
  clientLabel,
  primaryAction,
  onFluency,
  displayMode = "sticky",
  chatPreview,
  filePreview,
}: {
  item: WorkItemRow;
  actions: React.ReactNode;
  clientLabel?: string | null | undefined;
  onOpen?: (() => void) | undefined;
  chips?: React.ReactNode;
  nested?: boolean;
  /**
   * Figma 22:220 draws a piece of work inside a type column as three lines and
   * nothing else: where it came from, what it is called, and where it sits.
   * Everything else lives behind one always-visible menu in the card's corner.
   *
   * Off by default, so every existing caller renders exactly as before.
   */
  dense?: boolean;
  lead?: React.ReactNode;
  footer?: React.ReactNode;
  /** Dense only: the one act that stays on the card face, e.g. claiming. */
  primaryAction?: React.ReactNode;
  /** Dense only: passed through to the card menu's shared item actions. */
  onFluency?: ((item: WorkItemRow) => void) | undefined;
  displayMode?: WorkboardDisplayMode;
  chatPreview?: WorkboardCardPreview | undefined;
  filePreview?: WorkboardFilePreview | undefined;
}) {

  const mapping = item.work_item_tasks[0]?.tasks ?? null;
  const link = item.meta?.web_view_link ?? null;
  const dateIso = effectiveWorkDate(item);
  const state = item.visibility;

  // State reads before you read a word: dashed and muted = needs mapping,
  // solid with an engagement-coloured spine = mapped, recessed = private.
  const shell =
    state === "mapped"
      ? "border-border bg-card shadow-card"
      : state === "private"
        ? "border-border/70"
        : "border-dashed";

  // Amber wash + dashed border for waiting work, indigo recess for private.
  const wash =
    state === "unmapped"
      ? {
          backgroundColor: "var(--state-amber-wash)",
          borderColor: "color-mix(in oklab, var(--state-amber) 45%, transparent)",
        }
      : state === "private"
        ? { backgroundColor: "var(--state-indigo-wash)" }
        : {};

  // The spine stays per engagement on purpose: inside one client's colour
  // family, the spine is how you still tell two engagements apart.
  const spine =
    state === "mapped"
      ? {
          borderLeftWidth: "3px",
          borderLeftStyle: "solid" as const,
          borderLeftColor: `var(${engagementHue(mapping?.engagement_id)})`,
        }
      : {};

  if (dense) {
    return (
      <div className="relative">
        <WorkNote
          item={item}
          onOpen={onOpen}
          lead={lead}
          clientLabel={clientLabel}
          dense
          displayMode={displayMode}
          chatPreview={chatPreview}
          filePreview={filePreview}
          chips={
            primaryAction ? (
              <span onClick={(event) => event.stopPropagation()}>{primaryAction}</span>
            ) : null
          }
          actions={
            actions || chips ? (
              <CardMenu item={item} clientLabel={clientLabel} onFluency={onFluency}>
                {chips}
                {actions}
              </CardMenu>
            ) : null
          }
        />

        {contentsUnread(item.meta as never) ? (
          <p className="mt-1 text-[11px] text-muted-foreground">{UNREAD_MARKER_LINE}</p>
        ) : null}
        {footer ? <div className="mt-2">{footer}</div> : null}
      </div>
    );
  }


  return (
    <div
      className={`rounded-[var(--radius)] border ${shell} ${
        onOpen ? "transition-colors hover:border-accent/40" : ""
      }`}
      style={{ ...wash, ...spine }}
    >
      <div
        {...(onOpen
          ? {
              role: "button" as const,
              tabIndex: 0,
              // Without an explicit name, the row's accessible name is built
              // from everything inside it, including the action labels, so the
              // row itself answers to "Map to a workstream". Naming it after the item
              // keeps each action addressable as itself.
              "aria-label": item.title,
              onClick: onOpen,
              onKeyDown: (event: React.KeyboardEvent) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onOpen();
                }
              },
            }
          : {})}
        className={`flex flex-wrap items-center gap-3 px-3 sm:gap-4 sm:px-4 ${
          nested ? "py-2.5" : "py-3"
        } ${onOpen ? "cursor-pointer" : ""}`}
      >
        {lead ? (
          <div className="shrink-0" onClick={(event) => event.stopPropagation()}>
            {lead}
          </div>
        ) : null}

        <TypeIcon item={item} size={nested ? "sm" : "md"} />

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            {state === "private" ? (
              <Lock
                className="h-3 w-3 shrink-0"
                style={{ color: "var(--state-indigo)" }}
                aria-label="Private"
              />
            ) : null}
            <SourceMark item={item} />
            <p
              title={item.title}
              className="line-clamp-2 min-w-0 break-words text-sm font-medium text-foreground"
            >
              {item.title} <ArtifactNote item={item} />
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <TypeBadge item={item} className="mt-1" size={nested ? "sm" : "md"} />
            {state === "private" ? (
              <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                <Lock className="h-2.5 w-2.5" aria-hidden />
                Private
              </span>
            ) : null}
            {item.content_fidelity === "summary" ? (
              <span className="mt-1 inline-block rounded-full border border-border bg-secondary px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                Summary
              </span>
            ) : null}
            {chips}
          </div>
          {item.content_fidelity === "reference" ? (
            <p data-testid="reference-inbox-status" className="mt-1 text-xs text-muted-foreground">
              {REFERENCE_INBOX_STATUS}
            </p>
          ) : null}
          {contentsUnread(item.meta as never) ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {UNREAD_MARKER_LINE}
              {textStatusReason(item.meta as never)
                ? `: ${textStatusReason(item.meta as never)}`
                : ""}
            </p>
          ) : null}
          <p className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 break-words font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
            <span>{workIdentityLabel(item)}</span>
            <span aria-hidden>·</span>
            <VendorMark item={item} />
            <span aria-hidden>·</span>
            <span>{formatDate(dateIso)}</span>
            {link ? (
              <>
                {" · "}
                <a
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(event) => event.stopPropagation()}
                  className="text-accent-deep hover:opacity-70"
                >
                  open ↗
                </a>
              </>
            ) : null}
          </p>
        </div>

        {mapping ? (
          <span className="hidden shrink-0 sm:inline">
            <EngagementChip
              engagementId={mapping.engagement_id}
              code={mapping.engagements?.code}
              taskName={mapping.name}
            />
          </span>
        ) : state === "unmapped" ? (
          <span
            className="hidden shrink-0 items-center gap-1 rounded-full border border-dashed px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.08em] sm:inline-flex"
            style={{
              color: "var(--state-amber)",
              borderColor: "color-mix(in oklab, var(--state-amber) 50%, transparent)",
            }}
          >
            <CircleDashed className="h-3 w-3" aria-hidden />
            Needs mapping
          </span>
        ) : null}

        <div
          className="order-last flex w-full flex-wrap items-center justify-start gap-x-4 gap-y-0 border-t border-border/60 pt-1 md:order-none md:w-auto md:max-w-[50%] md:shrink-0 md:justify-end md:gap-x-3 md:gap-y-1 md:border-0 md:pt-0"
          onClick={(event) => event.stopPropagation()}
        >
          {actions}
        </div>
      </div>

      {footer ? <div className="px-3 pb-3 sm:px-4">{footer}</div> : null}
    </div>
  );
}

export function RowAction({
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
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={
        primary
          ? "inline-flex min-h-11 items-center text-xs font-medium text-accent-deep transition-opacity hover:opacity-70 md:min-h-0"
          : "inline-flex min-h-11 items-center text-xs text-muted-foreground transition-colors hover:text-foreground md:min-h-0"
      }
    >
      {children}
    </button>
  );
}
