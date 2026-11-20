import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";

import { WonTextButton } from "@/components/firm-brain/WonTextButton";
import { tagVariants } from "@/components/ui/tag";
import { ASK_COPY, askLine } from "@/lib/lead-ask-shared";
import { BOARD_WIN_COPY, deskDate, type BoardWin } from "@/lib/proposal-desk-shared";
import { boardWinFn } from "@/lib/proposal-desk.functions";

/** The strip's words. Plain values in, so it is tested without a server. */
export function BoardWinLines({ win, children, now }: { win: BoardWin; children?: React.ReactNode; now?: Date | undefined }) {
  if (!win.won) return null;
  return (
    <div data-testid="board-win-strip" role="status" className="flex flex-col gap-1 rounded-[var(--radius)] border border-border bg-card px-3 py-2 text-(length:--type-small) shadow-card">
      <p className="font-medium text-foreground">{BOARD_WIN_COPY.won(deskDate(win.decidedAt, now))}</p>
      {win.leadName ? (
        <p data-board-lead className="break-words text-muted-foreground [overflow-wrap:anywhere]">
          {BOARD_WIN_COPY.lead(win.leadName)}
        </p>
      ) : null}
      {win.ask ? (
        <p data-board-lead-answer className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground">
          <span>{askLine(win.ask)}</span>
          {win.ask.practice ? <span className={tagVariants({ tone: "outline" })}>{ASK_COPY.practiceTag}</span> : null}
        </p>
      ) : null}
      {children}
    </div>
  );
}

/**
 * 20 Nov 2026 (Liam, Q-52: "Named on the board as the lead"): on a board made by a win, one compact strip at the
 * top, open without pressing anything: that the proposal was won and when, the lead's name, the lead's answer once
 * there is one, and Text the lead for those allowed to use it. A board that did not come from a proposal shows
 * nothing, and so does a failed read. Naming the lead gives them no login and no seat on the board.
 */
export function BoardWinStrip({ engagementId, profileId }: { engagementId: string; profileId: string | null | undefined }) {
  const load = useServerFn(boardWinFn);
  const [win, setWin] = useState<BoardWin | null>(null);

  useEffect(() => {
    let current = true;
    setWin(null);
    Promise.resolve()
      .then(() => load({ data: { engagement_id: engagementId, profile_id: profileId ?? null } }))
      .then((next) => {
        if (current) setWin(next);
      })
      .catch(() => {
        if (current) setWin({ won: false });
      });
    return () => {
      current = false;
    };
  }, [engagementId, profileId, load]);

  if (!win || !win.won) return null;
  return (
    <BoardWinLines win={win}>
      <WonTextButton engagementId={engagementId} profileId={profileId} variant="dialog" />
    </BoardWinLines>
  );
}
