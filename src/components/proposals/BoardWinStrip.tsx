import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";

import { WonTextButton } from "@/components/firm-brain/WonTextButton";
import { BoardWinLines } from "@/components/proposals/BoardWinLines";
import type { BoardWin } from "@/lib/proposal-desk-shared";
import { boardWinFn } from "@/lib/proposal-desk.functions";

// The words live in their own file so they render without a server (tests, Storybook).
export { BoardWinLines };

/**
 * 20 Nov 2026 (Liam, Q-52: "Named on the board as the lead"): on a board made by a win, one compact strip at the
 * top, open without pressing anything: that the proposal was won and when, the lead's name, the lead's answer once
 * there is one, and Text the lead for those allowed to use it. A board that did not come from a proposal shows
 * nothing, and so does a failed read. Naming the lead gives them no login and no seat on the board.
 *
 * On a phone the strip sits at the foot of the board (06-lasso-shell.css): at the top it covered the first card.
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
