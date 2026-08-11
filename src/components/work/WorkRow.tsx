import { CircleDashed, Lock } from "lucide-react";

import { EngagementChip, TypeIcon, VendorChip } from "@/components/work/TypeIcon";
import { engagementHue, workIdentityLabel } from "@/lib/work-identity";
import { effectiveWorkDate, formatDate, sourceLabel, type WorkItemRow } from "@/lib/work-types";

export function WorkRow({
  item,
  actions,
  onOpen,
  chips,
  nested = false,
  lead,
  footer,
}: {
  item: WorkItemRow;
  actions: React.ReactNode;
  onOpen?: (() => void) | undefined;
  chips?: React.ReactNode;
  nested?: boolean;
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
              onClick: onOpen,
              onKeyDown: (event: React.KeyboardEvent) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onOpen();
                }
              },
            }
          : {})}
        className={`flex items-center gap-3 px-3 sm:gap-4 sm:px-4 ${
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
            <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {item.content_fidelity === "summary" ? (
              <span className="mt-1 inline-block rounded-full border border-border bg-secondary px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                Summary
              </span>
            ) : null}
            {chips}
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 truncate font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
            <span>{workIdentityLabel(item)}</span>
            <span aria-hidden>·</span>
            <VendorChip
              vendor={item.source_vendor ?? sourceLabel(item.source)}
              label={sourceLabel(item.source)}
            />
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
          className="flex max-w-[50%] shrink-0 flex-wrap items-center justify-end gap-x-3 gap-y-1"
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
