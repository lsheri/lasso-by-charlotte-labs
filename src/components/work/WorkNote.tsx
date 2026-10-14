import { displayName } from "@/lib/work-item-name";
import { ExternalLink, FileText, Lock } from "lucide-react";

import { WorkboardFilePreview as FilePreview } from "@/components/canvas-lab/WorkboardFilePreview";
import { BrandLogo, brandHex, brandLabel } from "@/components/connectors/BrandLogo";
import { ChatUrlLink } from "@/components/work/ChatUrlLink";
import { Button } from "@/components/ui/button";
import { engagementDisplayTitle } from "@/lib/clients";
import { workIdentityLabel } from "@/lib/work-identity";
import { pastedChatUrl } from "@/lib/chat-url";
import { sourceBrandKey } from "@/components/work/SourceMark";
import type { WorkboardCardPreview, WorkboardDisplayMode, WorkboardFilePreview } from "@/lib/workboard-card-preview.shared";
import { resolveWorkDate } from "@/lib/work-order";
import { formatDate, type WorkItemRow } from "@/lib/work-types";

/** The shared Ledger preview card used anywhere one piece of work is shown. */
export function WorkNote({
  item,
  onOpen,
  lead,
  actions,
  chips,
  clientLabel,
  dense: _dense = false,
  className = "",
  displayMode: _displayMode = "preview",
  chatPreview,
  filePreview,
  contextSelected = false,
  headerGutter = false,
  phoneRow = false,
  openOn = "click",
}: {
  /** BI-1b: the board opens on double-click; every other caller keeps single click. */
  openOn?: "click" | "doubleClick";
  item: Omit<WorkItemRow, "work_item_tasks"> & { work_item_tasks?: WorkItemRow["work_item_tasks"] };
  onOpen?: (() => void) | undefined;
  lead?: React.ReactNode;
  actions?: React.ReactNode;
  chips?: React.ReactNode;
  clientLabel?: string | null | undefined;
  dense?: boolean;
  className?: string;
  displayMode?: WorkboardDisplayMode;
  chatPreview?: WorkboardCardPreview | undefined;
  filePreview?: WorkboardFilePreview | undefined;
  contextSelected?: boolean;
  /** Reserves the lane the board's control bar occupies, so a control never covers the date. */
  headerGutter?: boolean;
  /** Opt-in phone list presentation, used only by All work below 768px. */
  phoneRow?: boolean;
}) {
  const mapping = item.work_item_tasks?.[0]?.tasks ?? null;
  const boardTitle = mapping?.engagements ? engagementDisplayTitle(mapping.engagements) : null;
  const when = resolveWorkDate(item);
  const date = when.byArrival ? `added ${formatDate(when.iso)}` : formatDate(when.iso);
  const brand = sourceBrandKey(item);
  const summary = item.work_item_extracts?.find((extract) => extract.summary)?.summary
    ?? chatPreview?.summary
    ?? chatPreview?.firstUserTurn?.content
    ?? chatPreview?.turns.find((turn) => turn.role.trim().toLowerCase() === "user")?.content
    ?? "Open it to see what landed.";
  const isFile = item.type === "document" || item.type === "deck" || item.type === "sheet";
  const sourceLabel = brand === "unknown" && isFile ? "Document" : brandLabel(brand);
  const hasFilePreview = Boolean(filePreview && filePreview.kind !== "fallback");
  const detail = item.type === "deck" && filePreview?.pages?.length
    ? `${filePreview.pages.length} ${filePreview.pages.length === 1 ? "slide" : "slides"}`
    : item.type === "sheet"
      ? "Spreadsheet"
      : filePreview?.kind === "pdf"
        ? "PDF document"
        : item.type === "document"
          ? "Document"
          : "";
  const sourceUrl = item.meta?.web_view_link ?? item.source_meta?.url ?? null;

  if (phoneRow) {
    return (
      <Button type="button" variant="ghost" onClick={onOpen} aria-label={displayName(item)} data-paper-state={item.visibility} className="work-phone-row work-state-card">
        <span className="shrink-0" aria-hidden="true"><BrandLogo brand={brand} size={20} /></span>
        <span className="min-w-0 flex-1 text-left">
          <span className="work-phone-row__title">{displayName(item)}</span>
          <span className="work-phone-row__stamp">
            {date} · {workIdentityLabel(item as WorkItemRow)} · {boardTitle ?? "NO BOARD"}
          </span>
          {item.visibility === "unmapped" ? <span className="work-no-board-label"><Lock className="h-3 w-3 shrink-0" aria-hidden />No board</span> : null}
        </span>
      </Button>
    );
  }

  return (
    <div
      className={`nb-paper ledger-work-note ${className}`}
      data-paper-state={item.visibility}
      data-client-label={clientLabel ?? undefined}
      data-brand={brand}
      style={item.visibility === "unmapped" ? undefined : { borderLeftColor: brandHex(brand) }}
    >
      <div
        {...(onOpen && openOn === "doubleClick"
          ? { onDoubleClick: onOpen }
          : onOpen
          ? {
              role: "button" as const,
              tabIndex: 0,
              "aria-label": displayName(item),
              onClick: onOpen,
              onKeyDown: (event: React.KeyboardEvent) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onOpen();
                }
              },
            }
          : {})}
        className={`nb-paper-body flex h-full min-h-0 flex-col ${onOpen && openOn === "click" ? "cursor-pointer" : ""}`}
      >
        <div className={`flex h-[18px] shrink-0 select-none items-center gap-2 ${headerGutter ? "pr-[58px]" : ""} ${contextSelected ? "canvas-lab-context-header" : ""}`}>
          {lead ? <span className="shrink-0">{lead}</span> : null}
          <BrandLogo brand={brand} size={16} />
          <span className="min-w-0 flex-1 truncate font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">{sourceLabel}</span>
          <span className="shrink-0 font-mono text-[8.5px] uppercase tracking-[0.08em] text-soft">{date}</span>
          {actions ? <span className="shrink-0 select-none" onClick={(event) => event.stopPropagation()}>{actions}</span> : null}
        </div>

        <p className={`mt-1 shrink-0 select-text truncate text-[12px] font-medium leading-[15px] text-foreground ${contextSelected ? "canvas-lab-context-title" : ""}`}>{displayName(item)}</p>

        {isFile ? (
          <div className="ledger-work-note__file mt-1 flex min-h-0 flex-1 items-center gap-2">
            <div className="ledger-work-note__thumbnail h-[42px] w-[74px] shrink-0 overflow-hidden border border-hairline bg-secondary">
              {hasFilePreview && filePreview ? <FilePreview preview={filePreview} title={displayName(item)} onFailure={() => {}} /> : <FileText className="m-auto h-full w-5 text-muted-foreground" aria-label="Document" />}
            </div>
            <div className="min-w-0 select-text">
              <p className="truncate text-[10.5px] leading-[15px] text-muted-foreground">{displayName(item)}</p>
              <p className="truncate font-mono text-[8.5px] uppercase tracking-[0.08em] text-soft">{detail}</p>
            </div>
          </div>
        ) : (
          <p data-summary-source={item.work_item_extracts?.some((extract) => extract.summary) || chatPreview?.summary ? "stored" : chatPreview?.firstUserTurn || chatPreview?.turns.some((turn) => turn.role.trim().toLowerCase() === "user") ? "first-turn" : "absent"} className="my-auto line-clamp-3 min-h-0 select-text text-[10.5px] leading-[1.45] text-muted-foreground">{summary}</p>
        )}

        <div className="mt-1 flex h-[16px] shrink-0 select-none items-center gap-2 border-t border-hairline pt-1">
          <span className="min-w-0 flex-1 truncate text-[9px] text-muted-foreground" onClick={(event) => event.stopPropagation()}>
            {item.type === "ai_thread" || pastedChatUrl((item as WorkItemRow).meta?.chat_url) ? (
              <ChatUrlLink item={item as WorkItemRow} showAbsence turnCount={chatPreview?.turnCount} toolSteps={chatPreview?.toolSteps} />
            ) : sourceUrl ? (
              <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1">
                <ExternalLink className="h-2.5 w-2.5 shrink-0" aria-hidden />
                <span className="truncate">{sourceUrl}</span>
              </a>
            ) : (
              <ChatUrlLink item={item as WorkItemRow} showAbsence turnCount={chatPreview?.turnCount} toolSteps={chatPreview?.toolSteps} />
            )}
          </span>
          {boardTitle ? <span className="min-w-0 truncate rounded-[3px] border border-hairline px-1 font-mono text-[8.5px] uppercase tracking-[0.08em] text-muted-foreground">{boardTitle}</span> : null}
          {chips ? <span className="sr-only">{chips}</span> : null}
        </div>
        {item.visibility === "unmapped" ? <span className="work-no-board-label"><Lock className="h-3 w-3 shrink-0" aria-hidden />No board</span> : null}
      </div>
    </div>
  );
}