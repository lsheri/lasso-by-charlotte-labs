import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { getVersionFileUrl } from "@/lib/work-files.functions";
import { diffDecisionLines, parseDecisionsMarkdown } from "@/lib/mcp-decisions";
import { formatDate } from "@/lib/work-types";

export const COPY = { title: "Versions", back: "Back", loading: "Reading version…", empty: "No versions yet", error: "This version could not be opened.", added: "added", edited: "changed", moved: "moved", removed: "removed", mcp_push: "Pushed from a chat", mcp_repush: "Pushed again from a chat", ledger_edit: "Edited in Lasso", version: (n: number) => `Version ${n}` };
export type DecisionsVersion = { id: string; version_no: number; created_at: string; source_event: string };
export function DecisionsVersions({ versions, onClose }: { versions: readonly DecisionsVersion[]; onClose: () => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const ordered = [...versions].sort((a, b) => b.version_no - a.version_no);
  const index = selected ? ordered.findIndex((v) => v.id === selected) : 0;
  const current = ordered[index]; const previous = ordered[index + 1];
  const getUrl = useServerFn(getVersionFileUrl);
  const result = useQuery({ queryKey: ["decisions-version-diff", current?.id, previous?.id], enabled: Boolean(current), retry: false, queryFn: async () => {
    async function read(id: string) { const { url } = await getUrl({ data: { version_id: id } }); const response = await fetch(url); if (!response.ok) throw new Error(COPY.error); return parseDecisionsMarkdown(await response.text()); }
    if (!current) throw new Error(COPY.error);
    const [now, before] = await Promise.all([read(current.id), previous ? read(previous.id) : Promise.resolve({ lines: [] })]);
    return diffDecisionLines(before.lines, now.lines);
  } });
  return <aside className="lasso-decisions-versions" aria-label={COPY.title} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onClose(); } }}><header><h2>{COPY.title}</h2><Button variant="ghost" autoFocus onClick={onClose}>{COPY.back}</Button></header><ol className="lasso-decisions-version-list">{ordered.map((v) => <li key={v.id}><Button variant="ghost" aria-pressed={current?.id === v.id} onClick={() => setSelected(v.id)}><span>{COPY.version(v.version_no)} · {formatDate(v.created_at)}</span><span>{v.source_event === "mcp_push" ? COPY.mcp_push : v.source_event === "mcp_repush" ? COPY.mcp_repush : v.source_event === "ledger_edit" ? COPY.ledger_edit : v.source_event}</span></Button></li>)}</ol>{!current ? <p>{COPY.empty}</p> : result.isError ? <p role="alert">{COPY.error}</p> : result.isLoading ? <p>{COPY.loading}</p> : <><ol className="lasso-decisions-version-lines">{result.data?.lines.map(({ line, change }, i) => <li key={i}><p>{line.ord}. {line.call_text}</p><p>{line.status === "draft" ? "Open" : line.status === "confirmed" ? "Agreed" : "Dropped"}</p>{line.why ? <p>{line.why}</p> : null}{change !== "unchanged" ? <span className="lasso-decisions-change">{COPY[change as "added" | "edited" | "moved"]}</span> : null}</li>)}</ol>{result.data?.removed.length ? <section><h3>{COPY.removed}</h3><ul>{result.data.removed.map((line, i) => <li key={i}>{line.call_text}</li>)}</ul></section> : null}</>}</aside>;
}