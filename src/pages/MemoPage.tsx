import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { openDocumentShareLinkFn, addDocumentLinkCommentFn } from "@/lib/board-share.functions";
import { DecisionsMemo } from "@/components/canvas-lab/DecisionsMemo";
import type { MemoComment } from "@/components/canvas-lab/MemoComments";

export const COPY = { expired: "This link has expired.", revoked: "This link is no longer active.", unknown: "This link does not open anything.", loading: "Reading memo…", error: "This memo could not be opened. Try again.", brand: "Lasso" };

export function MemoPage({ token }: { token: string }) {
  const open = useServerFn(openDocumentShareLinkFn);
  const add = useServerFn(addDocumentLinkCommentFn);
  const client = useQueryClient();
  const [added, setAdded] = useState<MemoComment[]>([]);
  const key = ["public-memo", token];
  const result = useQuery({ queryKey: key, queryFn: () => open({ data: { token } }), retry: false, staleTime: Infinity, gcTime: 0 });
  const memo = result.data;
  return <div className="lasso-memo-page"><main className="lasso-memo-container max-w-[680px]">
    {result.isLoading ? <p role="status">{COPY.loading}</p> : result.isError ? <p role="alert">{COPY.error}</p> : memo && "status" in memo ? <p>{COPY[memo.reason]}</p> : memo ? <DecisionsMemo key={token} title={memo.title} date={memo.updated_at} lines={memo.lines} filters comments={{ token, onSend: (data) => add({ data }), rows: [...memo.comments, ...added.filter((row) => !memo.comments.some((existing) => existing.id === row.id))], onAdded: (comment) => { setAdded((rows) => [...rows, comment]); client.setQueryData(key, { ...memo, comments: [...memo.comments, comment] }); } }} /> : null}
  </main><footer className="lasso-memo-footer"><a href="/">{COPY.brand}</a></footer></div>;
}