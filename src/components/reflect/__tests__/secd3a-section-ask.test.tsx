// @vitest-environment jsdom
// UI mock block adapted from be1-board-ask-mark.test.tsx (passing before edits).
import { act, cleanup, render, renderHook, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { containingSection } from '@/lib/board-section';
const state = vi.hoisted(() => ({ mobile: false, writes: [] as unknown[], requests: [] as Record<string, unknown>[], items: ['a','b','c','outside'].map(id => ({ id, title: id, type: 'chat', engagement_id: 'e' })) }));
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => state.mobile }));
vi.mock('@/hooks/use-perf-timer', () => ({ usePerfOpenFinish: vi.fn() }));
vi.mock('@/components/reflect/ask-dock-state', () => ({ useAskDockState: () => ({ width: 360, tab: 'messages', setTab: vi.fn() }) }));
vi.mock('@/components/oneonone/SaveForOneOnOne', () => ({ SaveForOneOnOneDialog: () => null }));
vi.mock('@tanstack/react-router', () => ({ Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }));
vi.mock('@/components/ui/sheet', () => ({ Sheet: ({ children, open }: { children: React.ReactNode; open: boolean }) => open ? <div>{children}</div> : null, SheetContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>, SheetTitle: () => null, SheetDescription: () => null }));
vi.mock('@/hooks/use-firm-checks', () => ({ useFirmChecks: () => ({ data: [] }) }));
vi.mock('@/hooks/use-profile', () => ({ useProfile: () => ({ data: { id: 'p', display_name: 'Liam' } }) }));
vi.mock('@/hooks/use-answer-sources', () => ({ useAnswerSources: () => ({ data: {} }) }));
vi.mock('@/hooks/use-engagement-page', () => ({ useEngagementPage: () => ({ data: { tasks: [] }, isPending: false }) }));
vi.mock('@/hooks/use-work-items', () => ({ useWorkItems: () => ({ data: { items: state.items }, isPending: false }) }));
vi.mock('@/lib/telemetry', () => ({ logEvent: vi.fn() }));
vi.mock('@/lib/stream-client', () => ({ streamChatRequest: vi.fn(async (_path, body) => { state.requests.push(body); return { truncated: false, fullCount: 3, summaryCount: 0 }; }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: () => {
  const chain = { select: () => chain, eq: () => chain, order: () => chain, limit: async () => ({ data: [] }), update: (value: unknown) => { state.writes.push(value); return chain; }, insert: (value: unknown) => { state.writes.push(value); return chain; }, single: async () => ({ data: { id: 's' } }), maybeSingle: async () => ({ data: null }), then: (done: (v: unknown) => unknown) => Promise.resolve({ error: null, data: [] }).then(done) };
  return chain;
} } }));
import { useAskLasso } from '@/components/reflect/use-ask-lasso';
import { BoardAsk } from '@/components/canvas-lab/BoardAsk';
import { LabSection } from '@/components/canvas-lab/LabSection';
Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
const args = { open: true, engagementId: 'e', engagementTitle: 'Board', profileId: 'p', orgId: 'o' };
function wrapper({ children }: { children: React.ReactNode }) { return <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>; }
afterEach(() => { cleanup(); state.requests.length = 0; state.writes.length = 0; });
function hook(resolve: () => string[] | null) { return renderHook(() => useAskLasso({ ...args, sectionSource: { resolve } }), { wrapper }); }
async function send(result: ReturnType<typeof hook>['result'], message = 'What matters?') { await act(async () => { await result.current.resend(message); }); }
// Use stable selector objects in tests: a live selector is not a snapshot.
function stableHook(resolve: () => string[] | null) { const sectionSource = { resolve }; return renderHook(() => useAskLasso({ ...args, sectionSource }), { wrapper }); }
describe('SECD-3a section Ask', () => {
  it('asks about exactly three live cards and writes ordinary items scope', async () => {
    const { result } = stableHook(() => ['a','b','c']);
    await send(result);
    expect(state.writes.filter((v: any) => v.context_scope).at(-1)).toEqual({ context_scope: { mode: 'items', ids: ['a','b','c'], board: 'e' } });
    expect(state.requests).toHaveLength(1);
    expect(state.requests[0]).toMatchObject({ scope_kind: 'section', pointed_at: [] });
    expect(state.requests[0]).not.toHaveProperty('section_id');
  });
  it('empty section says so and makes no session or question request', async () => {
    const { result } = stableHook(() => []); await send(result);
    expect(result.current.error).toBe('Nothing in this section yet');
    expect(state.requests).toEqual([]); expect(state.writes).toEqual([]);
  });
  it('shows the empty state in the real desktop surface', () => {
    const sectionSource = { resolve: () => [] };
    render(<BoardAsk {...args} onOpenChange={vi.fn()} canKeep={false} onKeep={vi.fn()} boardContextItemIds={[]} boardContextHasPicks={false} sectionSource={sectionSource} />, { wrapper });
    expect(screen.getByText('Nothing in this section yet')).toBeTruthy();
  });
  it('recomputes members at send rather than freezing the menu selection', async () => {
    let ids = ['a']; const { result } = stableHook(() => ids); ids = ['b','c']; await send(result);
    expect(state.writes.at(-1)).toEqual({ context_scope: { mode: 'items', ids: ['b','c'], board: 'e' } });
  });
  it('nested card belongs only to the inner section', async () => {
    const outer = { id: 'outer', x: 0, y: 0, width: 1000, height: 1000 };
    const inner = { id: 'inner', x: 100, y: 100, width: 200, height: 200 };
    const cards = [{ id: 'a', x: 150, y: 150, width: 40, height: 40 }, { id: 'b', x: 400, y: 400, width: 40, height: 40 }];
    const { result } = stableHook(() => cards.filter(card => containingSection(card, [outer, inner])?.id === 'outer').map(card => card.id));
    await send(result); expect(state.writes.at(-1)).toEqual({ context_scope: { mode: 'items', ids: ['b'], board: 'e' } });
  });
  it('deleted section stops before asking', async () => {
    let ids: string[] | null = ['a']; const { result } = stableHook(() => ids); ids = null; await send(result);
    expect(result.current.error).toBe('This section was removed. Choose work before asking.');
    expect(state.requests).toEqual([]); expect(state.writes).toEqual([]);
  });
  it('mentions narrow only within the resolved members', async () => {
    const { result } = stableHook(() => ['a','b','c']); await send(result, 'Compare @a and @outside');
    expect(state.requests[0]?.['pointed_at']).toEqual(['a']);
    expect(state.writes.at(-1)).toEqual({ context_scope: { mode: 'items', ids: ['a','b','c'], board: 'e' } });
  });
  it('only an outside mention stops instead of broadening', async () => {
    const { result } = stableHook(() => ['a']); await send(result, 'Read @outside');
    expect(state.requests).toEqual([]); expect(result.current.error).toBe('Choose a work item in this section before asking.');
  });
  it('ordinary scope has no scope_kind', async () => {
    const { result } = renderHook(() => useAskLasso(args), { wrapper }); await send(result);
    expect(state.requests[0]).not.toHaveProperty('scope_kind');
  });
  it('images-only board picks are real picks and persist their image scope through New chat', async () => {
    const { result } = renderHook(() => useAskLasso(args), { wrapper });
    act(() => result.current.setBoardSelection(true, [], ['image-node']));
    expect(result.current.boardPickActive).toBe(true);
    expect(result.current.boardPickedCount).toBe(1);
    await send(result);
    expect(state.requests[0]?.['scope_source']).toBe('board_pick');
    expect(state.writes.at(-1)).toEqual({ context_scope: { mode: 'items', ids: [], images: ['image-node'], board: 'e' } });
    act(() => result.current.newSession());
    await send(result);
    expect(state.writes.at(-1)).toEqual({ context_scope: { mode: 'items', ids: [], images: ['image-node'], board: 'e' } });
  });
  it('reads an image inside a section and recomputes its durable id at send', async () => {
    const section = { id: 'section:s', x: 0, y: 0, width: 300, height: 300 };
    let image = { id: 'image-node', x: 40, y: 40, width: 100, height: 80 };
    const sectionSource = { resolve: () => [], resolveImages: () => containingSection(image, [section])?.id === section.id ? [image.id] : [] };
    const { result } = renderHook(() => useAskLasso({ ...args, sectionSource }), { wrapper });
    expect(result.current.error).toBeNull();
    image = { ...image, id: 'new-image-node' };
    await send(result);
    expect(state.writes.at(-1)).toEqual({ context_scope: { mode: 'items', ids: [], images: ['new-image-node'], board: 'e' } });
    expect(state.requests[0]).toMatchObject({ scope_kind: 'section', pointed_at: [] });
  });
  it('desktop menu calls the optional door once and read-only has no menu', () => {
    const onAsk = vi.fn();
    const props = { frame: { id: 'section:s', name: 'Section', x: 0, y: 0, width: 500, height: 500 }, title: 'Section', selected: true, editable: true, onSelect: vi.fn(), onResizeStart: vi.fn(), onRename: vi.fn(), onRemove: vi.fn(), onMenuOpened: vi.fn(), onAsk };
    const { rerender } = render(<LabSection {...props} />);
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Section menu' }), { button: 0, ctrlKey: false, pointerType: 'mouse' });
    fireEvent.click(screen.getByRole('menuitem', { name: 'Ask Lasso about this section' })); expect(onAsk).toHaveBeenCalledTimes(1);
    rerender(<LabSection {...props} editable={false} />); expect(screen.queryByRole('button', { name: 'Section menu' })).toBeNull();
  });
});
