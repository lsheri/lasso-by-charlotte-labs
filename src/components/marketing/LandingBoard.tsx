import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  type CSSProperties,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { LassoLoopMark } from "@/components/layout/LassoLoopMark";
import { LandingParticlePhrase } from "@/components/marketing/LandingParticlePhrase";
import { FocusSection } from "@/components/marketing/FocusSection";
import { ToolLogo } from "@/components/marketing/ToolLogo";
import { MarkdownMessage } from "@/components/markdown/MarkdownMessage";
import { AnswerRail, ContextAudit, ThinkingTrail } from "@/components/reflect/ContextTrail";
import { AnswerTurnLinks } from "@/components/reflect/AnswerTurnLinks";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { VendorMark } from "@/components/work/SourceMark";
import { openDemoBoardFn } from "@/lib/demo.functions";
import type { DemoPreset } from "@/lib/demo-presets-shared";
import { submitPilotRequestFn } from "@/lib/pilot-request.functions";
import { recordAnonymousEventFn } from "@/lib/telemetry.functions";
import type { SharedBoardDto, SharedSeedWork } from "@/lib/board-share-shared";
import {
  parseLandingProof,
  type LandingProof,
  type LandingProofModel,
} from "@/lib/landing-proof-shared";
import { seedPlacement } from "@/lib/public-work-allowlist";
import { keptContentLabel } from "@/lib/work-open";
import { noteDemoOpened, noteDemoPlayInteracted, type DemoPlayAction } from "@/lib/demo-telemetry";

export const LANDING_BOARD_STEPS = [
  {
    key: "problem",
    label: "The problem",
    headline: "Your team's AI work is scattered.",
    line: "Four tools, a hundred tabs, and none of it connects to the deliverable.",
  },
  {
    key: "canvas",
    label: "One place",
    headline: "Every AI conversation and every work tool, in one organized place.",
    line: "Claude, ChatGPT, Gemini, Drive and the rest land on one board, grouped by the work they belong to.",
  },
  {
    key: "workstreams",
    label: "Workstreams",
    headline: "Group the work by workstream.",
    line: "Chats, files and decisions that belong together, sitting together on the board.",
  },
  {
    key: "deliverable",
    label: "The deliverable",
    headline: "See everything that went into the deck.",
    line: "Every chat, file and note behind a draft or a final deliverable.",
  },
  {
    key: "circle",
    label: "Pick a number",
    headline: "Pick any number in the deck.",
    line: "Where did the $1.4M on slide 3 come from?",
  },
  {
    key: "ask",
    label: "Ask Lasso",
    headline: "Ask where a number came from.",
    line: "The source, what your team checked after, and what is still unconfirmed.",
  },
  {
    key: "the-turn",
    label: "Open the chat",
    headline: "Open the conversation it came from.",
    line: "Find the turn where it was decided, and the thinking that got lost in the thread.",
  },
  {
    key: "still-open",
    label: "Notes",
    headline: "Add your own notes.",
    line: "Written by people, so a teammate can pick the work up where you left it.",
  },
  {
    key: "share",
    label: "Share it",
    headline: "Share the work with the context attached.",
    line: "Hand off the deliverable and everything behind it.",
  },
  {
    key: "try-it",
    label: "Try it",
    headline: "Open the board yourself.",
    line: "Every figure in this workspace is invented.",
  },
] as const;

type StepKey = (typeof LANDING_BOARD_STEPS)[number]["key"];
type StoryInput = "scroll" | "jump";
type UseCaseKey = "bring_work_in" | "reasoning_stays" | "every_number";
type SpotlightTarget = "deck" | "ask" | "turn";

type UseCaseAsset = { url: string };
const USE_CASE_ASSETS = import.meta.glob<UseCaseAsset>("/src/assets/use-*.asset.json", {
  eager: true,
  import: "default",
});

function useCaseAsset(name: string): string {
  return USE_CASE_ASSETS[`/src/assets/${name}.asset.json`]?.url ?? "";
}

const LANDING_BOARD_USE_CASES = [
  {
    key: "bring_work_in",
    title: "Connect every tool over MCP.",
    body: "All your work tools and AI chats, connected once.",
    poster: useCaseAsset("use-bring-work-in-poster.jpg"),
    webm: useCaseAsset("use-bring-work-in.webm"),
    mp4: useCaseAsset("use-bring-work-in.mp4"),
    tools: ["claude", "chatgpt", "gemini"],
  },
  {
    key: "every_number",
    title: "All your work becomes context.",
    body: "Ask about the whole process, from research in ChatGPT to the final deck.",
    poster: useCaseAsset("use-every-number-has-a-source-poster.jpg"),
    webm: useCaseAsset("use-every-number-has-a-source.webm"),
    mp4: useCaseAsset("use-every-number-has-a-source.mp4"),
    tools: ["claude", "powerpoint"],
  },
  {
    key: "reasoning_stays",
    title: "Every AI conversation, searchable.",
    body: "One view of the chats that mattered, so you can find them later.",
    poster: useCaseAsset("use-reasoning-stays-with-the-firm-poster.jpg"),
    webm: useCaseAsset("use-reasoning-stays-with-the-firm.webm"),
    mp4: useCaseAsset("use-reasoning-stays-with-the-firm.mp4"),
    tools: ["claude", "chatgpt", "gemini"],
  },
] as const satisfies ReadonlyArray<{
  key: UseCaseKey;
  title: string;
  body: string;
  poster: string;
  webm?: string;
  mp4: string;
  tools: readonly string[];
}>;

function boxesMatch(a: LassoBox | null, b: LassoBox | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    Math.abs(a.left - b.left) < 0.5 &&
    Math.abs(a.top - b.top) < 0.5 &&
    Math.abs(a.width - b.width) < 0.5 &&
    Math.abs(a.height - b.height) < 0.5
  );
}

const TOOL_BADGES = [
  { key: "claude", label: "Claude" },
  { key: "chatgpt", label: "ChatGPT" },
  { key: "gemini", label: "Gemini" },
  { key: "googledrive", label: "Drive" },
  { key: "gmail", label: "Gmail" },
] as const;

const FALLBACK_SLIDES = [
  "Partnership model",
  "Board structure",
  "$1.4M year-two net benefit",
  "Comparable health alliances",
  "Chair terms",
  "FY27 recommendation",
];

function event(
  viewId: string,
  eventType:
    | "landing.viewed"
    | "landing.story_section_viewed"
    | "landing.section_jumped"
    | "landing.proof_link_opened"
    | "landing.pilot_cta_clicked"
    | "landing.pilot_requested"
    | "landing.see_it_work_clicked"
    | "landing.usecase_played",
  dims: Record<string, string>,
) {
  void recordAnonymousEventFn({ data: { event_type: eventType, view_id: viewId, dims } }).catch(
    () => undefined,
  );
}

function toolKey(item: SharedSeedWork): string {
  return (item.source_vendor ?? item.source_meta?.vendor ?? item.source ?? "document")
    .toLowerCase()
    .replace(/^connector:/, "");
}

function ToolIdentity({ tool, compact = false }: { tool: string; compact?: boolean }) {
  return <ToolLogo vendor={tool} compact={compact} />;
}

function BoardCard({
  item,
  index,
  step,
  pin,
  read,
  turnCount,
  position,
  articleRef,
  proofSource,
}: {
  item: SharedSeedWork;
  index: number;
  step: number;
  pin: number | undefined;
  read: boolean;
  turnCount: number | null;
  position: { left: number; top: number };
  articleRef?: RefObject<HTMLElement | null> | undefined;
  proofSource?: boolean | undefined;
}) {
  return (
    <article
      ref={articleRef}
      className={`lb-board-card${proofSource ? " lb-proof-source-card" : ""}`}
      data-arrived={step >= 1}
      style={
        {
          "--lb-card-index": index,
          "--lb-card-left": `${position.left}px`,
          "--lb-card-top": `${position.top}px`,
        } as CSSProperties
      }
    >
      <ToolLogo vendor={toolKey(item)} />
      <strong>{item.title}</strong>
      <small>{keptContentLabel(item, turnCount)}</small>
      {pin ? (
        <span className="lb-pin" aria-label={`Source ${pin}`}>
          {pin}
        </span>
      ) : read ? (
        <span className="lb-read-dot" aria-label="Read for this response" />
      ) : null}
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
      const reading = window.setInterval(
        () => setReadCount((count) => Math.min(itemCount, count + 1)),
        Math.max(300, 2_200 / Math.max(itemCount, 1)),
      );
      timers.push(reading);
      timers.push(
        window.setTimeout(() => {
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
        }, 2_500),
      );
    }, 35);
    timers.push(typing);
    return () =>
      timers.forEach((timer) => {
        window.clearTimeout(timer);
        window.clearInterval(timer);
      });
  }, [position, preset]);

  return { phase, preset, readCount, streamed, typed, position };
}

function ReplayAnswer({
  preset,
  finished = true,
  showAudit = true,
  onOpenTurn,
}: {
  preset: DemoPreset;
  finished?: boolean;
  showAudit?: boolean;
  onOpenTurn?: (() => void) | undefined;
}) {
  return (
    <div className="nb-conversation-message max-w-none flex-row items-start gap-3">
      <LassoLoopMark className="size-7 shrink-0 text-lasso-green" />
      <div className="nb-conversation-body min-w-0 flex-1 gap-0">
        <span className="nb-binder-line font-sans text-[13px] font-semibold text-ink">Lasso</span>
        <AnswerRail state="done">
          <MarkdownMessage content={preset.answer} variant="binder" />
          {finished && onOpenTurn ? (
            <AnswerTurnLinks
              refs={preset.turnRefs}
              onOpen={(ref) => {
                onOpenTurn();
                window.location.assign(
                  `/demo/conversations?item=${encodeURIComponent(ref.work_item_id)}&turn=${ref.turn_no}&from=story`,
                );
              }}
              testId="landing-answer-turn-link"
            />
          ) : null}
          {showAudit && finished && preset.manifest ? (
            <ContextAudit manifest={preset.manifest} readOnly initialOpen />
          ) : null}
        </AnswerRail>
      </div>
    </div>
  );
}

