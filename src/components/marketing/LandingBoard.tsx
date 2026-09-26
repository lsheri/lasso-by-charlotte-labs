import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { type CSSProperties, type FormEvent, type RefObject, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { LassoLoopMark } from "@/components/layout/LassoLoopMark";
import { LandingParticlePhrase } from "@/components/marketing/LandingParticlePhrase";
import { FocusSection } from "@/components/marketing/FocusSection";
import { ToolLogo } from "@/components/marketing/ToolLogo";
import { MarkdownMessage } from "@/components/markdown/MarkdownMessage";
import { AnswerRail, ContextAudit, ThinkingTrail } from "@/components/reflect/ContextTrail";
import { LassoThinkingMark } from "@/components/reflect/LassoThinkingMark";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { VendorMark } from "@/components/work/SourceMark";
import { openDemoBoardFn } from "@/lib/demo.functions";
import type { DemoPreset } from "@/lib/demo-presets-shared";
import { submitPilotRequestFn } from "@/lib/pilot-request.functions";
import { recordAnonymousEventFn } from "@/lib/telemetry.functions";
import type { SharedBoardDto, SharedSeedWork } from "@/lib/board-share-shared";
import { parseLandingProof, type LandingProof, type LandingProofModel } from "@/lib/landing-proof-shared";
import { seedPlacement } from "@/lib/public-work-allowlist";
import { keptContentLabel } from "@/lib/work-open";

export const LANDING_BOARD_STEPS = [
  { key: "problem", label: "Problem", headline: "Your firm's thinking went invisible.", line: "The work is scattered across tools, tabs, and drafts." },
  { key: "canvas", label: "Canvas", headline: "All your AI research and conversations, on one infinite canvas.", line: "Today your team's thinking is spread across four AI tools and a hundred tabs." },
  { key: "workstreams", label: "Workstreams", headline: "Grouped into workstreams, the way your team actually splits the work.", line: "The shape of the engagement becomes visible without changing the source material." },
  { key: "deliverable", label: "Deliverable", headline: "Every workstream wired to the deliverable it fed.", line: "The finished deck stays connected to the work behind it." },
  { key: "circle", label: "Circle", headline: "A number worth asking about.", line: "Where did the $1.4M on slide 3 come from?" },
  { key: "ask", label: "Ask", headline: "Every number in the deck has a trail.", line: "Where it came from, what your team checked, what's still open. Open the chat and check it yourself." },
  { key: "the-turn", label: "The turn", headline: "Hand-check the actual chat.", line: "The proof card opens turn 4 in context, with turns 2 through 6 highlighted." },
  { key: "still-open", label: "Still open", headline: "And what's still open, pinned where it came from.", line: "Questions stay beside the work that raised them." },
  { key: "share", label: "Share", headline: "Share the deliverable, not the drafts.", line: "A read-only view closes in 48 hours and opens only what you chose." },
  { key: "try-it", label: "Try it", headline: "Your turn.", line: "Open the invented workspace and inspect the board yourself." },
] as const;

type StepKey = (typeof LANDING_BOARD_STEPS)[number]["key"];
type StoryInput = "scroll" | "jump";

const TOOL_BADGES = [
  { key: "claude", label: "Claude" },
  { key: "chatgpt", label: "ChatGPT" },
  { key: "gemini", label: "Gemini" },
  { key: "googledrive", label: "Drive" },
  { key: "gmail", label: "Gmail" },
] as const;

const FALLBACK_SLIDES = ["Partnership model", "Board structure", "$1.4M year-two net benefit", "Comparable health alliances", "Chair terms", "FY27 recommendation"];

function event(viewId: string, eventType: "landing.viewed" | "landing.story_section_viewed" | "landing.section_jumped" | "landing.proof_link_opened" | "landing.pilot_cta_clicked" | "landing.pilot_requested" | "landing.usecase_played", dims: Record<string, string>) {
  void recordAnonymousEventFn({ data: { event_type: eventType, view_id: viewId, dims } }).catch(() => undefined);
}

function toolKey(item: SharedSeedWork): string {
  return (item.source_vendor ?? item.source_meta?.vendor ?? item.source ?? "document").toLowerCase().replace(/^connector:/, "");
}

function ToolIdentity({ tool, compact = false }: { tool: string; compact?: boolean }) {
  return <ToolLogo vendor={tool} compact={compact} />;
}

function BoardCard({ item, index, step, pin, read, turnCount, position, articleRef, proofSource }: { item: SharedSeedWork; index: number; step: number; pin: number | undefined; read: boolean; turnCount: number | null; position: { left: number; top: number }; articleRef?: RefObject<HTMLElement | null> | undefined; proofSource?: boolean | undefined }) {
  return (
    <article ref={articleRef} className={`lb-board-card${proofSource ? " lb-proof-source-card" : ""}`} data-arrived={step >= 1} style={{ "--lb-card-index": index, "--lb-card-left": `${position.left}px`, "--lb-card-top": `${position.top}px` } as CSSProperties}>
      <ToolLogo vendor={toolKey(item)} />
      <strong>{item.title}</strong>
      <small>{keptContentLabel(item, turnCount)}</small>
      {pin ? <span className="lb-pin" aria-label={`Source ${pin}`}>{pin}</span> : read ? <span className="lb-read-dot" aria-label="Read for this response" /> : null}
    </article>
  );
}

type ReplayPhase = "typing" | "reading" | "streaming" | "done";

function wordsThrough(text: string, count: number): string {
  return text.split(/\s+/).slice(0, count).join(" ");
}

function usePresetReplay(step: number, presets: DemoPreset[]) {
  const reduced = useRef(false);
  const started = useRef(new Set<number>());
  const [phase, setPhase] = useState<ReplayPhase>("done");
  const [typed, setTyped] = useState("");
  const [streamed, setStreamed] = useState("");
  const [readCount, setReadCount] = useState(0);
  const position = step === 5 ? 1 : step === 6 ? 2 : step === 7 ? 4 : null;
  const preset = position ? presets.find((entry) => entry.position === position) : undefined;

  useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  useEffect(() => {
    if (!position || !preset) return;
    if (reduced.current || started.current.has(position)) {
      setTyped("");
      setStreamed(preset.answer);
      setReadCount(preset.manifest?.items.length ?? 0);
      setPhase("done");
      return;
    }
    started.current.add(position);
    setTyped("");
    setStreamed("");
    setReadCount(0);
    setPhase("typing");
    const timers: number[] = [];
    const questionChars = preset.question.length;
    let char = 0;
    const typing = window.setInterval(() => {
      char += 1;
      setTyped(preset.question.slice(0, char));
      if (char < questionChars) return;
      window.clearInterval(typing);
      setPhase("reading");
      const itemCount = preset.manifest?.items.length ?? 0;
      const reading = window.setInterval(() => setReadCount((count) => Math.min(itemCount, count + 1)), Math.max(300, 2_200 / Math.max(itemCount, 1)));
      timers.push(reading);
      timers.push(window.setTimeout(() => {
        window.clearInterval(reading);
        setReadCount(itemCount);
        setPhase("streaming");
        const words = preset.answer.split(/\s+/);
        let word = 0;
        const stream = window.setInterval(() => {
          word += 1;
          setStreamed(wordsThrough(preset.answer, word));
          if (word < words.length) return;
          window.clearInterval(stream);
          setPhase("done");
        }, 40);
        timers.push(stream);
      }, 2_500));
    }, 35);
    timers.push(typing);
    return () => timers.forEach((timer) => {
      window.clearTimeout(timer);
      window.clearInterval(timer);
    });
  }, [position, preset]);

  return { phase, preset, readCount, streamed, typed, position };
}

function ReplayAnswer({ preset, finished = true, showAudit = true }: { preset: DemoPreset; finished?: boolean; showAudit?: boolean }) {
  return (
    <div className="nb-conversation-message max-w-none flex-row items-start gap-3">
      <LassoLoopMark className="size-7 shrink-0 text-lasso-green" />
      <div className="nb-conversation-body min-w-0 flex-1 gap-0">
        <span className="nb-binder-line font-sans text-[13px] font-semibold text-ink">Lasso</span>
        <AnswerRail state="done">
          <MarkdownMessage content={preset.answer} variant="binder" />
          {showAudit && finished && preset.manifest ? <ContextAudit manifest={preset.manifest} readOnly initialOpen /> : null}
        </AnswerRail>
      </div>
    </div>
  );
}

function proofDate(proof: LandingProof): string {
  const value = proof.turns.find((turn) => turn.turn_no === 2)?.ts;
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function ProofCard({ proof, model, onShowSlide, onOpenTurn }: { proof: LandingProof; model: LandingProofModel; onShowSlide: () => void; onOpenTurn: () => void }) {
  const turn = (number: number) => proof.turns.find((entry) => entry.turn_no === number);
  const role = (number: number) => turn(number)?.role === "user" ? "you said" : "Claude said";
  return (
    <section className="lb-proof-card lb-caption-attention" data-testid="landing-proof-card">
      <h4>${model.scenarioB.toFixed(1)}M = ${model.savings.toFixed(1)}M savings − ${model.transition.toFixed(1)}M transition</h4>
      <div className="lb-proof-origin"><p className="lb-micro">WHERE IT CAME FROM</p><ToolLogo vendor={proof.vendor} /><strong>{proof.title}</strong><span>Turn 2 · {proofDate(proof)}</span><ul>{model.inputs.map((input) => <li key={input}>{input}</li>)}</ul></div>
      <div className="lb-proof-timeline"><p className="lb-micro">WHAT WAS CHECKED AFTER</p>
        {[3, 4, 5, 6].map((number, index) => <article key={number} style={{ "--lb-proof-row": index } as CSSProperties}><span>Turn {number} · {role(number)}</span>{number === 4 ? <div><p>{turn(number)?.content}</p><div className="lb-proof-bars">{model.lines.map((line) => <span key={line.label}><i style={{ "--lb-proof-bar": `${(line.amount / Math.max(...model.lines.map((entry) => entry.amount))) * 100}%` } as CSSProperties} />{line.label} ${line.amount.toFixed(1)}M</span>)}</div></div> : <p>{turn(number)?.content}</p>}</article>)}
      </div>
      <div className="lb-proof-open"><p className="lb-micro">STILL UNCONFIRMED</p><p>{model.unconfirmed}</p></div>
      <div className="lb-proof-actions"><Button asChild size="sm"><Link to="/demo/conversations" search={{ item: proof.itemId, turn: 4, from: "story" }} onClick={onOpenTurn}>Open the chat at turn 4 to hand-check</Link></Button><Button type="button" size="sm" variant="outline" onClick={onShowSlide}>Show slide 3</Button></div>
    </section>
  );
}

function AskReplay({ presets, step, onFinished, clientLabel, engagementTitle, proof, proofModel, onShowSlide, onOpenTurn }: { presets: DemoPreset[]; step: number; onFinished: (finished: boolean) => void; clientLabel: string; engagementTitle: string; proof: LandingProof | null; proofModel: LandingProofModel | null; onShowSlide: () => void; onOpenTurn: () => void }) {
  const replay = usePresetReplay(step, presets);
  const threadRef = useRef<HTMLDivElement>(null);
  const shownPositions = step === 5 ? [1] : step === 6 ? [1, 2] : [1, 2, 4];
  const liveItems = replay.preset?.manifest?.items.slice(0, replay.readCount) ?? [];
  useEffect(() => {
    onFinished(replay.phase === "done");
  }, [onFinished, replay.phase]);
  useLayoutEffect(() => {
    const thread = threadRef.current;
    if (!thread) return;
    thread.scrollTo({ top: thread.scrollHeight, behavior: replay.phase === "done" ? "auto" : "smooth" });
  }, [replay.phase, replay.readCount, replay.streamed, replay.typed]);
  return (
    <aside className="lb-answer-sheet" aria-label="Ask Lasso replay" data-replay-phase={replay.phase} data-story-scroll="locked">
      <header className="lb-ask-header"><LassoThinkingMark kind="signature" size={44} /><div><p className="lb-micro">ASK LASSO</p><h3>{clientLabel}</h3><p className="lb-ask-engagement-title">{engagementTitle}</p></div></header>
      <div ref={threadRef} className="lb-replay-thread nb-binder">
        {shownPositions.map((position) => {
          const preset = presets.find((entry) => entry.position === position);
          if (!preset) return null;
          const current = replay.position === position;
          const showQuestion = !current || replay.phase !== "typing";
          const answerText = current ? replay.streamed : preset.answer;
          return <div key={position} className="lb-replay-turn">
            {showQuestion ? <div className="lb-replay-question"><span>You</span><p>{preset.question}</p></div> : null}
            {current && replay.phase === "reading" ? <AnswerRail state="working"><ThinkingTrail items={preset.manifest?.items.map((item) => ({ id: item.id, title: item.title })) ?? []} finalPhase="Writing" manifest={liveItems.length > 0 && preset.manifest ? { ...preset.manifest, items: liveItems } : null} /></AnswerRail> : null}
            {answerText ? <ReplayAnswer preset={{ ...preset, answer: answerText }} finished={!current || replay.phase === "done"} showAudit={position !== 1} /> : null}
            {position === 1 && proof && proofModel && (!current || replay.phase === "done") ? <><ProofCard proof={proof} model={proofModel} onShowSlide={onShowSlide} onOpenTurn={onOpenTurn} />{preset.manifest ? <ContextAudit manifest={preset.manifest} readOnly initialOpen={false} buttonLabel="Show the full read list" /> : null}</> : null}
          </div>;
        })}
      </div>
      <footer className="lb-replay-composer">
        <Textarea value={replay.phase === "typing" ? replay.typed : ""} readOnly rows={2} aria-label="Ask Lasso question" />
        <Button disabled data-replay-send={replay.phase === "reading" ? "pressed" : undefined}>{replay.phase === "reading" ? "Sending" : "Send"}</Button>
      </footer>
    </aside>
  );
}

type LassoBox = { left: number; top: number; width: number; height: number };

function DeckSlide({ index, clientName, numberRef, proof }: { index: number; clientName: string; numberRef: RefObject<HTMLSpanElement | null>; proof: LandingProofModel | null }) {
  if (index === 0) return <section className="lb-deck-slide lb-slide-cover"><small>1</small><div className="lb-slide-cover-copy"><b>FY27 growth partnerships</b><span>{clientName}</span></div><svg viewBox="0 0 100 64" aria-hidden="true"><path d="M8 50 35 12l18 29 17-22 22 31Z" /><circle cx="69" cy="17" r="7" /></svg></section>;
  if (index === 1) { const values = proof ? [proof.scenarioA, proof.scenarioB, proof.scenarioC] : [0.3, 1.4, 1.2]; const max = Math.max(...values); return <section className="lb-deck-slide lb-slide-scenarios"><small>2</small><b>Three scenarios</b><div>{["A", "B", "C"].map((label, itemIndex) => <span key={label} data-picked={label === "B"}><i style={{ "--lb-scenario-height": `${((values[itemIndex] ?? 0) / max) * 100}%` } as CSSProperties} />{label} ${values[itemIndex]?.toFixed(1)}M</span>)}</div></section>; }
  if (index === 2) return <section className="lb-deck-slide lb-slide-number"><small>3</small><b>Year-two net benefit</b><span ref={numberRef} className="lb-number" data-testid="landing-board-number">$1.4M</span><div className="lb-waterfall" aria-label="$2.1M savings minus $0.7M costs equals $1.4M year-two net benefit"><span className="lb-waterfall-savings"><i data-units="2.1" />$2.1M<br />savings</span><span className="lb-waterfall-costs"><i data-units="0.7" />-$0.7M<br />costs</span><span className="lb-waterfall-net"><i data-units="1.4" />$1.4M<br />net</span></div></section>;
  if (index === 3) return <section className="lb-deck-slide lb-slide-governance"><small>4</small><b>Board structure</b><div><i /><i /><i /></div><span>Chair: two-term limit</span></section>;
  if (index === 4) return <section className="lb-deck-slide lb-slide-alliances"><small>5</small><b>Comparable alliances</b><div>{[1, 2, 3, 4, 5].map((item) => <i key={item} />)}</div></section>;
  return <section className="lb-deck-slide lb-slide-decision"><small>6</small><b>Decision asked for Oct 1</b><span aria-hidden="true" /></section>;
}

function ExactTurn({ board, preset }: { board: SharedBoardDto; preset: DemoPreset | undefined }) {
  const ref = preset?.turnRefs.find((entry) => entry.turn_no === 5) ?? preset?.turnRefs[0];
  const item = ref ? board.seed.work.find((entry) => entry.id === ref.work_item_id) : undefined;
  const turn = ref ? board.turns[ref.work_item_id]?.find((entry) => entry.turn_no === ref.turn_no) : undefined;
  return (
    <aside className="lb-turn-reader" aria-label="Exact turn reader">
      <header><div>{item ? <VendorMark item={item} /> : <ToolIdentity tool="document" />}<h3>{item?.title ?? "Source conversation"}</h3></div><span>READ ONLY</span></header>
      <div className="lb-turn-body">
        <p className="lb-turn-muted">Earlier turns are kept above.</p>
        <article className="lb-highlight-turn"><span>TURN {turn?.turn_no ?? ref?.turn_no ?? 5}</span><p>{turn?.content ?? preset?.answer ?? "The saved source turn is not available right now."}</p></article>
      </div>
    </aside>
  );
}

function StoryBoard({ board, presets, proof, step, attentionStep, attentionNonce, clientLabel, engagementTitle, onShowSlide, onOpenTurn }: { board: SharedBoardDto; presets: DemoPreset[]; proof: LandingProof | null; step: number; attentionStep: number; attentionNonce: number; clientLabel: string; engagementTitle: string; onShowSlide: () => void; onOpenTurn: () => void }) {
  const [replayFinished, setReplayFinished] = useState(false);
  const [lassoBox, setLassoBox] = useState<LassoBox | null>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const numberRef = useRef<HTMLSpanElement>(null);
  const sourceRef = useRef<HTMLElement>(null);
  const onReplayFinished = useCallback((finished: boolean) => setReplayFinished(finished), []);
  useEffect(() => {
    setReplayFinished(false);
  }, [step]);
  const deckItem = board.seed.work.find((item) => /board deck/i.test(item.title));
  const items = board.seed.work.filter((item) => item.id !== deckItem?.id).slice(0, 9);
  const slides = useMemo(() => Array.from({ length: 6 }, (_, index) => FALLBACK_SLIDES[index] || `Slide ${index + 1}`), []);
  const foundNumberSlide = slides.findIndex((slide) => /\$1\.4m/i.test(slide));
  const numberSlideIndex = foundNumberSlide >= 0 ? foundNumberSlide : 2;
  const first = presets.find((preset) => preset.position === 1);
  const proofModel = proof ? parseLandingProof(proof) : null;
  const second = presets.find((preset) => preset.position === 2);
  const trailNumbers = new Map(first?.manifest?.items.map((item, index) => [item.id, index + 1]) ?? []);
  const citedIds = new Set(first?.turnRefs.map((ref) => ref.work_item_id) ?? []);
  const readIds = new Set(first?.manifest?.items.map((item) => item.id) ?? []);
  const visibleTasks = board.seed.tasks.filter((task) => !/board deck/i.test(task.name)).slice(0, 2);
  const taskSlots = new Map<string, number>();
  const cardPositions = items.map((item, index) => {
    const taskIndex = visibleTasks.findIndex((task) => seedPlacement(item).includes(task.id));
    if (taskIndex < 0) return { left: 188 + (index % 2) * 312, top: 438 };
    const slot = taskSlots.get(visibleTasks[taskIndex]?.id ?? "") ?? 0;
    taskSlots.set(visibleTasks[taskIndex]?.id ?? "", slot + 1);
    return { left: taskIndex === 0 ? 188 : 500, top: 176 + slot * 140 };
  });
  const [proofLine, setProofLine] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const measureLasso = useCallback(() => {
    const layer = layerRef.current;
    const number = numberRef.current;
    if (!layer || !number) return;
    const layerRect = layer.getBoundingClientRect();
    const numberRect = number.getBoundingClientRect();
    const scale = layerRect.width / layer.offsetWidth;
    if (!Number.isFinite(scale) || scale <= 0) return;
    const padX = 10;
    const padY = 6;
    setLassoBox({
      left: (numberRect.left - layerRect.left) / scale - padX,
      top: (numberRect.top - layerRect.top) / scale - padY,
      width: numberRect.width / scale + padX * 2,
      height: numberRect.height / scale + padY * 2,
    });
    const source = sourceRef.current;
    if (source) {
      const sourceRect = source.getBoundingClientRect();
      setProofLine({ x1: (numberRect.left + numberRect.width / 2 - layerRect.left) / scale, y1: (numberRect.top + numberRect.height / 2 - layerRect.top) / scale, x2: (sourceRect.left + sourceRect.width / 2 - layerRect.left) / scale, y2: (sourceRect.top + sourceRect.height / 2 - layerRect.top) / scale });
    }
  }, []);
  useLayoutEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    const frame = window.requestAnimationFrame(measureLasso);
    const onTransitionEnd = (event: TransitionEvent) => { if (event.propertyName === "transform") measureLasso(); };
    layer.addEventListener("transitionend", onTransitionEnd);
    window.addEventListener("resize", measureLasso);
    return () => {
      window.cancelAnimationFrame(frame);
      layer.removeEventListener("transitionend", onTransitionEnd);
      window.removeEventListener("resize", measureLasso);
    };
  }, [measureLasso, step]);
  const pulse = (target: number) => attentionStep === target ? " lb-target-pulse" : "";
  return (
    <div className="lb-stage-window" data-step={step + 1} data-testid="landing-board-stage">
      <div ref={layerRef} className="lb-board-layer">
        <div className="lb-dot-grid" />
        <div key={`tools-${attentionNonce}`} className={`lb-tool-dock${pulse(1)}`} aria-label="Sources">
          {TOOL_BADGES.map((tool) => <div key={tool.key}><ToolLogo vendor={tool.key} compact /></div>)}
        </div>
        <div key={`frames-${attentionNonce}`} className={`lb-frames${pulse(2)}`}>
          {visibleTasks.map((task, index) => <section key={task.id} style={{ "--lb-frame-index": index } as CSSProperties}><h3>{task.name}</h3><p>{task.detail}</p></section>)}
        </div>
        <div className="lb-cards">
          {items.map((item, index) => <BoardCard key={item.id} item={item} index={index} step={step} pin={step >= 5 && replayFinished && citedIds.has(item.id) ? trailNumbers.get(item.id) : undefined} read={step >= 5 && replayFinished && readIds.has(item.id)} turnCount={item.type === "ai_thread" ? board.turns[item.id]?.length ?? null : null} position={cardPositions[index] ?? { left: 188, top: 438 }} articleRef={item.id === proof?.itemId ? sourceRef : undefined} proofSource={item.id === proof?.itemId && step >= 5 && step <= 7 && replayFinished} />)}
        </div>
        <svg className="lb-connectors" viewBox="0 0 1000 620" preserveAspectRatio="none" aria-hidden="true">
          <path d="M260 230 C470 220 570 280 735 350" /><path d="M260 390 C470 390 590 380 735 350" /><path d="M540 485 C620 470 680 410 735 350" />
        </svg>
        {proofLine && step >= 5 && step <= 7 && replayFinished ? <svg className="lb-proof-connector" viewBox="0 0 1120 680" aria-hidden="true"><path d={`M ${proofLine.x1} ${proofLine.y1} C ${proofLine.x1 - 80} ${proofLine.y1}, ${proofLine.x2 + 90} ${proofLine.y2}, ${proofLine.x2} ${proofLine.y2}`} /></svg> : null}
        <article key={`deck-${attentionNonce}`} className={`lb-deck${pulse(3)}`}>
          <header><ToolLogo vendor="powerpoint" compact /><strong>{(deckItem?.title ?? "FY27 board deck v3").replace(/\s*\(slide notes\)\s*/i, "").trim()}</strong></header>
          <div>{slides.map((slide, index) => <DeckSlide key={`${slide}-${index}`} index={index} clientName={clientLabel} numberRef={numberRef} proof={proofModel} />)}</div>
          {step >= 5 && replayFinished && deckItem && citedIds.has(deckItem.id) ? <span className="lb-pin" aria-label={`Source ${trailNumbers.get(deckItem.id)}`}>{trailNumbers.get(deckItem.id)}</span> : step >= 5 && replayFinished && deckItem && readIds.has(deckItem.id) ? <span className="lb-read-dot" aria-label="Read for this response" /> : null}
        </article>
        {lassoBox ? <span key={`lasso-${attentionNonce}`} className={`lb-slide-lasso${pulse(4)}`} data-testid="landing-board-lasso" style={{ left: lassoBox.left, top: lassoBox.top, width: lassoBox.width, height: lassoBox.height }} aria-hidden="true" /> : null}
        {lassoBox ? <svg className="lb-circle-link" viewBox="0 0 1120 680" aria-hidden="true"><line x1={lassoBox.left + lassoBox.width / 2} y1={lassoBox.top + lassoBox.height / 2} x2="932" y2="482" /></svg> : null}
        <div className="lb-circle-question"><p>Where did the $1.4M on slide 3 come from?</p></div>
        {step === 7 && replayFinished ? <div key={`notes-${attentionNonce}`} className={`lb-open-notes${pulse(7)}`}><p>Confirm the vendor extension assumption.</p><p>Confirm approval by Oct 1.</p></div> : null}
      </div>
      {step >= 5 && step <= 7 ? <div key={`ask-${attentionNonce}`} className={pulse(5)}><AskReplay presets={presets} step={step} onFinished={onReplayFinished} clientLabel={clientLabel} engagementTitle={engagementTitle} proof={proof} proofModel={proofModel} onShowSlide={onShowSlide} onOpenTurn={onOpenTurn} /></div> : null}
      {step === 6 && replayFinished ? <div key={`turn-${attentionNonce}`} className={pulse(6)}><ExactTurn board={board} preset={second} /></div> : null}
      {step === 8 ? <div key={`share-${attentionNonce}`} className={`lb-share-dialog${pulse(8)}`}><p className="lb-micro">READ ONLY</p><h3>Share this board</h3><p>They open the deliverable, source cards, and the conversations behind them.</p><p>They do not open private drafts or anything outside this board.</p><strong>Closes in 48 hours</strong><small>In the demo this is shown, not issued.</small></div> : null}
    </div>
  );
}

