// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LabCard } from '../LabCard';
import type { LabNode } from '../canvas-lab-model';
import type { WorkItemRow } from '@/lib/work-types';
import type { WorkboardFilePreview } from '@/lib/workboard-card-preview.shared';
import { NO_PREVIEW_COPY } from '@/design/reference/NoPreview';

vi.mock('@/hooks/use-vendor-display', () => ({ useVendorVisible: () => true }));
vi.mock('../WorkboardFilePreview', () => ({ WorkboardFilePreview: () => <div data-testid="real-file">Real file</div> }));

const summary = 'The research identifies three useful alternatives and describes the evidence for each.';
const reportMeta = (turn: number | null) => ({ kind: 'research_report', produced_at_turn: turn });
const item: WorkItemRow = {
  id: 'report', title: 'Research', type: 'document', source: 'mcp:claude',
  source_vendor: 'claude', visibility: 'mapped', captured_at: '2026-10-23T00:00:00Z',
  content_fidelity: 'verbatim', content_ref: 'reports/research.md',
  work_item_tasks: [], work_item_extracts: [{ summary }],
  source_meta: reportMeta(null),
};
const node: LabNode = {
  id: 'report-node', kind: 'work', frame: null, title: 'Research', summary: '',
  typeLabel: 'document', ownership: 'yours', workItemId: 'report',
  x: 0, y: 0, width: 300, height: 240,
};
const noop = () => undefined;
const props = {
  node, item, face: 'board' as const, selected: false, focused: false,
  onSelect: noop, onOpen: noop, onBranch: noop, onHide: noop, onDelete: noop,
  onEdit: noop, onEditCommitted: noop, connecting: false, connectSourceAnchor: null,
  onAnchorPointerDown: noop, onAnchorActivate: noop, onMenuOpened: noop,
  onMenuOpenChange: noop, onMeasure: noop, onPointerDown: noop, onFocus: noop,
  onKeyDown: noop, canResize: false, onResizeStart: noop, onFit: noop,
  onResizeKeyDown: noop, onResizeKeyUp: noop, frameChoices: [], structured: false,
  onMoveToFrame: noop,
};
const fallback: WorkboardFilePreview = {
  workItemId: item.id, kind: 'fallback', url: null, lines: [], slideTitle: null,
  versionCount: 0, reason: 'no_text',
};
beforeEach(() => {
  globalThis.ResizeObserver = class { observe() {} disconnect() {} unobserve() {} } as typeof ResizeObserver;
});
afterEach(cleanup);

describe('TEXT-FACE precedence', () => {
  it('uses the loaded extract after a completed preview has no renderable content', () => {
    render(<LabCard {...props} filePreview={fallback} />);
    expect(screen.getByTestId('text-face').textContent).toContain(summary);
    expect(screen.getByText('Research report')).toBeTruthy();
    expect(screen.queryByText(NO_PREVIEW_COPY.no_text)).toBeNull();
  });
  it('keeps an arriving real file preview ahead of the summary', () => {
    render(<LabCard {...props} filePreview={{ ...fallback, kind: 'html', html: '<p>Real file</p>' }} />);
    expect(screen.getByTestId('real-file')).toBeTruthy();
    expect(screen.queryByTestId('text-face')).toBeNull();
  });
  it('keeps existing text file rendering ahead of the summary', () => {
    render(<LabCard {...props} filePreview={{ ...fallback, kind: 'text', lines: ['Google Docs paragraph'] }} />);
    expect(screen.getByText('Google Docs paragraph')).toBeTruthy();
    expect(screen.queryByTestId('text-face')).toBeNull();
  });
  it('shows the existing NoPreview when neither source has content', () => {
    render(<LabCard {...props} item={{ ...item, work_item_extracts: [{ summary: '   ' }] }} filePreview={fallback} />);
    expect(screen.getByText(NO_PREVIEW_COPY.no_text)).toBeTruthy();
    expect(screen.queryByTestId('text-face')).toBeNull();
  });
  it('shows neither face while the preview is pending, even with a summary', () => {
    render(<LabCard {...props} />);
    expect(screen.queryByTestId('text-face')).toBeNull();
    for (const sentence of Object.values(NO_PREVIEW_COPY)) expect(screen.queryByText(sentence)).toBeNull();
  });
  it('does not print a turn label for the common null value', () => {
    render(<LabCard {...props} filePreview={fallback} />);
    expect(screen.queryByTestId('text-face-turn')).toBeNull();
    expect(screen.getByTestId('text-face').textContent?.toLowerCase()).not.toContain('turn');
  });
  it('prints the finite production turn', () => {
    render(<LabCard {...props} item={{ ...item, source_meta: reportMeta(12) }} filePreview={fallback} />);
    expect(screen.getByTestId('text-face-turn').textContent).toBe('TURN 12');
  });
  it('rejects non-finite production turns', () => {
    render(<LabCard {...props} item={{ ...item, source_meta: reportMeta(Infinity) }} filePreview={fallback} />);
    expect(screen.queryByTestId('text-face-turn')).toBeNull();
  });
  it('renders summary characters as ordinary text, not markup or links', () => {
    const prose = '<b>Evidence</b> **prose** https://example.com';
    render(<LabCard {...props} item={{ ...item, work_item_extracts: [{ summary: prose }] }} filePreview={fallback} />);
    const face = screen.getByTestId('text-face');
    expect(face.textContent).toContain(prose);
    expect(face.querySelector('b, strong, a')).toBeNull();
  });
  it('reuses the parent chat control in the face footer without duplicating it', () => {
    render(<LabCard {...props} parent={{ ...item, id: 'chat', type: 'ai_thread', meta: { chat_url: 'https://claude.ai/chat/parent' } }} filePreview={fallback} />);
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0]?.getAttribute('href')).toBe('https://claude.ai/chat/parent');
  });
});