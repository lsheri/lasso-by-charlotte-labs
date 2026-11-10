import { useEffect, useRef, useState, type Ref } from "react";

import { MentionTextEditor } from "@/components/canvas-lab/MentionTextEditor";
import { ThreadBody } from "@/components/peek/ThreadBody";
import { Button } from "@/components/ui/button";
import { ChatBorderFrame } from "@/components/work/ChatPreviewWindow";
import { sourceVendorKey } from "@/components/work/SourceMark";
import type { CommentDto, CommentThreadDto } from "@/lib/canvas-lab-annotations-shared";
import { committedComment, type MentionCandidate } from "@/lib/mention-editor";
import { type Mention } from "@/lib/mention-shared";
import { resolveTurnSelection, type TurnSelection } from "@/lib/turn-selection";
import type { WorkItemRow } from "@/lib/work-types";

/*
 * T2c-1 (one view, 9 Nov): a chat's reader and its notes (comments and highlights), lifted out of the
 * focus reader so the one view shows exactly the same thing. The focus reader composes these same pieces
 * (shared boards and demos keep it). Nothing here changes what is stored or who can read it.
 */

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
export type ComposerAnchor = {
  turnNo: number;
  charStart: number;
  charEnd: number;
  excerpt: string;
};

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

export function CommentComposer({
  label,
  placeholder,
  initial = "",
  initialMentions = [],
  mentionCandidates = [],
  quote,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  label: string;
  placeholder: string;
  initial?: string;
  initialMentions?: readonly Mention[];
  mentionCandidates?: readonly MentionCandidate[];
  quote?: string | undefined;
  submitLabel: string;
  onSubmit: (body: string, mentions: Mention[]) => void;
  onCancel: () => void;
}) {
  const [body, setBody] = useState(initial);
  const [mentions, setMentions] = useState<readonly Mention[]>(initialMentions);
  const submit = () => {
    const value = committedComment(body, mentions);
    onSubmit(value.body, value.mentions);
  };
  const ready = body.trim().length > 0 && body.trim().length <= 4000;
  return (
    <div className="mt-2">
      {quote ? (
        <p className="mb-1 line-clamp-2 nb-type-small italic leading-[17px] text-muted-foreground">
          &ldquo;{quote}&rdquo;
        </p>
      ) : null}
      <MentionTextEditor
        text={body}
        mentions={mentions}
        candidates={mentionCandidates}
        maxLength={4000}
        label={label}
        placeholder={placeholder}
        className="text-base"
        onChange={(text, nextMentions) => {
          setBody(text);
          setMentions(nextMentions);
        }}
        onKeyDown={(event) => {
          if (isSubmitKey(event) && ready) {
            event.preventDefault();
            submit();
          }
        }}
      />
      <p className="mt-1 nb-type-small leading-[17px] text-muted-foreground">
        Visible to your workboard team
      </p>
      <div className="mt-1 flex items-center gap-2">
        <Button size="sm" className="h-7 px-2 nb-type-small" disabled={!ready} onClick={submit}>
          {submitLabel}
        </Button>
        <Button size="sm" variant="ghost" className="h-7 px-2 nb-type-small" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export function CommentLine({ comment }: { comment: CommentDto }) {
  return (
    <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-soft">
      {comment.authorName} · {relativeTime(comment.createdAt)}
      {comment.edited ? " · edited" : ""}
    </span>
  );
}

/** The selection and composer state a chat's reader and its notes share. */
export function useChatNotesState(isThread: boolean, resetKey: string | null = null) {
  const [quote, setQuote] = useState("");
  const [turnSelection, setTurnSelection] = useState<TurnSelection | null>(null);
  const [crossTurn, setCrossTurn] = useState(false);
  const [composerAnchor, setComposerAnchor] = useState<ComposerAnchor | null>(null);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [heldKey, setHeldKey] = useState(resetKey);
  const readerRef = useRef<HTMLDivElement | null>(null);

  // The one view steps from chat to chat without unmounting the board: a new chat starts with no
  // selection, no open composer and no reply in progress.
  if (heldKey !== resetKey) {
    setHeldKey(resetKey);
    setQuote("");
    setTurnSelection(null);
    setCrossTurn(false);
    setComposerAnchor(null);
    setReplyTo(null);
    setEditingId(null);
    if (typeof CSS !== "undefined" && "highlights" in CSS)
      CSS.highlights?.delete("canvas-lab-selection");
  }

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
    if (isThread) {
      const resolved = resolveTurnSelection(range);
      setCrossTurn(resolved.kind === "cross_turn");
      setTurnSelection(resolved.kind === "ok" ? resolved.selection : null);
    }
    if (typeof CSS === "undefined" || !("highlights" in CSS) || typeof Highlight === "undefined")
      return;
    CSS.highlights?.set("canvas-lab-selection", new Highlight(range.cloneRange()));
  }

  function clearSelection() {
    setTurnSelection(null);
    setQuote("");
    setComposerAnchor(null);
  }

  function goToTurn(turnNo: number | null) {
    if (turnNo === null) return;
    readerRef.current
      ?.querySelector(`[data-turn-no="${turnNo}"]`)
      ?.scrollIntoView({ block: "center" });
  }

  return {
    quote,
    turnSelection,
    crossTurn,
    composerAnchor,
    setComposerAnchor,
    replyTo,
    setReplyTo,
    editingId,
    setEditingId,
    readerRef,
    captureSelection,
    clearSelection,
    goToTurn,
  };
}

export type ChatNotesState = ReturnType<typeof useChatNotesState>;

export type ChatNotesHandlers = {
  onHighlight?: ((selection: TurnSelection) => void) | undefined;
  onRemoveHighlight?: ((highlight: OverlayHighlight) => void) | undefined;
  /** The author alone flips one of their own between shared and just them. */
  onSetHighlightVisibility?:
    ((highlight: OverlayHighlight, visibility: "just_me" | "engagement") => void) | undefined;
  onCreateComment?:
    ((anchor: ComposerAnchor, body: string, mentions: Mention[]) => void) | undefined;
  onCreateReply?: ((parentId: string, body: string, mentions: Mention[]) => void) | undefined;
  onEditComment?: ((comment: CommentDto, body: string, mentions: Mention[]) => void) | undefined;
  onArchiveComment?: ((comment: CommentDto) => void) | undefined;
};

/** A chat's comments and highlights: the focus reader's side column and the one view's Comments tab. */
export function ChatNotesPanel({
  notes,
  isThread,
  canWrite,
  threads,
  highlights,
  mentionCandidates,
  onHighlight,
  onRemoveHighlight,
  onSetHighlightVisibility,
  onCreateComment,
  onCreateReply,
  onEditComment,
  onArchiveComment,
  commentsRef,
}: ChatNotesHandlers & {
  notes: ChatNotesState;
  isThread: boolean;
  canWrite: boolean;
  threads: readonly CommentThreadDto[];
  highlights: readonly OverlayHighlight[];
  mentionCandidates: readonly MentionCandidate[];
  commentsRef?: Ref<HTMLElement> | undefined;
}) {
  const {
    quote,
    turnSelection,
    crossTurn,
    composerAnchor,
    setComposerAnchor,
    replyTo,
    setReplyTo,
    editingId,
    setEditingId,
    clearSelection,
    goToTurn,
  } = notes;
  // A teammate's shared highlight is listed, not drawn over the reader's text.
  const myHighlights = highlights.filter((highlight) => highlight.isMine !== false);
  const teamHighlights = highlights.filter((highlight) => highlight.isMine === false);
  return (
    <>
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
                      mentionCandidates={mentionCandidates}
                      label="Edit your comment"
                      placeholder="What did you notice?"
                      initial={thread.body}
                      initialMentions={thread.mentions ?? []}
                      submitLabel="Save"
                      onSubmit={(body, mentions) => {
                        onEditComment?.(thread, body, mentions);
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
                              mentionCandidates={mentionCandidates}
                              label="Edit your reply"
                              placeholder="Add a reply"
                              initial={reply.body}
                              initialMentions={reply.mentions ?? []}
                              submitLabel="Save"
                              onSubmit={(body, mentions) => {
                                onEditComment?.(reply, body, mentions);
                                setEditingId(null);
                              }}
                              onCancel={() => setEditingId(null)}
                            />
                          ) : (
                            <p className="mt-1 text-[12px] leading-[18px] text-foreground">
                              {reply.body}
                            </p>
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
                      mentionCandidates={mentionCandidates}
                      label="Write a reply"
                      placeholder="Add a reply"
                      submitLabel="Post"
                      onSubmit={(body, mentions) => {
                        onCreateReply?.(thread.id, body, mentions);
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
              mentionCandidates={mentionCandidates}
              label="Write a comment on this passage"
              placeholder="What did you notice?"
              quote={composerAnchor.excerpt}
              submitLabel="Post"
              onSubmit={(body, mentions) => {
                onCreateComment?.(composerAnchor, body, mentions);
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
                        : "Visible to your workboard team"}
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
    </>
  );
}

/** A chat's full conversation, where a selection anchors a highlight or a comment to one turn. */
export function ChatReader({
  item,
  notes,
  threads,
  highlights,
  onContentScroll,
  vendorKey,
}: {
  item: WorkItemRow;
  /** The border's vendor treatment; null keeps a vendor-neutral workspace neutral. Defaults to the chat's own. */
  vendorKey?: string | null | undefined;
  notes: ChatNotesState;
  threads: readonly CommentThreadDto[];
  highlights: readonly OverlayHighlight[];
  onContentScroll?: (() => void) | undefined;
}) {
  const scrollNotedRef = useRef(false);
  const commentMarks = threads.map((thread) => ({
    id: thread.id,
    turnNo: thread.turnNo ?? -1,
    charStart: thread.charStart ?? 0,
    charEnd: thread.charEnd ?? 0,
    stale: thread.stale,
  }));
  const myHighlights = highlights.filter((highlight) => highlight.isMine !== false);
  return (
    <ChatBorderFrame
      vendorKey={vendorKey === undefined ? sourceVendorKey(item) : vendorKey}
      mode="expanded"
      testId="workboard-expanded-conversation"
      bodyRef={notes.readerRef}
      onScroll={() => {
        if (scrollNotedRef.current) return;
        scrollNotedRef.current = true;
        onContentScroll?.();
      }}
      onMouseUp={notes.captureSelection}
      onKeyUp={notes.captureSelection}
    >
      <ThreadBody
        item={item}
        enabled
        highlights={myHighlights}
        commentMarks={commentMarks}
        hideVendor={vendorKey === null}
      />
    </ChatBorderFrame>
  );
}
