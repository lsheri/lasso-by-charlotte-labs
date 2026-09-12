import { CircleDashed, Lock } from "lucide-react";

import { EngagementChip, TypeBadge, TypeIcon } from "@/components/work/TypeIcon";
import { ArtifactNote, SourceMark, VendorMark } from "@/components/work/SourceMark";
import { stampDate } from "@/components/work/card-stamp";
import { notePaper, noteHue } from "@/components/work/note-paper";
import { useNoteLive } from "@/hooks/use-note-live";
import { UNREAD_MARKER_LINE, contentsUnread, textStatusReason } from "@/lib/text-status";
import { engagementHue, workIdentityLabel } from "@/lib/work-identity";
import { effectiveWorkDate, formatDate, type WorkItemRow } from "@/lib/work-types";

/**
 * The sheet a dense note is drawn on. Sandbox A · M5 "Paper physics".
 *
 * Split out because it owns a hook — the on-screen gate — and a hook cannot
 * live inside the `if (dense)` branch of a component that also returns a wide
 * layout. Keeping it separate means the wide row's hook list is untouched.
 */
function NotePaperCard({
  item,
  state,
  engagementId,
  onOpen,
  children,
}: {
  item: WorkItemRow;
  state: WorkItemRow["visibility"];
  engagementId: string | null;
  onOpen?: (() => void) | undefined;
  children: React.ReactNode;
}) {
  const live = useNoteLive<HTMLDivElement>();
  return (
    <div
      ref={live}
      className="nb-paper"
      data-paper-state={state}
      /*
        No corner fold here. The fold means "shipped to the firm", and a
        WorkItemRow only knows whether it is MAPPED, which is a different and
        weaker claim — claimed is not shipped. Line three already says
        "CHA-01 · CLAIMED" in words. A fold that overstates is worse than no
        fold on a product whose argument is that it never says more than it can
        prove, so the fold waits for a surface that reads shipped_work.
      */
      style={{ ...notePaper(item.id), ...noteHue(engagementId) }}
    >
      <div
        {...(onOpen
          ? {
              role: "button" as const,
              tabIndex: 0,
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
        className={`nb-paper-body group/row ${onOpen ? "cursor-pointer" : ""}`}
      >
        {children}
      </div>
    </div>
  );
}

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
   * Every action still exists — it waits for hover, for keyboard focus, or for
   * a touch screen, where there is no hover to wait for.
   *
   * Off by default, so every existing caller renders exactly as before.
   */
  dense?: boolean;
  lead?: React.ReactNode;
  footer?: React.ReactNode;
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

  const spine =
    state === "mapped"
      ? {
          borderLeftWidth: "3px",
          borderLeftStyle: "solid" as const,
          borderLeftColor: `var(${engagementHue(mapping?.engagement_id)})`,
        }
      : {};

  /**
   * "MH-042 · CLAIMED" in the frame. `claimed` is what mapping means from the
   * person's side, so a mapped piece says so under its engagement code. There
   * is no separate claim flag in the record and none is invented here.
   *
   * A claim has two degrees: a client is the coarse one, a workstream
   * placement the fine one, so line three says which degree this piece has.
   */
  const stateStamp =
    state === "mapped"
      ? [mapping?.engagements?.code, "claimed"].filter(Boolean).join(" · ")
      : state === "private"
        ? "private"
        : clientLabel
          ? `${clientLabel} · claimed`
          : "not claimed yet";

  if (dense) {
    return (
      <NotePaperCard
        item={item}
        state={state}
        engagementId={mapping?.engagement_id ?? null}
        onOpen={onOpen}
      >
        {/* Line one: where it came from, and the tool's own mark on the far
              edge. The logo is full colour because that is the one thing on
              this note whose colour is already true in the world — and
              SourceMark still withholds it from a coach in a vendor-neutral
              org, which is a rule this does not get to override. */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            {lead ? (
              <span className="shrink-0" onClick={(event) => event.stopPropagation()}>
                {lead}
              </span>
            ) : null}
            {state === "private" ? (
              <Lock
                className="h-2.5 w-2.5 shrink-0"
                style={{ color: "var(--state-indigo)" }}
                aria-label="Private"
              />
            ) : null}
            <SourceMark item={item} size={14} disc />
            <span className="min-w-0 truncate font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
              <VendorMark item={item} />
              {" · "}
              {stampDate(dateIso)}
            </span>
          </div>
          {/* The type glyph stays opposite, as frame 22:220 draws it. The two
                marks say different things: the logo is where this came from,
                the glyph is what kind of thing it is. */}
          <span className="shrink-0">
            <TypeIcon item={item} size="sm" />
          </span>
        </div>

        {/* Line two: the name, which is the only thing set in body text. */}
        <p
          title={item.title}
          className="mt-1 line-clamp-3 break-words text-[13px] leading-[18px] text-foreground"
        >
          {item.title} <ArtifactNote item={item} />
        </p>

        {/* Line three: where it sits. */}
        <p className="mt-1 truncate font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
          {stateStamp}
        </p>

        {contentsUnread(item.meta as never) ? (
          <p className="mt-1 text-[11px] text-muted-foreground">{UNREAD_MARKER_LINE}</p>
        ) : null}

        {/*
            Every control the wide row has, kept and reachable. Hidden at rest
            from `md` up, where a pointer can reveal it; always shown below `md`,
            where there is no hover. `group-focus-within` keeps it on the keyboard
            path, so tabbing into an action reveals the set it belongs to.
          */}
        <div
          className="absolute bottom-0 left-0 right-0 flex flex-wrap items-center gap-x-3 gap-y-1 bg-[color-mix(in_oklab,var(--nb-paper-fill,var(--nb-white))_88%,transparent)] p-2 backdrop-blur-sm md:hidden md:group-focus-within/row:flex md:group-hover/row:flex"
          onClick={(event) => event.stopPropagation()}
        >
          {chips}
          {actions}
        </div>
        {footer ? <div className="mt-2">{footer}</div> : null}
      </NotePaperCard>
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
