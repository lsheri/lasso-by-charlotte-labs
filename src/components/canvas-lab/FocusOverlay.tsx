import { ChatNotesPanel, ChatReader, useChatNotesState, type ComposerAnchor, type OverlayHighlight } from "@/components/canvas-lab/chat-notes";
import type { MentionCandidate } from "@/lib/mention-editor";
import { type Mention } from "@/lib/mention-shared";
import { displayName } from "@/lib/work-item-name";
import { useEffect, useRef, type CSSProperties } from "react";

import { actionsFor, type LabNode } from "@/components/canvas-lab/canvas-lab-model";
import { WorkboardFilePreview } from "@/components/canvas-lab/WorkboardFilePreview";
import { Spinner } from "@/components/common/Working";
import type { WorkboardFilePreview as WorkboardFilePreviewData } from "@/lib/workboard-card-preview.shared";
import { RenderedContent } from "@/components/peek/RenderedContent";
import { Button } from "@/components/ui/button";
import { SourceMark, VendorMark } from "@/components/work/SourceMark";
import type { CommentDto, CommentThreadDto } from "@/lib/canvas-lab-annotations-shared";
import type { TurnSelection } from "@/lib/turn-selection";
import { effectiveWorkDate, formatDate, type WorkItemRow } from "@/lib/work-types";
import { useWorkFileDownload } from "@/hooks/use-work-file-download";

export { CommentComposer, type OverlayHighlight } from "@/components/canvas-lab/chat-notes";

export const COPY = {
  loading: "Loading work…",
  unavailable: "This card's work could not be loaded. Please try again.",
} as const;

/**
 * Reading at full size without losing the board. The overlay sits above the
 * canvas, so the surface keeps its pan and zoom exactly where it was and
 * closing puts the person back in the same place.
 */
