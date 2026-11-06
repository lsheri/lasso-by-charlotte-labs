import { Pin, X } from "lucide-react";

import type { AskLasso } from "@/components/reflect/use-ask-lasso";
import { NbDots } from "@/components/reflect/AskSurface";
import { readAskPins } from "@/lib/ask-draft";

export type PinnedAnswerRow = { nodeId: string; durableId: string | null; text: string };

function safeStore(): Storage | null {
  try { return window.localStorage; } catch { return null; }
}

const HEADING = "font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground";
const ROW = "min-h-10 w-full min-w-0 truncate text-left text-sm";

/** ASK-B2: answers pinned on this board, then this person's past chats. Reads only what is already loaded. */
export function AskPastList({ ask, pinned, onOpen, onJump, onUnpin, unpinned = {} }: {
  ask: Pick<AskLasso, "sessions" | "historySettled" | "sessionId">;
  pinned: PinnedAnswerRow[];
  onOpen: (sessionId: string) => void;
  onJump: (nodeId: string) => void;
  /** PIN-1: takes a pinned answer off the board. */
  onUnpin?: ((nodeId: string) => void) | undefined;
  /** PIN-1: sessions taken off the board, session id to board id. */
  unpinned?: Record<string, string> | undefined;
}) {
  const sessions = ask.sessions ?? [];
  const pinnedSessions = new Set(Object.values(readAskPins(safeStore())));
  return (
    <div data-ask-list className="min-h-0 flex-1 overflow-y-auto">
      <div className="space-y-1 px-4 py-4">
      {pinned.length > 0 ? (
        <div>
          <p className={HEADING}>Pinned on this board</p>
          {pinned.map((row) => (
            <div key={row.nodeId} className="flex min-w-0 items-center gap-1">
              <button type="button" onClick={() => onJump(row.nodeId)} className={`${ROW} flex flex-1 items-center gap-2`}>
                <Pin size={13} aria-hidden="true" className="shrink-0 text-[var(--pin)]" />
                <span className="min-w-0 truncate">{row.text.split(/\r?\n/).find((line) => line.trim()) ?? ""}</span>
              </button>
              {onUnpin ? (
                <button type="button" aria-label="Take off the board" title="Take off the board" onClick={() => onUnpin(row.nodeId)} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:text-foreground">
                  <X size={14} aria-hidden="true" />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
      {!ask.historySettled ? (
        <div className="flex items-center gap-2 py-2">
          <NbDots label="Loading earlier sessions" />
          <span className="text-sm text-muted-foreground">Finding this workboard's chats</span>
        </div>
      ) : sessions.length > 0 ? (
        <div>
          <p className={HEADING}>Past conversations on this board</p>
          {sessions.map((row) => (
            <button key={row.id} type="button" onClick={() => onOpen(row.id)} className={`${ROW} flex items-center gap-2 ${row.id === ask.sessionId ? "text-foreground" : "text-muted-foreground"}`}>
              {pinnedSessions.has(row.id) ? <Pin size={13} aria-hidden="true" className="shrink-0 text-[var(--pin)]" data-testid="ask-past-pin" /> : null}
              <span className="min-w-0 flex-1 truncate">
                {row.title ?? "Untitled"}{" "}
                <span className="font-mono text-[10px] uppercase tracking-[0.08em]">{new Date(row.created_at).toLocaleDateString()}</span>
              </span>
              {!pinnedSessions.has(row.id) && unpinned[row.id] ? <span className="shrink-0 font-mono text-[10px]">Was pinned</span> : null}
            </button>
          ))}
        </div>
      ) : pinned.length === 0 ? (
        <p className="text-sm text-muted-foreground">No earlier chats on this workboard yet.</p>
      ) : null}
      </div>
    </div>
  );
}
