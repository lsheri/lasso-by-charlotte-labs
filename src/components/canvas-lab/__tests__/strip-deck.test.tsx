// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useRef, useState } from 'react';
import { DeckStrip, DeckStripFace } from '../DeckStrip';
import { deckSlidesBand } from '../canvas-lab-telemetry';
import { WORKBOARD_EVENT_DIMS } from '@/lib/workboard-event-allowlist';
import { NO_PREVIEW_COPY } from '@/design/reference/NoPreview';
vi.mock('@/lib/telemetry', () => ({ logEvent: vi.fn() }));
import { logEvent } from '@/lib/telemetry';
const content = { kind: 'deck' as const, slides: [{ title: 'First', bullets: ['A'] }, { title: 'Second', bullets: ['B'] }] };
afterEach(() => { cleanup(); vi.clearAllMocks(); });
describe('STRIP', () => {
  it('renders one page per existing slide with its title and bullets', () => {
    render(<DeckStripFace content={content} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    for (const slide of content.slides) {
      expect(screen.getByRole('heading', { name: slide.title })).toBeTruthy();
      expect(screen.getByText(slide.bullets[0] ?? '')).toBeTruthy();
    }
  });
  it('uses FACE-2 rather than an empty strip, retaining the reason', () => {
    render(<DeckStripFace content={{ kind: 'deck', slides: [] }} reason="refused" />);
    expect(screen.getByText(NO_PREVIEW_COPY.refused)).toBeTruthy();
    expect(screen.queryByRole('list')).toBeNull();
  });
  it('expands locally without calling any board handler or changing geometry', () => {
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
    const writeBoard = vi.fn();
    const node = Object.freeze({ x: 40, y: 70, width: 232, height: 170 });
    function Harness() {
      const ref = useRef<HTMLDivElement>(null);
      const [open, setOpen] = useState(false);
      return <div className="canvas-lab-surface"><div ref={ref} data-testid="card" style={{ left: node.x, top: node.y, width: node.width, height: node.height }}>
        <DeckStrip content={content} cardRef={ref} expanded={open} onExpandedChange={setOpen} orgId="org" />
        <button onClick={writeBoard}>Save geometry</button>
      </div></div>;
    }
    render(<Harness />);
    const before = screen.getByTestId('card').getAttribute('style');
    fireEvent.click(screen.getByRole('button', { name: 'Expand deck' }));
    expect(document.querySelector('[data-deck-strip]')).toBeTruthy();
    expect(screen.getByTestId('card').getAttribute('style')).toBe(before);
    expect(writeBoard).not.toHaveBeenCalled();
    expect(logEvent).toHaveBeenLastCalledWith('workboard.deck_expanded', 'org', { state: 'open', slides_band: '1_5' });
    fireEvent.click(screen.getAllByRole('button', { name: 'Collapse deck' })[1] as HTMLElement);
    expect(document.querySelector('[data-deck-strip]')).toBeNull();
    expect(logEvent).toHaveBeenLastCalledWith('workboard.deck_expanded', 'org', { state: 'closed', slides_band: '1_5' });
    expect(writeBoard).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
  it.each([[1, '1_5'], [5, '1_5'], [6, '6_10'], [10, '6_10'], [11, '11_20'], [20, '11_20'], [21, '21_plus'], [40, '21_plus']])('bands %s slides as %s', (count, band) => {
    expect(deckSlidesBand(Number(count))).toBe(band);
  });
  it('registers the additive event in the allowlist and type union', () => {
    expect(WORKBOARD_EVENT_DIMS['workboard.deck_expanded']).toEqual(['state', 'slides_band']);
    expect(readFileSync('src/lib/telemetry-shared.ts', 'utf8')).toContain('| "workboard.deck_expanded"');
  });
});