import { useEffect, useRef, useState } from "react";

import {
  actionsFor,
  createComment,
  type LabComment,
  type LabNode,
} from "@/components/canvas-lab/canvas-lab-model";
import { RenderedContent } from "@/components/peek/RenderedContent";
import { ThreadBody } from "@/components/peek/ThreadBody";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { WorkItemRow } from "@/lib/work-types";

/**
 * Reading at full size without losing the board. The overlay sits above the
 * canvas, so the surface keeps its pan and zoom exactly where it was and
 * closing puts the person back in the same place.
 */
export function FocusOverlay({
  node,
  item,
  viewerName,
  comments,
  onComment,
  onSummarize,
  onBranch,
  onClose,
}: {
  node: LabNode;
  item: WorkItemRow | null;
  viewerName: string;
  comments: LabComment[];
  onComment: (comment: LabComment) => void;
  onSummarize: () => void;
  onBranch: () => void;
  onClose: () => void;
}) {
  const [quote, setQuote] = useState("");
  const [body, setBody] = useState("");
  const readerRef = useRef<HTMLDivElement | null>(null);
  const actions = actionsFor(node.ownership);

  useEffect(() => {
    return () => {
      if (typeof CSS === "undefined" || !("highlights" in CSS)) return;
      CSS.highlights?.delete("canvas-lab-selection");
    };
  }, []);

  function captureSelection() {
    if (typeof window === "undefined") return;
    const selection = window.getSelection();
    const text = selection?.toString() ?? "";
    if (!selection || text.trim().length === 0) return;
    const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
    if (!range || !readerRef.current?.contains(range.commonAncestorContainer)) return;
    setQuote(text.trim());
    if (typeof CSS === "undefined" || !("highlights" in CSS) || typeof Highlight === "undefined") return;
    CSS.highlights?.set("canvas-lab-selection", new Highlight(range.cloneRange()));
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--nb-scrim)] p-4 md:p-8">
      <div className="mx-auto flex h-full w-full max-w-[1200px] flex-col overflow-hidden rounded-[var(--radius)] border border-[var(--nb-graphite)] bg-card shadow-[var(--shadow-modal)]">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
          <div className="min-w-0">
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-soft">
              {node.typeLabel} · {node.ownership === "teammate" ? "a teammate's work" : "yours"}
            </span>
            <h1 className="page-title truncate">{node.title}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {actions.includes("Summarize") ? (
              <Button size="sm" variant="outline" onClick={onSummarize}>
                Summarize
              </Button>
            ) : null}
            {actions.includes("Branch") ? (
              <Button size="sm" variant="outline" onClick={onBranch}>
                Branch
              </Button>
            ) : null}
            <Button size="sm" variant="ghost" onClick={onClose}>
              Back to the workboard
            </Button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden lg:flex-row">
          <div
            ref={readerRef}
            className="min-h-0 flex-1 overflow-y-auto px-5 py-4"
            onMouseUp={captureSelection}
            onKeyUp={captureSelection}
          >
            {item && item.type === "ai_thread" ? (
              <ThreadBody item={item} enabled />
            ) : item ? (
              <RenderedContent item={item} onDownload={() => undefined} canEdit={false} />
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-[13px] leading-[20px] text-foreground">{node.summary}</p>
                {node.prompt ? (
                  <p className="text-[13px] leading-[20px] text-foreground">{node.prompt}</p>
                ) : null}
                <p className="font-hand text-[16px] leading-none text-[var(--nb-mid)]">
                  the live AI connection is off in this prototype
                </p>
              </div>
            )}
          </div>

          <aside className="w-full shrink-0 border-t border-border bg-[var(--nb-paper)] px-4 py-4 lg:w-[300px] lg:border-l lg:border-t-0">
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <h2 className="section-title">notes in the margin</h2>
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-soft">
                Not saved
              </span>
            </div>

            {comments.length === 0 ? (
              <p className="text-[11.5px] leading-[17px] text-muted-foreground">
                Select a passage, then write what you noticed.
              </p>
            ) : (
              <ul className="mb-3 flex flex-col gap-2">
                {comments.map((comment, index) => (
                  <li
                    key={comment.id}
                    className="rounded-[var(--radius-control)] border border-[var(--nb-green)] bg-[var(--nb-green-wash)] px-2.5 py-2"
                  >
                    <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-green">
                      {index + 1} · {comment.author} · {comment.at} · not saved
                    </span>
                    <p className="mt-1 text-[11.5px] italic leading-[17px] text-muted-foreground">
                      &ldquo;{comment.quote}&rdquo;
                    </p>
                    <p className="mt-1 text-[12px] leading-[18px] text-foreground">{comment.body}</p>
                  </li>
                ))}
              </ul>
            )}

            {quote ? (
              <p className="mb-1 text-[11.5px] italic leading-[17px] text-muted-foreground">
                {comments.length + 1} · &ldquo;{quote.slice(0, 120)}&rdquo;
              </p>
            ) : null}
            <Textarea
              rows={3}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="What did you notice?"
              aria-label="Write a note on this passage"
              className="text-[12px]"
            />
            <Button
              size="sm"
              className="mt-2 w-full"
              disabled={body.trim().length === 0}
              onClick={() => {
                onComment(createComment(node.id, quote || node.title, body.trim(), viewerName));
                setBody("");
                setQuote("");
              }}
            >
              Leave the note here
            </Button>
          </aside>
        </div>
      </div>
    </div>
  );
}
