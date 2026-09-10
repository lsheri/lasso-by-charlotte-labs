import { VendorMark } from "@/components/work/SourceMark";
import type { WorkItemRow } from "@/lib/work-types";

/**
 * Figma 27:635, a row in the chat library.
 *
 * Three parts and no card: the conversation's name in body text, one mono line
 * saying where it came from and what it fed, and the time on the far right.
 * The frame draws these as a list with hairlines between, not as a stack of
 * bordered tiles, which is what makes a hundred and forty of them readable.
 *
 * The row's actions are kept and reachable: hidden at rest from `md` up where a
 * pointer can reveal them, always shown below `md` where there is no hover, and
 * on the keyboard path via `group-focus-within`.
 */
export function ChatRow({
  item,
  turns,
  fed,
  when,
  onOpen,
  actions,
}: {
  item: WorkItemRow;
  turns: number;
  /** Titles this conversation was confirmed to have fed. */
  fed: string[];
  /** The frame's right-hand stamp: "2H AGO" near in time, "5 SEP" further out. */
  when: string;
  onOpen: () => void;
  actions?: React.ReactNode;
}) {
  // "fed the model" in the frame. Only said when a link is confirmed; a
  // conversation that has fed nothing says so rather than staying silent.
  const fedPhrase =
    fed.length === 0
      ? "fed nothing yet"
      : fed.length === 1
        ? `fed ${fed[0]}`
        : `fed ${fed.length} pieces`;

  const stamp = [
    <VendorMark key="vendor" item={item} />,
    ` · ${turns} ${turns === 1 ? "turn" : "turns"} · ${fedPhrase}`,
  ];

  return (
    <div className="group/chat border-b border-[var(--nb-rule)] last:border-b-0">
      <div
        role="button"
        tabIndex={0}
        aria-label={item.title}
        onClick={onOpen}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onOpen();
          }
        }}
        className="flex cursor-pointer items-baseline gap-4 py-2.5 transition-colors hover:bg-secondary/40"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] leading-[18px] text-foreground">{item.title}</p>
          <p className="mt-0.5 flex min-w-0 items-center truncate font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
            {stamp}
          </p>
        </div>
        <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.08em] text-soft">
          {when}
        </span>
      </div>
      {actions ? (
        <div
          className="flex flex-wrap items-center gap-x-3 gap-y-1 pb-2 md:hidden md:group-focus-within/chat:flex md:group-hover/chat:flex"
          onClick={(event) => event.stopPropagation()}
        >
          {actions}
        </div>
      ) : null}
    </div>
  );
}

/**
 * "2H AGO" for today, "5 SEP" for anything older. The frame uses the near form
 * only where it is genuinely near, so a stamp never implies more precision than
 * the record has.
 */
export function chatWhen(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const hours = Math.floor((Date.now() - d.getTime()) / 3_600_000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const day = String(d.getDate()).padStart(2, "0");
  return `${day} ${d.toLocaleString("en-US", { month: "short" }).toUpperCase()}`;
}