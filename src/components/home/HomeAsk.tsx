import { useNavigate } from "@tanstack/react-router";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";

import { Button } from "@/components/ui/button";
import { chipVariants } from "@/components/ui/chip";
import { tagVariants } from "@/components/ui/tag";
import { ArrowUp } from "@/design/brand/icons";
import { useReducedMotion } from "@/hooks/use-motion";
import { FIRM_ASK_QUESTION_MAX, type FirmAskResult } from "@/lib/firm-ask-shared";
import { isFirmBrainLimit, FIRM_BRAIN_LIMIT_COPY } from "@/lib/firm-brain-limit-shared";
import { answerBoards, pendingCaption, type FirmCanvasData } from "@/lib/firm-canvas-shared";
import { ORB_COPY } from "@/lib/firm-orb-shared";
import {
  firstNameOf,
  handOffQuestion,
  HOME_ASK_COPY,
  homeStarters,
  takeReturn,
} from "@/lib/home-ask-shared";
import { FIRM_BRAIN_COPY } from "@/lib/role-screens-shared";
import { cn } from "@/lib/utils";

import { FirmOrb, type FirmOrbHandle } from "./FirmOrb";
import { firmBrainRow, morph, rectOf, topMiddle } from "./morph-ghost";

/**
 * 21 Nov, D-85 PR B: Home's mini firm brain, with the firm map as a turning sphere at its centre (Liam: "3d orb as
 * center for non admins"). A greeting, the orb, one large question box, starters made from the person's most recent
 * board. Asking reads the firm here: the orb says what is happening, turns to the engagements the answer quoted and
 * pulls them tight, then the box morphs into the Firm brain menu row and the canvas builds the same answer (asked
 * once). Without the map (still loading, or it failed) the question goes straight to Firm brain. Coming back, the box
 * grows out of the row again. Nothing about the question is kept or sent anywhere but Ask the firm.
 */
