import { useEffect, useRef, useState } from "react";

import { actionsFor, type LabNode } from "@/components/canvas-lab/canvas-lab-model";
import { RenderedContent } from "@/components/peek/RenderedContent";
import { ThreadBody } from "@/components/peek/ThreadBody";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { CommentDto, CommentThreadDto } from "@/lib/canvas-lab-annotations-shared";
import { resolveTurnSelection, type TurnSelection } from "@/lib/turn-selection";
import type { WorkItemRow } from "@/lib/work-types";

/** One saved highlight, already told whether its turn has moved on. */
export type OverlayHighlight = {
  id: string;
  turnNo: number;
  charStart: number;
  charEnd: number;
  excerpt: string;
  stale: boolean;
  version: number;
};

/** Where a composer is anchored: a fresh selection or an existing highlight. */
type ComposerAnchor = { turnNo: number; charStart: number; charEnd: number; excerpt: string };

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const seconds = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/** Cmd or Ctrl with Enter posts, the way every other composer here behaves. */
function isSubmitKey(event: React.KeyboardEvent): boolean {
  return event.key === "Enter" && (event.metaKey || event.ctrlKey);
}

function CommentComposer({
  label,
  placeholder,
  initial = "",
  quote,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  label: string;
  placeholder: string;
  initial?: string;
  quote?: string | undefined;
  submitLabel: string;
  onSubmit: (body: string) => void;
  onCancel: () => void;
}) {
  const [body, setBody] = useState(initial);
  const ready = body.trim().length > 0 && body.trim().length <= 4000;
  return (
    <div className="mt-2">
      {quote ? (
        <p className="mb-1 line-clamp-2 text-[11.5px] italic leading-[17px] text-muted-foreground">
          &ldquo;{quote}&rdquo;
        </p>
      ) : null}
      <Textarea
        rows={3}
        autoFocus
        value={body}
        onChange={(event) => setBody(event.target.value)}
        onKeyDown={(event) => {
          if (isSubmitKey(event) && ready) {
            event.preventDefault();
            onSubmit(body.trim());
          }
        }}
        placeholder={placeholder}
        aria-label={label}
        className="text-[12px]"
      />
      <p className="mt-1 text-[11.5px] leading-[17px] text-muted-foreground">
        Visible to everyone on this engagement
      </p>
      <div className="mt-1 flex items-center gap-2">
        <Button size="sm" className="h-7 px-2 text-[11.5px]" disabled={!ready} onClick={() => onSubmit(body.trim())}>
          {submitLabel}
        </Button>
        <Button size="sm" variant="ghost" className="h-7 px-2 text-[11.5px]" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function CommentLine({ comment }: { comment: CommentDto }) {
  return (
    <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-soft">
      {comment.authorName} · {relativeTime(comment.createdAt)}
      {comment.edited ? " · edited" : ""}
    </span>
  );
}

/**
 * Reading at full size without losing the board. The overlay sits above the
 * canvas, so the surface keeps its pan and zoom exactly where it was and
 * closing puts the person back in the same place.
 */
export function FocusOverlay({
  node,
  item,
  onSummarize,
  onBranch,
  onClose,
  highlights = [],
  onHighlight,
  onRemoveHighlight,
  threads = [],
  canWrite = false,
  onCreateComment,
  onCreateReply,
  onEditComment,
  onArchiveComment,
  openComments = false,
}: {
  node: LabNode;
  item: WorkItemRow | null;
  onSummarize: () => void;
  onBranch: () => void;
  onClose: () => void;
  /** Slice 2a: the reader's own highlights on this chat. */
  highlights?: readonly OverlayHighlight[];
  onHighlight?: ((selection: TurnSelection) => void) | undefined;
  onRemoveHighlight?: ((highlight: OverlayHighlight) => void) | undefined;
  /** Slice 2a unit 2: live comment threads on this chat, oldest first. */
  threads?: readonly CommentThreadDto[];
  /** A coach can read the review without being able to add to it. */
  canWrite?: boolean;
  onCreateComment?: ((anchor: ComposerAnchor, body: string) => void) | undefined;
  onCreateReply?: ((parentId: string, body: string) => void) | undefined;
  onEditComment?: ((comment: CommentDto, body: string) => void) | undefined;
  onArchiveComment?: ((comment: CommentDto) => void) | undefined;
  /** Opened from a card's chip, so the panel starts at the comments. */
  openComments?: boolean;
}) {
  const [quote, setQuote] = useState("");
  const [turnSelection, setTurnSelection] = useState<TurnSelection | null>(null);
  const [crossTurn, setCrossTurn] = useState(false);
  const [composerAnchor, setComposerAnchor] = useState<ComposerAnchor | null>(null);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const readerRef = useRef<HTMLDivElement | null>(null);
  const commentsRef = useRef<HTMLDivElement | null>(null);
  const actions = actionsFor(node.ownership);
  const isThread = item?.type === "ai_thread";

  useEffect(() => {
    return () => {
      if (typeof CSS === "undefined" || !("highlights" in CSS)) return;
      CSS.highlights?.delete("canvas-lab-selection");
    };
  }, []);

  useEffect(() => {
    if (!openComments) return;
    commentsRef.current?.scrollIntoView({ block: "start" });
  }, [openComments]);

  function captureSelection() {
    if (typeof window === "undefined") return;
    const selection = window.getSelection();
    const text = selection?.toString() ?? "";
    if (!selection || text.trim().length === 0) return;
    const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
    if (!range || !readerRef.current?.contains(range.commonAncestorContainer)) return;
    setQuote(text.trim());
    if (isThread) {
      const resolved = resolveTurnSelection(range);
      setCrossTurn(resolved.kind === "cross_turn");
      setTurnSelection(resolved.kind === "ok" ? resolved.selection : null);
    }
    if (typeof CSS === "undefined" || !("highlights" in CSS) || typeof Highlight === "undefined") return;
    CSS.highlights?.set("canvas-lab-selection", new Highlight(range.cloneRange()));
  }

  function clearSelection() {
    setTurnSelection(null);
    setQuote("");
    setComposerAnchor(null);
  }

  function goToTurn(turnNo: number | null) {
    if (turnNo === null) return;
    readerRef.current?.querySelector(`[data-turn-no="${turnNo}"]`)?.scrollIntoView({ block: "center" });
  }

  const commentMarks = threads.map((thread) => ({
    id: thread.id,
    turnNo: thread.turnNo ?? -1,
    charStart: thread.charStart ?? 0,
    charEnd: thread.charEnd ?? 0,
    stale: thread.stale,
  }));

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
              <ThreadBody item={item} enabled highlights={highlights} commentMarks={commentMarks} />
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

          <aside className="w-full shrink-0 overflow-y-auto border-t border-border bg-[var(--nb-paper)] px-4 py-4 lg:w-[320px] lg:border-l lg:border-t-0">
            {isThread ? (
              <section ref={commentsRef} className="mb-5 border-b border-border pb-4">
                <h2 className="section-title mb-2">comments</h2>
                {threads.length === 0 ? (
                  <p className="text-[11.5px] leading-[17px] text-muted-foreground">
                    {canWrite
                      ? "Select a passage, then leave a comment for the people on this engagement."
                      : "No comments on this chat yet."}
                  </p>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {threads.map((thread) => (
                      <li
                        key={thread.id}
                        className="rounded-[var(--radius-control)] border border-border bg-card px-2.5 py-2"
                      >
                        <button
                          type="button"
                          className="block w-full text-left"
                          onClick={() => goToTurn(thread.turnNo)}
                        >
                          <CommentLine comment={thread} />
                          <p className="mt-1 line-clamp-2 text-[11.5px] italic leading-[17px] text-muted-foreground">
                            &ldquo;{thread.excerpt}&rdquo;
                            {thread.stale ? " · From an earlier version" : ""}
                          </p>
                        </button>
                        {editingId === thread.id ? (
                          <CommentComposer
                            label="Edit your comment"
                            placeholder="What did you notice?"
                            initial={thread.body}
                            submitLabel="Save"
                            onSubmit={(body) => {
                              onEditComment?.(thread, body);
                              setEditingId(null);
                            }}
                            onCancel={() => setEditingId(null)}
                          />
                        ) : (
                          <p className="mt-1 text-[12px] leading-[18px] text-foreground">{thread.body}</p>
                        )}

                        {thread.replies.length > 0 ? (
                          <ul className="mt-2 flex flex-col gap-2 border-l border-border pl-2.5">
                            {thread.replies.map((reply) => (
                              <li key={reply.id}>
                                <CommentLine comment={reply} />
                                {editingId === reply.id ? (
                                  <CommentComposer
                                    label="Edit your reply"
                                    placeholder="Add a reply"
                                    initial={reply.body}
                                    submitLabel="Save"
                                    onSubmit={(body) => {
                                      onEditComment?.(reply, body);
                                      setEditingId(null);
                                    }}
                                    onCancel={() => setEditingId(null)}
                                  />
                                ) : (
                                  <p className="mt-1 text-[12px] leading-[18px] text-foreground">{reply.body}</p>
                                )}
                                {reply.isMine && editingId !== reply.id ? (
                                  <div className="flex items-center gap-1">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 px-1.5 text-[11.5px]"
                                      onClick={() => setEditingId(reply.id)}
                                    >
                                      Edit
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 px-1.5 text-[11.5px]"
                                      onClick={() => onArchiveComment?.(reply)}
                                    >
                                      Remove
                                    </Button>
                                  </div>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        ) : null}

                        {replyTo === thread.id ? (
                          <CommentComposer
                            label="Write a reply"
                            placeholder="Add a reply"
                            submitLabel="Post"
                            onSubmit={(body) => {
                              onCreateReply?.(thread.id, body);
                              setReplyTo(null);
                            }}
                            onCancel={() => setReplyTo(null)}
                          />
                        ) : (
                          <div className="mt-1 flex items-center gap-1">
                            {canWrite ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-1.5 text-[11.5px]"
                                onClick={() => setReplyTo(thread.id)}
                              >
                                Reply
                              </Button>
                            ) : null}
                            {thread.isMine && editingId !== thread.id ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 px-1.5 text-[11.5px]"
                                  onClick={() => setEditingId(thread.id)}
                                >
                                  Edit
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 px-1.5 text-[11.5px]"
                                  onClick={() => onArchiveComment?.(thread)}
                                >
                                  Remove
                                </Button>
                              </>
                            ) : null}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ) : null}

            {isThread ? (
              <section>
                <h2 className="section-title mb-2">your highlights</h2>
                {crossTurn ? (
                  <p className="mb-2 text-[11.5px] leading-[17px] text-muted-foreground">
                    Highlight one turn at a time
                  </p>
                ) : turnSelection && canWrite ? (
                  <div className="mb-2 flex items-center gap-2">
                    <Button
                      size="sm"
                      className="h-7 flex-1 px-2 text-[11.5px]"
                      onClick={() => {
                        onHighlight?.(turnSelection);
                        clearSelection();
                      }}
                    >
                      Highlight
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 flex-1 px-2 text-[11.5px]"
                      onClick={() =>
                        setComposerAnchor({
                          turnNo: turnSelection.turnNo,
                          charStart: turnSelection.charStart,
                          charEnd: turnSelection.charEnd,
                          excerpt: quote,
                        })
                      }
                    >
                      Comment
                    </Button>
                  </div>
                ) : canWrite ? (
                  <p className="mb-2 text-[11.5px] leading-[17px] text-muted-foreground">
                    Select a passage in one turn to highlight it.
                  </p>
                ) : null}

                {composerAnchor && canWrite ? (
                  <CommentComposer
                    label="Write a comment on this passage"
                    placeholder="What did you notice?"
                    quote={composerAnchor.excerpt}
                    submitLabel="Post"
                    onSubmit={(body) => {
                      onCreateComment?.(composerAnchor, body);
                      clearSelection();
                    }}
                    onCancel={() => setComposerAnchor(null)}
                  />
                ) : null}

                {highlights.length === 0 ? null : (
                  <ul className="mt-2 flex flex-col gap-2">
                    {highlights.map((highlight) => (
                      <li
                        key={highlight.id}
                        className="rounded-[var(--radius-control)] border border-border bg-card px-2.5 py-2"
                      >
                        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-soft">
                          Turn {highlight.turnNo}
                          {highlight.stale ? " · From an earlier version" : ""}
                        </span>
                        <p className="mt-1 line-clamp-2 text-[12px] leading-[18px] text-foreground">
                          {highlight.excerpt}
                        </p>
                        <div className="mt-1 flex items-center gap-1">
                          {canWrite && !highlight.stale ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-[11.5px]"
                              onClick={() =>
                                setComposerAnchor({
                                  turnNo: highlight.turnNo,
                                  charStart: highlight.charStart,
                                  charEnd: highlight.charEnd,
                                  excerpt: highlight.excerpt,
                                })
                              }
                            >
                              Comment
                            </Button>
                          ) : null}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-[11.5px]"
                            onClick={() => onRemoveHighlight?.(highlight)}
                          >
                            Remove
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ) : null}
          </aside>
        </div>
      </div>
    </div>
  );
}