function proofDate(proof: LandingProof): string {
  const value = proof.turns.find((turn) => turn.turn_no === 2)?.ts;
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

const PROOF_TURN_SUMMARIES: Readonly<Record<number, string>> = {
  3: "asked where the $2.1M comes from.",
  4: "split it into four lines.",
  5: "approved it as the slide 3 headline.",
  6: "assumption noted under the chart.",
};

function ProofCard({
  proof,
  model,
  onShowSlide,
  onOpenTurn,
  returnTo = "story",
  showSlideAction = true,
}: {
  proof: LandingProof;
  model: LandingProofModel;
  onShowSlide: () => void;
  onOpenTurn: () => void;
  returnTo?: "story" | "demo";
  showSlideAction?: boolean;
}) {
  const turn = (number: number) => proof.turns.find((entry) => entry.turn_no === number);
  const role = (number: number) => (turn(number)?.role === "user" ? "you said" : "Claude said");
  return (
    <section className="lb-proof-card lb-caption-attention" data-testid="landing-proof-card">
      <h4>
        <strong>${model.scenarioB.toFixed(1)}M</strong>
        <span>
          = ${model.savings.toFixed(1)}M savings − ${model.transition.toFixed(1)}M transition
        </span>
      </h4>
      <div className="lb-proof-origin">
        <ToolLogo vendor={proof.vendor} compact />
        <strong>{proof.title.replace(/: year-two net benefit/i, "")}</strong>
        <span>Turn 2 · {proofDate(proof)}</span>
        <p>{model.inputs.join(", ")}</p>
      </div>
      <div className="lb-proof-timeline">
        <p className="lb-micro">CHECKED AFTER · 4 TURNS</p>
        {[3, 4, 5, 6].map((number, index) => (
          <details key={number} style={{ "--lb-proof-row": index } as CSSProperties}>
            <summary>
              <span>
                Turn {number} · {role(number)}
              </span>
              <b>{PROOF_TURN_SUMMARIES[number]}</b>
            </summary>
            {number === 4 ? (
              <div>
                <p>{turn(number)?.content}</p>
                <div
                  className="lb-proof-bars"
                  aria-label="Finance 0.6, HR 0.4, IT 0.7, revenue cycle 0.4 of 2.1 million"
                >
                  {model.lines.map((line) => (
                    <span key={line.label} data-unconfirmed={line.label === "Revenue cycle"}>
                      <i
                        style={
                          {
                            "--lb-proof-segment": `${(line.amount / model.savings) * 100}%`,
                          } as CSSProperties
                        }
                      />
                      {line.label}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <p>{turn(number)?.content}</p>
            )}
          </details>
        ))}
      </div>
      <div className="lb-proof-open">
        <p>
          <strong>1 still unconfirmed:</strong> {model.unconfirmed}
        </p>
      </div>
      <div className="lb-proof-actions">
        <Button asChild size="sm">
          <Link
            to="/demo/conversations"
            search={{ item: proof.itemId, turn: 4, from: returnTo }}
            onClick={onOpenTurn}
          >
            Open the chat at turn 4 to hand-check
          </Link>
        </Button>
        {showSlideAction ? (
          <Button type="button" size="sm" variant="outline" onClick={onShowSlide}>
            Show slide 3
          </Button>
        ) : null}
      </div>
    </section>
  );
}

export function PlaygroundProofCard({
  proof,
  model,
  emit,
}: {
  proof: LandingProof;
  model: LandingProofModel;
  emit: (action: DemoPlayAction) => void;
}) {
  return (
    <ProofCard
      proof={proof}
      model={model}
      returnTo="demo"
      onOpenTurn={() => emit("proof_link_opened")}
      onShowSlide={() => emit("proof_link_opened")}
    />
  );
}

type PlaygroundPosition = { x: number; y: number };
type PlaygroundDrag = {
  key: string;
  startX: number;
  startY: number;
  origin: PlaygroundPosition;
  action: "drag_card" | "drag_group";
};
type PlaygroundSticky = { id: string; text: string; x: number; y: number };

export function PlayableDemoBoard({
  board,
  presets,
  proof,
  clientLabel,
  engagementTitle,
}: {
  board: SharedBoardDto;
  presets: DemoPreset[];
  proof: LandingProof | null;
  clientLabel: string;
  engagementTitle: string;
}) {
  const deckItem = board.seed.work.find((item) => /board deck/i.test(item.title));
  const items = board.seed.work.filter((item) => item.id !== deckItem?.id).slice(0, 8);
  const visibleTasks = board.seed.tasks
    .filter((task) => !/board deck/i.test(task.name))
    .slice(0, 2);
  const proofModel = proof ? parseLandingProof(proof) : null;
  const [offsets, setOffsets] = useState<Record<string, PlaygroundPosition>>({});
  const [stickies, setStickies] = useState<PlaygroundSticky[]>([]);
  const [drag, setDrag] = useState<PlaygroundDrag | null>(null);
  const [resetAt, setResetAt] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(5);
  const [resetting, setResetting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [hint, setHint] = useState(true);
  const [askOpen, setAskOpen] = useState(true);
  const [activePreset, setActivePreset] = useState(
    presets.find((entry) => entry.position === 1)?.position ?? presets[0]?.position ?? 1,
  );
  const resetTimer = useRef<number | null>(null);
  const surface = () =>
    window.matchMedia("(max-width: 639px)").matches ? ("phone" as const) : ("desktop" as const);
  const emit = (action: DemoPlayAction) => noteDemoPlayInteracted(action, surface());

  useEffect(() => {
    noteDemoOpened("playground", "ysm-01");
    if (window.matchMedia("(max-width: 639px)").matches) setAskOpen(false);
  }, []);

  const clearResetTimer = useCallback(() => {
    if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
    resetTimer.current = null;
  }, []);
  const resetBoard = useCallback(
    (automatic: boolean) => {
      clearResetTimer();
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      setResetting(!reduced);
      setOffsets({});
      setStickies([]);
      setResetAt(null);
      setRemaining(5);
      if (!reduced) window.setTimeout(() => setResetting(false), 600);
      emit(automatic ? "reset_auto" : "reset_manual");
    },
    [clearResetTimer],
  );
  const scheduleReset = useCallback(() => {
    clearResetTimer();
    const at = Date.now() + 5_000;
    setResetAt(at);
    setRemaining(5);
    resetTimer.current = window.setTimeout(() => resetBoard(true), 5_000);
  }, [clearResetTimer, resetBoard]);
  useEffect(() => {
    if (!resetAt || drag || editing) return;
    const interval = window.setInterval(
      () => setRemaining(Math.max(0, Math.ceil((resetAt - Date.now()) / 1000))),
      200,
    );
    return () => window.clearInterval(interval);
  }, [drag, editing, resetAt]);
  useEffect(() => () => clearResetTimer(), [clearResetTimer]);

  const beginDrag = (
    eventValue: ReactPointerEvent<HTMLElement>,
    key: string,
    action: "drag_card" | "drag_group",
  ) => {
    if ((eventValue.target as HTMLElement).closest("input")) return;
    eventValue.currentTarget.setPointerCapture(eventValue.pointerId);
    clearResetTimer();
    setHint(false);
    setDrag({
      key,
      action,
      startX: eventValue.clientX,
      startY: eventValue.clientY,
      origin: offsets[key] ?? { x: 0, y: 0 },
    });
  };
  const moveDrag = (eventValue: ReactPointerEvent<HTMLElement>) => {
    if (!drag) return;
    setOffsets((current) => ({
      ...current,
      [drag.key]: {
        x: drag.origin.x + eventValue.clientX - drag.startX,
        y: drag.origin.y + eventValue.clientY - drag.startY,
      },
    }));
  };
  const endDrag = () => {
    if (!drag) return;
    emit(drag.action);
    setDrag(null);
    scheduleReset();
  };
  const transform = (key: string, extra?: PlaygroundPosition) => {
    const group = extra ?? { x: 0, y: 0 };
    const own = offsets[key] ?? { x: 0, y: 0 };
    return `translate(${own.x + group.x}px, ${own.y + group.y}px)`;
  };
  const addSticky = () => {
    const id = `sticky-${Date.now()}`;
    setStickies((current) => [
      ...current,
      { id, text: "New note", x: 530 + current.length * 18, y: 330 + current.length * 14 },
    ]);
    setHint(false);
    emit("sticky_added");
    scheduleReset();
  };
  const active = presets.find((entry) => entry.position === activePreset);
  const showProof = active?.position === 1 && proof && proofModel;
  const groupOffsets = visibleTasks.map((task) => offsets[`group:${task.id}`] ?? { x: 0, y: 0 });

  return (
    <div className="demo-playground" data-resetting={resetting}>
      {hint ? (
        <p className="demo-play-hint">
          Drag anything. Add a sticky. It all goes back in 5 seconds.
        </p>
      ) : null}
      <div className="demo-play-toolbar" aria-label="Board tools">
        <Button size="sm" variant="outline" onClick={addSticky}>
          Add sticky
        </Button>
        <Button size="sm" variant="outline" onClick={() => setAskOpen((open) => !open)}>
          Ask Lasso
        </Button>
        <Button size="sm" variant="outline" onClick={() => resetBoard(false)}>
          Reset
        </Button>
        {resetAt && !drag && !editing ? (
          <span className="demo-reset-countdown">
            <i style={{ "--demo-reset-progress": `${remaining / 5}` } as CSSProperties} />
            Back to the finished board in {remaining}s
          </span>
        ) : null}
      </div>
      <div className="demo-play-canvas" data-ask-open={askOpen}>
        <div
          className="demo-play-board"
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <div className="lb-dot-grid" />
          {visibleTasks.map((task, groupIndex) => (
            <section
              key={task.id}
              className="demo-play-group"
              style={{
                left: groupIndex === 0 ? 80 : 390,
                top: 92,
                transform: transform(`group:${task.id}`),
              }}
            >
              <h3
                onPointerDown={(eventValue) =>
                  beginDrag(eventValue, `group:${task.id}`, "drag_group")
                }
              >
                {task.name}
              </h3>
              <p>{task.detail}</p>
            </section>
          ))}
          {items.map((item, index) => {
            const taskIndex = visibleTasks.findIndex((task) =>
              seedPlacement(item).includes(task.id),
            );
            const groupOffset = taskIndex >= 0 ? groupOffsets[taskIndex] : undefined;
            const left = taskIndex === 1 ? 414 : 104;
            const top = 166 + Math.floor(index / 2) * 116;
            return (
              <article
                key={item.id}
                data-testid={`demo-play-card-${index}`}
                className="lb-board-card demo-play-card"
                style={{ left, top, transform: transform(`card:${item.id}`, groupOffset) }}
                onPointerDown={(eventValue) =>
                  beginDrag(eventValue, `card:${item.id}`, "drag_card")
                }
              >
                <ToolLogo vendor={toolKey(item)} />
                <strong>{item.title}</strong>
                <small>
                  {keptContentLabel(
                    item,
                    item.type === "ai_thread" ? (board.turns[item.id]?.length ?? null) : null,
                  )}
                </small>
              </article>
            );
          })}
          <article
            className="lb-deck demo-play-deck"
            style={{ transform: transform("deck") }}
            onPointerDown={(eventValue) => beginDrag(eventValue, "deck", "drag_card")}
          >
            <header>
              <ToolLogo vendor="powerpoint" compact />
              <strong>
                {(deckItem?.title ?? "FY27 board deck v3")
                  .replace(/\s*\(slide notes\)\s*/i, "")
                  .trim()}
              </strong>
            </header>
            <div>
              {Array.from({ length: 6 }, (_, index) => (
                <DeckSlide
                  key={index}
                  index={index}
                  clientName={clientLabel}
                  numberRef={{ current: null }}
                  proof={proofModel}
                />
              ))}
            </div>
            <span className="demo-play-lasso" aria-hidden="true" />
          </article>
          <div className="lb-open-notes demo-play-notes">
            <p>Confirm the vendor extension assumption.</p>
            <p>Confirm approval by Oct 1.</p>
          </div>
          {stickies.map((sticky) => (
            <article
              key={sticky.id}
              data-testid="demo-play-sticky"
              className="demo-play-sticky"
              style={{ left: sticky.x, top: sticky.y, transform: transform(sticky.id) }}
              onPointerDown={(eventValue) => beginDrag(eventValue, sticky.id, "drag_card")}
            >
              <input
                value={sticky.text}
                maxLength={80}
                aria-label="Sticky note"
                onFocus={() => {
                  clearResetTimer();
                  setEditing(true);
                }}
                onBlur={() => {
                  setEditing(false);
                  emit("sticky_edited");
                  scheduleReset();
                }}
                onChange={(eventValue) =>
                  setStickies((current) =>
                    current.map((entry) =>
                      entry.id === sticky.id
                        ? { ...entry, text: eventValue.target.value.slice(0, 80) }
                        : entry,
                    ),
                  )
                }
              />
            </article>
          ))}
        </div>
        <aside className="demo-play-ask" data-open={askOpen} aria-label="Ask Lasso">
          <button
            type="button"
            className="demo-play-ask-toggle"
            onClick={() => setAskOpen((open) => !open)}
          >
            <span>
              <b>Ask Lasso</b>
              <small>{engagementTitle}</small>
            </span>
          </button>
          <div className="demo-play-ask-body">
            <div className="demo-play-presets">
              {presets.map((preset) => (
                <Button
                  key={preset.position}
                  size="sm"
                  variant={preset.position === activePreset ? "secondary" : "outline"}
                  onClick={() => {
                    setActivePreset(preset.position);
                    emit("preset_opened");
                  }}
                >
                  {preset.question}
                </Button>
              ))}
            </div>
            <div className="demo-play-answer">
              {showProof ? (
                <ProofCard
                  proof={proof}
                  model={proofModel}
                  returnTo="demo"
                  onOpenTurn={() => emit("proof_link_opened")}
                  onShowSlide={() => emit("proof_link_opened")}
                />
              ) : active ? (
                <>
                  <div className="lb-replay-question">
                    <span>You</span>
                    <p>{active.question}</p>
                  </div>
                  <ReplayAnswer preset={active} />
                </>
              ) : (
                <p>The saved answer is not available right now.</p>
              )}
            </div>
            <div className="demo-play-composer">
              <Textarea disabled placeholder="Ask your own questions in a pilot" rows={2} />
              <Button disabled>Send</Button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export function PlaygroundReplayAnswer({ preset }: { preset: DemoPreset }) {
  return <ReplayAnswer preset={preset} />;
}

function AskReplay({
  presets,
  step,
  onFinished,
  clientLabel,
  engagementTitle,
  proof,
  proofModel,
  onShowSlide,
  onOpenTurn,
  onOpenDecisionTurn,
}: {
  presets: DemoPreset[];
  step: number;
  onFinished: (finished: boolean) => void;
  clientLabel: string;
  engagementTitle: string;
  proof: LandingProof | null;
  proofModel: LandingProofModel | null;
  onShowSlide: () => void;
  onOpenTurn: () => void;
  onOpenDecisionTurn: () => void;
}) {
  const replay = usePresetReplay(step, presets);
  const threadRef = useRef<HTMLDivElement>(null);
  const shownPositions = step === 5 ? [1] : step === 6 ? [2] : [1, 2, 4];
  const liveItems = replay.preset?.manifest?.items.slice(0, replay.readCount) ?? [];
  const showProof = step === 5 && replay.phase === "done" && proof && proofModel;
  useEffect(() => {
    onFinished(replay.phase === "done");
  }, [onFinished, replay.phase]);
  useLayoutEffect(() => {
    const thread = threadRef.current;
    if (!thread) return;
    const proofCard = thread.querySelector<HTMLElement>("[data-testid=landing-proof-card]");
    if (proofCard && replay.phase === "done") {
      thread.scrollTo({ top: proofCard.offsetTop, behavior: "auto" });
      return;
    }
    thread.scrollTo({ top: thread.scrollHeight, behavior: "smooth" });
  }, [replay.phase, replay.readCount, replay.streamed, replay.typed]);
  return (
    <aside
      className="lb-answer-sheet"
      aria-label="Ask Lasso replay"
      data-replay-phase={replay.phase}
      data-story-scroll="locked"
    >
      <header className="lb-ask-header">
        <div>
          <p className="lb-micro">ASK LASSO</p>
          <h3>{clientLabel}</h3>
          <p className="lb-ask-engagement-title">{engagementTitle}</p>
        </div>
      </header>
      <div ref={threadRef} className="lb-replay-thread nb-binder">
        {showProof ? (
          <>
            <ProofCard
              proof={proof}
              model={proofModel}
              onShowSlide={onShowSlide}
              onOpenTurn={onOpenTurn}
            />
            {presets.find((entry) => entry.position === 1)?.manifest ? (
              <ContextAudit
                manifest={presets.find((entry) => entry.position === 1)?.manifest ?? null}
                readOnly
                initialOpen={false}
                buttonLabel="Show the full read list"
              />
            ) : null}
          </>
        ) : (
          shownPositions.map((position) => {
            const preset = presets.find((entry) => entry.position === position);
            if (!preset) return null;
            const current = replay.position === position;
            const showQuestion = !current || replay.phase !== "typing";
            const answerText = current ? replay.streamed : preset.answer;
            return (
              <div key={position} className="lb-replay-turn">
                {showQuestion ? (
                  <div className="lb-replay-question">
                    <span>You</span>
                    <p>{preset.question}</p>
                  </div>
                ) : null}
                {current && replay.phase === "reading" ? (
                  <AnswerRail state="working">
                    <ThinkingTrail
                      items={
                        preset.manifest?.items.map((item) => ({
                          id: item.id,
                          title: item.title,
                        })) ?? []
                      }
                      finalPhase="Writing"
                      manifest={
                        liveItems.length > 0 && preset.manifest
                          ? { ...preset.manifest, items: liveItems }
                          : null
                      }
                    />
                  </AnswerRail>
                ) : null}
                {answerText ? (
                  <ReplayAnswer
                    preset={{ ...preset, answer: answerText }}
                    finished={!current || replay.phase === "done"}
                    showAudit={position !== 1}
                    onOpenTurn={step === 6 && position === 2 ? onOpenDecisionTurn : undefined}
                  />
                ) : null}
              </div>
            );
          })
        )}
      </div>
      <footer className="lb-replay-composer">
        <Textarea
          value={replay.phase === "typing" ? replay.typed : ""}
          readOnly
          rows={2}
          aria-label="Ask Lasso question"
        />
        <Button disabled data-replay-send={replay.phase === "reading" ? "pressed" : undefined}>
          {replay.phase === "reading" ? "Sending" : "Send"}
        </Button>
      </footer>
    </aside>
  );
}

type LassoBox = { left: number; top: number; width: number; height: number };

export function DeckSlide({
  index,
  clientName,
  numberRef,
  proof,
}: {
  index: number;
  clientName: string;
  numberRef?: RefObject<HTMLSpanElement | null>;
  proof: LandingProofModel | null;
}) {
  if (index === 0)
    return (
      <section className="lb-deck-slide lb-slide-cover">
        <small>1</small>
        <div className="lb-slide-cover-copy">
          <b>FY27 growth partnerships</b>
          <span>{clientName}</span>
        </div>
        <svg viewBox="0 0 100 64" aria-hidden="true">
          <path d="M8 50 35 12l18 29 17-22 22 31Z" />
          <circle cx="69" cy="17" r="7" />
        </svg>
      </section>
    );
  if (index === 1) {
    const values = proof ? [proof.scenarioA, proof.scenarioB, proof.scenarioC] : null;
    const max = values ? Math.max(...values) : null;
    return (
      <section className="lb-deck-slide lb-slide-scenarios">
        <small>2</small>
        <b>Three scenarios</b>
        <div>
          {["A", "B", "C"].map((label, itemIndex) => (
            <span key={label} data-picked={label === "B"}>
              {values && max ? (
                <i
                  style={
                    {
                      "--lb-scenario-height": `${((values[itemIndex] ?? 0) / max) * 100}%`,
                    } as CSSProperties
                  }
                />
              ) : null}
              {label}{values ? ` $${values[itemIndex]?.toFixed(1)}M` : ""}
            </span>
          ))}
        </div>
      </section>
    );
  }
  if (index === 2) {
    const net = proof ? proof.scenarioB : null;
    const figure = (value: number) => `$${value.toFixed(1)}M`;
    return (
      <section className="lb-deck-slide lb-slide-number">
        <small>3</small>
        <b>Year-two net benefit</b>
        <span ref={numberRef} className="lb-number" data-testid="landing-board-number">
          {net === null ? "" : figure(net)}
        </span>
        <div
          className="lb-waterfall"
          aria-label={proof ? `${figure(proof.savings)} savings minus ${figure(proof.transition)} transition cost equals ${figure(proof.scenarioB)} year-two net benefit` : "Year-two net benefit figures unavailable"}
        >
          <span className="lb-waterfall-savings">
            {proof ? <><i style={{ "--lb-waterfall-units": proof.savings } as CSSProperties} />{figure(proof.savings)}<br /></> : null}
            savings
          </span>
          <span className="lb-waterfall-costs">
            {proof ? <><i style={{ "--lb-waterfall-units": proof.transition, "--lb-waterfall-net-units": proof.scenarioB } as CSSProperties} />-{figure(proof.transition)}<br /></> : null}
            transition
          </span>
          <span className="lb-waterfall-net">
            {proof ? <><i style={{ "--lb-waterfall-units": proof.scenarioB } as CSSProperties} />{figure(proof.scenarioB)}<br /></> : null}
            net
          </span>
        </div>
      </section>
    );
  }
  if (index === 3)
    return (
      <section className="lb-deck-slide lb-slide-governance">
        <small>4</small>
        <b>Board structure</b>
        <div>
          <i />
          <i />
          <i />
        </div>
        <span>Chair: two-term limit</span>
      </section>
    );
  if (index === 4)
    return (
      <section className="lb-deck-slide lb-slide-alliances">
        <small>5</small>
        <b>Comparable alliances</b>
        <div>
          {[1, 2, 3, 4, 5].map((item) => (
            <i key={item} />
          ))}
        </div>
      </section>
    );
  return (
    <section className="lb-deck-slide lb-slide-decision">
      <small>6</small>
      <b>Decision asked for Oct 1</b>
      <span aria-hidden="true" />
    </section>
  );
}

export function LandingDemoDeck({
  clientName,
  proof,
}: {
  clientName: string;
  proof: LandingProofModel | null;
}) {
  const numberRef = useRef<HTMLSpanElement>(null);
  return (
    <div className="landing-demo-deck-grid">
      {Array.from({ length: 6 }, (_, index) => (
        <DeckSlide
          key={index}
          index={index}
          clientName={clientName}
          numberRef={numberRef}
          proof={proof}
        />
      ))}
    </div>
  );
}

function ExactTurn({
  board,
  preset,
  onOpenTurn,
  phone = false,
}: {
  board: SharedBoardDto;
  preset: DemoPreset | undefined;
  onOpenTurn: () => void;
  phone?: boolean;
}) {
  const ref = preset?.turnRefs.find((entry) => entry.turn_no === 5) ?? preset?.turnRefs[0];
  const item = ref ? board.seed.work.find((entry) => entry.id === ref.work_item_id) : undefined;
  const allTurns = ref
    ? [...(board.turns[ref.work_item_id] ?? [])].sort((a, b) => a.turn_no - b.turn_no)
    : [];
  const turns = phone ? allTurns.filter((turn) => turn.turn_no >= 4) : allTurns;
  const bodyRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const body = bodyRef.current;
    const decision = body?.querySelector<HTMLElement>('[data-decision="true"]');
    if (!body || !decision) return;
    body.scrollTop = Math.max(0, decision.offsetTop - body.clientHeight / 3);
  }, [item?.id]);
  return (
    <aside className="lb-turn-reader" aria-label="Exact turn reader">
      <header>
        <div>
          {item ? <VendorMark item={item} /> : <ToolIdentity tool="document" />}
          <div>
            <h3>{item?.title ?? "Source conversation"}</h3>
            {item ? (
              <p>
                {item.source_vendor ?? item.source_meta?.vendor ?? "Claude"} ·{" "}
                {proofDate({
                  turns: [{ ts: item.work_date ?? item.created_at_source ?? item.captured_at }],
                } as LandingProof)}
              </p>
            ) : null}
          </div>
        </div>
        {item ? (
          <Button asChild size="sm" variant="ghost">
            <Link
              to="/demo/conversations"
              search={{ item: item.id, turn: 5, from: "story" }}
              onClick={onOpenTurn}
            >
              Open this chat
            </Link>
          </Button>
        ) : null}
      </header>
      <div ref={bodyRef} className="lb-turn-body" data-testid="landing-decision-transcript">
        {turns.map((turn) => {
          const user = turn.role === "user";
          return (
            <article
              key={turn.id}
              className="lb-chat-turn"
              data-speaker={user ? "user" : "assistant"}
              data-decision={turn.turn_no === 5 ? "true" : undefined}
            >
              <span>
                Turn {turn.turn_no} · {user ? "you said" : "Claude said"}
              </span>
              {turn.turn_no === 5 ? <strong>The decision</strong> : null}
              <p>{turn.content}</p>
            </article>
          );
        })}
        {turns.length === 0 ? (
          <p className="lb-turn-muted">The saved conversation is not available right now.</p>
        ) : null}
      </div>
    </aside>
  );
}

function PhoneCaption({ index }: { index: number }) {
  const item = LANDING_BOARD_STEPS[index];
  if (!item) return null;
  const displayStep = index;
  // "Try it" is the closing card, not a step in the process: it carries no numeral.
  const closing = item.key === "try-it";
  return (
    <article className="lb-phone-caption">
      <span
        className="lb-caption-progress"
        aria-label={closing ? item.label : `${displayStep} of ${LANDING_BOARD_STEPS.length}`}
        style={{ "--lb-progress-to": `${(index + 1) * 10}%` } as CSSProperties}
      />
      <div className="lb-caption-heading">
        {closing ? null : (
          <span className="lb-step-ring">
            <svg viewBox="0 0 34 34" aria-hidden="true">
              <ellipse cx="17" cy="17" rx="14" ry="12.5" pathLength="1" />
            </svg>
            <span>{displayStep}</span>
          </span>
        )}
        <span>{item.label}</span>
      </div>
      <h2>
        <CaptionWords text={item.headline} />
      </h2>
      <p>{item.line}</p>
    </article>
  );
}

function PhoneDeck({
  clientLabel,
  proof,
  lasso = false,
}: {
  clientLabel: string;
  proof: LandingProofModel | null;
  lasso?: boolean;
}) {
  const numberRef = useRef<HTMLSpanElement>(null);
  return (
    <article className="lb-phone-deck" data-lasso={lasso ? "true" : undefined}>
      <header>
        <ToolLogo vendor="powerpoint" compact />
        <strong>FY27 board deck v3</strong>
      </header>
      <div className="lb-phone-deck-main">
        <DeckSlide index={2} clientName={clientLabel} numberRef={numberRef} proof={proof} />
        {lasso ? (
          <svg
            className="lb-phone-lasso"
            viewBox="0 0 100 48"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <ellipse cx="50" cy="24" rx="46" ry="20" pathLength="1" />
          </svg>
        ) : null}
      </div>
      {!lasso ? (
        <div className="lb-phone-thumbnails" aria-label="Deliverable slides">
          {Array.from({ length: 6 }, (_, index) => (
            <span key={index} data-current={index === 2 ? "true" : undefined}>
              <DeckSlide
                index={index}
                clientName={clientLabel}
                numberRef={{ current: null }}
                proof={proof}
              />
            </span>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function PhoneStory({
  board,
  presets,
  proof,
  clientLabel,
  active,
  onActive,
  onWatch,
  onPilot,
  onShowSlide,
  onOpenTurn,
  onOpenDecisionTurn,
  onUseCasePlayed,
}: {
  board: SharedBoardDto;
  presets: DemoPreset[];
  proof: LandingProof | null;
  clientLabel: string;
  active: number;
  onActive: (stop: number) => void;
  onWatch: () => void;
  onPilot: () => void;
  onShowSlide: () => void;
  onOpenTurn: () => void;
  onOpenDecisionTurn: () => void;
  onUseCasePlayed: (key: UseCaseKey, inputMode: "hover" | "tap") => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const proofModel = proof ? parseLandingProof(proof) : null;
  const deckItem = board.seed.work.find((item) => /board deck/i.test(item.title));
  const items = board.seed.work.filter((item) => item.id !== deckItem?.id);
  const conversations = items.filter((item) => item.type === "ai_thread").slice(0, 2);
  const visibleTasks = board.seed.tasks
    .filter((task) => !/board deck/i.test(task.name))
    .slice(0, 2);
  const second = presets.find((preset) => preset.position === 2);
  const sourceItems = [
    items.find((item) => item.id === proof?.itemId),
    items.find((item) => item.id !== proof?.itemId),
  ].filter((item): item is SharedSeedWork => Boolean(item));

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const sections = Array.from(root.querySelectorAll<HTMLElement>("[data-phone-step]"));
    const observer = new IntersectionObserver(
      (entries) => {
        const entered = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!entered) return;
        const index = Number((entered.target as HTMLElement).dataset["phoneStep"] ?? 0);
        (entered.target as HTMLElement).dataset["entered"] = "true";
        onActive(index);
      },
      { threshold: 0.6 },
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [onActive]);

  const card = (item: SharedSeedWork, key: string) => (
    <article key={key} className="lb-phone-source-card">
      <ToolLogo vendor={toolKey(item)} />
      <strong>{item.title}</strong>
      <small>
        {keptContentLabel(
          item,
          item.type === "ai_thread" ? (board.turns[item.id]?.length ?? null) : null,
        )}
      </small>
    </article>
  );
  return (
    <div ref={rootRef} className="lb-phone-story" data-active-step={active + 1}>
      <section
        id="lb-phone-problem"
        className="lb-phone-step"
        data-phone-step={0}
        data-entered="true"
      >
        <div className="lb-phone-hero">
          <h1>
            Your firm bought AI.{" "}
            <LandingParticlePhrase text="The human judgment, process, and thinking" /> in your
            team's work went invisible.
          </h1>
          <p>
            Lasso is the reasoning and judgment layer for AI-assisted consulting. It connects the
            work across tools to the client deliverable and keeps the decisions your team made.
          </p>
          <div>
            <Button onClick={onWatch}>Watch it work</Button>
            <Button asChild variant="outline">
              <Link to="/demo">View a Workboard</Link>
            </Button>
          </div>
          <PhoneHeroAssemble />
        </div>
      </section>
      <UseCaseSection
        id="lb-phone-usecases"
        phone
        onPlayed={onUseCasePlayed}
      />
      {LANDING_BOARD_STEPS.slice(1).map((step, itemIndex) => {
        const index = itemIndex + 1;
        const stop = index + 1;
        return (
          <section
            key={step.key}
            id={`lb-phone-${step.key}`}
            className="lb-phone-step"
            data-phone-step={stop}
          >
            {index === 1 ? (
              <div className="lb-phone-how">
                <p className="micro-label">HOW IT WORKS</p>
                <h2>Watch one engagement, start to finish.</h2>
              </div>
            ) : null}
            <PhoneCaption index={index} />
            <div className="lb-phone-visual">
              {index === 1 ? (
                <>
                  <div className="lb-phone-tools">
                    {TOOL_BADGES.map((tool) => (
                      <span key={tool.key} role="img" aria-label={tool.label}>
                        <span aria-hidden="true">
                          <ToolLogo vendor={tool.key} compact />
                        </span>
                      </span>
                    ))}
                  </div>
                  <div className="lb-phone-card-stack">
                    {conversations.map((item, itemIndex) =>
                      card(item, `conversation-${itemIndex}`),
                    )}
                  </div>
                </>
              ) : null}
              {index === 2 ? (
                <div className="lb-phone-workstreams">
                  {visibleTasks.map((task) => (
                    <section key={task.id}>
                      <h3>{task.name}</h3>
                      <p>{task.detail}</p>
                      {items
                        .filter((item) => seedPlacement(item).includes(task.id))
                        .slice(0, 2)
                        .map((item) => card(item, `${task.id}-${item.id}`))}
                    </section>
                  ))}
                </div>
              ) : null}
              {index === 3 ? <PhoneDeck clientLabel={clientLabel} proof={proofModel} /> : null}
              {index === 4 ? (
                <PhoneDeck clientLabel={clientLabel} proof={proofModel} lasso />
              ) : null}
              {index === 5 ? (
                <div className="lb-phone-proof">
                  {presets.find((preset) => preset.position === 1) ? (
                    <p className="lb-phone-question">
                      {presets.find((preset) => preset.position === 1)?.question}
                    </p>
                  ) : null}
                  {proof && proofModel ? (
                    <ProofCard
                      proof={proof}
                      model={proofModel}
                      onShowSlide={onShowSlide}
                      onOpenTurn={onOpenTurn}
                      showSlideAction={false}
                    />
                  ) : (
                    <p>The saved proof is not available right now.</p>
                  )}
                </div>
              ) : null}
              {index === 6 ? (
                <ExactTurn board={board} preset={second} onOpenTurn={onOpenDecisionTurn} phone />
              ) : null}
              {index === 7 ? (
                <div className="lb-phone-open-items">
                  {["Confirm the vendor extension assumption.", "Confirm approval by Oct 1."].map(
                    (note, noteIndex) => (
                      <div key={note}>
                        <p>{note}</p>
                        {sourceItems[noteIndex]
                          ? card(sourceItems[noteIndex], `open-${noteIndex}`)
                          : null}
                      </div>
                    ),
                  )}
                </div>
              ) : null}
              {index === 8 ? (
                <div className="lb-phone-share">
                  <p className="lb-micro">READ ONLY</p>
                  <h3>Share this board</h3>
                  <p>They open the deliverable, source cards, and the conversations behind them.</p>
                  <p>They do not open private drafts or anything outside this board.</p>
                  <strong>Closes in 48 hours</strong>
                  <small>In the demo this is shown, not issued.</small>
                </div>
              ) : null}
              {index === 9 ? (
                <div className="lb-phone-final-actions">
                  <Button asChild>
                    <Link to="/demo">Open the board yourself</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <a href="#pilot" onClick={onPilot}>
                      Book a pilot
                    </a>
                  </Button>
                </div>
              ) : null}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function StorySpotlight({
  containerRef,
  target,
}: {
  containerRef: RefObject<HTMLElement | null>;
  target: SpotlightTarget;
}) {
  const [box, setBox] = useState<LassoBox | null>(null);
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const selector =
      target === "deck" ? ".lb-deck" : target === "ask" ? ".lb-answer-sheet" : ".lb-turn-reader";
    let frame = 0;
    const measure = () => {
      frame = 0;
      const element = container.querySelector<HTMLElement>(selector);
      if (!element) {
        setBox((current) => (current === null ? current : null));
        return;
      }
      const containerRect = container.getBoundingClientRect();
      const targetRect = element.getBoundingClientRect();
      if (targetRect.width <= 0 || targetRect.height <= 0) {
        setBox((current) => (current === null ? current : null));
        return;
      }
      const scale = containerRect.width / container.offsetWidth;
      if (!Number.isFinite(scale) || scale <= 0) return;
      const inset = 8 / scale;
      const next = {
        left: (targetRect.left - containerRect.left) / scale - inset,
        top: (targetRect.top - containerRect.top) / scale - inset,
        width: targetRect.width / scale + inset * 2,
        height: targetRect.height / scale + inset * 2,
      };
      setBox((current) => (boxesMatch(current, next) ? current : next));
    };
    const schedule = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(measure);
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(container);
    const element = container.querySelector<HTMLElement>(selector);
    if (element && element !== container) observer.observe(element);
    const onTransitionEnd = (event: TransitionEvent) => {
      if (event.target === container || event.target === element) schedule();
    };
    container.addEventListener("transitionend", onTransitionEnd);
    schedule();
    window.addEventListener("resize", schedule);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      observer.disconnect();
      container.removeEventListener("transitionend", onTransitionEnd);
      window.removeEventListener("resize", schedule);
    };
  }, [containerRef, target]);
  if (!box) return null;
  return (
    <div
      className="lb-spotlight-overlay"
      data-testid="landing-story-spotlight"
      data-spotlight={target}
      style={
        {
          "--lb-spot-left": `${box.left}px`,
          "--lb-spot-top": `${box.top}px`,
          "--lb-spot-right": `${box.left + box.width}px`,
          "--lb-spot-bottom": `${box.top + box.height}px`,
          "--lb-spot-width": `${box.width}px`,
          "--lb-spot-height": `${box.height}px`,
        } as CSSProperties
      }
      aria-hidden="true"
    />
  );
}

function StoryBoard({
  board,
  presets,
  proof,
  step,
  attentionStep,
  attentionNonce,
  clientLabel,
  engagementTitle,
  onShowSlide,
  onOpenTurn,
  onOpenDecisionTurn,
}: {
  board: SharedBoardDto;
  presets: DemoPreset[];
  proof: LandingProof | null;
  step: number;
  attentionStep: number;
  attentionNonce: number;
  clientLabel: string;
  engagementTitle: string;
  onShowSlide: () => void;
  onOpenTurn: () => void;
  onOpenDecisionTurn: () => void;
}) {
  const renderCount = useRef(0);
  renderCount.current += 1;
  if (import.meta.env.DEV && typeof window !== "undefined") {
    (window as Window & { __landingStoryBoardRenderCount?: number }).__landingStoryBoardRenderCount =
      renderCount.current;
  }
  const [replayFinished, setReplayFinished] = useState(false);
  const [lassoBox, setLassoBox] = useState<LassoBox | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const numberRef = useRef<HTMLSpanElement>(null);
  const sourceRef = useRef<HTMLElement>(null);
  const measureFrameRef = useRef<number | null>(null);
  const onReplayFinished = useCallback((finished: boolean) => setReplayFinished(finished), []);
  useEffect(() => {
    setReplayFinished(false);
  }, [step]);
  const deckItem = board.seed.work.find((item) => /board deck/i.test(item.title));
  const items = board.seed.work.filter((item) => item.id !== deckItem?.id).slice(0, 9);
  const slides = useMemo(
    () => Array.from({ length: 6 }, (_, index) => FALLBACK_SLIDES[index] || `Slide ${index + 1}`),
    [],
  );
  const foundNumberSlide = slides.findIndex((slide) => /\$1\.4m/i.test(slide));
  const numberSlideIndex = foundNumberSlide >= 0 ? foundNumberSlide : 2;
  const first = presets.find((preset) => preset.position === 1);
  const proofModel = proof ? parseLandingProof(proof) : null;
  const second = presets.find((preset) => preset.position === 2);
  const trailNumbers = new Map(
    first?.manifest?.items.map((item, index) => [item.id, index + 1]) ?? [],
  );
  const citedIds = new Set(first?.turnRefs.map((ref) => ref.work_item_id) ?? []);
  const readIds = new Set(first?.manifest?.items.map((item) => item.id) ?? []);
  const visibleTasks = board.seed.tasks
    .filter((task) => !/board deck/i.test(task.name))
    .slice(0, 2);
  const taskSlots = new Map<string, number>();
  const cardPositions = items.map((item, index) => {
    const taskIndex = visibleTasks.findIndex((task) => seedPlacement(item).includes(task.id));
    if (taskIndex < 0) return { left: 188 + (index % 2) * 312, top: 438 };
    const slot = taskSlots.get(visibleTasks[taskIndex]?.id ?? "") ?? 0;
    taskSlots.set(visibleTasks[taskIndex]?.id ?? "", slot + 1);
    return { left: taskIndex === 0 ? 188 : 500, top: 176 + slot * 140 };
  });
  const [proofLine, setProofLine] = useState<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null>(null);
  const measureLasso = useCallback(() => {
    const layer = layerRef.current;
    const number = numberRef.current;
    if (!layer || !number) return false;
    const layerRect = layer.getBoundingClientRect();
    const numberRect = number.getBoundingClientRect();
    const scale = layerRect.width / layer.offsetWidth;
    if (!Number.isFinite(scale) || scale <= 0 || numberRect.width <= 0 || numberRect.height <= 0)
      return false;
    const padX = 10;
    const padY = 6;
    const nextLassoBox = {
      left: (numberRect.left - layerRect.left) / scale - padX,
      top: (numberRect.top - layerRect.top) / scale - padY,
      width: numberRect.width / scale + padX * 2,
      height: numberRect.height / scale + padY * 2,
    };
    setLassoBox((current) => (boxesMatch(current, nextLassoBox) ? current : nextLassoBox));
    const source = sourceRef.current;
    if (!source) {
      setProofLine((current) => (current === null ? current : null));
      return true;
    }
    const sourceRect = source.getBoundingClientRect();
    if (sourceRect.width <= 0 || sourceRect.height <= 0) return false;
    const nextProofLine = {
      x1: (numberRect.left - layerRect.left) / scale - padX,
      y1: (numberRect.top + numberRect.height / 2 - layerRect.top) / scale,
      x2: (sourceRect.right - layerRect.left) / scale,
      y2: (sourceRect.top + sourceRect.height / 2 - layerRect.top) / scale,
    };
    setProofLine((current) => {
      if (
        current &&
        Math.abs(current.x1 - nextProofLine.x1) < 0.5 &&
        Math.abs(current.y1 - nextProofLine.y1) < 0.5 &&
        Math.abs(current.x2 - nextProofLine.x2) < 0.5 &&
        Math.abs(current.y2 - nextProofLine.y2) < 0.5
      )
        return current;
      return nextProofLine;
    });
    return true;
  }, []);
  useLayoutEffect(() => {
    const stage = stageRef.current;
    const layer = layerRef.current;
    if (!stage || !layer) return;
    if (step < 4 || attentionStep !== step) {
      setLassoBox((current) => (current === null ? current : null));
      setProofLine((current) => (current === null ? current : null));
      return;
    }
    const stopRetry = () => {
      if (measureFrameRef.current !== null) window.cancelAnimationFrame(measureFrameRef.current);
      measureFrameRef.current = null;
    };
    const retryMeasure = () => {
      stopRetry();
      const tick = () => {
        if (measureLasso()) {
          measureFrameRef.current = null;
          return;
        }
        measureFrameRef.current = window.requestAnimationFrame(tick);
      };
      measureFrameRef.current = window.requestAnimationFrame(tick);
    };
    const frame = window.requestAnimationFrame(() => {
      measureLasso();
      if (step >= 5 && step <= 7 && replayFinished) retryMeasure();
    });
    const onTransitionEnd = (event: TransitionEvent) => {
      if (event.target === layer && event.propertyName === "transform") retryMeasure();
    };
    const geometryObserver = new ResizeObserver(retryMeasure);
    geometryObserver.observe(stage);
    geometryObserver.observe(layer);
    if (numberRef.current) geometryObserver.observe(numberRef.current);
    if (sourceRef.current) geometryObserver.observe(sourceRef.current);
    layer.addEventListener("transitionend", onTransitionEnd);
    window.addEventListener("resize", measureLasso);
    return () => {
      window.cancelAnimationFrame(frame);
      stopRetry();
      geometryObserver.disconnect();
      layer.removeEventListener("transitionend", onTransitionEnd);
      window.removeEventListener("resize", measureLasso);
    };
  }, [attentionStep, measureLasso, replayFinished, step]);
  const pulse = (target: number) => (attentionStep === target ? " lb-target-pulse" : "");
  const spotlight =
    attentionStep === step
      ? step === 4
        ? "deck"
        : step === 5
          ? "ask"
          : step === 6
            ? "turn"
            : null
      : null;
  return (
    <div
      ref={stageRef}
      className="lb-stage-window"
      data-step={step + 1}
      data-spotlight={spotlight ?? undefined}
      data-testid="landing-board-stage"
    >
      <div ref={layerRef} className="lb-board-layer">
        <div className="lb-dot-grid" />
        <div
          key={`tools-${attentionNonce}`}
          className={`lb-tool-dock${pulse(1)}`}
          aria-label="Sources"
        >
          {TOOL_BADGES.map((tool) => (
            <div key={tool.key}>
              <ToolLogo vendor={tool.key} compact />
            </div>
          ))}
        </div>
        <div key={`frames-${attentionNonce}`} className={`lb-frames${pulse(2)}`}>
          {visibleTasks.map((task, index) => (
            <section key={task.id} style={{ "--lb-frame-index": index } as CSSProperties}>
              <h3>{task.name}</h3>
              <p>{task.detail}</p>
            </section>
          ))}
        </div>
        <div className="lb-cards">
          {items.map((item, index) => (
            <BoardCard
              key={item.id}
              item={item}
              index={index}
              step={step}
              pin={
                step >= 5 && replayFinished && citedIds.has(item.id)
                  ? trailNumbers.get(item.id)
                  : undefined
              }
              read={step >= 5 && replayFinished && readIds.has(item.id)}
              turnCount={item.type === "ai_thread" ? (board.turns[item.id]?.length ?? null) : null}
              position={cardPositions[index] ?? { left: 188, top: 438 }}
              articleRef={item.id === proof?.itemId ? sourceRef : undefined}
              proofSource={item.id === proof?.itemId && step >= 5 && step <= 7 && replayFinished}
            />
          ))}
        </div>
        <svg className="lb-connectors" viewBox="0 0 1120 680" aria-hidden="true">
          <g className="lb-workstream-connectors">
            <path d="M260 230 C470 220 570 280 735 350" />
            <path d="M260 390 C470 390 590 380 735 350" />
            <path d="M540 485 C620 470 680 410 735 350" />
          </g>
          {proofLine && step >= 5 && step <= 7 ? (
            <path
              data-testid="landing-proof-connector"
              className="lb-proof-connector"
              d={`M ${proofLine.x1} ${proofLine.y1} C ${proofLine.x1 - 80} ${proofLine.y1}, ${proofLine.x2 + 90} ${proofLine.y2}, ${proofLine.x2} ${proofLine.y2}`}
            />
          ) : null}
        </svg>
        {spotlight === "deck" ? <StorySpotlight containerRef={layerRef} target="deck" /> : null}
        <article key={`deck-${attentionNonce}`} className={`lb-deck${pulse(3)}`}>
          <header>
            <ToolLogo vendor="powerpoint" compact />
            <strong>
              {(deckItem?.title ?? "FY27 board deck v3")
                .replace(/\s*\(slide notes\)\s*/i, "")
                .trim()}
            </strong>
          </header>
          <div>
            {slides.map((slide, index) => (
              <DeckSlide
                key={`${slide}-${index}`}
                index={index}
                clientName={clientLabel}
                numberRef={numberRef}
                proof={proofModel}
              />
            ))}
          </div>
          {step >= 5 && replayFinished && deckItem && citedIds.has(deckItem.id) ? (
            <span className="lb-pin" aria-label={`Source ${trailNumbers.get(deckItem.id)}`}>
              {trailNumbers.get(deckItem.id)}
            </span>
          ) : step >= 5 && replayFinished && deckItem && readIds.has(deckItem.id) ? (
            <span className="lb-read-dot" aria-label="Read for this response" />
          ) : null}
        </article>
        {lassoBox && step >= 4 && attentionStep === step ? (
          <svg
            key={`lasso-${attentionNonce}`}
            className={`lb-slide-lasso${pulse(4)}`}
            data-testid="landing-board-lasso"
            style={{
              left: lassoBox.left,
              top: lassoBox.top,
              width: lassoBox.width,
              height: lassoBox.height,
            }}
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <ellipse cx="50" cy="50" rx="46" ry="42" pathLength="1" />
          </svg>
        ) : null}
        {lassoBox && step === 4 ? (
          <svg className="lb-circle-link" viewBox="0 0 1120 680" aria-hidden="true">
            <line
              x1={lassoBox.left + lassoBox.width / 2}
              y1={lassoBox.top + lassoBox.height / 2}
              x2="932"
              y2="482"
            />
          </svg>
        ) : null}
        <div className="lb-circle-question">
          <p>Where did the $1.4M on slide 3 come from?</p>
        </div>
        {step === 7 && replayFinished ? (
          <div key={`notes-${attentionNonce}`} className={`lb-open-notes${pulse(7)}`}>
            <p>Confirm the vendor extension assumption.</p>
            <p>Confirm approval by Oct 1.</p>
          </div>
        ) : null}
      </div>
      {spotlight === "ask" || spotlight === "turn" ? (
        <StorySpotlight containerRef={stageRef} target={spotlight} />
      ) : null}
      {step >= 5 && step <= 7 ? (
        <div key={`ask-${attentionNonce}`} className={`lb-ask-spotlight${pulse(5)}`}>
          <AskReplay
            presets={presets}
            step={step}
            onFinished={onReplayFinished}
            clientLabel={clientLabel}
            engagementTitle={engagementTitle}
            proof={proof}
            proofModel={proofModel}
            onShowSlide={onShowSlide}
            onOpenTurn={onOpenTurn}
            onOpenDecisionTurn={onOpenDecisionTurn}
          />
        </div>
      ) : null}
      {step === 6 && replayFinished ? (
        <div key={`turn-${attentionNonce}`} className={`lb-turn-spotlight${pulse(6)}`}>
          <ExactTurn board={board} preset={second} onOpenTurn={onOpenDecisionTurn} />
        </div>
      ) : null}
      {step === 8 ? (
        <div key={`share-${attentionNonce}`} className={`lb-share-dialog${pulse(8)}`}>
          <p className="lb-micro">CHECK THIS OUT</p>
          <h3>Share this board</h3>
          <p>Share your work with your team, manager, client, or bestie!</p>
          <p>Decide whether they can see full context and transcripts or just the outline of your process.</p>
          <strong>Closes in 48 hours - Or grant unlimited access</strong>
          <small>Sharing can always be revoked.</small>
        </div>
      ) : null}
    </div>
  );
}

function useDecorativeHeroVideo(paused = false) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      if (paused || motion.matches) {
        video.pause();
        return;
      }
      void video.play().catch(() => undefined);
    };
    sync();
    motion.addEventListener("change", sync);
    return () => motion.removeEventListener("change", sync);
  }, [paused]);
  return videoRef;
}

/** Inert recorded sequence showing scattered AI work settling onto a finished board. */
function HeroAssemble({ paused }: { paused: boolean }) {
  const videoRef = useDecorativeHeroVideo(paused);
  return (
    <div className="lb-hero-assemble" aria-hidden="true" inert>
      <video
        ref={videoRef}
        className="lb-hero-assemble-video"
        autoPlay
        muted
        playsInline
        loop
        preload="metadata"
        poster="/videos/landing-hero-assemble-poster.png"
      >
        <source src="/videos/landing-hero-assemble.webm" type="video/webm" />
        <source src="/videos/landing-hero-assemble.mp4" type="video/mp4" />
      </video>
    </div>
  );
}

/** Inert phone-framed recording with three readable cards and no positioned children. */
function PhoneHeroAssemble() {
  const videoRef = useDecorativeHeroVideo();
  return (
    <div className="lb-phone-hero-sequence" aria-hidden="true" inert>
      <div className="lb-phone-hero-assemble">
        <video
          ref={videoRef}
          className="lb-phone-hero-video"
          autoPlay
          muted
          playsInline
          loop
          preload="metadata"
          poster="/videos/landing-hero-assemble-phone-poster.png"
        >
          <source src="/videos/landing-hero-assemble-phone.webm" type="video/webm" />
          <source src="/videos/landing-hero-assemble-phone.mp4" type="video/mp4" />
        </video>
      </div>
      <p className="micro-label lb-phone-hero-caption">CHATS FROM EVERY TOOL, ON ONE BOARD</p>
      <div className="lb-phone-hero-line">
        <p className="micro-label">WHAT IT IS</p>
        <p>ONE INFINITE CANVAS WHERE YOUR AI WORK, AND THE THINKING BEHIND IT, LIVES</p>
      </div>
    </div>
  );
}

function LandingBoardHeader({ onPilot }: { onPilot: () => void }) {
  return (
    <header className="lb-header">
      <div className="lb-header-main">
        <Link to="/" className="lb-brand">
          <LassoLoopMark /> <span>LASSO</span>
        </Link>
        <nav className="lb-header-nav" aria-label="Primary navigation">
          <a href="#lb-canvas">How it works</a>
          <Link to="/trust">Trust &amp; data</Link>
        </nav>
        <div className="lb-header-actions">
          <Button asChild size="sm" variant="outline">
            <Link to="/auth">Sign in</Link>
          </Button>
          <Button asChild size="sm">
            <a href="#pilot" onClick={onPilot}>
              Book a pilot
            </a>
          </Button>
        </div>
      </div>
    </header>
  );
}

function CaptionWords({ text }: { text: string }) {
  const words = text.split(/\s+/);
  return words.map((word, index) => (
    <span key={`${word}-${index}`} style={{ "--lb-word-index": index } as CSSProperties}>
      {word}
    </span>
  ));
}

function StoryCaption({
  step,
  nonce,
  onPilot,
}: {
  step: number;
  nonce: number;
  onPilot: () => void;
}) {
  const [outgoing, setOutgoing] = useState<number | null>(null);
  const previousStep = useRef(step);
  const outgoingTimer = useRef<number | null>(null);
  useEffect(() => {
    if (previousStep.current === step) return;
    if (outgoingTimer.current !== null) window.clearTimeout(outgoingTimer.current);
    setOutgoing(previousStep.current);
    previousStep.current = step;
    outgoingTimer.current = window.setTimeout(() => {
      setOutgoing(null);
      outgoingTimer.current = null;
    }, 160);
  }, [step]);
  useEffect(
    () => () => {
      if (outgoingTimer.current !== null) window.clearTimeout(outgoingTimer.current);
    },
    [],
  );
  const renderCaption = (index: number, phase: "incoming" | "outgoing") => {
    const item = LANDING_BOARD_STEPS[index];
    if (!item) return null;
    const displayStep = index;
    // "Try it" is the closing card, not a step in the process: it carries no numeral.
    const closing = item.key === "try-it";
    return (
      <article
        key={`${phase}-${index}-${nonce}`}
        className="lb-caption"
        data-phase={phase}
        data-step={index + 1}
        aria-live={phase === "incoming" ? "polite" : undefined}
        aria-hidden={phase === "outgoing" ? "true" : undefined}
        style={
          {
            "--lb-progress-from": `${Math.max(0, index) * 10}%`,
            "--lb-progress-to": `${(index + 1) * 10}%`,
          } as CSSProperties
        }
      >
        <span
          className="lb-caption-progress"
          aria-label={closing ? item.label : `${displayStep} of ${LANDING_BOARD_STEPS.length}`}
        />
        <div className="lb-caption-text">
          <div className="lb-caption-heading">
            {closing ? null : (
              <span className="lb-step-ring">
                <svg viewBox="0 0 34 34" aria-hidden="true">
                  <ellipse cx="17" cy="17" rx="14" ry="12.5" pathLength="1" />
                </svg>
                <span>{displayStep}</span>
              </span>
            )}
            <span>{item.label}</span>
          </div>
          <h2>
            <CaptionWords text={item.headline} />
          </h2>
          <p>{item.line}</p>
        </div>
        {index === 9 ? (
          <div>
            <Button asChild>
              <Link to="/demo">Open the board yourself</Link>
            </Button>
            <Button asChild variant="outline">
              <a href="#pilot" onClick={onPilot}>
                Book a pilot
              </a>
            </Button>
          </div>
        ) : null}
      </article>
    );
  };
  return (
    <div className="lb-caption-stack">
      {outgoing !== null ? renderCaption(outgoing, "outgoing") : null}
      {renderCaption(step, "incoming")}
    </div>
  );
}

function LandingBoardUseCase({
  card,
  rotationActive,
  rotationEnabled,
  onRotationAdvance,
  onBeforeUserPlay,
  onPlayed,
}: {
  card: (typeof LANDING_BOARD_USE_CASES)[number];
  rotationActive: boolean;
  rotationEnabled: boolean;
  onRotationAdvance: () => void;
  onBeforeUserPlay: (video: HTMLVideoElement) => void;
  onPlayed: (key: UseCaseKey, inputMode: "hover" | "tap") => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const inputMode = useRef<"hover" | "tap">("hover");
  const playIntent = useRef<"auto" | "user">("auto");
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);

  function play(mode: "hover" | "tap") {
    const video = videoRef.current;
    if (!video || videoFailed) return;
    onBeforeUserPlay(video);
    video.pause();
    playIntent.current = "user";
    inputMode.current = mode;
    video.currentTime = 0;
    setEnded(false);
    void video.play().catch(() => setVideoFailed(true));
  }

  function pause() {
    videoRef.current?.pause();
  }

  useEffect(() => {
    const video = videoRef.current;
    if (!video || videoFailed) {
      if (rotationActive && rotationEnabled) onRotationAdvance();
      return;
    }
    if (!rotationActive || !rotationEnabled) {
      video.pause();
      return;
    }
    playIntent.current = "auto";
    video.currentTime = 0;
    setEnded(false);
    void video.play().catch(() => {
      setVideoFailed(true);
    });
  }, [onRotationAdvance, rotationActive, rotationEnabled, videoFailed]);

  return (
    <article className="landing-usecase" data-usecase={card.key}>
      <div className="landing-usecase-copy">
        <div className="landing-usecase-tools" aria-label="Tools shown">
          {card.tools.map((tool) => (
            <ToolLogo key={tool} vendor={tool} compact />
          ))}
        </div>
        <h3>{card.title}</h3>
        <p>{card.body}</p>
      </div>
      <Button
        type="button"
        variant="ghost"
        className="landing-usecase-media"
        aria-label={`Play: ${card.title}`}
        data-playing={playing}
        onPointerEnter={(pointerEvent) => {
          if (pointerEvent.pointerType === "mouse") play("hover");
        }}
        onPointerLeave={(pointerEvent) => {
          if (pointerEvent.pointerType === "mouse") pause();
        }}
        onClick={() => {
          if (window.matchMedia("(hover: hover)").matches) return;
          if (playing) pause();
          else play("tap");
        }}
      >
        <img className="landing-usecase-poster" src={card.poster} alt="" aria-hidden="true" />
        {videoFailed ? null : (
          <video
            ref={videoRef}
            className="landing-usecase-video"
            muted
            playsInline
            preload="metadata"
            poster={card.poster}
            onPlaying={() => {
              setPlaying(true);
              if (playIntent.current === "user") onPlayed(card.key, inputMode.current);
            }}
            onPause={() => {
              setPlaying(false);
              if ((videoRef.current?.currentTime ?? 0) > 0) setEnded(true);
            }}
            onEnded={() => {
              setPlaying(false);
              setEnded(true);
              if (rotationActive && rotationEnabled) onRotationAdvance();
            }}
            onError={() => {
              setVideoFailed(true);
            }}
          >
            {"webm" in card ? <source src={card.webm} type="video/webm" /> : null}
            <source src={card.mp4} type="video/mp4" />
          </video>
        )}
        {ended ? <span className="landing-usecase-replay">Replay</span> : null}
      </Button>
    </article>
  );
}

function UseCaseSection({
  id = "usecases",
  phone = false,
  onPlayed,
}: {
  id?: string;
  phone?: boolean;
  onPlayed: (key: UseCaseKey, inputMode: "hover" | "tap") => void;
}) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [activeClip, setActiveClip] = useState(0);
  const [sectionVisible, setSectionVisible] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const observer = new IntersectionObserver(
      ([entry]) => setSectionVisible(Boolean(entry?.isIntersecting)),
      { threshold: 0.05 },
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  const advanceRotation = useCallback(
    () => setActiveClip((current) => (current + 1) % LANDING_BOARD_USE_CASES.length),
    [],
  );
  const beforeUserPlay = useCallback((nextVideo: HTMLVideoElement) => {
    sectionRef.current?.querySelectorAll("video").forEach((video) => {
      if (video !== nextVideo) video.pause();
    });
    const card = nextVideo.closest<HTMLElement>("[data-usecase]")?.dataset["usecase"];
    const index = LANDING_BOARD_USE_CASES.findIndex((item) => item.key === card);
    if (index >= 0) setActiveClip(index);
  }, []);
  const rotationEnabled = sectionVisible && !reducedMotion;

  return (
    <section
      ref={sectionRef}
      id={id}
      className={`landing-usecases${phone ? " lb-phone-step lb-phone-usecases" : ""}`}
      data-phone-step={phone ? 1 : undefined}
      aria-label="What Lasso does"
    >
      <div className="landing-section-head">
        <p className="micro-label">WHAT LASSO DOES</p>
        <h2>Deliverables you can defend to a client, a partner, or a board.</h2>
        <p>Three things a buyer asks for. Here is what each looks like.</p>
      </div>
      <div className="landing-usecase-grid">
        {LANDING_BOARD_USE_CASES.map((card, index) => (
          <LandingBoardUseCase
            key={card.key}
            card={card}
            rotationActive={activeClip === index}
            rotationEnabled={rotationEnabled}
            onRotationAdvance={advanceRotation}
            onBeforeUserPlay={beforeUserPlay}
            onPlayed={onPlayed}
          />
        ))}
      </div>
    </section>
  );
}

function LandingBoardContinuation({
  viewId,
  onPilot,
}: {
  viewId: string;
  onPilot: (placement: string) => void;
}) {
  const submitPilot = useServerFn(submitPilotRequestFn);
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  async function submit(eventValue: FormEvent<HTMLFormElement>) {
    eventValue.preventDefault();
    setState("sending");
    const form = eventValue.currentTarget;
    const controls = form.elements as typeof form.elements & {
      name: HTMLInputElement;
      firm: HTMLInputElement;
      email: HTMLInputElement;
      teamSize: HTMLSelectElement;
      note: HTMLTextAreaElement;
      website: HTMLInputElement;
    };
    const teamSize = controls.teamSize.value as "1-5" | "6-15" | "16-40" | "40+";
    try {
      await submitPilot({
        data: {
          name: controls.name.value,
          firm: controls.firm.value,
          email: controls.email.value,
          team_size: teamSize,
          note: controls.note.value || undefined,
          website: controls.website.value,
        },
      });
      event(viewId, "landing.pilot_requested", { team_size: teamSize });
      setState("sent");
    } catch {
      setState("error");
    }
  }
  return (
    <div className="landing-next lb-continuation">
      <section className="landing-close mx-auto max-w-4xl px-6 md:px-10" data-resolved="true">
        <h2 className="landing-close-line1 landing-close-wordmark">
          Every claim, traced to the work behind it.
        </h2>
        <p className="landing-close-line2">
          <LandingParticlePhrase text="The judgement, thinking, work... *Visible*" />
        </p>
        <div className="mt-10">
          <Button asChild>
            <a href="#pilot" onClick={() => onPilot("close")}>
              Book a pilot
            </a>
          </Button>
        </div>
      </section>
      <div className="mx-auto max-w-3xl px-6 pb-24 md:px-10">
        <div id="pilot">
          <FocusSection className="mt-20 border-t border-rule pt-10">
            <p className="micro-label">PILOT</p>
            <h2 className="pencil-title mt-4">Run it on one engagement.</h2>
            {state === "sent" ? (
              <p className="mt-8 border-l-2 border-green pl-4">
                Thanks. Liam will be in touch within a day.
              </p>
            ) : (
              <form className="landing-next-pilot-form mt-8 grid gap-5" onSubmit={submit}>
                <label className="sr-only" aria-hidden="true">
                  <span>Website</span>
                  <input name="website" tabIndex={-1} autoComplete="off" />
                </label>
                <label>
                  <span>Name</span>
                  <input name="name" required />
                </label>
                <label>
                  <span>Firm</span>
                  <input name="firm" required />
                </label>
                <label>
                  <span>Work email</span>
                  <input name="email" type="email" required />
                </label>
                <label>
                  <span>Team size</span>
                  <select name="teamSize" required defaultValue="">
                    <option value="" disabled>
                      Select team size
                    </option>
                    <option value="1-5">1 to 5</option>
                    <option value="6-15">6 to 15</option>
                    <option value="16-40">16 to 40</option>
                    <option value="40+">40+</option>
                  </select>
                </label>
                <label>
                  <span>Anything we should know</span>
                  <textarea name="note" rows={4} />
                </label>
                <div>
                  <Button
                    type="submit"
                    disabled={state === "sending"}
                    onClick={() => onPilot("form")}
                  >
                    {state === "sending" ? "Sending…" : "Book a pilot"}
                  </Button>
                </div>
                {state === "error" ? (
                  <p role="alert">
                    That didn't go through. Email liam@charlotte-labs.com and we'll pick it up.
                  </p>
                ) : null}
              </form>
            )}
          </FocusSection>
        </div>
      </div>
      <footer className="border-t border-rule">
        <div className="mx-auto flex max-w-3xl flex-wrap gap-4 px-6 py-8 font-mono text-[11px] text-muted-foreground">
          <span>Charlotte Labs</span>
          <a href="https://charlotte-labs.com">charlotte-labs.com</a>
          <a href="mailto:liam@charlotte-labs.com">liam@charlotte-labs.com</a>
          <Link to="/trust">Trust &amp; data</Link>
        </div>
      </footer>
    </div>
  );
}

export function LandingBoard() {
  const open = useServerFn(openDemoBoardFn);
  const query = useQuery({
    queryKey: ["landing-board", "YSM-01"],
    queryFn: () => open({ data: { code: "YSM-01" } }),
    staleTime: 60_000,
    retry: false,
  });
  const viewId = useRef(
    typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
  );
  const [active, setActive] = useState(0);
  const [settledStep, setSettledStep] = useState(0);
  const [attentionNonce, setAttentionNonce] = useState(0);
  const [phoneStop, setPhoneStop] = useState(0);
  const activeRef = useRef(0);
  const settledStepRef = useRef(0);
  const transitioning = useRef(false);
  const queued = useRef<{ index: number; input: StoryInput } | null>(null);
  const jumpTarget = useRef<number | null>(null);
  const seen = useRef(new Set<string>());
  const settleTimer = useRef<number | null>(null);
  const transitionTimer = useRef<number | null>(null);
  const playedCards = useRef(new Set<UseCaseKey>());

  useEffect(() => {
    event(viewId.current, "landing.viewed", {
      variant: "b2b",
      surface: "landing-board",
      input_mode: window.matchMedia("(max-width: 639px)").matches ? "scroll" : "scroll",
    });
  }, []);
  const settle = useCallback((index: number, inputMode: StoryInput) => {
    if (settleTimer.current !== null) window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => {
      if (activeRef.current !== index || transitioning.current || queued.current) return;
      if (settledStepRef.current !== index) {
        settledStepRef.current = index;
        setSettledStep(index);
        setAttentionNonce((nonce) => nonce + 1);
      }
      const key = LANDING_BOARD_STEPS[index]?.key;
      if (!key || seen.current.has(`${key}:${inputMode}`)) return;
      seen.current.add(`${key}:${inputMode}`);
      event(viewId.current, "landing.story_section_viewed", {
        section: key,
        input_mode: inputMode,
      });
    }, 800);
  }, []);

  const activate = useCallback(
    (index: number, inputMode: StoryInput, immediate = false) => {
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
    },
    [settle],
  );

  useEffect(() => {
    if (window.matchMedia("(max-width: 639px)").matches) return;
    document.documentElement.classList.add("lb-scroll-root");
    const sections = Array.from(document.querySelectorAll<HTMLElement>("[data-lb-step]"));
    let frame = 0;
    const readStep = () => {
      frame = 0;
      if (jumpTarget.current !== null) return;
      const threshold = window.innerHeight * 0.55;
      let latest = 0;
      for (const section of sections) {
        if (section.getBoundingClientRect().top <= threshold)
          latest = Number(section.dataset["lbStep"] ?? latest);
      }
      activate(latest, "scroll");
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(readStep);
    };
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

  // R6 focus rule: one hero zone in focus at a time, with hysteresis so small
  // scrolls settle in one state. Render state only, no events.
  const [heroFocus, setHeroFocus] = useState<1 | 2>(1);
  useEffect(() => {
    if (window.matchMedia("(max-width: 639px)").matches) return;
    const ENTER_ZONE_2 = 160;
    const RETURN_ZONE_1 = 80;
    let frame = 0;
    const read = () => {
      frame = 0;
      const y = window.scrollY;
      setHeroFocus((current) =>
        current === 1 ? (y > ENTER_ZONE_2 ? 2 : 1) : y < RETURN_ZONE_1 ? 1 : 2,
      );
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(read);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    read();
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  const activatePhone = useCallback((stop: number) => {
    setPhoneStop(stop);
    if (stop === 1) return;
    const index = stop === 0 ? 0 : stop - 1;
    activeRef.current = index;
    setActive(index);
    settledStepRef.current = index;
    setSettledStep(index);
    const key = LANDING_BOARD_STEPS[index]?.key;
    if (!key || seen.current.has(`${key}:scroll`)) return;
    seen.current.add(`${key}:scroll`);
    event(viewId.current, "landing.story_section_viewed", { section: key, input_mode: "scroll" });
  }, []);

  function jump(key: StepKey) {
    const index = LANDING_BOARD_STEPS.findIndex((step) => step.key === key);
    if (index < 0) return;
    jumpTarget.current = index;
    activate(index, "jump", true);
    event(viewId.current, "landing.section_jumped", { section: key });
    if (window.matchMedia("(max-width: 639px)").matches) {
      document
        .getElementById(`lb-phone-${key}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    const target = document.getElementById(`lb-${key}`);
    if (target)
      window.scrollTo({
        top: window.scrollY + target.getBoundingClientRect().top - window.innerHeight * 0.54,
        behavior: "auto",
      });
    window.setTimeout(() => {
      jumpTarget.current = null;
    }, 120);
  }
  function noteUseCasePlayed(card: UseCaseKey, inputMode: "hover" | "tap") {
    if (playedCards.current.has(card)) return;
    playedCards.current.add(card);
    event(viewId.current, "landing.usecase_played", { card, input_mode: inputMode });
  }
  function jumpToUseCases() {
    const id = window.matchMedia("(max-width: 639px)").matches ? "lb-phone-usecases" : "usecases";
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function pilot(placement: string) {
    event(viewId.current, "landing.pilot_cta_clicked", { placement });
  }
  const result = query.data;
  return (
    <div className="landing-board-page">
      <LandingBoardHeader onPilot={() => pilot("header")} />
      <main className="lb-story">
        <section
          className="lb-desktop-hero"
          aria-labelledby="lb-home-title"
          data-hero-focus={heroFocus}
          onFocus={(focusEvent) => {
            if ((focusEvent.target as HTMLElement).closest(".lb-hero-zone-1")) setHeroFocus(1);
          }}
        >
          <div className="lb-hero-copy">
            <div>
              <h1 id="lb-home-title">
                Your firm bought AI.{" "}
                <LandingParticlePhrase text="The human judgment, process, and thinking" /> in your
                team's work went invisible.
              </h1>
              <h2>
                Lasso is the reasoning and judgment layer for AI-assisted consulting. It connects
                the work across tools to the client deliverable and keeps the decisions your team
                made, so they can show where a claim came from and why it stayed.
              </h2>
              <div className="lb-hero-zone-1">
                <Button onClick={jumpToUseCases}>Watch it work</Button>
                <Button asChild variant="outline">
                  <Link
                    to="/demo"
                    onClick={() =>
                      event(viewId.current, "landing.see_it_work_clicked", {
                        location: "hero_workboard",
                      })
                    }
                  >
                    View a Workboard
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <a href="#pilot" onClick={() => pilot("hero")}>
                    Book a pilot
                  </a>
                </Button>
              </div>
              <div className="lb-hero-stage">
                <HeroAssemble paused={heroFocus === 1} />
              </div>
              <p className="micro-label lb-hero-assemble-caption" aria-hidden="true">CHATS FROM EVERY TOOL, ON ONE BOARD</p>
              <div className="lb-hero-line">
                <p className="micro-label">{"\n"}</p>
                <p className="lb-hero-line-text font-mono font-bold uppercase tracking-[0.18em]">
                  ONE INFINITE CANVAS WHERE YOUR AI WORK, AND THE THINKING BEHIND IT, LIVES
                </p>
              </div>
            </div>
          </div>
        </section>
        <UseCaseSection onPlayed={noteUseCasePlayed} />
        <section className="lb-how-it-works">
          <div className="lb-how-it-works-head">
            <p className="micro-label">HOW IT WORKS</p>
            <h2>Watch one engagement, start to finish.</h2>
          </div>
          <div className="lb-sticky-stage">
            {result?.status === "open" && "board" in result ? (
              <StoryBoard
                board={result.board}
                presets={result.presets}
                proof={result.proof}
                step={active}
                attentionStep={settledStep}
                attentionNonce={attentionNonce}
                clientLabel={result.engagement.clientLabel ?? ""}
                engagementTitle={result.engagement.title}
                onShowSlide={() => {
                  event(viewId.current, "landing.proof_link_opened", {
                    step: "6",
                    target: "slide",
                  });
                  jump("circle");
                }}
                onOpenTurn={() =>
                  event(viewId.current, "landing.proof_link_opened", { step: "6", target: "turn" })
                }
                onOpenDecisionTurn={() =>
                  event(viewId.current, "landing.proof_link_opened", { step: "7", target: "turn" })
                }
              />
            ) : (
              <div className="lb-stage-window lb-loading">
                {query.isPending
                  ? "Opening the demo board."
                  : "The demo board is not available right now."}
              </div>
            )}
            <StoryCaption
              step={settledStep}
              nonce={attentionNonce}
              onPilot={() => pilot("try_it")}
            />
          </div>
          <div className="lb-scroll-sections">
            {LANDING_BOARD_STEPS.slice(1).map((step, itemIndex) => {
              const index = itemIndex + 1;
              // S2: workstreams is a self-contained section, not a shared-stage step.
              if (step.key === "workstreams")
                return <WorkstreamsSection key={step.key} onViewed={noteWorkstreamsViewed} />;
              return (
                <section
                  id={`lb-${step.key}`}
                  data-lb-step={index}
                  key={step.key}
                  className="lb-scroll-step"
                ></section>
              );
            })}
          </div>
        </section>
        {result?.status === "open" && "board" in result ? (
          <PhoneStory
            board={result.board}
            presets={result.presets}
            proof={result.proof}
            clientLabel={result.engagement.clientLabel ?? ""}
            active={phoneStop}
            onActive={activatePhone}
            onWatch={jumpToUseCases}
            onPilot={() => pilot("try_it")}
            onShowSlide={() => {
              event(viewId.current, "landing.proof_link_opened", { step: "6", target: "slide" });
              jump("circle");
            }}
            onOpenTurn={() =>
              event(viewId.current, "landing.proof_link_opened", { step: "6", target: "turn" })
            }
            onOpenDecisionTurn={() =>
              event(viewId.current, "landing.proof_link_opened", { step: "7", target: "turn" })
            }
            onUseCasePlayed={noteUseCasePlayed}
          />
        ) : (
          <div className="lb-phone-loading">
            {query.isPending
              ? "Opening the demo board."
              : "The demo board is not available right now."}
          </div>
        )}
      </main>
      <div className="lb-phone-pilot" data-visible={phoneStop > 0 ? "true" : "false"}>
        <Button asChild size="sm">
          <a href="#pilot" onClick={() => pilot("phone_bar")}>
            Book a pilot
          </a>
        </Button>
      </div>
      <LandingBoardContinuation viewId={viewId.current} onPilot={pilot} />
    </div>
  );
}
