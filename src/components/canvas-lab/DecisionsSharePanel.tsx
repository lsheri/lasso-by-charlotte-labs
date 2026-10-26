import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createDocumentShareLinkFn, listDocumentShareLinksFn, revokeDocumentShareLinkFn } from "@/lib/board-share.functions";
import { formatDate } from "@/lib/work-types";

export const COPY = { title: "Share this memo", explanation: "Anyone with the link sees the current decisions and can leave comments. They never see the board.", make: "Make a link", copy: "Copy", copied: "Copied", once: "Copy it now. It is shown once.", expires: (time: string) => `Expires in ${time}`, expire: "Expire now", empty: "No live links.", close: "Close", link: "Memo link", loading: "Reading links…", error: "The links could not be opened. Try again.", createError: "The link could not be made. Try again.", expireError: "The link could not be expired. Try again.", copyError: "Could not copy. Try again.", hours: (n: number) => `${n} ${n === 1 ? "hour" : "hours"}`, minutes: (n: number) => `${n} ${n === 1 ? "minute" : "minutes"}` };
type Link = { id: string; created_at: string; expires_at: string };
export function timeLeft(expiresAt: string, now = Date.now()) {
  const minutes = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now) / 60000));
  return minutes >= 60 ? COPY.hours(Math.ceil(minutes / 60)) : COPY.minutes(minutes);
}
export function DecisionsSharePanel({ documentId, onClose }: { documentId: string; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [fresh, setFresh] = useState<{ url: string; expiresAt: string; id: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const client = useQueryClient();
  const key = ["document-share-links", documentId];
  const list = useServerFn(listDocumentShareLinksFn), create = useServerFn(createDocumentShareLinkFn), revoke = useServerFn(revokeDocumentShareLinkFn);
  const links = useQuery({ queryKey: key, queryFn: () => list({ data: { document_id: documentId } }) });
  useEffect(() => { const previous = document.activeElement; closeRef.current?.focus(); const timer = setInterval(() => setNow(Date.now()), 60000); return () => { clearInterval(timer); if (previous instanceof HTMLElement) previous.focus(); }; }, []);
  const make = useMutation({ mutationFn: () => create({ data: { document_id: documentId } }), onSuccess: (answer) => {
    setProblem(null); setCopied(false); setFresh({ url: `${window.location.origin}/memo/${answer.token}`, expiresAt: answer.expiresAt, id: answer.id });
    void client.invalidateQueries({ queryKey: key });
  }, onError: () => setProblem(COPY.createError) });
  const expire = useMutation({ mutationFn: (id: string) => revoke({ data: { document_id: documentId, id } }), onSuccess: (_answer, id) => {
    client.setQueryData<Link[]>(key, (rows) => (rows ?? []).filter((row) => row.id !== id)); if (fresh?.id === id) setFresh(null); setProblem(null);
    void client.invalidateQueries({ queryKey: key });
  }, onError: () => setProblem(COPY.expireError) });
  const live = (links.data ?? []).filter((link) => new Date(link.expires_at).getTime() > now);
  return <aside className="lasso-decisions-share-panel" aria-label={COPY.title} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onClose(); } }}>
    <header><h2>{COPY.title}</h2><Button ref={closeRef} variant="ghost" onClick={onClose}>{COPY.close}</Button></header><p>{COPY.explanation}</p>
    {fresh ? <div className="lasso-decisions-fresh-link"><p>{COPY.once}</p><Input aria-label={COPY.link} readOnly value={fresh.url} /><Button variant="outline" onClick={() => { void navigator.clipboard.writeText(fresh.url).then(() => { setCopied(true); setProblem(null); }).catch(() => setProblem(COPY.copyError)); }}>{copied ? COPY.copied : COPY.copy}</Button><p>{COPY.expires(timeLeft(fresh.expiresAt, now))}</p></div> : <Button disabled={make.isPending} onClick={() => make.mutate()}>{COPY.make}</Button>}
    {problem ? <p role="alert">{problem}</p> : null}
    {links.isLoading ? <p>{COPY.loading}</p> : links.isError ? <p role="alert">{COPY.error}</p> : live.length ? <ul className="lasso-decisions-share-links">{live.map((link) => <li key={link.id}><div><p>{formatDate(link.created_at)}</p><p>{COPY.expires(timeLeft(link.expires_at, now))}</p></div><Button variant="ghost" disabled={expire.isPending} onClick={() => expire.mutate(link.id)}>{COPY.expire}</Button></li>)}</ul> : <p>{COPY.empty}</p>}
  </aside>;
}