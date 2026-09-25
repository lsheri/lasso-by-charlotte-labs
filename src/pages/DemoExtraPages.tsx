/**
 * Unit 4: two public, read-only demo pages. Nothing here writes: no capture,
 * push, map, comment, share or delete control is rendered at all.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from "react";

import { FocusOverlay } from "@/components/canvas-lab/FocusOverlay";
import type { LabNode } from "@/components/canvas-lab/canvas-lab-model";
import { SetupSteps } from "@/components/connectors/ConnectYourAiCard";
import { useSession } from "@/hooks/use-session";
import { openDemoConversationsFn } from "@/lib/demo.functions";
import { noteDemoCardOpened, noteDemoFilterChanged, noteDemoOpened } from "@/lib/demo-telemetry";
import type { DemoConversationItem } from "@/lib/demo-board.server";
import { effectiveWorkDate } from "@/lib/work-types";
import { vendorFromSource } from "@/lib/work-taxonomy";

export const DEMO_TOOLS = [
  { key: "all", label: "All" },
  { key: "claude", label: "Claude" },
  { key: "chatgpt", label: "ChatGPT" },
  { key: "gemini", label: "Gemini" },
  { key: "document", label: "Document" },
] as const;
type DemoTool = (typeof DEMO_TOOLS)[number]["key"];

export const DEMO_SOURCES_LINK_LINE = "Your link is issued when your pilot starts.";

const LINK_CLASS = "font-mono text-[11.5px] uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground";

function DemoSubHeader({ title }: { title: string }) {
  const { session, loading } = useSession();
  return (
    <header className="flex h-[52px] shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4">
      {session || loading ? (
        <Link to="/demo" className={LINK_CLASS}>Back to the demo</Link>
      ) : (
        <Link to="/" hash="demo" className={LINK_CLASS}>Back to the demo</Link>
      )}
      <span className="hidden min-w-0 truncate text-[13px] font-medium text-foreground sm:block">{title}</span>
      <Link
        to="/"
        hash="pilot"
        data-testid="demo-book-pilot"
        className="shrink-0 rounded-[var(--radius)] bg-primary px-3 py-1.5 font-mono text-[11.5px] uppercase tracking-[0.08em] text-primary-foreground"
      >
        Book a pilot
      </Link>
    </header>
  );
}

function Shell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-dvh overflow-x-hidden bg-background">
      <DemoSubHeader title={title} />
      <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-8 sm:px-8">
        <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">Demo workspace</p>
        <h1 className="mt-1 font-serif text-[26px] text-foreground">{title}</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">A demo workspace. Every figure is invented.</p>
        <div className="mt-6">{children}</div>
      </main>
    </div>
  );
}

export function demoToolOf(entry: DemoConversationItem): Exclude<DemoTool, "all"> | "other" {
  if (entry.item.type === "document") return "document";
  const v = vendorFromSource(entry.item as never);
  return v === "claude" || v === "chatgpt" || v === "gemini" ? v : "other";
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function monthLanes(items: DemoConversationItem[]) {
  const lanes = new Map<string, { label: string; items: DemoConversationItem[] }>();
  for (const entry of items) {
    const at = new Date(effectiveWorkDate(entry.item));
    const ok = !Number.isNaN(at.getTime());
    const key = ok ? `${at.getFullYear()}-${String(at.getMonth()).padStart(2, "0")}` : "undated";
    const label = ok ? `${MONTHS[at.getMonth()]} ${at.getFullYear()}` : "No date recorded";
    const lane = lanes.get(key) ?? { label, items: [] };
    lane.items.push(entry);
    lanes.set(key, lane);
  }
  return [...lanes.entries()]
    .sort(([a], [b]) => (a === "undated" ? 1 : b === "undated" ? -1 : a < b ? 1 : -1))
    .map(([key, lane]) => ({ key, ...lane }));
}

export function DemoConversationsPage() {
  const open = useServerFn(openDemoConversationsFn);
  const query = useQuery({ queryKey: ["demo-conversations"], queryFn: () => open(), staleTime: 60_000 });
  const queryClient = useQueryClient();
  const [tool, setTool] = useState<DemoTool>("all");
  const [focus, setFocus] = useState<DemoConversationItem | null>(null);

  useEffect(() => noteDemoOpened("conversations", "none"), []);
  useLayoutEffect(() => {
    if (!query.data) return;
    queryClient.setQueryDefaults(["turns"], { staleTime: Number.POSITIVE_INFINITY, retry: false });
    for (const [id, turns] of Object.entries(query.data.turns)) queryClient.setQueryData(["turns", id], turns);
  }, [query.data, queryClient]);

  const items = query.data?.items ?? [];
  const shown = useMemo(() => items.filter((e) => tool === "all" || demoToolOf(e) === tool), [items, tool]);
  const lanes = useMemo(() => monthLanes(shown), [shown]);

  function openItem(entry: DemoConversationItem) {
    setFocus(entry);
    noteDemoCardOpened(entry.code, entry.item.type === "document" ? "document" : "ai_thread");
  }

  const node: LabNode | null = focus
    ? { id: focus.item.id, kind: "work", title: focus.item.title ?? "Untitled", summary: "", typeLabel: focus.item.type === "document" ? "Document" : "Conversation", ownership: "teammate", workItemId: focus.item.id, x: 0, y: 0, width: 0, height: 0 }
    : null;

  return (
    <Shell title="All AI Conversations">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by tool">
        {DEMO_TOOLS.map((chip) => (
          <button
            key={chip.key}
            type="button"
            aria-pressed={tool === chip.key}
            data-testid={`demo-tool-${chip.key}`}
            onClick={() => { if (chip.key === tool) return; setTool(chip.key); noteDemoFilterChanged(chip.key); }}
            className={`rounded-[var(--radius)] border px-3 py-1.5 text-[11.5px] ${tool === chip.key ? "border-foreground text-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}
          >
            {chip.label}
          </button>
        ))}
      </div>
      <div className="mt-6 space-y-8">
        {query.isPending ? (
          <p className="text-[13px] text-muted-foreground">Opening the demo.</p>
        ) : shown.length === 0 ? (
          <p className="text-[13px] text-foreground">Nothing here for this tool.</p>
        ) : (
          lanes.map((lane) => (
            <section key={lane.key} aria-label={lane.label}>
              <h2 className="font-hand text-[16px] text-foreground">{lane.label}</h2>
              <ul className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {lane.items.map((entry) => (
                  <li key={entry.item.id} className="min-w-0 rounded-[var(--radius-lg)] border border-border bg-card p-3" data-testid="demo-conversation">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
                        {DEMO_TOOLS.find((t) => t.key === demoToolOf(entry))?.label ?? "AI"}
                      </span>
                      <Link to="/demo/$code" params={{ code: entry.code }} className="font-mono text-[9px] uppercase tracking-[0.08em] text-foreground underline underline-offset-2" data-testid="demo-conversation-code">
                        {entry.code}
                      </Link>
                    </div>
                    <button type="button" onClick={() => openItem(entry)} className="mt-2 block w-full min-w-0 text-left text-[13px] text-foreground hover:text-muted-foreground">
                      <span className="line-clamp-2 break-words">{entry.item.title ?? "Untitled"}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
      {focus && node ? (
        <div className="fixed inset-0 z-50">
          <FocusOverlay
            node={node}
            item={focus.item}
            readOnly
            closeLabel="Back to conversations"
            filePreview={query.data?.filePreviews[focus.item.id]}
            onSummarize={() => undefined}
            onBranch={() => undefined}
            onClose={() => setFocus(null)}
          />
        </div>
      ) : null}
    </Shell>
  );
}

export function DemoSourcesPage() {
  useEffect(() => noteDemoOpened("sources", "none"), []);
  return (
    <Shell title="Where work comes from">
      <section aria-labelledby="demo-sources-ai" className="rounded-[var(--radius-lg)] border border-border bg-card px-4 py-4">
        <h2 id="demo-sources-ai" className="text-[13px] font-medium text-foreground">Add to Claude or ChatGPT</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Add Lasso to your AI once. At the end of a working session, ask it to push the conversation to Lasso.
        </p>
        <div className="mt-4"><SetupSteps /></div>
        <p className="mt-4 text-[13px] text-foreground" data-testid="demo-sources-link-line">{DEMO_SOURCES_LINK_LINE}</p>
        <Link
          to="/"
          hash="pilot"
          className="mt-3 inline-flex min-h-11 items-center rounded-[var(--radius)] bg-primary px-4 font-mono text-[11.5px] uppercase tracking-[0.08em] text-primary-foreground"
        >
          Book a pilot
        </Link>
      </section>
      <section aria-labelledby="demo-sources-more" className="mt-6 rounded-[var(--radius-lg)] border border-border bg-card px-4 py-4">
        <h2 id="demo-sources-more" className="text-[13px] font-medium text-foreground">Also available in a pilot</h2>
        <ul className="mt-2 space-y-1 text-[13px] text-muted-foreground">
          <li>Google Drive: available</li>
          <li>Gmail: available</li>
        </ul>
      </section>
    </Shell>
  );
}
