import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

import { CanvasAnswerCard, type CanvasAnswer } from "@/components/firm-brain/CanvasAnswerCard";
import { BrandMark } from "@/components/layout/BrandLockup";
import { ArrowUp, ArrowUpRight, ChevronDown, Maximize2, Minimize2 } from "@/design/brand/icons";
import { isFirmBrainLimit } from "@/lib/firm-brain-limit-shared";
import type { FirmAskResult, FirmAskStarter } from "@/lib/firm-ask-shared";
import { toast } from "sonner";

import { BRIEF_READ_MAX } from "@/lib/brief-read-shared";
import { briefText, isBriefPaste } from "@/lib/pill-proposal-shared";

import { landCard, liftCard } from "./fly-card";
import {
  behindAt,
  PILL_OPEN_EVENT,
  dragPull,
  geometryAt,
  PILL_COPY,
  PILL_DRAG_SLOP,
  PILL_MODES,
  PILL_MORPH_MS,
  pillGeometry,
  pillQuestion,
  progressForHeight,
  settleMode,
  type PillGeometry,
  type PillMode,
  type PillPlace,
  type PillStarter,
  type Viewport,
} from "@/lib/chat-pill-shared";

import "./chat-pill.css";

export type ChatPillMessage =
  | { id: number; kind: "person" | "note" | "alert"; text: string }
  /** An answer from the firm, drawn with the canvas's own card, and the one action it offers once it is in. */
  | { id: number; kind: "answer"; answer: CanvasAnswer }
  /** 20 Nov 2026, PR 3b: a pasted brief, drawn by the container's proposal card (or, for a Member, the pass to an admin). */
  | { id: number; kind: "brief"; text: string };

/** What the pill hands a brief card: a way to tuck the chat away once the card has flown out of it. */
export type BriefContext = { tuck: () => void; askInstead: () => void };

/**
 * 20 Nov 2026, chat pill PR 1a (Liam, D-97). The one place to ask, on every signed-in page: a pill that says where
 * you are, opens into the helper panel (a bottom sheet on a phone) and, dragged on, becomes a full screen chat with
 * the page soft behind it. One element morphs the whole way, so it is never two things swapped. On a board, the pill
 * opens that board's own chat instead. Props in, effects out: the container (ChatPillMount) owns the route, the
 * person and what asking does.
 */
const noop = () => {};