export function HomeAsk({
  displayName,
  role,
  recentBoard,
  map = null,
  mapLoading = false,
  askFirm,
  now = new Date(),
}: {
  displayName: string | null | undefined;
  role: string | null | undefined;
  recentBoard: string | null | undefined;
  /** The firm map for the orb, as the server sent it (fees for admins and leads only). Null while it loads. */
  map?: FirmCanvasData | null | undefined;
  /** The map is on its way: the orb's place shows a quiet frame. */
  mapLoading?: boolean;
  /** Asks the firm. With a map, Home asks so the orb can turn to the answer before Firm brain opens. */
  askFirm?: ((question: string) => Promise<FirmAskResult>) | undefined;
  now?: Date;
}) {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const [question, setQuestion] = useState("");
  const [leaving, setLeaving] = useState(false);
  const [hidden, setHidden] = useState(false);
  const box = useRef<HTMLFormElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const orb = useRef<FirmOrbHandle>(null);
  const [caption, setCaption] = useState<string>(ORB_COPY.hint);
  const [readingSince, setReadingSince] = useState<number | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const starters = homeStarters(role, recentBoard);
  const hasOrb = Boolean(map && map.threads.length);

  // While the firm is read, the caption names each stage.
  useEffect(() => {
    if (readingSince === null) return;
    const tick = () => setCaption(pendingCaption(Date.now() - readingSince));
    tick();
    const timer = window.setInterval(tick, 300);
    return () => window.clearInterval(timer);
  }, [readingSince]);

  // Coming back from Firm brain: the box grows out of the menu row it went into.
  useLayoutEffect(() => {
    const from = takeReturn();
    const to = rectOf(box.current);
    if (!from || !to || reduceMotion) return;
    setHidden(true);
    void morph({
      from,
      to,
      text: HOME_ASK_COPY.placeholder,
      label: FIRM_BRAIN_COPY.nav,
      toRow: false,
      reduceMotion,
    }).then(() => setHidden(false));
  }, [reduceMotion]);

  useLayoutEffect(() => {
    const el = field.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 84), 200)}px`;
  }, [question]);

  async function ask(text: string) {
    const clean = text.trim();
    if (clean.length < 3 || leaving) return;
    setLeaving(true);
    setProblem(null);
    let result: FirmAskResult | null = null;
    if (hasOrb && askFirm) {
      setReadingSince(Date.now());
      try {
        result = await askFirm(clean);
      } catch (error) {
        setReadingSince(null);
        setCaption(ORB_COPY.hint);
        setProblem(isFirmBrainLimit(error) ? FIRM_BRAIN_LIMIT_COPY.shown : ORB_COPY.failed);
        setLeaving(false);
        return;
      }
      setReadingSince(null);
      const boards = result.status === "answered" ? answerBoards(result.claims) : [];
      setCaption(boards.length ? ORB_COPY.found(boards.length) : ORB_COPY.nothing);
      await orb.current?.focus(boards);
      setCaption(ORB_COPY.opening);
    }
    handOffQuestion(clean, result);
    const from = rectOf(box.current);
    const to = rectOf(firmBrainRow()) ?? topMiddle();
    if (!from || reduceMotion) {
      void navigate({ to: "/firm-brain" });
      return;
    }
    setHidden(true);
    await morph({
      from,
      to,
      text: clean,
      label: FIRM_BRAIN_COPY.nav,
      toRow: true,
      reduceMotion,
      onHalfway: () => void navigate({ to: "/firm-brain" }),
    });
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

  return (
    <section data-testid="home-ask" aria-labelledby="home-title" className="flex flex-col gap-5">
      <h1
        id="home-title"
        className="text-center text-(length:--type-display) font-semibold text-foreground [text-wrap:balance]"
      >
        {HOME_ASK_COPY.greeting(now.getHours(), firstNameOf(displayName))}
      </h1>
      {mapLoading ? (
        <div
          aria-hidden
          data-testid="firm-orb-loading"
          className="mx-auto grid h-[300px] w-full place-items-center max-md:h-[240px]"
        >
          <div className="aspect-square h-[78%] animate-pulse rounded-[var(--radius-pill)] border border-dashed border-border" />
        </div>
      ) : hasOrb ? (
        <div className="flex flex-col items-center gap-1">
          <FirmOrb ref={orb} data={map!} reduceMotion={reduceMotion} />
          <p
            role="status"
            data-testid="firm-orb-caption"
            className="min-h-5 text-center text-(length:--type-small) text-muted-foreground"
          >
            {caption}
          </p>
        </div>
      ) : null}
      <form
        ref={box}
        onSubmit={submit}
        data-ph-no-autocapture=""
        className={cn(
          "ph-no-autocapture flex flex-col gap-2 rounded-[var(--radius-card)] border border-border bg-card p-3 shadow-card transition-opacity focus-within:border-foreground/40",
          hidden && "invisible",
        )}
      >
        <textarea
          ref={field}
          rows={3}
          value={question}
          maxLength={FIRM_ASK_QUESTION_MAX}
          placeholder={HOME_ASK_COPY.placeholder}
          aria-label={HOME_ASK_COPY.label}
          disabled={leaving}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={onKey}
          className="min-h-[84px] w-full resize-none bg-transparent px-1 py-1 text-(length:--type-lead) text-foreground outline-none placeholder:text-muted-foreground"
        />
        <div className="flex items-center gap-2">
          <span className={cn(tagVariants({ tone: "outline" }), "min-w-0 truncate")}>
            {HOME_ASK_COPY.scope}
          </span>
          <Button
            type="submit"
            variant="ink"
            size="icon"
            className="ml-auto"
            aria-label={HOME_ASK_COPY.send}
            disabled={leaving || question.trim().length < 3}
          >
            <ArrowUp aria-hidden className="size-4" />
          </Button>
        </div>
      </form>
      {problem ? (
        <p role="alert" className="text-center text-(length:--type-small) text-destructive">
          {problem}
        </p>
      ) : null}
      {starters.length ? (
        <div
          data-ph-no-autocapture=""
          className="ph-no-autocapture flex flex-wrap justify-center gap-2"
        >
          {starters.map((starter) => (
            <button
              key={starter}
              type="button"
              disabled={leaving}
              onClick={() => void ask(starter)}
              className={cn(chipVariants({ tone: "quiet" }), "bg-card text-left")}
            >
              {starter}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
