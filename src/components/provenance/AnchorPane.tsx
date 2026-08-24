import { useRef, useState } from "react";

import { ReextractAction } from "@/components/peek/ReextractAction";
import { ChatUrlLink } from "@/components/work/ChatUrlLink";
import { Button } from "@/components/ui/button";
import type { AuditPaneItem, AuditStitch } from "@/lib/span-provenance.functions";
import {
  countOccurrences,
  findSnippetOffset,
  MIN_SNIPPET_CHARS,
  sectionsFromText,
  spanStatusLabel,
  spanVerificationLine,
  type SpanLocator,
} from "@/lib/span-provenance-shared";
import { TITLE_ONLY_LINE } from "@/lib/text-status";

const DEFAULT_QUESTION = "Where did this come from?";

type Placed = { stitch: AuditStitch; start: number; end: number };

/** The stitches that still anchor in this section, in text order. */
function placeStitches(sectionText: string, index: number, stitches: AuditStitch[]): Placed[] {
  return stitches
    .filter((stitch) => stitch.locator?.index === index)
    .map((stitch) => {
      const at = findSnippetOffset(
        sectionText,
        stitch.locator.snippet,
        stitch.locator.occurrence ?? 1,
      );
      return at ? { stitch, start: at.start, end: at.end } : null;
    })
    .filter((placed): placed is Placed => placed !== null)
    .sort((a, b) => a.start - b.start);
}

