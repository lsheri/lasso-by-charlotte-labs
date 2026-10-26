import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/work-types";

export const COPY = { comment: "Comment", name: "Your name (optional)", body: "Add a comment", send: "Send", whole: "Comment on the whole memo", reader: "a reader", count: (n: number) => `${n} comments from the link`, remove: "Remove", error: "The comment could not be added. Try again.", readError: "Comments could not be opened.", removeError: "The comment could not be removed. Try again.", expired: "This link has expired.", limited: "Too many comments. Please try again later." };
export type MemoComment = { id: string; decision_id: string | null; display_name: string | null; body: string; created_at: string };
export type MemoCommentsModel = { rows: readonly MemoComment[]; token?: string; onAdded?: (comment: MemoComment) => void; onRemove?: (id: string) => Promise<void>; error?: boolean; onSend?: (data: { token: string; decision_id?: string; display_name: string | null; body: string }) => Promise<MemoComment | { status: "closed" | "refused"; message: string }> };
const NAME_KEY = "lasso-memo-reader-name";

export function useDocumentLinkComments(documentId: string) {
  const client = useQueryClient();
  const key = ["document-link-comments", documentId];
  const result = useQuery({ queryKey: key, queryFn: async () => {
    const { data, error } = await supabase.from("document_link_comments").select("id, decision_id, display_name, body, created_at").eq("work_item_id", documentId).order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  } });
  async function remove(id: string) {
    const { error } = await supabase.from("document_link_comments").delete().eq("id", id).eq("work_item_id", documentId);
    if (error) throw new Error(error.message);
    client.setQueryData<MemoComment[]>(key, (rows) => (rows ?? []).filter((row) => row.id !== id));
  }
  return { rows: result.data ?? [], error: result.isError, remove };
}

export function MemoComments({ decisionId = null, model, ledger = false }: { decisionId?: string | null; model: MemoCommentsModel; ledger?: boolean }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  useEffect(() => { try { setName(localStorage.getItem(NAME_KEY) ?? ""); } catch { /* Browser storage is optional. */ } }, []);
  const rows = model.rows.filter((row) => row.decision_id === decisionId);
  if (!model.token && !rows.length && !model.error) return null;
  const label = decisionId === null ? COPY.whole : ledger ? COPY.count(rows.length) : COPY.comment;
  return <section className="lasso-memo-comments" onKeyDown={(event) => { if (event.key === "Escape" && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); } }}>
    <Button variant="ghost" aria-expanded={open} onClick={() => setOpen(!open)}>{label}{model.token && decisionId !== null ? <span className="lasso-memo-comment-count">{rows.length}</span> : null}</Button>
    {model.error ? <p role="alert">{COPY.readError}</p> : null}
    {open ? <div className="lasso-memo-thread">
      {rows.map((row) => <div className="lasso-memo-comment" key={row.id}><p className="lasso-memo-comment-byline">{row.display_name || COPY.reader} · {formatDate(row.created_at)}</p><p>{row.body}</p>{model.onRemove ? <Button variant="ghost" disabled={removing !== null} onClick={() => { setRemoving(row.id); setError(null); void model.onRemove?.(row.id).catch(() => setError(COPY.removeError)).finally(() => setRemoving(null)); }}>{COPY.remove}</Button> : null}</div>)}
      {model.token ? expired ? <p role="status">{COPY.expired}</p> : <form className="lasso-memo-composer" onSubmit={(event) => {
        event.preventDefault(); if (!body.trim() || busy || !model.token || !model.onSend) return;
        setBusy(true); setError(null);
        void model.onSend({ token: model.token, ...(decisionId ? { decision_id: decisionId } : {}), display_name: name.trim() || null, body: body.trim() }).then((answer) => {
          if ("status" in answer) { if (answer.status === "closed") setExpired(true); else setError(COPY.limited); return; }
          model.onAdded?.(answer); setBody("");
        }).catch(() => setError(COPY.error)).finally(() => setBusy(false));
      }}><Input aria-label={COPY.name} placeholder={COPY.name} maxLength={60} value={name} onChange={(event) => { setName(event.target.value); try { localStorage.setItem(NAME_KEY, event.target.value); } catch { /* Browser storage is optional. */ } }} /><Textarea aria-label={COPY.body} placeholder={COPY.body} maxLength={2000} value={body} onChange={(event) => setBody(event.target.value)} /><Button type="submit" disabled={busy || !body.trim()}>{COPY.send}</Button></form> : null}
      {error ? <p role="alert">{error}</p> : null}
    </div> : null}
  </section>;
}