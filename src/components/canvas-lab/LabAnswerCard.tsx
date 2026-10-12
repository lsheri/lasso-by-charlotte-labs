import { stableMemo } from "@/components/canvas-lab/stable-memo";
import { MoreHorizontal } from "lucide-react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { RichTextView } from "@/components/rich-text/RichTextView";
import { plainToRichHtml } from "@/lib/rich-text";
import { logEvent } from "@/lib/telemetry";
import { MarkdownMessage } from "@/components/markdown/MarkdownMessage";
import { Button } from "@/components/ui/button";

import { answerAsOf, serializeAnswerBody } from "@/lib/answer-card";
import type { LabNode } from "@/components/canvas-lab/canvas-lab-model";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const RichTextEditor = lazy(() => import("@/components/rich-text/RichTextEditor"));
export const EDIT_COPY = { edit: "Edit", seeOriginal: "See original", hideOriginal: "Hide original", original: "Original answer", editedYou: "Edited by you", editedBy: "Edited by", saveError: "Could not save your last change." };

/** Multiset word overlap over the union, including repeated words. No content leaves this function. */
export function answerChangeBand(before: string, after: string): "format_only" | "light" | "moderate" | "heavy" {
  if (before === after) return "format_only";
  const words = (text: string) => text.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  const a = words(before); const b = words(after);
  const remaining = new Map<string, number>();
  for (const word of a) remaining.set(word, (remaining.get(word) ?? 0) + 1);
  let shared = 0;
  for (const word of b) { const count = remaining.get(word) ?? 0; if (count > 0) { shared += 1; remaining.set(word, count - 1); } }
  const all = a.length + b.length - shared;
  const difference = all === 0 ? 0 : 1 - shared / all;
  return difference < 0.15 ? "light" : difference < 0.5 ? "moderate" : "heavy";
}

export const COPY = { showAll: "Show all", showLess: "Show less" };

/**
 * An answer kept on the board. White face, lime edge, so it reads apart from
 * work and decisions at a glance. The date is read from the saved row.
 * It belongs to a workstream like any other card, or to none at all.
 */
