import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ledgerTurnOf, statusWord, type DecisionLine } from "@/hooks/use-decision-lines";
import { formatDate } from "@/lib/work-types";
import { MemoComments, type MemoCommentsModel } from "./MemoComments";

export const COPY = { updated: (date: string) => `Updated ${date}`, aside: "Set aside", pointer: "from a chat on this board", copy: "Copy as text", copied: "Copied", copyError: "Could not copy. Try again.", agreed: "Agreed", open: "Open", dropped: "Dropped", filter: "Decisions" };
export type OpenedMemoLine = { id: string; ord: number | null; statement: string; reason: string | null; status: "open" | "agreed" | "dropped"; has_source: boolean };
type MemoLine = DecisionLine | OpenedMemoLine;
function normalize(line: MemoLine): OpenedMemoLine {
  return "statement" in line ? line : { id: line.id, ord: line.ord, statement: line.call_text, reason: line.why, status: statusWord(line.status).toLowerCase() as OpenedMemoLine["status"], has_source: ledgerTurnOf(line) !== null };
}
export function memoText(title: string, date: string | undefined, lines: readonly MemoLine[]) {
  const rows = lines.map(normalize);
  const live = rows.filter((line) => line.status !== "dropped");
  const dropped = rows.filter((line) => line.status === "dropped");
  const render = (line: OpenedMemoLine, index: number) => `${index + 1}. ${line.statement}\n   ${COPY[line.status]}${line.reason ? `\n   ${line.reason}` : ""}${line.has_source ? `\n   ${COPY.pointer}` : ""}`;
  return [title, ...(date ? [COPY.updated(formatDate(date))] : []), ...live.map(render), ...(dropped.length ? [COPY.aside, ...dropped.map(render)] : [])].join("\n\n");
}
export function DecisionsMemo({ title, date, lines, comments, filters = false }: { title: string; date: string | undefined; lines: readonly MemoLine[]; comments?: MemoCommentsModel; filters?: boolean }) {
  const [visible, setVisible] = useState({ agreed: true, open: true, dropped: true });
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  function group(rows: readonly OpenedMemoLine[]) {
    return <ol>{rows.map((line) => <li key={line.id}><p>{line.statement}</p><span className="lasso-decisions-memo-status">{COPY[line.status]}</span>{line.reason ? <p className="lasso-decisions-reason">{line.reason}</p> : null}{line.has_source ? <p className="lasso-decisions-memo-pointer">{COPY.pointer}</p> : null}{comments ? <MemoComments decisionId={line.id} model={comments} ledger={!comments.token} /> : null}</li>)}</ol>;
  }
  const rows = lines.map(normalize).filter((line) => !filters || visible[line.status]);
  const dropped = rows.filter((line) => line.status === "dropped");
  return <article className="lasso-decisions-memo"><h2>{title}</h2>{date ? <p className="lasso-decisions-version">{COPY.updated(formatDate(date))}</p> : null}{filters ? <div role="group" aria-label={COPY.filter} className="lasso-memo-filters">{(["agreed", "open", "dropped"] as const).map((status) => <Button key={status} variant="outline" aria-pressed={visible[status]} onClick={() => setVisible((current) => ({ ...current, [status]: !current[status] }))}>{COPY[status]}</Button>)}</div> : null}{group(rows.filter((line) => line.status !== "dropped"))}{dropped.length ? <section className="lasso-decisions-memo-aside"><h3>{COPY.aside}</h3>{group(dropped)}</section> : null}<Button variant="ghost" onClick={() => { void navigator.clipboard.writeText(memoText(title, date, lines)).then(() => { setError(false); setCopied(true); if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => setCopied(false), 1500); }).catch(() => setError(true)); }}>{copied ? COPY.copied : COPY.copy}</Button>{error ? <p role="status">{COPY.copyError}</p> : null}{comments ? <MemoComments model={comments} /> : null}</article>;
}