function StitchChip({
  stitch,
  onGoToSource,
}: {
  stitch: AuditStitch;
  onGoToSource: (stitch: AuditStitch) => void;
}) {
  return (
    <div className="mt-2 rounded-[var(--radius-md)] border border-border bg-card px-3 py-2">
      <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
        {spanStatusLabel(stitch.status)}
        {stitch.to_item_title ? ` · ${stitch.to_item_title}` : ""}
        {stitch.to_turn_no ? ` · turn ${stitch.to_turn_no}` : ""}
      </p>
      {stitch.quote ? (
        <blockquote className="mt-1.5 border-l-2 border-accent pl-2 text-sm text-foreground">
          {stitch.quote}
        </blockquote>
      ) : null}
      <p className="mt-1.5 text-xs text-muted-foreground">
        {spanVerificationLine(stitch.verification, stitch.verification_note)}
      </p>
      <div className="mt-1.5 flex flex-wrap items-center gap-3">
        {stitch.to_item_id ? (
          <button
            type="button"
            onClick={() => onGoToSource(stitch)}
            className="text-xs font-medium text-accent-deep transition-opacity hover:opacity-70"
          >
            Show me where
          </button>
        ) : null}
        {stitch.to_item_url ? (
          <ChatUrlLink item={{ source_meta: { url: stitch.to_item_url } } as never} />
        ) : null}
        {stitch.asked_by_name ? (
          <span className="text-[11px] text-muted-foreground">
            Asked by {stitch.asked_by_name}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The deliverable's own captured record, sectioned by the structure the stored
 * text actually has. Selecting inside a section offers the one question this
 * view exists to answer.
 */
export function AnchorPane({
  anchor,
  canEdit,
  stitches,
  viewerProfileId,
  busy,
  onAsk,
  onGoToSource,
}: {
  anchor: AuditPaneItem;
  canEdit: boolean;
  stitches: AuditStitch[];
  viewerProfileId: string | null;
  busy: boolean;
  onAsk: (locator: SpanLocator, question: string) => void;
  onGoToSource: (stitch: AuditStitch) => void;
}) {
  const paneRef = useRef<HTMLDivElement>(null);
  const [pending, setPending] = useState<{ locator: SpanLocator; question: string } | null>(null);

  const sections = anchor.text ? sectionsFromText(anchor.text) : [];
  const placedIds = new Set(
    sections.flatMap((section) =>
      placeStitches(section.text, section.index, stitches).map((placed) => placed.stitch.id),
    ),
  );
  const orphans = stitches.filter((stitch) => !placedIds.has(stitch.id));

  function captureSelection() {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return;
    const snippet = selection.toString().trim();
    if (snippet.length < MIN_SNIPPET_CHARS) return;
    const range = selection.getRangeAt(0);
    const holder = (range.startContainer.parentElement ?? null)?.closest<HTMLElement>(
      "[data-section-index]",
    );
    if (!holder || !paneRef.current?.contains(holder)) return;

    const sectionIndex = Number(holder.dataset["sectionIndex"]);
    const unit = (holder.dataset["sectionUnit"] as SpanLocator["unit"]) ?? "section";
    const sectionText = holder.textContent ?? "";

    // Which instance of this wording was selected: everything up to the end of
    // the selection, counted. Offsets stay advisory, the snippet is authoritative.
    const prefix = document.createRange();
    prefix.selectNodeContents(holder);
    prefix.setEnd(range.endContainer, range.endOffset);
    const occurrence = Math.max(1, countOccurrences(prefix.toString(), snippet));

    setPending({
      locator: {
        unit,
        index: Number.isFinite(sectionIndex) ? sectionIndex : 1,
        snippet,
        occurrence,
        start: sectionText.indexOf(snippet),
        end: sectionText.indexOf(snippet) + snippet.length,
      },
      question: DEFAULT_QUESTION,
    });
  }

  if (!anchor.text) {
    return (
      <div className="space-y-3">
        <p className="micro-label micro-label-structural">{anchor.title}</p>
        <p className="text-sm text-muted-foreground">{TITLE_ONLY_LINE}</p>
        {canEdit ? <ReextractAction workItemId={anchor.id} /> : null}
      </div>
    );
  }

  return (
    <div className="space-y-3" ref={paneRef}>
      <div>
        <p className="micro-label micro-label-structural">{anchor.title}</p>
        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
          {anchor.date_line}
        </p>
      </div>

      {sections.map((section) => {
        const placed = placeStitches(section.text, section.index, stitches);
        const parts: React.ReactNode[] = [];
        let cursor = 0;
        placed.forEach((entry, i) => {
          if (entry.start > cursor) parts.push(section.text.slice(cursor, entry.start));
          parts.push(
            <mark
              key={`${entry.stitch.id}-${i}`}
              className="rounded-[3px] bg-accent-soft px-0.5 text-foreground"
            >
              {section.text.slice(entry.start, entry.end)}
            </mark>,
          );
          cursor = entry.end;
        });
        if (cursor < section.text.length) parts.push(section.text.slice(cursor));

        return (
          <section key={`${section.unit}-${section.index}`} className="space-y-1.5">
            <p className="micro-label micro-label-field">{section.label}</p>
            <div
              data-section-index={section.index}
              data-section-unit={section.unit}
              onMouseUp={captureSelection}
              className={`whitespace-pre-wrap text-sm leading-relaxed text-foreground ${
                busy ? "animate-pulse" : ""
              }`}
            >
              {parts.length > 0 ? parts : section.text}
            </div>
            {placed.map((entry) => (
              <StitchChip key={entry.stitch.id} stitch={entry.stitch} onGoToSource={onGoToSource} />
            ))}
          </section>
        );
      })}

      {orphans.length > 0 ? (
        <div className="rounded-[var(--radius-md)] border border-dashed border-border px-3 py-3">
          <p className="micro-label micro-label-field">Previously asked</p>
          <p className="mt-1 text-xs text-muted-foreground">
            This wording is no longer in the text, so these answers are kept here rather than placed
            in the wrong spot.
          </p>
          {orphans.map((stitch) => (
            <StitchChip key={stitch.id} stitch={stitch} onGoToSource={onGoToSource} />
          ))}
        </div>
      ) : null}

      {pending ? (
        <div className="sticky bottom-2 rounded-[var(--radius-md)] border border-border bg-card p-3 shadow-lg">
          <p className="text-xs text-muted-foreground">
            {pending.locator.snippet.slice(0, 160)}
            {pending.locator.snippet.length > 160 ? "…" : ""}
          </p>
          <textarea
            value={pending.question}
            onChange={(event) =>
              setPending((prev) => (prev ? { ...prev, question: event.target.value } : prev))
            }
            rows={2}
            className="mt-2 w-full resize-none rounded-[var(--radius-md)] border border-border bg-background px-2 py-1.5 text-sm text-foreground"
          />
          <div className="mt-2 flex items-center gap-3">
            <Button
              type="button"
              size="sm"
              disabled={busy || !viewerProfileId}
              onClick={() => {
                onAsk(pending.locator, pending.question.trim() || DEFAULT_QUESTION);
                setPending(null);
              }}
            >
              {busy ? "Reading the record…" : DEFAULT_QUESTION}
            </Button>
            <button
              type="button"
              onClick={() => setPending(null)}
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
