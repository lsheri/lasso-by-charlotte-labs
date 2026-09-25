/**
 * Product shell 1.3: the public demo Home and a read-only demo board.
 * Nothing here writes. Signed-in people see exactly what anyone else sees.
 */

import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";

import { SharedBoardView } from "@/components/canvas-lab/SharedBoardView";
import { MarkdownMessage } from "@/components/markdown/MarkdownMessage";
import { ContextAudit } from "@/components/reflect/ContextTrail";
import { HomeEngagementGrid } from "@/components/home/HomeEngagementGrid";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { openDemoBoardFn, openDemoHomeFn } from "@/lib/demo.functions";
import { DEMO_CHAT_LINK_NOTE, isChatLinkQuestion, type DemoPreset } from "@/lib/demo-presets-shared";
import { noteDemoCardOpened, noteDemoOpened, noteDemoPresetOpened, noteDemoTurnOpened } from "@/lib/demo-telemetry";
import type { HomeGridEngagement } from "@/lib/home-grid";
import type { HomePreviewState } from "@/lib/home-board-preview";

export const DEMO_LINE = "A demo workspace. Every figure is invented.";

function PilotLink({ className }: { className?: string }) {
  return (
    <Link
      to="/"
      hash="pilot"
      className={
        className ??
        "flex min-h-11 items-center justify-center rounded-[var(--radius)] bg-primary px-3 py-2 font-mono text-[13px] uppercase tracking-[0.08em] text-primary-foreground sm:px-6 sm:py-3 sm:text-[18px]"
      }
    >
      Book a pilot
    </Link>
  );
}

export function DemoHomePage() {
  const open = useServerFn(openDemoHomeFn);
  const query = useQuery({ queryKey: ["demo-home"], queryFn: () => open(), staleTime: 60_000 });
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(960);

  useEffect(() => noteDemoOpened("home", "none"), []);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const { cards, previews } = useMemo(() => {
    const list = query.data?.engagements ?? [];
    const cards: HomeGridEngagement[] = list.map((e) => ({
      id: e.code,
      code: e.code,
      title: e.title,
      clientLabel: e.clientLabel,
      lastViewedAt: null,
      workCount: e.workCount,
    }));
    const previews = new Map<string, HomePreviewState>(
      list.map((e) => [e.code, { status: "ready", board: e.preview }]),
    );
    return { cards, previews };
  }, [query.data]);

  return (
    <div className="min-h-dvh bg-background">
      <PublicHeader cta={<PilotLink />} />
      <main className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-8 md:px-12">
        <p className="mb-6 text-[13px] text-muted-foreground">{DEMO_LINE}</p>
        <div ref={ref}>
          {query.isPending ? (
            <p className="text-[13px] text-muted-foreground">Opening the demo.</p>
          ) : cards.length === 0 ? (
            <p className="text-[13px] text-foreground">The demo is not available right now.</p>
          ) : (
            <HomeEngagementGrid cards={cards} availableWidth={width} previews={previews} demo />
          )}
        </div>
      </main>
    </div>
  );
}

