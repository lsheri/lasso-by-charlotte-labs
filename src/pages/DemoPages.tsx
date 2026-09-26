/**
 * Product shell 1.3: the public demo Home and a read-only demo board.
 * Nothing here writes. Signed-in people see exactly what anyone else sees.
 */

import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";

import { SharedBoardView } from "@/components/canvas-lab/SharedBoardView";
import { DemoHomeWorkspace } from "@/components/demo/DemoHomeWorkspace";
import { DemoWorkboardSandbox } from "@/components/demo/DemoWorkboardSandbox";
import { DemoTourNote } from "@/components/demo/DemoTourNote";
import { LassoLoopMark } from "@/components/layout/LassoLoopMark";
import { MarkdownMessage } from "@/components/markdown/MarkdownMessage";
import { ContextAudit } from "@/components/reflect/ContextTrail";
import { AnswerTurnLinks } from "@/components/reflect/AnswerTurnLinks";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { useSession } from "@/hooks/use-session";
import { openDemoBoardFn } from "@/lib/demo.functions";
import { useDemoTour } from "@/hooks/use-demo-tour";
import { DEMO_CHAT_LINK_NOTE, isChatLinkQuestion, type DemoPreset } from "@/lib/demo-presets-shared";
import { noteDemoCardOpened, noteDemoOpened, noteDemoPresetOpened, noteDemoTurnOpened } from "@/lib/demo-telemetry";

export const DEMO_LINE = "A demo workspace. Every figure is invented.";