function LabAnswerCardInner({
  node,
  focused,
  stackZ,
  onFocus,
  onPointerDown,
  onDelete,
  frameChoices = [],
  onMoveToFrame,
  onCommit,
  orgId,
}: {
  node: LabNode;
  orgId?: string | undefined;
  onCommit?: (body: string) => Promise<string | null>;
  focused: boolean;
  stackZ: number;
  onFocus: () => void;
  onPointerDown: (event: React.PointerEvent) => void;
  onDelete: () => void;
  frameChoices?: { id: string; name: string }[];
  onMoveToFrame?: ((id: string) => void) | undefined;
}) {
  const asOf = answerAsOf(node.createdAt ?? null);
  const moveTargets = onMoveToFrame ? frameChoices.filter((frame) => frame.id !== node.frame) : [];
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const [editing, setEditing] = useState(false);
  const [originalOpen, setOriginalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const draft = useRef({ html: "", plain: "", changed: false });
  const saving = useRef(false);
  const canEdit = node.ownership === "yours" && Boolean(onCommit);
  const grown = expanded || editing || originalOpen;
  function startEdit() {
    if (!canEdit || editing) return;
    draft.current = { html: node.html ?? plainToRichHtml(node.summary), plain: node.summary, changed: false };
    setError(null); setEditing(true);
  }
  async function finishEdit() {
    if (saving.current || !onCommit || !editing) return;
    const { html, plain, changed } = draft.current;
    if (!changed || (html === (node.html ?? plainToRichHtml(node.summary)) && plain === node.summary)) { setEditing(false); return; }
    saving.current = true;
    try {
      const message = await onCommit(serializeAnswerBody({ text: plain, html, original: node.original ?? node.summary, editedAt: new Date().toISOString() }));
      if (message) { setError(message); return; }
      if (orgId) {
        logEvent("workboard.node_edited", orgId, { kind: "answer" });
        logEvent("answer.edited", orgId, { change_band: answerChangeBand(node.summary, plain), first_edit: node.original == null ? "true" : "false" });
      }
      setError(null); setEditing(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : EDIT_COPY.saveError); }
    finally { saving.current = false; }
  }
  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    const measure = () => {
      if (!grown) setOverflows(body.scrollHeight > body.clientHeight + 1);
    };
    measure();
    const resize = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : undefined;
    resize?.observe(body);
    const mutations = new MutationObserver(measure);
    mutations.observe(body, { childList: true, subtree: true, characterData: true });
    return () => { resize?.disconnect(); mutations.disconnect(); };
  }, [grown, node.summary, node.html, node.width, node.height]);
  return (
    <article
      data-testid="canvas-lab-answer-card"
      tabIndex={0}
      aria-label={`Answer kept by ${node.authorName ?? "you"}`}
      onFocus={onFocus}
      onPointerDown={(event) => { if (editing) event.stopPropagation(); else onPointerDown(event); }}
      data-focused={focused ? "true" : undefined}
      data-expanded={grown ? "true" : undefined}
      data-editing={editing ? "true" : undefined}
      className="canvas-lab-answer-card absolute overflow-hidden"
      style={{ left: node.x, top: node.y, width: node.width, height: grown ? "auto" : node.height, minHeight: grown ? node.height : undefined, ...(editing ? { overflow: "visible" as const } : {}), zIndex: stackZ }}
    >
      <style>{`.canvas-lab-answer-body > .rich-text { font-size: inherit; line-height: inherit; } .canvas-lab-answer-card[data-editing="true"] .canvas-lab-answer-body { overflow: visible; } .canvas-lab-answer-card[data-editing="true"] [role="toolbar"] { bottom: calc(100% + 2.5rem); }`}</style>
      <header className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-soft">Answer</span>
        <span className="flex items-center gap-1">
          {asOf ? <span className="font-mono text-[9px] text-soft">{asOf}</span> : null}
          {moveTargets.length > 0 || canEdit ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  type="button"
                  aria-label={canEdit ? "Answer menu" : "Move answer"}
                  className="h-auto min-h-0 p-0 text-soft hover:text-foreground"
                  onPointerDown={(event) => event.stopPropagation()}
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="canvas-lab-card-menu">
                {canEdit ? <DropdownMenuItem onSelect={startEdit}>{EDIT_COPY.edit}</DropdownMenuItem> : null}
                {moveTargets.map((frame) => (
                  <DropdownMenuItem key={frame.id} onSelect={() => onMoveToFrame?.(frame.id)}>
                    Move to {frame.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </span>
      </header>
      <div ref={bodyRef} className="canvas-lab-answer-body" onDoubleClick={(event) => { event.stopPropagation(); startEdit(); }} data-overflow={overflows && !grown ? "true" : undefined}>
        {editing ? <Suspense fallback={node.html ? <RichTextView html={node.html} /> : <MarkdownMessage content={node.summary} />}><RichTextEditor initialHtml={draft.current.html} autoFocus onChange={(html, plain) => { draft.current = { html, plain, changed: true }; }} onDone={() => { void finishEdit(); }} /></Suspense> : node.html ? <RichTextView html={node.html} /> : <MarkdownMessage content={node.summary} />}
        {overflows && !grown ? <span className="canvas-lab-answer-fade" aria-hidden="true" data-testid="answer-body-fade" /> : null}
      </div>
      {overflows && !editing ? (
        <Button
          variant="ghost"
          className="canvas-lab-answer-toggle"
          aria-expanded={expanded}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => { event.stopPropagation(); setExpanded((value) => !value); }}
        >
          {expanded ? COPY.showLess : COPY.showAll}
        </Button>
      ) : null}
      {error ? <p role="alert" className="mt-1 text-[13px] text-destructive">{error}</p> : null}
      {node.original != null && !editing ? <Button variant="ghost" className="canvas-lab-answer-toggle" aria-expanded={originalOpen} onPointerDown={(event) => event.stopPropagation()} onClick={() => { if (!originalOpen && orgId) logEvent("answer.original_viewed", orgId, {}); setOriginalOpen((value) => !value); }}>{originalOpen ? EDIT_COPY.hideOriginal : EDIT_COPY.seeOriginal}</Button> : null}
      {originalOpen && node.original != null ? <section className="mt-2 border-t border-border bg-muted p-2" aria-label={EDIT_COPY.original}><h3 className="mb-1 text-[13px] text-soft">{EDIT_COPY.original}</h3><MarkdownMessage content={node.original} /></section> : null}
      <footer className="mt-2 flex items-center justify-between gap-2">
        <span className="font-mono text-[9px] text-soft">Kept by {node.authorName ?? "you"}{node.editedAt ? <> · {node.ownership === "yours" ? EDIT_COPY.editedYou : `${EDIT_COPY.editedBy} ${node.authorName ?? "you"}`}</> : null}</span>
        {node.local ? (
          <button
            type="button"
            onClick={onDelete}
            className="font-mono text-[9px] uppercase tracking-[0.08em] text-soft hover:text-foreground"
          >
            Remove
          </button>
        ) : null}
      </footer>
    </article>
  );
}

/** BB-3: memoized so typing in one card never re-renders its siblings. */
export const LabAnswerCard = stableMemo(LabAnswerCardInner);