export function FocusOverlay({
  node,
  item,
  itemLoading = false,
  viewerOwnsItem = false,
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
  focusLabel,
  highlightTurnRange,
  focusedTurnTestId,
  closeLabel,
  mentionCandidates = [],
}: {
  mentionCandidates?: readonly MentionCandidate[];
  node: LabNode;
  item: WorkItemRow | null;
  itemLoading?: boolean;
  /** WI-1: only the owner sees the captured title beneath a chosen name. */
  viewerOwnsItem?: boolean;
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
  onCreateComment?: ((anchor: ComposerAnchor, body: string, mentions: Mention[]) => void) | undefined;
  onCreateReply?: ((parentId: string, body: string, mentions: Mention[]) => void) | undefined;
  onEditComment?: ((comment: CommentDto, body: string, mentions: Mention[]) => void) | undefined;
  onArchiveComment?: ((comment: CommentDto) => void) | undefined;
  /** Opened from a card's chip, so the panel starts at the comments. */
  openComments?: boolean;
  origin?: { left: number; top: number; width: number; height: number } | null;
  onContentScroll?: (() => void) | undefined;
  /** S3a: a shared board reads only. No Branch, no server reads. */
  readOnly?: boolean;
  /** S3a: the preview the shared board was handed, used in place of a server read. */
  filePreview?: WorkboardFilePreviewData | undefined;
  /** Unit 2: open scrolled to this turn, lit. */
  focusTurnNo?: number | null | undefined;
  focusLabel?: string | undefined;
  /** Public proof link: quietly marks the surrounding source sequence. */
  highlightTurnRange?: readonly [number, number] | undefined;
  /** Public demo tour: stable selector placed on the focused turn once found. */
  focusedTurnTestId?: string | undefined;
  /** Close button words; defaults to "Back to the workboard". */
  closeLabel?: string | undefined;
}) {
  const download = useWorkFileDownload("focus");
  const isThread = item?.type === "ai_thread";
  const notes = useChatNotesState(isThread);
  const { readerRef, captureSelection } = notes;
  const commentsRef = useRef<HTMLElement | null>(null);
  const actions = actionsFor(node.ownership);
  const originStyle = origin && typeof window !== "undefined" ? {
    "--focus-from-x": `${origin.left + origin.width / 2 - window.innerWidth / 2}px`,
    "--focus-from-y": `${origin.top + origin.height / 2 - window.innerHeight / 2}px`,
    "--focus-from-scale": String(Math.max(0.18, Math.min(0.72, origin.width / Math.min(1200, window.innerWidth - 64)))),
  } as CSSProperties : undefined;

  useEffect(() => {
    if (!focusTurnNo) return;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let lit: Element | null = null;
    const find = () => {
      const el = readerRef.current?.querySelector(`[data-turn-no="${focusTurnNo}"]`) ?? null;
      if (el) {
        const reader = readerRef.current;
        if (!reader) return;
        const readerRect = reader.getBoundingClientRect();
        const turnRect = el.getBoundingClientRect();
        reader.scrollTo({ top: reader.scrollTop + turnRect.top - readerRect.top - 96, behavior: "auto" });
        el.classList.add("nb-turn-lit");
        el.setAttribute("data-turn-focus", "true");
        if (focusLabel) el.setAttribute("data-focus-label", focusLabel);
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
      lit?.removeAttribute("data-focus-label");
      if (focusedTurnTestId) lit?.removeAttribute("data-testid");
    };
  }, [focusTurnNo, focusedTurnTestId, focusLabel]);

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
            <h1 className="page-title truncate">{item ? displayName(item) || node.title : node.title}</h1>
            {item && viewerOwnsItem && displayName(item) !== item.title ? <p data-testid="focus-captured-as" className="truncate text-[11.5px] text-muted-foreground">Captured as {item.title}</p> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
            {item && item.type === "ai_thread" ? <ChatReader item={item} notes={notes} threads={threads} highlights={highlights} onContentScroll={onContentScroll} /> : item ? (
              <div ref={readerRef} className="focus-paper-reader h-full px-5 py-4" onMouseUp={captureSelection} onKeyUp={captureSelection}>
              {readOnly ? (
                filePreview && filePreview.kind !== "fallback"
                  ? <WorkboardFilePreview preview={filePreview} title={node.title} onFailure={() => undefined} />
                  : <p className="whitespace-pre-wrap text-[13px] leading-[20px] text-foreground">{node.summary}</p>
              ) : <RenderedContent item={item} onDownload={() => void download(item)} canEdit={false} />}
              </div>
            ) : itemLoading ? (
              <div className="focus-paper-reader flex h-full items-start gap-2 px-5 py-4 text-muted-foreground" aria-live="polite" aria-busy="true">
                <Spinner />
                <p className="text-base leading-relaxed">{COPY.loading}</p>
              </div>
            ) : (
              <div ref={readerRef} className="focus-paper-reader flex h-full flex-col gap-2 px-5 py-4" onMouseUp={captureSelection} onKeyUp={captureSelection}>
                <p className="text-[13px] leading-[20px] text-foreground">{node.summary}</p>
                {node.prompt ? (
                  <p className="text-[13px] leading-[20px] text-foreground">{node.prompt}</p>
                ) : null}
                <p className="font-hand text-base leading-relaxed text-muted-foreground">
                  {COPY.unavailable}
                </p>
              </div>
            )}
          </div>

          {readOnly ? null : <aside className="focus-paper-aside w-full shrink-0 overflow-y-auto border-t border-border px-4 py-4 lg:w-[320px] lg:border-l lg:border-t-0">
            <ChatNotesPanel
              notes={notes}
              isThread={isThread}
              canWrite={canWrite}
              threads={threads}
              highlights={highlights}
              mentionCandidates={mentionCandidates}
              onHighlight={onHighlight}
              onRemoveHighlight={onRemoveHighlight}
              onSetHighlightVisibility={onSetHighlightVisibility}
              onCreateComment={onCreateComment}
              onCreateReply={onCreateReply}
              onEditComment={onEditComment}
              onArchiveComment={onArchiveComment}
              commentsRef={commentsRef}
            />
          </aside>}
        </div>
      </div>
    </div>
  );
}
