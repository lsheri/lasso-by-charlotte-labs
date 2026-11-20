import { tagVariants } from "@/components/ui/tag";
import { ASK_COPY, askLine } from "@/lib/lead-ask-shared";
import { BOARD_WIN_COPY, deskDate, type BoardWin } from "@/lib/proposal-desk-shared";

/** The strip's words. Plain values in, so it is tested without a server. */
export function BoardWinLines({
  win,
  children,
  now,
}: {
  win: BoardWin;
  children?: React.ReactNode;
  now?: Date | undefined;
}) {
  if (!win.won) return null;
  return (
    <div
      data-testid="board-win-strip"
      data-board-win
      role="status"
      className="flex flex-col gap-1 rounded-[var(--radius)] border border-border bg-card px-3 py-2 text-(length:--type-small) shadow-card"
    >
      <p className="flex items-center gap-2 font-medium text-foreground">
        <span aria-hidden className="size-2 shrink-0 rounded-full bg-[var(--good-mark)]" />
        {BOARD_WIN_COPY.won(deskDate(win.decidedAt, now))}
      </p>
      {win.leadName ? (
        <p data-board-lead className="break-words text-muted-foreground [overflow-wrap:anywhere]">
          {BOARD_WIN_COPY.lead(win.leadName)}
        </p>
      ) : null}
      {win.ask ? (
        <p
          data-board-lead-answer
          className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground"
        >
          <span>{askLine(win.ask)}</span>
          {win.ask.practice ? (
            <span className={tagVariants({ tone: "outline" })}>{ASK_COPY.practiceTag}</span>
          ) : null}
          {win.ask.recorded ? (
            <span className={tagVariants({ tone: "outline" })}>{ASK_COPY.recordedTag}</span>
          ) : null}
        </p>
      ) : null}
      {children}
    </div>
  );
}
