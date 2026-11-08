import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { LabNode } from "@/components/canvas-lab/canvas-lab-model";

import { supabase } from "@/integrations/supabase/client";
import { noteWorkboardPinnedChatOpened } from "@/components/canvas-lab/canvas-lab-telemetry";
import { ASK_DRAFT_OPEN_SESSION_EVENT, readAskPins, resolveAskDraft, type AskDraft } from "@/lib/ask-draft";

export const PINNED_CHAT_COPY = { row: "Chat", unavailable: "This chat is not available to you here.", loading: "Opening the chat" };

function safeStore(): Storage | null {
  try { return window.localStorage; } catch { return null; }
}

/** Read the saved chat first, with a browser-local fallback for old pins. */
export function useAskDraftPin(node: Pick<LabNode, "id" | "durableId" | "chatSessionId">): { draft: AskDraft; sessionId: string } | null {
  const nodeId = node.durableId ?? node.id;
  const chatSessionId = node.chatSessionId;
  const [pin, setPin] = useState<{ draft: AskDraft; sessionId: string } | null>(null);
  useEffect(() => {
    const store = safeStore();
    const draft = resolveAskDraft(window.location.host, window.location.search, store);
    const sessionId = draft ? (chatSessionId ?? readAskPins(store)[nodeId]) : undefined;
    setPin(draft && sessionId ? { draft, sessionId } : null);
  }, [nodeId, chatSessionId]);
  return pin;
}

type Row = { id: number | string; role: string; content: string };

/**
 * The chat under a pinned answer. It reads the owner's own session with the
 * normal client, so row level security decides; nothing is written to the node.
 */
export function PinnedChatRow({ draft, sessionId, ownership, authorName, orgId, onOpenChange }: { draft: AskDraft; sessionId: string; ownership: LabNode["ownership"]; authorName?: string | undefined; orgId?: string | undefined; onOpenChange: (open: boolean) => void }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    if (ownership !== "yours" || !open || draft !== "a" || rows !== null) return;
    let live = true;
    void supabase
      .from("chat_messages")
      .select("id, role, content")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true })
      .then(({ data }) => { if (live) setRows((data ?? []) as Row[]); });
    return () => { live = false; };
  }, [open, draft, sessionId, rows, ownership]);

  const press = () => {
    if (ownership !== "yours") return;
    if (draft === "b") {
      noteWorkboardPinnedChatOpened(orgId, draft);
      window.dispatchEvent(new CustomEvent(ASK_DRAFT_OPEN_SESSION_EVENT, { detail: { sessionId } }));
      return;
    }
    const next = !open;
    if (next) noteWorkboardPinnedChatOpened(orgId, draft);
    setOpen(next);
    onOpenChange(next);
  };

  if (ownership !== "yours") {
    const name = authorName?.trim();
    return <p className="ask-draft-pinned-chat-note">{name && name !== "A teammate" ? `Pinned from ${name}'s chat. The chat is theirs.` : "Pinned from a teammate's chat. The chat is theirs."}</p>;
  }

  return (
    <div className="ask-draft-pinned-chat" onPointerDown={(event) => event.stopPropagation()}>
      <button type="button" className="ask-draft-pinned-chat-row" aria-expanded={draft === "a" ? open : undefined} onClick={press}>
        <span>{PINNED_CHAT_COPY.row}</span>
        <ChevronDown className="h-3.5 w-3.5" style={{ transform: open ? "rotate(180deg)" : undefined }} aria-hidden="true" />
      </button>
      {draft === "a" && open ? (
        rows === null ? (
          <p className="ask-draft-pinned-chat-note">{PINNED_CHAT_COPY.loading}</p>
        ) : rows.length === 0 ? (
          <p className="ask-draft-pinned-chat-note">{PINNED_CHAT_COPY.unavailable}</p>
        ) : (
          <ol className="ask-draft-pinned-chat-list" aria-label="Chat">
            {rows.map((row) => (
              <li key={row.id} data-role={row.role}>
                <span className="ask-draft-pinned-chat-who">{row.role === "user" ? "You" : "Lasso"}</span>
                <p>{row.content}</p>
              </li>
            ))}
          </ol>
        )
      ) : null}
    </div>
  );
}