function PilotLink({ className, onChoose }: { className?: string; onChoose?: () => void }) {
  return (
    <Link
      to="/"
      hash="pilot"
      data-testid="demo-book-pilot"
      onClick={onChoose}
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
  return (
    <div className="min-h-dvh bg-background">
      <PublicHeader cta={<PilotLink />} />
      <main className="demo-tour-page mx-auto w-full max-w-6xl px-4 pb-16 sm:px-8 md:px-12">
        <p className="mb-6 text-[13px] text-muted-foreground">{DEMO_LINE}</p>
        <DemoHomeWorkspace surface="home" />
      </main>
    </div>
  );
}

export function DemoPlaygroundPage() {
  const open = useServerFn(openDemoBoardFn);
  const query = useQuery({ queryKey: ["demo-board", "YSM-01"], queryFn: () => open({ data: { code: "YSM-01" } }), staleTime: 60_000, retry: false });
  return query.isLoading ? <main className="demo-play-state">Opening the finished board…</main> : query.isError || !query.data || query.data.status !== "open" ? <main className="demo-play-state"><h1>The demo board is unavailable.</h1><p>Please try again shortly.</p></main> : <DemoWorkboardSandbox board={query.data.board} presets={query.data.presets} proof={query.data.proof} clientLabel={query.data.engagement.clientLabel ?? "YellowSigil Medical Group"} engagementTitle={query.data.engagement.title} />;
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
  const tour = useDemoTour();
  const { session, loading: sessionLoading } = useSession();

  const back = session || sessionLoading ? (
    <Link to="/demo" className="font-mono text-[11.5px] uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground">Back to the demo</Link>
  ) : (
    <Link to="/" hash="demo" className="font-mono text-[11.5px] uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground">Back to the demo</Link>
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
  const positions = new Set(presets.filter((preset) => preset.answer.trim().length > 0).map((preset) => preset.position));
  const first = presets.find((preset) => preset.position === 1);
  const second = presets.find((preset) => preset.position === 2);
  const stepMissing =
    code === "YSM-01" &&
    ((tour.step === 2 && !positions.has(1)) ||
      (tour.step === 3 && (!positions.has(1) || !first?.manifest)) ||
      (tour.step === 4 && !positions.has(2)) ||
      (tour.step === 5 && (!positions.has(2) || (second?.turnRefs.length ?? 0) === 0)));
  if (stepMissing) queueMicrotask(() => tour.skipMissing(tour.step));
  return (
    <main className="demo-tour-page flex h-dvh w-full flex-col bg-background">
      <header className="flex h-[52px] shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4">
        {back}
        <span className="min-w-0 truncate text-[13px] font-medium text-foreground">
          {engagement.clientLabel ?? engagement.title}
        </span>
        <PilotLink onChoose={() => tour.complete(7, code)} className="rounded-[var(--radius)] bg-primary px-3 py-1.5 font-mono text-[11.5px] uppercase tracking-[0.08em] text-primary-foreground" />
      </header>
      <div className="min-h-0 flex-1">
        <SharedBoardView
          board={board}
          openTurn={openTurn}
          focusedTurnTestId="demo-highlighted-turn"
          onReaderClosed={() => tour.complete(6, code)}
          onNodeOpened={(kind) => noteDemoCardOpened(code, kind)}
        />
      </div>
      <DemoPresetBar
        code={code}
        presets={presets}
        onPresetOpened={(position) => tour.complete(position === 1 ? 2 : position === 2 ? 4 : -1, code)}
        onTrailOpened={(position) => { if (position === 1) tour.complete(3, code); }}
        onOpenTurn={(workItemId, turnNo, position) => {
          noteDemoTurnOpened(code, position);
          setOpenTurn({ workItemId, turnNo, nonce: Date.now() });
          if (position === 2) tour.complete(5, code);
        }}
      />
      {code === "YSM-01" && tour.step === 2 && positions.has(1) ? <DemoTourNote step={2} anchorTestId="demo-preset-1" onDismiss={tour.dismiss}>Ask the CFO's question.</DemoTourNote> : null}
      {code === "YSM-01" && tour.step === 3 && positions.has(1) && first?.manifest ? <DemoTourNote step={3} anchorTestId="demo-context-trail" onDismiss={tour.dismiss}>See exactly what Lasso read.</DemoTourNote> : null}
      {code === "YSM-01" && tour.step === 4 && positions.has(2) ? <DemoTourNote step={4} anchorTestId="demo-preset-2" onDismiss={tour.dismiss}>Now find the chat where the board settled it.</DemoTourNote> : null}
      {code === "YSM-01" && tour.step === 5 && (second?.turnRefs.length ?? 0) > 0 ? <DemoTourNote step={5} anchorTestId="demo-open-turn-2" onDismiss={tour.dismiss}>Open the turn itself.</DemoTourNote> : null}
      {code === "YSM-01" && tour.step === 6 && openTurn ? <DemoTourNote step={6} anchorTestId="demo-highlighted-turn" onDismiss={tour.dismiss}>This is the turn. Every answer points back to one.</DemoTourNote> : null}
      {tour.step === 7 ? <DemoTourNote step={7} anchorTestId="demo-book-pilot" onDismiss={() => tour.complete(7, code)} final>Want this on your team's work? Book a pilot.</DemoTourNote> : null}
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
  onPresetOpened,
  onTrailOpened,
}: {
  code: string;
  presets: DemoPreset[];
  onOpenTurn: (workItemId: string, turnNo: number, position: number) => void;
  onPresetOpened?: (position: number) => void;
  onTrailOpened?: (position: number) => void;
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
                <AnswerTurnLinks refs={open.turnRefs} onOpen={(ref) => onOpenTurn(ref.work_item_id, ref.turn_no, open.position)} testId={`demo-open-turn-${open.position}`} />
                {isChatLinkQuestion(open.question) ? <p className="text-[11.5px] text-muted-foreground">{DEMO_CHAT_LINK_NOTE}</p> : null}
              </div>
            ) : null}
            <ContextAudit manifest={open.manifest} readOnly testId="demo-context-trail" onOpenChange={(next) => { if (next) onTrailOpened?.(open.position); }} />
          </div>
        </div>
      ) : null}
      <div className="flex gap-2 overflow-x-auto px-4 py-3" data-testid="demo-preset-chips" data-demo-tour-collision-bar>
        {answered.map((p) => (
          <button
            key={p.position}
            type="button"
            aria-pressed={p.position === active}
            data-testid={`demo-preset-${p.position}`}
            onClick={() => {
              if (p.position === active) return setActive(null);
              setActive(p.position);
              noteDemoPresetOpened(code, p.position);
              onPresetOpened?.(p.position);
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
