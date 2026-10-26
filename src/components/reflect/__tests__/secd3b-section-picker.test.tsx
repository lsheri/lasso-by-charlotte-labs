// @vitest-environment jsdom
// UI mock block copied from be1-board-ask-mark.test.tsx (confirmed 4/4 before
// these edits), extended with the secd3a-section-ask server mocks for sends.
import { act, cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mappedItem = (id: string) => ({
  id,
  title: id,
  type: 'chat',
  visibility: 'mapped',
  work_item_tasks: [{ task_id: 't', tasks: { engagement_id: 'e', name: 'Stream' } }],
});
const state = vi.hoisted(() => ({
  mobile: false,
  writes: [] as unknown[],
  requests: [] as Record<string, unknown>[],
  items: ['a', 'b', 'c', 'outside'].map((id) => ({
    id,
    title: id,
    type: 'chat',
    visibility: 'mapped',
    work_item_tasks: [{ task_id: 't', tasks: { engagement_id: 'e', name: 'Stream' } }],
  })),
}));
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

import { BoardAsk, type AskSectionChoice } from '@/components/canvas-lab/BoardAsk';
Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
// jsdom has no matchMedia; the thinking trail asks it about reduced motion.
window.matchMedia = window.matchMedia ?? ((query: string) => ({
  matches: false,
  media: query,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  addListener: () => undefined,
  removeListener: () => undefined,
  onchange: null,
  dispatchEvent: () => false,
}) as MediaQueryList);
const args = { open: true, engagementId: 'e', engagementTitle: 'Board', profileId: 'p', orgId: 'o' };
function wrapper({ children }: { children: React.ReactNode }) { return <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>; }
afterEach(() => { cleanup(); state.mobile = false; state.requests.length = 0; state.writes.length = 0; });

const CHOICES: AskSectionChoice[] = [
  { id: 's1', title: 'Discovery', marker: 'Week of 19 Oct' },
  { id: 's2', title: null, marker: '#2' },
  { id: 's3', title: null, marker: null },
];

/** The page wiring, in miniature: both doors set the same askSection state. */
function Harness({ choices, resolve }: { choices: AskSectionChoice[]; resolve: (id: string) => string[] | null }) {
  const [askSection, setAskSection] = useState<{ id: string; nonce: number } | null>(null);
  const sectionSource = useMemo(
    () => (askSection ? { resolve: () => resolve(askSection.id) } : undefined),
    [askSection, resolve],
  );
  return (
    <BoardAsk
      {...args}
      onOpenChange={vi.fn()}
      canKeep={false}
      onKeep={vi.fn()}
      boardContextItemIds={[]}
      boardContextHasPicks={false}
      sectionSource={sectionSource}
      sectionChoices={choices}
      onPickSection={(id) => setAskSection({ id, nonce: Date.now() })}
    />
  );
}

function openPicker() {
  fireEvent.click(screen.getByText('Change'));
}

async function sendQuestion(message = 'What matters?') {
  fireEvent.change(screen.getByPlaceholderText(/What do you want to think through/), { target: { value: message } });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  });
}

describe('SECD-3b section picker door', () => {
  it('lists every section, marked or not', () => {
    render(<Harness choices={CHOICES} resolve={() => ['a']} />, { wrapper });
    openPicker();
    expect(screen.getByText('Discovery')).toBeTruthy();
    expect(screen.getByText('#2')).toBeTruthy();
    expect(screen.getByText('Untitled section')).toBeTruthy();
  });

  it('shows no Sections group when the board has no sections', () => {
    render(<Harness choices={[]} resolve={() => ['a']} />, { wrapper });
    openPicker();
    expect(screen.queryByText('Sections')).toBeNull();
  });

  it('shows the marker as the quieter second line when a section has both', () => {
    render(<Harness choices={CHOICES} resolve={() => ['a']} />, { wrapper });
    openPicker();
    const button = screen.getByText('Discovery').closest('button');
    expect(button?.textContent).toBe('DiscoveryWeek of 19 Oct');
    expect(button?.firstElementChild?.textContent).toBe('Discovery');
  });

  it('an untitled marked section shows its marker as the label', () => {
    render(<Harness choices={CHOICES} resolve={() => ['a']} />, { wrapper });
    openPicker();
    const button = screen.getByText('#2').closest('button');
    expect(button?.textContent).toBe('#2');
  });

  it('an untitled unmarked section reads Untitled section', () => {
    render(<Harness choices={CHOICES} resolve={() => ['a']} />, { wrapper });
    openPicker();
    expect(screen.getByText('Untitled section')).toBeTruthy();
  });

  it('picking a section scopes the question to exactly its live members', async () => {
    render(<Harness choices={CHOICES} resolve={(id) => (id === 's1' ? ['a', 'b'] : [])} />, { wrapper });
    openPicker();
    fireEvent.click(screen.getByText('Discovery'));
    await sendQuestion();
    await waitFor(() => expect(state.requests).toHaveLength(1));
    expect(state.requests[0]).toMatchObject({ scope_kind: 'section', pointed_at: [] });
    expect(state.writes.filter((v: any) => v.context_scope).at(-1)).toEqual({ context_scope: { mode: 'items', ids: ['a', 'b'] } });
  });

  it('picking an empty section stops and says so', async () => {
    render(<Harness choices={CHOICES} resolve={() => []} />, { wrapper });
    openPicker();
    fireEvent.click(screen.getByText('Discovery'));
    await sendQuestion();
    expect(screen.getByText('Nothing in this section yet')).toBeTruthy();
    expect(state.requests).toEqual([]);
  });

  it('choosing other work clears the section scope', async () => {
    render(<Harness choices={CHOICES} resolve={() => ['a', 'b']} />, { wrapper });
    openPicker();
    fireEvent.click(screen.getByText('Discovery'));
    openPicker();
    fireEvent.click(screen.getByRole('checkbox', { name: 'c' }));
    await sendQuestion();
    await waitFor(() => expect(state.requests).toHaveLength(1));
    expect(state.requests[0]).not.toHaveProperty('scope_kind');
  });

  it('the phone sheet offers the same choices', () => {
    state.mobile = true;
    render(<Harness choices={CHOICES} resolve={() => ['a']} />, { wrapper });
    openPicker();
    expect(screen.getByText('Discovery')).toBeTruthy();
    expect(screen.getByText('#2')).toBeTruthy();
    expect(screen.getByText('Untitled section')).toBeTruthy();
  });

  it('a section removed while the picker is open leaves the list', () => {
    const { rerender } = render(<Harness choices={CHOICES} resolve={() => ['a']} />, { wrapper });
    openPicker();
    expect(screen.getByText('Discovery')).toBeTruthy();
    rerender(<Harness choices={CHOICES.filter((c) => c.id !== 's1')} resolve={() => ['a']} />);
    expect(screen.queryByText('Discovery')).toBeNull();
    expect(screen.getByText('#2')).toBeTruthy();
  });
});
