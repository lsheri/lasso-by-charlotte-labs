import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ledgerTurnOf, statusWord, type DecisionLine } from "@/hooks/use-decision-lines";
import { formatDate } from "@/lib/work-types";

export const COPY = { updated: (date: string) => `Updated ${date}`, aside: "Set aside", pointer: "from a chat on this board", copy: "Copy as text", copied: "Copied", copyError: "Could not copy. Try again." };
export function memoText(title: string, date: string | undefined, lines: readonly DecisionLine[]) {
  const live = lines.filter((line) => line.status !== "discarded");
  const dropped = lines.filter((line) => line.status === "discarded");
  const render = (line: DecisionLine, index: number) => `${index + 1}. ${line.call_text}\n   ${statusWord(line.status)}${line.why ? `\n   ${line.why}` : ""}${ledgerTurnOf(line) ? `\n   ${COPY.pointer}` : ""}`;
  return [title, ...(date ? [COPY.updated(formatDate(date))] : []), ...live.map(render), ...(dropped.length ? [COPY.aside, ...dropped.map(render)] : [])].join("\n\n");
}
export function DecisionsMemo({ title, date, lines }: { title: string; date: string | undefined; lines: readonly DecisionLine[] }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  function group(rows: readonly DecisionLine[]) {
    return <ol>{rows.map((line) => <li key={line.id}><p>{line.call_text}</p><span className="lasso-decisions-memo-status">{statusWord(line.status)}</span>{line.why ? <p className="lasso-decisions-reason">{line.why}</p> : null}{ledgerTurnOf(line) ? <p className="lasso-decisions-memo-pointer">{COPY.pointer}</p> : null}</li>)}</ol>;
  }
  const dropped = lines.filter((line) => line.status === "discarded");
  return <article className="lasso-decisions-memo"><h2>{title}</h2>{date ? <p className="lasso-decisions-version">{COPY.updated(formatDate(date))}</p> : null}{group(lines.filter((line) => line.status !== "discarded"))}{dropped.length ? <section className="lasso-decisions-memo-aside"><h3>{COPY.aside}</h3>{group(dropped)}</section> : null}<Button variant="ghost" onClick={() => { void navigator.clipboard.writeText(memoText(title, date, lines)).then(() => { setError(false); setCopied(true); if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => setCopied(false), 1500); }).catch(() => setError(true)); }}>{copied ? COPY.copied : COPY.copy}</Button>{error ? <p role="status">{COPY.copyError}</p> : null}</article>;
}