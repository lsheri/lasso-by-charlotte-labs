/**
 * S1: the page somebody with no account lands on.
 *
 * It revalidates rather than trusting what it loaded with, so hour 49 stops
 * working for a page that was already open. There is no app shell here, no
 * navigation into the rest of the product, and nothing to click that writes.
 */

import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";

import { SharedBoardView } from "@/components/canvas-lab/SharedBoardView";
import { openSharedBoardFn } from "@/lib/board-share.functions";
import { SHARE_CLOSED_MESSAGE, type SharedBoardResult } from "@/lib/board-share-shared";

const REVALIDATE_MS = 60_000;

export function SharedBoardPage({ token }: { token: string }) {
  const open = useServerFn(openSharedBoardFn);
  const query = useQuery<SharedBoardResult>({
    queryKey: ["shared-board", token],
    queryFn: () => open({ data: { token } }),
    // The page never trusts the copy it loaded with.
    staleTime: 0,
    refetchInterval: REVALIDATE_MS,
    refetchOnWindowFocus: true,
    retry: false,
  });

  const expiresAt = query.data?.status === "open" ? query.data.board.expiresAt : null;
  const refetch = query.refetch;

  useEffect(() => {
    if (!expiresAt) return;
    const ms = new Date(expiresAt).getTime() - Date.now();
    if (ms <= 0) {
      void refetch();
      return;
    }
    const timer = window.setTimeout(() => void refetch(), Math.min(ms + 1000, 2_147_000_000));
    return () => window.clearTimeout(timer);
  }, [expiresAt, refetch]);

  if (query.isPending) {
    return <Shell>{<p className="text-[13px] text-muted">Opening the board.</p>}</Shell>;
  }

  if (!query.data || query.data.status === "closed") {
    return (
      <Shell>
        <p className="text-[13px] text-foreground">{SHARE_CLOSED_MESSAGE}</p>
        <p className="mt-1 text-[11.5px] text-muted">
          Ask the person who sent it for a new one.
        </p>
      </Shell>
    );
  }

  return (
    <main className="flex h-dvh w-full flex-col bg-background">
      <header className="flex h-[52px] shrink-0 items-center justify-between border-b border-border bg-card px-4">
        <span className="text-[13px] font-medium text-foreground">A shared board</span>
        <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-soft">
          Read only
        </span>
      </header>
      <div className="min-h-0 flex-1">
        <SharedBoardView board={query.data.board} />
      </div>
    </main>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex h-dvh w-full items-center justify-center bg-background p-6">
      <div className="max-w-sm text-center">{children}</div>
    </main>
  );
}