export function DemoBoardPage({ code }: { code: string }) {
  const open = useServerFn(openDemoBoardFn);
  const query = useQuery({
    queryKey: ["demo-board", code],
    queryFn: () => open({ data: { code } }),
    staleTime: 60_000,
    retry: false,
  });

  useEffect(() => noteDemoOpened("board", code), [code]);
  const [openTurn, setOpenTurn] = useState<{ workItemId: string; turnNo: number; nonce: number } | null>(null);

  const back = (
    <Link to="/demo" className="font-mono text-[11.5px] uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground">
      Back to the demo
    </Link>
  );

  if (query.isPending || !query.data || query.data.status !== "open") {
    return (
      <main className="flex h-dvh w-full items-center justify-center bg-background p-6">
        <div className="max-w-sm text-center">
          <p className="text-[13px] text-foreground">
            {query.isPending ? "Opening the board." : "This demo board is not available."}
          </p>
          {query.isPending ? null : <div className="mt-3">{back}</div>}
        </div>
      </main>
    );
  }

  const { board, engagement } = query.data;
  const presets = query.data.presets ?? [];
  return (
    <main className="flex h-dvh w-full flex-col bg-background">
      <header className="flex h-[52px] shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4">
        {back}
        <span className="min-w-0 truncate text-[13px] font-medium text-foreground">
          {engagement.clientLabel ?? engagement.title}
        </span>
        <PilotLink className="rounded-[var(--radius)] bg-primary px-3 py-1.5 font-mono text-[11.5px] uppercase tracking-[0.08em] text-primary-foreground" />
      </header>
      <div className="min-h-0 flex-1">
        <SharedBoardView board={board} openTurn={openTurn} onNodeOpened={(kind) => noteDemoCardOpened(code, kind)} />
      </div>
      <DemoPresetBar
        code={code}
        presets={presets}
        onOpenTurn={(workItemId, turnNo, position) => {
          noteDemoTurnOpened(code, position);
          setOpenTurn({ workItemId, turnNo, nonce: Date.now() });
        }}
      />
    </main>
  );
}

function savedDate(iso: string | null): string {
  if (!iso) return "an earlier date";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "an earlier date" : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** Unit 2: preset questions with saved answers. Answered rows only, no free text. */
export function DemoPresetBar({
  code,
  presets,
  onOpenTurn,
}: {
  code: string;
  presets: DemoPreset[];
  onOpenTurn: (workItemId: string, turnNo: number, position: number) => void;
}) {
  const [active, setActive] = useState<number | null>(null);
  const answered = presets.filter((p) => p.answer.trim().length > 0);
  if (answered.length === 0) return null;
  const open = answered.find((p) => p.position === active) ?? null;
  return (
    <section aria-label="Ask Lasso, saved answers" className="shrink-0 border-t border-border bg-card">
      {open ? (
        <div className="max-h-[45dvh] overflow-y-auto px-4 pb-3 pt-4" data-testid="demo-preset-panel">
          <div className="mx-auto max-w-3xl space-y-3">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-[13px] font-medium text-foreground">{open.question}</h2>
              <button type="button" onClick={() => setActive(null)} className="shrink-0 font-mono text-[11.5px] uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground">
                Close
              </button>
            </div>
            <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
              Saved answer, generated by Lasso on {savedDate(open.generatedAt)}
            </p>
            <MarkdownMessage content={open.answer} className="text-[13px]" />
            {open.turnRefs.length > 0 ? (
              <div className="space-y-1">
                {open.turnRefs.map((ref) => (
                  <div key={`${ref.work_item_id}:${ref.turn_no}`}>
                    <button
                      type="button"
                      onClick={() => onOpenTurn(ref.work_item_id, ref.turn_no, open.position)}
                      className="text-left text-[13px] text-foreground underline underline-offset-2 hover:text-muted-foreground"
                    >
                      Open the exact turn
                    </button>
                    <span className="ml-2 text-[11.5px] text-muted-foreground">{ref.label}</span>
                    {isChatLinkQuestion(open.question) ? (
                      <p className="text-[11.5px] text-muted-foreground">{DEMO_CHAT_LINK_NOTE}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
            <ContextAudit manifest={open.manifest} readOnly />
          </div>
        </div>
      ) : null}
      <div className="flex gap-2 overflow-x-auto px-4 py-3" data-testid="demo-preset-chips">
        {answered.map((p) => (
          <button
            key={p.position}
            type="button"
            aria-pressed={p.position === active}
            onClick={() => {
              if (p.position === active) return setActive(null);
              setActive(p.position);
              noteDemoPresetOpened(code, p.position);
            }}
            className={`shrink-0 rounded-[var(--radius)] border px-3 py-1.5 text-left text-[11.5px] ${p.position === active ? "border-foreground text-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}
          >
            {p.question}
          </button>
        ))}
      </div>
    </section>
  );
}
