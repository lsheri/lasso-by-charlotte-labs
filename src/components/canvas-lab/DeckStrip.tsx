import { useLayoutEffect, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import type { WorkContent } from '@/design/reference/work-types';
import { NoPreview } from '@/design/reference/NoPreview';
import type { NoPreviewReason } from '@/lib/workboard-card-preview.shared';
import { Button } from '@/components/ui/button';
import { GraphiteIcon } from '@/components/notebook/icons';
import { noteWorkboardDeckExpanded } from './canvas-lab-telemetry';

export const COPY = { open: 'Expand deck', close: 'Collapse deck', pages: 'Deck slides' };

export function DeckStripFace({ content, reason = 'no_text', contextAvailable = false }: {
  content: Extract<WorkContent, { kind: 'deck' }>;
  reason?: NoPreviewReason;
  contextAvailable?: boolean;
}) {
  if (!content.slides.length) return <NoPreview reason={reason} contextAvailable={contextAvailable} />;
  return <div className="deck-strip-pages" role="list" aria-label={COPY.pages}>
    {content.slides.map((slide, i) => <article className="deck-strip-page" role="listitem" key={i}>
      <h3>{slide.title}</h3>
      <ul>{slide.bullets?.map((bullet, n) => <li key={n}>{bullet}</li>)}</ul>
    </article>)}
  </div>;
}

/** Local view furniture outside the measured paper, never a board mutation. */
export function DeckStrip({ content, cardRef, expanded, onExpandedChange, orgId }: {
  content: Extract<WorkContent, { kind: 'deck' }>;
  cardRef: RefObject<HTMLDivElement | null>;
  expanded: boolean;
  onExpandedChange: (open: boolean) => void;
  orgId?: string;
}) {
  const [box, setBox] = useState({ width: 0, left: 0 });
  useLayoutEffect(() => {
    if (!expanded) return;
    const card = cardRef.current;
    const canvas = card?.closest('.canvas-lab-surface');
    if (!card || !canvas) return;
    const measure = () => {
      const cr = card.getBoundingClientRect();
      const vr = canvas.getBoundingClientRect();
      const scale = cr.width / card.offsetWidth;
      if (!Number.isFinite(scale) || scale <= 0) return;
      const width = Math.min(content.slides.length * 336 + 16, Math.max(0, vr.width - 24) / scale);
      const left = Math.max(vr.left + 12 - cr.left, Math.min(0, vr.right - 12 - cr.left - width * scale)) / scale;
      setBox({ width, left });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(canvas);
    const stage = card.parentElement;
    const mutation = new MutationObserver(measure);
    if (stage) mutation.observe(stage, { attributes: true, attributeFilter: ['style'] });
    window.addEventListener('resize', measure);
    return () => { observer.disconnect(); mutation.disconnect(); window.removeEventListener('resize', measure); };
  }, [expanded, cardRef, content.slides.length]);
  if (!content.slides.length) return null;
  const label = expanded ? COPY.close : COPY.open;
  const toggle = () => {
    onExpandedChange(!expanded);
    noteWorkboardDeckExpanded(orgId, expanded ? 'closed' : 'open', content.slides.length);
  };
  return <>
    <Button type="button" size="icon" variant="ghost" className="canvas-lab-card-open" title={label} aria-label={label} aria-expanded={expanded}
      onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); toggle(); }}>
      <GraphiteIcon name={expanded ? 'minus' : 'workstreams'} size={17} animate={false} />
    </Button>
    {expanded && cardRef.current ? createPortal(<div data-deck-strip className="deck-strip" style={{ width: box.width, left: box.left }}
      onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()} onWheel={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <header><Button type="button" size="icon" variant="ghost" title={COPY.close} aria-label={COPY.close} onClick={toggle}><GraphiteIcon name="minus" size={17} animate={false} /></Button></header>
      <div className="deck-strip-scroll" tabIndex={0} aria-label={COPY.pages}><DeckStripFace content={content} /></div>
    </div>, cardRef.current) : null}
  </>;
}