// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { slidesFromMap } from '../workboard-file-preview';
import { workToBoardCard } from '../work-board-card';
import { RealPreview } from '@/design/reference/RealPreview';
import type { WorkItemRow } from '../work-types';
import type { WorkboardFilePreview } from '../workboard-card-preview.shared';

const slides = [{ title: 'Opening', bullets: ['First bullet'], notes: 'Speaker detail' }, { title: 'Closing', bullets: ['Next step'] }];
const item = (value: unknown = slides): WorkItemRow => ({
  id: 'deck', title: 'Deck', type: 'deck', source: 'mcp:claude', visibility: 'mapped',
  captured_at: '2026-10-24T00:00:00Z', content_ref: null, work_item_tasks: [],
  source_meta: { rendition: { slides: value } }, work_item_extracts: [{ summary: 'Fallback prose' }],
});
afterEach(cleanup);
describe('DECK-SHAPE-1', () => {
  it('keeps notes separate from bullets', () => {
    expect(slidesFromMap({ slides })[0]).toEqual({ title: 'Opening', lines: ['First bullet'], notes: 'Speaker detail' });
    expect(slidesFromMap({ slides })[1]?.notes).toBeNull();
  });
  it('adapts structured slides without a file', () => {
    expect(workToBoardCard(item()).content).toEqual({ kind: 'deck', slides });
  });
  it.each([[], 'run together text', { title: 'Wrong shape' }, ['run together text'], [{ notes: 'Only notes' }], [{ title: 'Bad', bullets: 'Not an array' }], [{ title: '' }]])('rejects empty or malformed slides %j', (value) => {
    const work = workToBoardCard(item(value));
    expect(work.content).toBeUndefined();
    expect(work.summary).toBe('Fallback prose');
  });
  it('keeps real slide files first', () => {
    const file: WorkboardFilePreview = { workItemId: 'deck', kind: 'slide', pages: [{ title: 'Real slide', lines: ['Real bullet'] }], url: null, lines: [], slideTitle: null, versionCount: 1 };
    expect(workToBoardCard(item(), undefined, file).content).toEqual({ kind: 'deck', slides: [{ title: 'Real slide', bullets: ['Real bullet'] }] });
  });
  it.each([
    { kind: 'pdf' as const, url: 'https://example.com/file.pdf' },
    { kind: 'html' as const, html: '<p>Real file</p>' },
    { kind: 'text' as const, lines: ['Real file'] },
  ])('does not replace a usable $kind file', (overrides) => {
    const file: WorkboardFilePreview = { workItemId: 'deck', kind: 'fallback', url: null, lines: [], slideTitle: null, versionCount: 1, ...overrides };
    expect(workToBoardCard(item(), undefined, file).content?.kind).not.toBe('deck');
  });
  it('renders notes beneath bullets inside the slide and no absent-note row', () => {
    render(<RealPreview work={workToBoardCard(item())} />);
    const note = screen.getByText('Speaker detail');
    expect(note.tagName).toBe('P');
    expect(note.previousElementSibling?.tagName).toBe('UL');
    expect(note.parentElement?.contains(screen.getByText('First bullet'))).toBe(true);
    expect(screen.getByText('Closing').parentElement?.querySelector('p')).toBeNull();
  });
});