function LandingBoardHeader({ active, onJump, onPilot }: { active: StepKey; onJump: (key: StepKey) => void; onPilot: () => void }) {
  return (
    <header className="lb-header">
      <div className="lb-header-main">
        <Link to="/" className="lb-brand"><LassoLoopMark /> <span>LASSO</span></Link>
        <nav className="lb-step-nav" aria-label="Story sections">
          {LANDING_BOARD_STEPS.map((item) => <Button key={item.key} size="sm" variant="ghost" aria-current={active === item.key ? "step" : undefined} onClick={() => onJump(item.key)}>{item.label}</Button>)}
        </nav>
        <Button asChild size="sm"><a href="#pilot" onClick={onPilot}>Book a pilot</a></Button>
      </div>
    </header>
  );
}

function LandingBoardContinuation({ viewId, onPilot }: { viewId: string; onPilot: (placement: string) => void }) {
  const submitPilot = useServerFn(submitPilotRequestFn);
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  async function submit(eventValue: FormEvent<HTMLFormElement>) {
    eventValue.preventDefault();
    setState("sending");
    const form = eventValue.currentTarget;
    const controls = form.elements as typeof form.elements & { name: HTMLInputElement; firm: HTMLInputElement; email: HTMLInputElement; teamSize: HTMLSelectElement; note: HTMLTextAreaElement; website: HTMLInputElement };
    const teamSize = controls.teamSize.value as "1-5" | "6-15" | "16-40" | "40+";
    try {
      await submitPilot({ data: { name: controls.name.value, firm: controls.firm.value, email: controls.email.value, team_size: teamSize, note: controls.note.value || undefined, website: controls.website.value } });
      event(viewId, "landing.pilot_requested", { team_size: teamSize });
      setState("sent");
    } catch { setState("error"); }
  }
  return (
    <div className="landing-next lb-continuation">
      <section className="landing-usecases mx-auto max-w-[1200px] px-4 md:px-6" aria-label="What consultants use it for">
        <div className="landing-section-head"><p className="micro-label">HOW IT WORKS</p><h2 className="pencil-title">Deliverables you can defend to a client, a partner, or a board.</h2></div>
        <div className="landing-usecase-grid">
          {["Push work in with one sentence.", "Every AI conversation, on the record.", "Every number has a source."].map((title, index) => <article className="landing-usecase" key={title}><div className="landing-usecase-media lb-usecase-art"><LassoThinkingMark kind={index === 2 ? "trace" : "signature"} size={92} /></div><div className="landing-usecase-copy"><h3>{title}</h3><p>{["Bring work from your AI tools into one shared place.", "Keep the conversations that shaped the engagement.", "Open the source behind a figure or claim."][index]}</p></div></article>)}
        </div>
      </section>
      <section className="landing-close mx-auto max-w-4xl px-6 md:px-10" data-resolved="true"><h2 className="landing-close-line1 landing-close-wordmark">Every claim, traced to the work behind it.</h2><p className="landing-close-line2"><LandingParticlePhrase text="The judgement, thinking, work... *Visible*" /></p><div className="mt-10"><Button asChild><a href="#pilot" onClick={() => onPilot("close")}>Book a pilot</a></Button></div></section>
      <div className="mx-auto max-w-3xl px-6 pb-24 md:px-10"><div id="pilot"><FocusSection className="mt-20 border-t border-rule pt-10"><p className="micro-label">PILOT</p><h2 className="pencil-title mt-4">Run it on one engagement.</h2>{state === "sent" ? <p className="mt-8 border-l-2 border-green pl-4">Thanks. Liam will be in touch within a day.</p> : <form className="landing-next-pilot-form mt-8 grid gap-5" onSubmit={submit}><label className="sr-only" aria-hidden="true"><span>Website</span><input name="website" tabIndex={-1} autoComplete="off" /></label><label><span>Name</span><input name="name" required /></label><label><span>Firm</span><input name="firm" required /></label><label><span>Work email</span><input name="email" type="email" required /></label><label><span>Team size</span><select name="teamSize" required defaultValue=""><option value="" disabled>Select team size</option><option value="1-5">1 to 5</option><option value="6-15">6 to 15</option><option value="16-40">16 to 40</option><option value="40+">40+</option></select></label><label><span>Anything we should know</span><textarea name="note" rows={4} /></label><div><Button type="submit" disabled={state === "sending"} onClick={() => onPilot("form")}>{state === "sending" ? "Sending…" : "Book a pilot"}</Button></div>{state === "error" ? <p role="alert">That didn't go through. Email liam@charlotte-labs.com and we'll pick it up.</p> : null}</form>}</FocusSection></div></div>
      <footer className="border-t border-rule"><div className="mx-auto flex max-w-3xl flex-wrap gap-4 px-6 py-8 font-mono text-[11px] text-muted-foreground"><span>Charlotte Labs</span><a href="https://charlotte-labs.com">charlotte-labs.com</a><a href="mailto:liam@charlotte-labs.com">liam@charlotte-labs.com</a><Link to="/trust">Trust &amp; data</Link></div></footer>
    </div>
  );
}

