import {
  FileText,
  ImageIcon,
  Mail,
  MessageSquare,
  MessagesSquare,
  Phone,
  Presentation,
  Table2,
} from "lucide-react";

import { formatDate, sourceLabel, type WorkItemRow, type WorkType } from "@/lib/work-types";

const ICONS: Record<WorkType, typeof FileText> = {
  ai_thread: MessagesSquare,
  document: FileText,
  deck: Presentation,
  sheet: Table2,
  call: Phone,
  email: Mail,
  message: MessageSquare,
  image: ImageIcon,
};

export function WorkRow({
  item,
  actions,
  onOpen,
}: {
  item: WorkItemRow;
  actions: React.ReactNode;
  onOpen?: (() => void) | undefined;
}) {
  const Icon = ICONS[item.type];
  const mapping = item.work_item_tasks[0]?.tasks ?? null;
  const link = item.meta?.web_view_link ?? null;
  const dateIso = item.created_at_source ?? item.captured_at;

  return (
    <div className="flex items-center gap-4 rounded-[var(--radius)] border border-border bg-card px-4 py-3 shadow-card">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0 flex-1">
        {onOpen ? (
          <button
            type="button"
            onClick={onOpen}
            className="block max-w-full truncate text-left text-sm font-medium text-foreground hover:text-accent-deep"
          >
            {item.title}
          </button>
        ) : (
          <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
        )}
        {item.content_fidelity === "summary" ? (
          <span className="mt-1 inline-block rounded-full border border-border bg-secondary px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
            Summary
          </span>
        ) : null}
        <p className="mt-0.5 truncate font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
          {item.type.replace("_", " ")} · {sourceLabel(item.source)} · {formatDate(dateIso)}
          {link ? (
            <>
              {" · "}
              <a
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent-deep hover:opacity-70"
              >
                open ↗
              </a>
            </>
          ) : null}
        </p>
      </div>

      {mapping ? (
        <span className="hidden shrink-0 rounded-full bg-accent-soft px-3 py-1 font-mono text-[11px] tracking-[0.06em] text-accent-deep sm:inline">
          {mapping.engagements?.code ?? "—"} · {mapping.name}
        </span>
      ) : null}

      <div className="flex shrink-0 items-center gap-3">{actions}</div>
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
