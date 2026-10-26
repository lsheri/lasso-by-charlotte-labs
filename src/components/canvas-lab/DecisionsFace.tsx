import { statusWord, useDecisionLines } from "@/hooks/use-decision-lines";

export const COPY = { empty: "No decisions yet", error: "Decisions could not be opened.", count: (n: number) => `${n} decisions`, dropped: (n: number) => ` · ${n} dropped` };

export function DecisionsFace({ documentId }: { documentId: string }) {
  const { data = [], isLoading, isError } = useDecisionLines(documentId);
  const live = data.filter((line) => line.status !== "discarded").sort((a, b) => (a.ord ?? 0) - (b.ord ?? 0));
  const dropped = data.length - live.length;
  return <div className="lasso-decisions-face">
    {isLoading ? <div aria-label="Loading decisions" className="lasso-decisions-placeholders">{[0, 1, 2].map((n) => <span key={n} />)}</div> : isError ? <p>{COPY.error}</p> : <>
      {live.length ? live.slice(0, 3).map((line) => <div key={line.id} className="lasso-decisions-face-row"><span className="lasso-decisions-status" data-status={line.status}>{statusWord(line.status)}</span><span className="lasso-decisions-statement">{line.call_text}</span></div>) : <p>{COPY.empty}</p>}
      <p className="lasso-decisions-count">{COPY.count(live.length)}{dropped > 0 ? COPY.dropped(dropped) : null}</p>
    </>}
  </div>;
}