export function LandingBoard() {
  const open = useServerFn(openDemoBoardFn);
  const query = useQuery({ queryKey: ["landing-board", "YSM-01"], queryFn: () => open({ data: { code: "YSM-01" } }), staleTime: 60_000, retry: false });
  const viewId = useRef(typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));
  const [active, setActive] = useState(0);
  const [settledStep, setSettledStep] = useState(0);
  const [attentionNonce, setAttentionNonce] = useState(0);
  const activeRef = useRef(0);
  const transitioning = useRef(false);
  const queued = useRef<{ index: number; input: StoryInput } | null>(null);
  const jumpTarget = useRef<number | null>(null);
  const seen = useRef(new Set<string>());
  const settleTimer = useRef<number | null>(null);
  const transitionTimer = useRef<number | null>(null);

  useEffect(() => { event(viewId.current, "landing.viewed", { variant: "b2b", surface: "landing-board" }); }, []);
  const settle = useCallback((index: number, inputMode: StoryInput) => {
    if (settleTimer.current !== null) window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => {
      if (activeRef.current !== index || transitioning.current || queued.current) return;
      setSettledStep((current) => {
        if (current === index) return current;
        setAttentionNonce((nonce) => nonce + 1);
        return index;
      });
      const key = LANDING_BOARD_STEPS[index]?.key;
      if (!key || seen.current.has(`${key}:${inputMode}`)) return;
      seen.current.add(`${key}:${inputMode}`);
      event(viewId.current, "landing.story_section_viewed", { section: key, input_mode: inputMode });
    }, 800);
  }, []);

  const activate = useCallback((index: number, inputMode: StoryInput, immediate = false) => {
    if (index === activeRef.current && !transitioning.current) {
      settle(index, inputMode);
      return;
    }
    if (transitioning.current && !immediate) {
      queued.current = { index, input: inputMode };
      return;
    }
    if (transitionTimer.current !== null) window.clearTimeout(transitionTimer.current);
    if (settleTimer.current !== null) window.clearTimeout(settleTimer.current);
    queued.current = null;
    activeRef.current = index;
    setActive(index);
    transitioning.current = !immediate;
    const finish = () => {
      transitioning.current = false;
      const next = queued.current;
      queued.current = null;
      if (next && next.index !== activeRef.current) activate(next.index, next.input);
      else settle(index, inputMode);
    };
    if (immediate) finish();
    else transitionTimer.current = window.setTimeout(finish, 700);
  }, [settle]);

  useEffect(() => {
    document.documentElement.classList.add("lb-scroll-root");
    const sections = Array.from(document.querySelectorAll<HTMLElement>("[data-lb-step]"));
    let frame = 0;
    const readStep = () => {
      frame = 0;
      if (jumpTarget.current !== null) return;
      const threshold = window.innerHeight * 0.55;
      let latest = 0;
      for (const section of sections) {
        if (section.getBoundingClientRect().top <= threshold) latest = Number(section.dataset["lbStep"] ?? latest);
      }
      activate(latest, "scroll");
    };
    const onScroll = () => { if (!frame) frame = window.requestAnimationFrame(readStep); };
    window.addEventListener("scroll", onScroll, { passive: true });
    readStep();
    return () => {
      document.documentElement.classList.remove("lb-scroll-root");
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
      if (settleTimer.current !== null) window.clearTimeout(settleTimer.current);
      if (transitionTimer.current !== null) window.clearTimeout(transitionTimer.current);
    };
  }, [activate]);

  function jump(key: StepKey) {
    const index = LANDING_BOARD_STEPS.findIndex((step) => step.key === key);
    if (index < 0) return;
    jumpTarget.current = index;
    activate(index, "jump", true);
    event(viewId.current, "landing.section_jumped", { section: key });
    const target = document.getElementById(`lb-${key}`);
    if (target) window.scrollTo({ top: window.scrollY + target.getBoundingClientRect().top - window.innerHeight * 0.54, behavior: "auto" });
    window.setTimeout(() => {
      jumpTarget.current = null;
    }, 120);
  }
  function pilot(placement: string) { event(viewId.current, "landing.pilot_cta_clicked", { placement }); }
  const result = query.data;
  return (
    <div className="landing-board-page">
      <LandingBoardHeader active={LANDING_BOARD_STEPS[active]?.key ?? "problem"} onJump={jump} onPilot={() => pilot("header")} />
      <main className="lb-story">
        <div className="lb-sticky-stage">
          {result?.status === "open" && "board" in result ? <StoryBoard board={result.board} presets={result.presets} proof={result.proof} step={active} attentionStep={settledStep} attentionNonce={attentionNonce} clientLabel={result.engagement.clientLabel ?? ""} engagementTitle={result.engagement.title} onShowSlide={() => { event(viewId.current, "landing.proof_link_opened", { step: "6", target: "slide" }); jump("circle"); }} onOpenTurn={() => event(viewId.current, "landing.proof_link_opened", { step: "6", target: "turn" })} /> : <div className="lb-stage-window lb-loading">{query.isPending ? "Opening the demo board." : "The demo board is not available right now."}</div>}
          {settledStep > 0 ? <article key={`${settledStep}-${attentionNonce}`} className="lb-caption lb-caption-attention" aria-live="polite"><div className="lb-caption-text"><span>{String(settledStep + 1).padStart(2, "0")} · {LANDING_BOARD_STEPS[settledStep]?.label}</span><h2>{LANDING_BOARD_STEPS[settledStep]?.headline}</h2><p>{LANDING_BOARD_STEPS[settledStep]?.line}</p></div>{settledStep === 9 ? <div><Button asChild><Link to="/demo/$code" params={{ code: "YSM-01" }}>Open the board yourself</Link></Button><Button asChild variant="outline"><a href="#pilot" onClick={() => pilot("try_it")}>Book a pilot</a></Button></div> : null}</article> : null}
        </div>
        <div className="lb-scroll-sections">
          {LANDING_BOARD_STEPS.map((step, index) => (
            <section id={`lb-${step.key}`} data-lb-step={index} key={step.key} className="lb-scroll-step">
              {index === 0 ? <div className="lb-hero-copy"><LassoThinkingMark kind="signature" size={150} /><div><h1>Your firm bought AI. <LandingParticlePhrase text="The human judgment, process, and thinking" /> in your team's work went invisible.</h1><h2>Lasso is the reasoning and judgment layer for AI-assisted consulting. It connects the work across tools to the client deliverable and keeps the decisions your team made, so they can show where a claim came from and why it stayed.</h2><div><Button onClick={() => jump("canvas")}>Watch it work</Button><Button asChild variant="outline"><a href="#pilot" onClick={() => pilot("hero")}>Book a pilot</a></Button></div></div></div> : null}
            </section>
          ))}
        </div>
      </main>
      <LandingBoardContinuation viewId={viewId.current} onPilot={pilot} />
    </div>
  );
}