export function ChatPill({
  brandName,
  askLabel,
  firstName,
  place,
  canAsk,
  questionMax,
  starters,
  onAsk,
  onOpenOnCanvas,
  onOpenSource,
  profileId,
  boardChat,
  onOpened,
  onExpanded,
  reduceMotion = false,
  initialMode = "shut",
  brief = null,
  upNext = null,
}: {
  brandName: string;
  /** The brand's Ask label ("Ask Lasso"), from the brand module. */
  askLabel: string;
  firstName: string;
  place: PillPlace;
  /** The person may ask the firm: a member of a company workspace who is not a coach or a guest. */
  canAsk: boolean;
  questionMax: number;
  /** Each with the starter it came from, so Ask the firm's counts can still tell starters from typed questions. */
  starters: readonly PillStarter[];
  /** Asks the firm. Resolves with the answer; a thrown error is a failure (the daily limit says so). */
  onAsk: (question: string, starter: FirmAskStarter | null) => Promise<FirmAskResult>;
  /** Opens a finished answer on the Firm brain canvas, beside its threads, without asking again. */
  onOpenOnCanvas: (question: string, result: FirmAskResult) => void | Promise<void>;
  /** Opens a line's source, as the canvas does. */
  onOpenSource: (itemId: string) => void;
  /** Whose answer it is, for "Cite this" on each line. */
  profileId?: string | null | undefined;
  /** On a board: the board's own chat. The pill opens it instead of the panel. */
  boardChat?: (() => void) | null | undefined;
  onOpened?: ((place: PillPlace) => void) | undefined;
  onExpanded?: ((place: PillPlace) => void) | undefined;
  reduceMotion?: boolean;
  initialMode?: PillMode;
  /**
   * 20 Nov 2026, PR 3b: a pasted brief is not a question. Given, a paste that reads as a brief is drawn by `render`
   * (the proposal card, or a Member's pass to an admin) instead of being asked of the firm.
   */
  brief?: { render: (text: string, context: BriefContext) => ReactNode } | null | undefined;
  /** 21 Nov 2026, PR 4b: the Lead's Up next, drawn under the welcome. The container decides who gets one. */
  upNext?: ReactNode;
}) {
  const [mode, setModeState] = useState<PillMode>(initialMode);
  const [messages, setMessages] = useState<ChatPillMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState(false);
  const el = useRef<HTMLDivElement>(null);
  const shut = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const msgs = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);
  const justDragged = useRef(false);
  const drag = useRef<{
    x: number;
    y: number;
    h0: number;
    progress: number;
    moved: boolean;
    id: number;
    fromShut: boolean;
    hist: [number, number][];
  } | null>(null);
  const scrub = useRef({ cur: 0, target: 0, raf: 0 });
  const modeRef = useRef(mode);
  modeRef.current = mode;

  const viewport = useCallback((): Viewport => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const phone = width <= 767;
    const rail = document.querySelector<HTMLElement>(".lasso-sidebar-shell");
    const tabbar = document.querySelector<HTMLElement>("nav.nb-tabbar");
    return {
      width,
      height,
      phone,
      railWidth: phone ? 0 : (rail?.offsetWidth ?? 0),
      shutWidth: (shut.current?.scrollWidth ?? 120) + 2,
      bottomClear: phone ? (tabbar?.offsetHeight ?? 0) : 0,
    };
  }, []);

  const apply = useCallback((g: PillGeometry) => {
    const node = el.current;
    if (!node) return;
    node.style.left = `${g.left}px`;
    node.style.top = `${g.top}px`;
    node.style.width = `${g.width}px`;
    node.style.height = `${g.height}px`;
    node.style.borderRadius = g.radius;
  }, []);

  const place_ = useCallback(
    (next: PillMode, instant: boolean) => {
      const node = el.current;
      if (!node) return;
      const vp = viewport();
      const open = pillGeometry("open", vp);
      node.style.setProperty("--chat-pill-open-w", `${open.width}px`);
      node.style.setProperty("--chat-pill-open-h", `${open.height}px`);
      if (instant || reduceMotion) node.setAttribute("data-instant", "");
      apply(pillGeometry(next, vp));
      if (instant || reduceMotion) {
        void node.offsetWidth;
        node.removeAttribute("data-instant");
      }
    },
    [apply, reduceMotion, viewport],
  );

  /** The page behind: soft while the chat is full screen. */
  const root = () => el.current?.closest<HTMLElement>('[data-lasso="on"]') ?? null;
  const behind = () => root()?.querySelector<HTMLElement>("[data-pill-behind]") ?? null;
  const clearBehind = () => {
    const node = behind();
    if (node) for (const key of ["filter", "opacity", "transform"] as const) node.style[key] = "";
    root()?.removeAttribute("data-pill-scrubbing");
  };

  const setMode = useCallback(
    (next: PillMode) => {
      const was = modeRef.current;
      modeRef.current = next;
      setModeState(next);
      el.current?.removeAttribute("data-dragging");
      if (panel.current) panel.current.style.opacity = "";
      if (shut.current) shut.current.style.opacity = "";
      clearBehind();
      const r = root();
      if (r) {
        if (next === "full") r.setAttribute("data-pill-full", "");
        else r.removeAttribute("data-pill-full");
      }
      place_(next, false);
      if (next !== "shut" && was === "shut") {
        onOpened?.(place);
        window.setTimeout(
          () => {
            // A laptop gets the question box. A phone gets the panel itself, so a screen reader says what opened
            // without the keyboard rising over the sheet (QA M2 of PR 289).
            if (window.innerWidth > 767) input.current?.focus();
            else panel.current?.focus({ preventScroll: true });
            if (msgs.current) msgs.current.scrollTop = msgs.current.scrollHeight;
          },
          reduceMotion ? 0 : PILL_MORPH_MS + 20,
        );
      }
      if (next === "full" && was !== "full") onExpanded?.(place);
      if (next === "shut" && was !== "shut") shut.current?.focus({ preventScroll: true });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [place, place_, onOpened, onExpanded, reduceMotion],
  );

  // First paint: placed with no motion. Afterwards, every resize places it again at once.
  useLayoutEffect(() => {
    place_(modeRef.current, true);
    const onResize = () => place_(modeRef.current, true);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [place_]);

  // A new page: the shut pill fits its new words, and the "On ..." chip flashes once.
  useLayoutEffect(() => {
    place_(modeRef.current, true);
    setFlash(true);
    const timer = window.setTimeout(() => setFlash(false), 900);
    return () => window.clearTimeout(timer);
  }, [place, place_]);

  // Leaving the page with the chat full screen never leaves the page behind soft.
  useEffect(
    () => () => {
      clearBehind();
      root()?.removeAttribute("data-pill-full");
    },
    // Only on leaving: both read the element through its ref at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    if (mode === "shut") return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      // A dialog over the pill takes its own Escape first (QA L1 of PR 289).
      if (event.key !== "Escape" || event.defaultPrevented) return;
      const other = [...document.querySelectorAll('[role="dialog"], [role="alertdialog"]')].some(
        (node) => !el.current?.contains(node) && (node as HTMLElement).offsetParent !== null,
      );
      if (other) return;
      setMode("shut");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, setMode]);

  useEffect(() => {
    // The list scrolls smoothly by its own CSS; reduced motion turns that off.
    if (msgs.current) msgs.current.scrollTop = msgs.current.scrollHeight;
  }, [messages]);

  useLayoutEffect(() => {
    const node = input.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${Math.min(110, node.scrollHeight)}px`;
  }, [question]);

  /* ----- the drag: one continuous, gesture-scrubbed morph between pill (0), panel (1) and full screen (2) ----- */

  const scrubLoop = () => {
    scrub.current.raf = 0;
    if (!drag.current) return;
    const s = scrub.current;
    s.cur += (s.target - s.cur) * 0.1;
    const node = behind();
    if (node) {
      const b = behindAt(s.cur);
      node.style.filter = `blur(${b.blurPx.toFixed(2)}px)`;
      node.style.opacity = b.opacity.toFixed(3);
      node.style.transform = `scale(${b.scale.toFixed(4)})`;
    }
    s.raf = window.requestAnimationFrame(scrubLoop);
  };

  function applyProgress(progress: number) {
    apply(geometryAt(progress, viewport()));
    if (panel.current)
      panel.current.style.opacity = String(
        progress < 1 ? Math.min(1, Math.max(0, (progress - 0.25) / 0.55)) : 1,
      );
    if (shut.current)
      shut.current.style.opacity = String(Math.min(1, Math.max(0, 1 - progress * 4)));
    scrub.current.target = Math.min(1, Math.max(0, progress - 1));
    if (!scrub.current.raf && !reduceMotion)
      scrub.current.raf = window.requestAnimationFrame(scrubLoop);
  }

  function onPointerDown(event: ReactPointerEvent<HTMLElement>) {
    if (event.button > 0) return;
    if ((event.target as HTMLElement).closest(".chat-pill__head button")) return;
    if (boardChat && modeRef.current === "shut") return;
    const index = PILL_MODES.indexOf(modeRef.current);
    drag.current = {
      x: event.clientX,
      y: event.clientY,
      h0: pillGeometry(modeRef.current, viewport()).height,
      progress: index,
      moved: false,
      id: event.pointerId,
      fromShut: modeRef.current === "shut",
      hist: [[performance.now(), index]],
    };
    scrub.current.cur = scrub.current.target = Math.min(1, Math.max(0, index - 1));
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* a pointer that cannot be captured still drags while it stays over the pill */
    }
  }

  function onPointerMove(event: ReactPointerEvent<HTMLElement>) {
    const d = drag.current;
    if (!d || event.pointerId !== d.id) return;
    const dx = event.clientX - d.x;
    const dy = event.clientY - d.y;
    const vp = viewport();
    if (!d.moved) {
      if (Math.hypot(dx, dy) < PILL_DRAG_SLOP) return;
      d.moved = true;
      el.current?.setAttribute("data-dragging", "");
      root()?.setAttribute("data-pill-scrubbing", "");
    }
    const progress = progressForHeight(d.h0 + dragPull(dx, dy, vp.phone), vp);
    d.progress = progress;
    d.hist.push([performance.now(), progress]);
    if (d.hist.length > 6) d.hist.shift();
    applyProgress(progress);
    event.preventDefault();
  }

  function onPointerUp(event: ReactPointerEvent<HTMLElement>) {
    const d = drag.current;
    if (!d || event.pointerId !== d.id) return;
    drag.current = null;
    if (scrub.current.raf) window.cancelAnimationFrame(scrub.current.raf);
    scrub.current.raf = 0;
    if (!d.moved) return;
    justDragged.current = d.fromShut;
    window.setTimeout(() => (justDragged.current = false), 60);
    const first = d.hist[0]!;
    const last = d.hist[d.hist.length - 1]!;
    const velocity = (last[1] - first[1]) / Math.max(16, last[0] - first[0]);
    setMode(settleMode(d.progress, velocity));
  }

  // 21 Nov 2026, click path cards: a step card's "Ask Lasso about this" opens the pill, and nothing more. The card has
  // closed first; the pill opens where it is, as if pressed.
  useEffect(() => {
    const onOpen = () => {
      if (boardChat) boardChat();
      else setMode("open");
    };
    window.addEventListener(PILL_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(PILL_OPEN_EVENT, onOpen);
  }, [boardChat, setMode]);

  function openFromShut() {
    if (justDragged.current) {
      justDragged.current = false;
      return;
    }
    if (boardChat) {
      boardChat();
      return;
    }
    setMode("open");
  }

  /* ----- asking ----- */

  const updateAnswer = (id: string, patch: Partial<CanvasAnswer>) =>
    setMessages((list) =>
      list.map((message) =>
        message.kind === "answer" && message.answer.id === id
          ? { ...message, answer: { ...message.answer, ...patch } }
          : message,
      ),
    );

  async function read(answer: CanvasAnswer) {
    setBusy(true);
    try {
      const result = await onAsk(answer.question, answer.starter);
      updateAnswer(answer.id, { status: "answered", result, limited: false });
    } catch (error) {
      updateAnswer(answer.id, { status: "failed", result: null, limited: isFirmBrainLimit(error) });
    } finally {
      setBusy(false);
    }
  }

  async function ask(text: string, starter: FirmAskStarter | null = null, asQuestion = false) {
    if (busy) return;
    if (brief && !starter && !asQuestion && isBriefPaste(text)) {
      const pasted = briefText(text);
      setQuestion("");
      setMessages((list) => [
        ...list,
        { id: nextId.current++, kind: "person", text: pasted },
        { id: nextId.current++, kind: "brief", text: pasted },
      ]);
      return;
    }
    const clean = pillQuestion(text, questionMax);
    if (!clean) {
      setMessages((list) => [
        ...list,
        { id: nextId.current++, kind: "alert", text: PILL_COPY.tooShort },
      ]);
      return;
    }
    setQuestion("");
    const answer: CanvasAnswer = {
      id: `pill-${nextId.current}`,
      question: clean,
      starter,
      status: "pending",
      result: null,
      limited: false,
      x: 0,
      y: 0,
      h: 0,
      startedAt: Date.now(),
      built: false,
    };
    setMessages((list) => [
      ...list,
      { id: nextId.current++, kind: "person", text: clean },
      { id: nextId.current++, kind: "note", text: PILL_COPY.looking },
      { id: nextId.current++, kind: "answer", answer },
    ]);
    await read(answer);
  }

  const tuck = () => window.setTimeout(() => setMode("shut"), reduceMotion ? 0 : 250);
  /** The brief card and the person's paste above it go, and the same words are asked of the firm as a question. */
  const briefContext = (id: number, text: string): BriefContext => ({
    tuck,
    askInstead: () => {
      setMessages((list) => list.filter((message) => message.id !== id && message.id !== id - 1));
      void ask(text, null, true);
    },
  });

  async function retry(answer: CanvasAnswer) {
    if (busy) return;
    const fresh = {
      ...answer,
      status: "pending" as const,
      result: null,
      limited: false,
      startedAt: Date.now(),
      built: false,
    };
    updateAnswer(answer.id, fresh);
    await read(fresh);
  }

  /**
   * QA M1 of PR 290, the prototype's hand-over: a picture of the card is lifted before the page changes, the chat
   * tucks itself away, and the card flies onto the canvas card that holds the same answer, beside its threads. A toast
   * says where the chat went. With reduced motion nothing travels; the toast still says it.
   */
  async function openOnCanvas(answer: CanvasAnswer) {
    if (!answer.result) return;
    const source =
      msgs.current?.querySelector<HTMLElement>(
        `[data-pill-answer="${answer.id}"] [data-testid="chat-answer"]`,
      ) ?? null;
    const lifted = !reduceMotion && source ? liftCard(source) : null;
    await onOpenOnCanvas(answer.question, answer.result);
    window.setTimeout(() => setMode("shut"), reduceMotion ? 0 : 250);
    toast(PILL_COPY.movedToCorner);
    if (lifted) {
      await landCard(lifted, () => {
        const cards = [...document.querySelectorAll<HTMLElement>('[data-testid="canvas-answer"]')];
        return cards.reverse().find((card) => card.textContent?.includes(answer.question)) ?? null;
      });
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void ask(question);
  }

  function onKey(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void ask(question);
    }
  }

  const where = PILL_COPY.where(place);
  const shutLabel = boardChat ? PILL_COPY.openBoardChat : PILL_COPY.open(brandName);
  const open = mode !== "shut";

  return (
    <div
      ref={el}
      className="chat-pill"
      data-mode={mode}
      data-testid="ask-the-firm"
      data-chat-pill=""
      data-ph-no-autocapture=""
    >
      <button
        ref={shut}
        type="button"
        className="chat-pill__shut"
        aria-label={shutLabel}
        aria-expanded={open}
        tabIndex={open ? -1 : 0}
        onClick={openFromShut}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <BrandMark px={24} />
        <span>{askLabel}</span>
        {boardChat ? <span className="chat-pill__ctx">{PILL_COPY.where("board")}</span> : null}
      </button>
      <div
        ref={panel}
        className="chat-pill__panel ph-no-autocapture"
        role="dialog"
        // Open or closed in the shared dialogs' own words, so anything that watches the page for open dialogs (the demo
        // story collapses its card under one) reads the shut pill as closed. Without it a hand-built dialog counts as
        // open whenever it is in the page, and the story never showed its card (live check of PR 290, 20 Nov 2026).
        data-state={open ? "open" : "closed"}
        tabIndex={-1}
        aria-modal={mode === "full" || undefined}
        aria-label={PILL_COPY.panel(brandName)}
        aria-hidden={!open}
        inert={!open || undefined}
      >
        <div
          className="chat-pill__head"
          title={PILL_COPY.dragHint}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <i className="chat-pill__grip" aria-hidden />
          <BrandMark px={22} />
          <b className="chat-pill__title">{brandName}</b>
          {where ? (
            <span className="chat-pill__where" data-flash={flash || undefined}>
              {where}
            </span>
          ) : null}
          <button
            type="button"
            className="chat-pill__icon chat-pill__icon--first"
            aria-label={mode === "full" ? PILL_COPY.shrink : PILL_COPY.grow}
            onClick={() => setMode(mode === "full" ? "open" : "full")}
          >
            {mode === "full" ? (
              <Minimize2 className="size-[18px]" aria-hidden />
            ) : (
              <Maximize2 className="size-[18px]" aria-hidden />
            )}
          </button>
          <button
            type="button"
            className="chat-pill__icon"
            aria-label={PILL_COPY.close}
            onClick={() => setMode("shut")}
          >
            <ChevronDown className="size-[18px]" aria-hidden />
          </button>
        </div>
        <div ref={msgs} className="chat-pill__msgs" aria-live="polite">
          <div className="chat-pill__msg chat-pill__msg--welcome">
            <p>
              <b>{PILL_COPY.hello(firstName)}</b>{" "}
              {canAsk ? PILL_COPY.welcomeFirm : PILL_COPY.welcomeNone}
            </p>
          </div>
          {upNext}
          {messages.map((message) =>
            message.kind === "answer" ? (
              <div key={message.id} className="chat-pill__msg" data-pill-answer={message.answer.id}>
                <CanvasAnswerCard
                  inline
                  answer={message.answer}
                  focused={message.answer.status !== "failed"}
                  dimmed={false}
                  reduceMotion={reduceMotion}
                  profileId={profileId}
                  onOpenSource={onOpenSource}
                  onRetry={(failed) => void retry(failed)}
                  onMeasured={noop}
                  onBuilt={(id) => updateAnswer(id, { built: true })}
                />
                {message.answer.status === "answered" &&
                (message.answer.built || reduceMotion) &&
                message.answer.result?.status === "answered" ? (
                  <div className="chat-pill__acts">
                    <button
                      type="button"
                      className="chat-pill__act"
                      onClick={() => void openOnCanvas(message.answer)}
                    >
                      <ArrowUpRight className="size-[16px]" aria-hidden />
                      {PILL_COPY.openOnCanvas}
                    </button>
                  </div>
                ) : null}
              </div>
            ) : message.kind === "brief" && brief ? (
              <div key={message.id} className="chat-pill__msg" data-pill-brief>
                {brief.render(message.text, briefContext(message.id, message.text))}
              </div>
            ) : message.kind === "person" ? (
              <div key={message.id} className="chat-pill__msg chat-pill__msg--person">
                {message.text}
              </div>
            ) : (
              <div
                key={message.id}
                className={
                  message.kind === "alert" ? "chat-pill__msg chat-pill__alert" : "chat-pill__msg"
                }
                role={message.kind === "alert" ? "alert" : undefined}
              >
                <p>{message.text}</p>
              </div>
            ),
          )}
        </div>
        {canAsk ? (
          <>
            {starters.length && !busy ? (
              <div className="chat-pill__starters">
                {starters.map((starter) => (
                  <button
                    key={starter.text}
                    type="button"
                    className="chat-pill__starter"
                    onClick={() => void ask(starter.text, starter.starter)}
                  >
                    {starter.text}
                  </button>
                ))}
              </div>
            ) : null}
            <form className="chat-pill__form" onSubmit={submit} autoComplete="off">
              <textarea
                ref={input}
                rows={1}
                value={question}
                maxLength={brief ? BRIEF_READ_MAX : questionMax}
                placeholder={brief ? PILL_COPY.placeholderBrief : PILL_COPY.placeholder}
                aria-label={PILL_COPY.label}
                disabled={busy}
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={onKey}
                className="chat-pill__input"
              />
              <button
                type="submit"
                className="chat-pill__send"
                aria-label={PILL_COPY.send}
                disabled={busy || question.trim().length < 3}
              >
                <ArrowUp className="size-[18px]" aria-hidden />
              </button>
            </form>
            <p className="chat-pill__foot">{PILL_COPY.footer}</p>
          </>
        ) : null}
      </div>
    </div>
  );
}
