import { useEffect, useRef, useState, type CSSProperties } from "react";

import { actionsFor, type LabNode } from "@/components/canvas-lab/canvas-lab-model";
import { WorkboardFilePreview } from "@/components/canvas-lab/WorkboardFilePreview";
import type { WorkboardFilePreview as WorkboardFilePreviewData } from "@/lib/workboard-card-preview.shared";
import { RenderedContent } from "@/components/peek/RenderedContent";
import { ThreadBody } from "@/components/peek/ThreadBody";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ChatBorderFrame } from "@/components/work/ChatPreviewWindow";
import { SourceMark, sourceVendorKey, VendorMark } from "@/components/work/SourceMark";
import type { CommentDto, CommentThreadDto } from "@/lib/canvas-lab-annotations-shared";
import { resolveTurnSelection, type TurnSelection } from "@/lib/turn-selection";
import { effectiveWorkDate, formatDate, type WorkItemRow } from "@/lib/work-types";

/** One saved highlight, already told whether its turn has moved on. */
export type OverlayHighlight = {
  id: string;
  turnNo: number;
  charStart: number;
  charEnd: number;
  excerpt: string;
  stale: boolean;
  version: number;
  /** Teammate visibility: who can read this one, and who made it. */
  visibility?: "just_me" | "engagement";
  isMine?: boolean;
  authorName?: string;
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
        <p className="mb-1 line-clamp-2 nb-type-small italic leading-[17px] text-muted-foreground">
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
      <p className="mt-1 nb-type-small leading-[17px] text-muted-foreground">
        Visible to your engagement team
      </p>
      <div className="mt-1 flex items-center gap-2">
        <Button size="sm" className="h-7 px-2 nb-type-small" disabled={!ready} onClick={() => onSubmit(body.trim())}>
          {submitLabel}
        </Button>
        <Button size="sm" variant="ghost" className="h-7 px-2 nb-type-small" onClick={onCancel}>
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
  onSetHighlightVisibility,
  threads = [],
  canWrite = false,
  onCreateComment,
  onCreateReply,
  onEditComment,
  onArchiveComment,
  openComments = false,
  origin,
  onContentScroll,
  readOnly = false,
  filePreview,
  focusTurnNo,
  highlightTurnRange,
  focusedTurnTestId,
  closeLabel,
}: {
  node: LabNode;
  item: WorkItemRow | null;
  onSummarize: () => void;
  onBranch: () => void;
  onClose: () => void;
  /** Slice 2a: highlights on this chat the reader is allowed to see. */
  highlights?: readonly OverlayHighlight[];
  onHighlight?: ((selection: TurnSelection) => void) | undefined;
  onRemoveHighlight?: ((highlight: OverlayHighlight) => void) | undefined;
  /** The author alone flips one of their own between shared and just them. */
  onSetHighlightVisibility?:
    | ((highlight: OverlayHighlight, visibility: "just_me" | "engagement") => void)
    | undefined;

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
  origin?: { left: number; top: number; width: number; height: number } | null;
  onContentScroll?: (() => void) | undefined;
  /** S3a: a shared board reads only. No Summarize, no Branch, no server reads. */
  readOnly?: boolean;
  /** S3a: the preview the shared board was handed, used in place of a server read. */
  filePreview?: WorkboardFilePreviewData | undefined;
  /** Unit 2: open scrolled to this turn, lit. */
  focusTurnNo?: number | null | undefined;
  /** Public proof link: quietly marks the surrounding source sequence. */
  highlightTurnRange?: readonly [number, number] | undefined;
  /** Public demo tour: stable selector placed on the focused turn once found. */
  focusedTurnTestId?: string | undefined;
  /** Close button words; defaults to "Back to the workboard". */
  closeLabel?: string | undefined;
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
  const scrollNotedRef = useRef(false);
  const originStyle = origin && typeof window !== "undefined" ? {
    "--focus-from-x": `${origin.left + origin.width / 2 - window.innerWidth / 2}px`,
    "--focus-from-y": `${origin.top + origin.height / 2 - window.innerHeight / 2}px`,
    "--focus-from-scale": String(Math.max(0.18, Math.min(0.72, origin.width / Math.min(1200, window.innerWidth - 64)))),
  } as CSSProperties : undefined;

  useEffect(() => {
    return () => {
      if (typeof CSS === "undefined" || !("highlights" in CSS)) return;
      CSS.highlights?.delete("canvas-lab-selection");
    };
  }, []);

  useEffect(() => {
    if (!focusTurnNo) return;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let lit: Element | null = null;
    const find = () => {
      const el = readerRef.current?.querySelector(`[data-turn-no="${focusTurnNo}"]`) ?? null;
      if (el) {
        el.scrollIntoView({ block: "center" });
        el.classList.add("nb-turn-lit");
        el.setAttribute("data-turn-focus", "true");
        if (focusedTurnTestId) el.setAttribute("data-testid", focusedTurnTestId);
        lit = el;
        return;
      }
      tries += 1;
      if (tries < 40) timer = setTimeout(find, 100);
    };
    find();
    return () => {
      if (timer) clearTimeout(timer);
      lit?.classList.remove("nb-turn-lit");
      lit?.removeAttribute("data-turn-focus");
      if (focusedTurnTestId) lit?.removeAttribute("data-testid");
    };
  }, [focusTurnNo, focusedTurnTestId]);

  useEffect(() => {
    if (!highlightTurnRange) return;
    const [from, to] = highlightTurnRange;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let marked: Element[] = [];
    const find = () => {
      marked = Array.from(readerRef.current?.querySelectorAll("[data-turn-no]") ?? []).filter((element) => {
        const turn = Number(element.getAttribute("data-turn-no"));
        return turn >= from && turn <= to;
      });
      if (marked.length > 0) {
        marked.forEach((element) => element.classList.add("nb-turn-proof-range"));
        return;
      }
      tries += 1;
      if (tries < 40) timer = setTimeout(find, 100);
    };
    find();
    return () => {
      if (timer) clearTimeout(timer);
      marked.forEach((element) => element.classList.remove("nb-turn-proof-range"));
    };
  }, [highlightTurnRange]);

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

  // A teammate's shared highlight is listed, not drawn over the reader's text.
  const myHighlights = highlights.filter((highlight) => highlight.isMine !== false);
  const teamHighlights = highlights.filter((highlight) => highlight.isMine === false);


  return (
    <div className="focus-paper-backdrop">
      <div className="focus-paper" style={originStyle}>
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
          <div className="min-w-0">
            <span className="flex min-w-0 items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
              {item ? <SourceMark item={item} size={14} disc /> : null}
              {item ? <VendorMark item={item} /> : node.typeLabel}
              {item ? <> · {formatDate(effectiveWorkDate(item))}</> : null}
            </span>
            <h1 className="page-title truncate">{node.title}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!readOnly && actions.includes("Summarize") ? (
              <Button size="sm" variant="outline" onClick={onSummarize}>
                Summarize
              </Button>
            ) : null}
            {!readOnly && actions.includes("Branch") ? (
              <Button size="sm" variant="outline" onClick={onBranch}>
                Branch
              </Button>
            ) : null}
            <Button data-testid={readOnly ? "demo-reader-close" : undefined} size="sm" variant="ghost" onClick={onClose}>
              {closeLabel ?? "Back to the workboard"}
            </Button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden lg:flex-row">
          <div className="min-h-0 flex-1 p-[var(--nb-preview-inset)]">
            {item && item.type === "ai_thread" ? <ChatBorderFrame
              vendorKey={sourceVendorKey(item)}
              mode="expanded"
              testId="workboard-expanded-conversation"
              bodyRef={readerRef}
              onScroll={() => {
                if (scrollNotedRef.current) return;
                scrollNotedRef.current = true;
                onContentScroll?.();
              }}
              onMouseUp={captureSelection}
              onKeyUp={captureSelection}
            >
              <ThreadBody item={item} enabled highlights={myHighlights} commentMarks={commentMarks} />
            </ChatBorderFrame> : item ? (
              <div ref={readerRef} className="focus-paper-reader h-full px-5 py-4" onMouseUp={captureSelection} onKeyUp={captureSelection}>
              {readOnly ? (
                filePreview && filePreview.kind !== "fallback"
                  ? <WorkboardFilePreview preview={filePreview} title={node.title} onFailure={() => undefined} />
                  : <p className="whitespace-pre-wrap text-[13px] leading-[20px] text-foreground">{node.summary}</p>
              ) : <RenderedContent item={item} onDownload={() => undefined} canEdit={false} />}
              </div>
            ) : (
              <div ref={readerRef} className="focus-paper-reader flex h-full flex-col gap-2 px-5 py-4" onMouseUp={captureSelection} onKeyUp={captureSelection}>
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

          {readOnly ? null : <aside className="focus-paper-aside w-full shrink-0 overflow-y-auto border-t border-border px-4 py-4 lg:w-[320px] lg:border-l lg:border-t-0">
            {isThread ? (
              <section ref={commentsRef} className="mb-5 border-b border-border pb-4">
                <h2 className="section-title mb-2">comments</h2>
                {threads.length === 0 ? (
                  <p className="nb-type-small leading-[17px] text-muted-foreground">
                    {canWrite
                      ? "Select a passage, then leave a comment for people who can open this chat."
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
                          <p className="mt-1 line-clamp-2 nb-type-small italic leading-[17px] text-muted-foreground">
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
                                      className="h-6 px-1.5 nb-type-small"
                                      onClick={() => setEditingId(reply.id)}
                                    >
                                      Edit
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 px-1.5 nb-type-small"
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
                                className="h-6 px-1.5 nb-type-small"
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
                                  className="h-6 px-1.5 nb-type-small"
                                  onClick={() => setEditingId(thread.id)}
                                >
                                  Edit
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 px-1.5 nb-type-small"
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
                  <p className="mb-2 nb-type-small leading-[17px] text-muted-foreground">
                    Highlight one turn at a time
                  </p>
                ) : turnSelection && canWrite ? (
                  <div className="mb-2 flex items-center gap-2">
                    <Button
                      size="sm"
                      className="h-7 flex-1 px-2 nb-type-small"
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
                      className="h-7 flex-1 px-2 nb-type-small"
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
                  <p className="mb-2 nb-type-small leading-[17px] text-muted-foreground">
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

                {myHighlights.length === 0 ? null : (
                  <ul className="mt-2 flex flex-col gap-2">
                    {myHighlights.map((highlight) => (
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
                              className="h-7 px-2 nb-type-small"
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
                            className="h-7 px-2 nb-type-small"
                            onClick={() => onRemoveHighlight?.(highlight)}
                          >
                            Remove
                          </Button>
                        </div>
                        {onSetHighlightVisibility ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="mt-1 h-6 px-1.5 nb-type-small text-muted-foreground"
                            aria-pressed={highlight.visibility !== "just_me"}
                            onClick={() =>
                              onSetHighlightVisibility(
                                highlight,
                                highlight.visibility === "just_me" ? "engagement" : "just_me",
                              )
                            }
                          >
                            {highlight.visibility === "just_me"
                              ? "Just me"
                              : "Visible to your engagement team"}
                          </Button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}

                {teamHighlights.length === 0 ? null : (
                  <>
                    <h2 className="section-title mb-2 mt-4">shared by your team</h2>
                    <ul className="flex flex-col gap-2">
                      {teamHighlights.map((highlight) => (
                        <li
                          key={highlight.id}
                          className="rounded-[var(--radius-control)] border border-border bg-card px-2.5 py-2"
                        >
                          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-soft">
                            {highlight.authorName ?? "A colleague"} · Turn {highlight.turnNo}
                            {highlight.stale ? " · From an earlier version" : ""}
                          </span>
                          <p className="mt-1 line-clamp-2 text-[12px] leading-[18px] text-foreground">
                            {highlight.excerpt}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </section>

            ) : null}
          </aside>}
        </div>
      </div>
    </div>
  );
}
