import { describe, expect, it } from 'vitest';
import { workToBoardCard } from '../work-board-card';
import { workToSketch } from '../work-sketch';
import type { WorkItemRow } from '../work-types';
import type { WorkboardCardPreview, WorkboardFilePreview } from '../workboard-card-preview.shared';

const item = (overrides: Partial<WorkItemRow> = {}): WorkItemRow => ({
  id: 'work-1', title: 'Real work', type: 'document', source: 'upload',
  visibility: 'unmapped', captured_at: '2026-10-13T12:00:00Z',
  content_ref: null, work_item_tasks: [], ...overrides,
});
const file = (overrides: Partial<WorkboardFilePreview> = {}): WorkboardFilePreview => ({
  workItemId: 'work-1', kind: 'text', url: null, lines: [], slideTitle: null,
  versionCount: 1, ...overrides,
});
const chat = (overrides: Partial<WorkboardCardPreview> = {}): WorkboardCardPreview => ({
  workItemId: 'work-1', turns: [{ turnNo: 3, role: 'assistant', content: 'Third' },
    { turnNo: 2, role: 'USER', content: 'Second' }], turnCount: 3, model: null,
  firstUserTurn: { turnNo: 1, role: 'user', content: 'First' }, ...overrides,
});

describe('BC1 real board content adapter', () => {
  it('prepends the missing first user turn and sorts the remaining real turns', () => {
    expect(workToBoardCard(item(), chat()).content).toEqual({ kind: 'chat', turns: [
      { role: 'you', text: 'First' }, { role: 'you', text: 'Second' },
      { role: 'assistant', text: 'Third' },
    ] });
  });
  it('does not duplicate a first user turn already present by turnNo', () => {
    expect(workToBoardCard(item(), chat({ firstUserTurn: { turnNo: 2, role: 'user', content: 'Duplicate' } })).content)
      .toEqual({ kind: 'chat', turns: [{ role: 'you', text: 'Second' }, { role: 'assistant', text: 'Third' }] });
  });
  it('retains unusual roles as assistant and maps case-insensitive you without truncating text', () => {
    const text = 'Real '.repeat(100);
    expect(workToBoardCard(item(), chat({ firstUserTurn: null, turns: [
      { turnNo: 1, role: 'model', content: text }, { turnNo: 2, role: 'YoU', content: 'Question' },
    ] })).content).toEqual({ kind: 'chat', turns: [
      { role: 'assistant', text }, { role: 'you', text: 'Question' },
    ] });
  });
  it('derives a deck from slide evidence even for a document-labelled item', () => {
    expect(workToBoardCard(item(), undefined, file({ kind: 'slide', pages: [
      { title: 'Opening', lines: ['Evidence one', 'Evidence two'] },
      { title: null, lines: ['Evidence three'] },
    ] })).content).toEqual({ kind: 'deck', slides: [
      { title: 'Opening', bullets: ['Evidence one', 'Evidence two'] },
      { title: '', bullets: ['Evidence three'] },
    ] });
  });
  it('drops empty slide pages but preserves a title-only page', () => {
    expect(workToBoardCard(item(), undefined, file({ kind: 'slide', pages: [
      { title: null, lines: [] }, { title: 'Title only', lines: [] },
    ] })).content).toEqual({ kind: 'deck', slides: [{ title: 'Title only', bullets: [] }] });
  });
  it('omits content when all slide pages are empty', () => {
    expect(workToBoardCard(item(), undefined, file({ kind: 'slide', pages: [{ title: null, lines: [] }] })))
      .not.toHaveProperty('content');
  });
  it('parses a sheet header, skips sheet markers and blanks, and converts only plain numbers', () => {
    expect(workToBoardCard(item({ type: 'sheet' }), undefined, file({ lines: [
      '## Sheet: Budget', ' ', 'Quarter,Amount,Date', 'Q1, 42.5 ,2026-01', 'Q2,-3,.5',
    ] })).content).toEqual({ kind: 'sheet', columns: ['Quarter', 'Amount', 'Date'],
      rows: [['Q1', 42.5, '2026-01'], ['Q2', -3, 0.5]] });
  });
  it('preserves a quoted comma as one cell and unescapes doubled quotes', () => {
    expect(workToBoardCard(item({ type: 'sheet' }), undefined, file({ lines: [
      'Name,Amount,Note', '"Revenue, Nordics",12,"Said ""yes"""',
    ] })).content).toEqual({ kind: 'sheet', columns: ['Name', 'Amount', 'Note'],
      rows: [['Revenue, Nordics', 12, 'Said "yes"']] });
  });
  it('preserves empty and non-plain numeric cells as strings', () => {
    expect(workToBoardCard(item({ type: 'sheet' }), undefined, file({ lines: ['A,B,C,D', ',1e3,12%,+2'] })).content)
      .toEqual({ kind: 'sheet', columns: ['A', 'B', 'C', 'D'], rows: [['', '1e3', '12%', 2]] });
  });
  it('falls through to document content when a sheet has fewer than two usable CSV lines', () => {
    expect(workToBoardCard(item({ type: 'sheet' }), undefined, file({ lines: ['Only header'] })).content)
      .toEqual({ kind: 'doc', heading: 'Real work', blocks: [{ type: 'p', text: 'Only header' }] });
  });
  it('uses the display heading and real text blocks, stripping heading hashes and skipping blanks', () => {
    expect(workToBoardCard(item({ display_title: 'Chosen title' }), undefined, file({ lines: [
      '# Heading', '', 'Plain paragraph', '### Detail', '  ',
    ] })).content).toEqual({ kind: 'doc', heading: 'Chosen title', blocks: [
      { type: 'h2', text: 'Heading' }, { type: 'p', text: 'Plain paragraph' }, { type: 'h2', text: 'Detail' },
    ] });
  });
  it.each(['pdf', 'html', 'mermaid', 'fallback'] as const)('omits the content key for unsupported %s evidence', (kind) => {
    expect(workToBoardCard(item(), undefined, file({ kind, lines: ['Not a text preview'], url: 'https://example.com/real' })))
      .not.toHaveProperty('content');
  });
  it('omits content without any preview', () => {
    expect(workToBoardCard(item())).not.toHaveProperty('content');
  });
  it('does not fabricate content from an empty text preview or a firstUserTurn without turns', () => {
    expect(workToBoardCard(item(), chat({ turns: [] }), file({ lines: [' ', ''] }))).not.toHaveProperty('content');
  });
  it('preserves every sketch field unchanged, including mapped visibility with no placements', () => {
    const row = item({ visibility: 'mapped', work_date: '2026-10-12',
      meta: { web_view_link: 'https://docs.google.com/document/d/real' },
      work_item_extracts: [{ summary: 'Real summary' }] });
    const { content, ...base } = workToBoardCard(row, undefined, file({ lines: ['Real paragraph'] }));
    expect(base).toEqual(workToSketch(row));
    expect(base.onBoard).toBe(true);
    expect(base).not.toHaveProperty('board');
    expect(content).toEqual({ kind: 'doc', heading: 'Real work', blocks: [{ type: 'p', text: 'Real paragraph' }] });
  });
});