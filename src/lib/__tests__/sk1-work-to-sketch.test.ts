import { describe, expect, it } from 'vitest';
import type { WorkItemRow } from '../work-types';
import { workToSketch } from '../work-sketch';

const row = (overrides: Partial<WorkItemRow> = {}): WorkItemRow => ({
  id: 'work-1',
  title: 'Original work',
  type: 'ai_thread',
  source: 'mcp:claude',
  source_vendor: 'claude',
  visibility: 'unmapped',
  captured_at: '2026-10-13T12:00:00Z',
  content_ref: null,
  work_item_tasks: [],
  ...overrides,
});

describe('workToSketch display-only derivation', () => {
  it('maps a Claude thread to a Claude chat', () => {
    expect(workToSketch(row())).toMatchObject({ source: 'claude', kind: 'chat' });
  });

  it('maps a Granola call to its transcript drawing', () => {
    expect(workToSketch(row({ type: 'call', source: 'connector:granola', source_vendor: 'granola' })))
      .toMatchObject({ source: 'granola', kind: 'transcript' });
  });

  it('maps an evidenced Google Slides item to a deck', () => {
    expect(workToSketch(row({ type: 'deck', source: 'connector:googledrive', source_vendor: 'gdrive',
      meta: { source_mime: 'application/vnd.google-apps.presentation' } })))
      .toMatchObject({ source: 'slides', kind: 'deck' });
  });

  it('recovers Perplexity through taxonomy instead of returning other', () => {
    expect(workToSketch(row({ source: 'mcp:perplexity', source_vendor: 'perplexity' })).source).toBe('perplexity');
  });

  it('recovers Wispr despite its missing toolkit brand mapping', () => {
    expect(workToSketch(row({ source: 'connector:wispr', source_vendor: 'wispr' })).source).toBe('wispr');
  });

  it('returns other without throwing for an unrecognised vendor', () => {
    const item = row({ source: 'connector:mystery', source_vendor: 'mystery' });
    expect(() => workToSketch(item)).not.toThrow();
    expect(workToSketch(item).source).toBe('other');
  });

  it('keeps unmapped work off a board', () => {
    expect(workToSketch(row({ visibility: 'unmapped' })).onBoard).toBe(false);
  });

  it('keeps mapped work on a board even when placements failed to load', () => {
    const work = workToSketch(row({ visibility: 'mapped', work_item_tasks: [] }));
    expect(work.onBoard).toBe(true);
    expect(work).not.toHaveProperty('board');
  });

  it('keeps private visibility distinct from unmapped', () => {
    expect(workToSketch(row({ visibility: 'private' })).onBoard).toBe(true);
  });

  it('labels a capture-only date as Added Oct 13', () => {
    expect(workToSketch(row()).date).toBe('Added Oct 13');
  });

  it('uses work_date without implying it is an added date', () => {
    expect(workToSketch(row({ work_date: '2026-10-12', created_at_source: '2026-10-11T12:00:00Z' })).date).toBe('Oct 12');
  });

  it('uses created_at_source before capture without the Added prefix', () => {
    expect(workToSketch(row({ created_at_source: '2026-10-11T12:00:00Z' })).date).toBe('Oct 11');
  });

  it('omits an invalid date rather than inventing one', () => {
    expect(workToSketch(row({ captured_at: 'invalid' }))).not.toHaveProperty('date');
  });

  it('uses the chosen display title', () => {
    expect(workToSketch(row({ display_title: '  Chosen name  ' })).title).toBe('Chosen name');
  });

  it('uses the first mapping display title including quick folders', () => {
    const work = workToSketch(row({ work_item_tasks: [{ task_id: 'task-1', tasks: {
      id: 'task-1', name: 'Workstream', engagement_id: 'board-1', engagements: {
        id: 'board-1', code: 'B1', title: 'General work', clients: { id: 'folder-1', name: 'Folder name', quick_folder: true },
      },
    } }] }));
    expect(work.board).toBe('Folder name');
  });

  it('selects the first non-null summary without inventing one', () => {
    expect(workToSketch(row({ work_item_extracts: [{ summary: null }, { summary: 'Real summary' }, { summary: 'Later' }] })).summary)
      .toBe('Real summary');
    expect(workToSketch(row())).not.toHaveProperty('summary');
  });

  it('uses URL precedence and derives only its real hostname', () => {
    const work = workToSketch(row({ meta: { web_view_link: 'https://docs.google.com/presentation/d/real', chat_url: 'https://claude.ai/chat/real' },
      source_meta: { url: 'https://chatgpt.com/c/real' } }));
    expect(work.url).toBe('https://docs.google.com/presentation/d/real');
    expect(work.prov).toBe('docs.google.com');
  });

  it('uses source metadata URL before chat URL', () => {
    expect(workToSketch(row({ source_meta: { url: 'https://chatgpt.com/c/real' }, meta: { chat_url: 'https://claude.ai/chat/real' } })).url)
      .toBe('https://chatgpt.com/c/real');
  });

  it('uses the chat URL when other links are absent', () => {
    expect(workToSketch(row({ meta: { chat_url: 'https://claude.ai/chat/real' } })).prov).toBe('claude.ai');
  });

  it('omits provenance without a valid hostname and always omits content', () => {
    expect(workToSketch(row())).not.toHaveProperty('prov');
    expect(workToSketch(row({ source_meta: { url: 'invalid' } }))).not.toHaveProperty('prov');
    expect(workToSketch(row({ content_ref: 'real/stored/content' }))).not.toHaveProperty('content');
  });

  it('prefers a recognized brand before a different taxonomy vendor', () => {
    expect(workToSketch(row({ source_vendor: 'granola', source_meta: { vendor: 'perplexity' } })).source).toBe('granola');
  });

  it('normalizes metadata vendors and stripped source prefixes', () => {
    expect(workToSketch(row({ source_vendor: null, source_meta: { vendor: ' GEMINI ' } })).source).toBe('gemini');
    expect(workToSketch(row({ source_vendor: 'other', source: 'import:copilot' })).source).toBe('copilot');
  });

  it.each([
    ['email', 'email'], ['message', 'chat'], ['image', 'doc'], ['document', 'doc'], ['sheet', 'sheet'],
  ] as const)('borrows the specified drawing for %s', (type, kind) => {
    expect(workToSketch(row({ type })).kind).toBe(kind);
  });
});