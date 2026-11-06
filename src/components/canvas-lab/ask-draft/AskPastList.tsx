import { Pin } from "lucide-react";

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
export function AskPastList({ ask, pinned, onOpen, onJump }: {
  ask: Pick<AskLasso, "sessions" | "historySettled" | "sessionId">;
  pinned: PinnedAnswerRow[];
  onOpen: (sessionId: string) => void;
  onJump: (nodeId: string) => void;
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
            <button key={row.nodeId} type="button" onClick={() => onJump(row.nodeId)} className={`${ROW} flex items-center gap-2`}>
              <Pin size={13} aria-hidden="true" className="shrink-0" />
              <span className="min-w-0 truncate">{row.text.split(/\r?\n/).find((line) => line.trim()) ?? ""}</span>
            </button>
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
              {pinnedSessions.has(row.id) ? <Pin size={13} aria-hidden="true" className="shrink-0" data-testid="ask-past-pin" /> : null}
              <span className="min-w-0 truncate">
                {row.title ?? "Untitled"}{" "}
                <span className="font-mono text-[10px] uppercase tracking-[0.08em]">{new Date(row.created_at).toLocaleDateString()}</span>
              </span>
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
