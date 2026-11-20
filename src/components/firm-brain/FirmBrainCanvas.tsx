import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";

import { Button } from "@/components/ui/button";
import { chipVariants } from "@/components/ui/chip";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, ArrowUp, List, Maximize2, Minus, Plus } from "@/design/brand/icons";
import { useIsMobile } from "@/hooks/use-mobile";
import { useReducedMotion } from "@/hooks/use-motion";
import {
  FIRM_ASK_QUESTION_MAX,
  FIRM_ASK_STARTER_COPY,
  startersFor,
  type FirmAskResult,
  type FirmAskStarter,
} from "@/lib/firm-ask-shared";
import { askTheFirm } from "@/lib/firm-ask.functions";
import { isFirmBrainLimit } from "@/lib/firm-brain-limit-shared";
import {
  answerBoards,
  canvasThreadId,
  CANVAS_SIZES,
  easeFlow,
  edgeEnds,
  FIRM_CANVAS_COPY,
  layoutCanvas,
  placeAnswer,
  pullTargets,
  threadPath,
  visibleIn,
  type CanvasLayout,
  type FirmCanvasData,
  type Placed,
} from "@/lib/firm-canvas-shared";
import { layoutFirmMap } from "@/lib/firm-map-shared";
import { getFirmMap } from "@/lib/firm-map.functions";
import { startReturn, takeHandedQuestion } from "@/lib/home-ask-shared";
import { FIRM_BRAIN_COPY } from "@/lib/role-screens-shared";
import { cn } from "@/lib/utils";

import { CanvasAnswerCard, type CanvasAnswer } from "./CanvasAnswerCard";
import { FirmMapList } from "./FirmMapList";
import { firmBrainRow, rectOf, topMiddle } from "../home/morph-ghost";
import { FirmSourcePreview } from "./FirmSourcePreview";
import { JuniorTools } from "./JuniorTools";
import { useCanvasCamera, type Insets } from "./use-canvas-camera";

type CanvasProfile = {
  id?: string | null;
  role?: string | null;
  has_firm_view?: boolean | null;
  org_type?: string | null;
  is_guest?: boolean | null;
};

/**
 * Answers stay where they landed while the tab is open, and go when it closes. Memory only: no storage, no server,
 * no telemetry, so a question is never kept anywhere.
 */
const kept = new Map<string, CanvasAnswer[]>();
/** The map builds in once per tab; coming back shows it whole. */
const drawnOnce = new Set<string>();

/** Test hook: forget kept answers and the first-draw marker. */
export function resetFirmCanvasMemory(): void {
  kept.clear();
  drawnOnce.clear();
}

let nextId = 0;

/**
 * Where answers land when the map is still loading or could not be read: a plain column at the place they would
 * take beside an empty map. Ask the firm never waits on the map (QA M1).
 */
const NO_MAP = layoutCanvas({ situations: [], methods: [], threads: [] });

/**
 * Answers without anything from a board that is no longer on the map. A line from such a board goes, with its source
 * and facts; an answer with no lines left goes. Pending and failed answers stay as they are.
 */
export function pruneAnswers(list: CanvasAnswer[], shared: ReadonlySet<string>): CanvasAnswer[] {
  let changed = false;
  const next = list.flatMap((answer) => {
    const result = answer.result;
    if (answer.status !== "answered" || !result) return [answer];
    const claims = result.claims.filter((claim) => shared.has(claim.boardId));
    const facts = result.facts.filter((fact) => shared.has(fact.boardId));
    const sources = Object.fromEntries(
      Object.entries(result.sources).filter(([, source]) => shared.has(source.boardId)),
    );
    if (
      claims.length === result.claims.length &&
      facts.length === result.facts.length &&
      Object.keys(sources).length === Object.keys(result.sources).length
    )
      return [answer];
    changed = true;
    if (result.status === "answered" && claims.length === 0) return [];
    return [
      {
        ...answer,
        result: {
          ...result,
          claims,
          facts,
          sources,
          summary: claims.length === result.claims.length ? result.summary : null,
        },
      },
    ];
  });
  return changed ? next : list;
}

/** The frame fills the page's content area, below the phone header and above the phone tab bar. */
function useFullBleed(anchor: React.RefObject<HTMLDivElement | null>) {
  const [box, setBox] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    const el = anchor.current;
    const main = el?.closest("main");
    if (!el || !main) return;
    const read = () => {
      const r = main.getBoundingClientRect();
      setBox({ left: Math.max(0, r.left), top: Math.max(0, r.top + window.scrollY) });
    };
    read();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(read);
    observer?.observe(main);
    window.addEventListener("resize", read);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", read);
    };
  }, [anchor]);
  return box;
}

/** Tweens the pulled engagements to their targets and the bend of their threads. One rAF loop, small state. */
function usePull(layout: CanvasLayout | null, targets: Map<string, Placed>, reduceMotion: boolean) {
  const [at, setAt] = useState<Map<string, Placed>>(new Map());
  const [bend, setBend] = useState(1);
  const atRef = useRef(at);
  atRef.current = at;
  const key = [...targets]
    .map(([id, p]) => `${id}:${Math.round(p.x)},${Math.round(p.y)}`)
    .join("|");
  useEffect(() => {
    if (!layout) return;
    const from = new Map(atRef.current);
    const ids = new Set([...from.keys(), ...targets.keys()]);
    const goal = new Map<string, Placed>();
    for (const id of ids) {
      const node = layout.byId.get(id);
      if (!node) continue;
      goal.set(id, targets.get(id) ?? { x: node.x, y: node.y });
    }
    const bendFrom = bend;
    const bendTo = targets.size ? 0.06 : 1;
    const finish = () => {
      const settled = new Map([...goal].filter(([id]) => targets.has(id)));
      setAt(settled);
      setBend(bendTo);
    };
    if (reduceMotion) {
      finish();
      return;
    }
    const ms = 1000;
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = easeFlow(Math.min(1, (now - start) / ms));
      const next = new Map<string, Placed>();
      for (const [id, to] of goal) {
        const node = layout.byId.get(id)!;
        const f = from.get(id) ?? { x: node.x, y: node.y };
        next.set(id, { x: f.x + (to.x - f.x) * t, y: f.y + (to.y - f.y) * t });
      }
      setAt(next);
      setBend(bendFrom + (bendTo - bendFrom) * t);
      if (t < 1) raf = requestAnimationFrame(step);
      else finish();
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // `bend` is read once as the start value; re-running on it would restart every frame.
  }, [key, layout, reduceMotion]); // eslint-disable-line react-hooks/exhaustive-deps
  return { at, bend };
}

/**
 * 20 Nov, D-85: Firm brain as one canvas. The firm map is the page; the question floats on it; each answer lands
 * beside the engagements it quoted, which pull into a column next to it with their threads drawn tight, and stays
 * there. Only what is on screen is drawn. Everyone in the firm sees it; fees come from the server for admins and
 * leads only.
 */
export function FirmBrainCanvas({ profile }: { profile: CanvasProfile }) {
  const ask = useServerFn(askTheFirm);
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  // A question handed over from Home's box (PR B), taken once, in memory only.
  const [handed] = useState(() => takeHandedQuestion(profile.id));
  const handedResult = useRef(handed?.result ?? null);
  // Read fresh every time the page opens, so a board with sharing turned off is gone at the next load.
  const query = useQuery({
    queryKey: ["firm-map", profile.id ?? null],
    staleTime: 0,
    retry: (count, error) => !(error instanceof Response) && count < 1,
    queryFn: (): Promise<FirmCanvasData> =>
      getFirmMap({ data: { profile_id: profile.id ?? null } }),
  });
  return (
    <FirmBrainCanvasView
      profile={profile}
      map={{
        data: query.data ?? null,
        pending: query.isPending,
        failed: query.isError && !(query.error instanceof Response && query.error.status === 403),
        refused: query.error instanceof Response && query.error.status === 403,
        retry: () => void query.refetch(),
      }}
      ask={(question, starter) => {
        // The answer Home already has (the orb turned to it) builds here without asking twice; once only.
        const ready = handedResult.current;
        if (ready && question === handed?.question) {
          handedResult.current = null;
          return Promise.resolve(ready);
        }
        return ask({ data: { question, starter, profile_id: profile.id ?? null } });
      }}
      initialQuestion={handed?.question ?? null}
      onBack={
        handed
          ? () => {
              // Back the same way: Home's box grows out of the menu row the question went into.
              startReturn(reduceMotion ? null : (rectOf(firmBrainRow()) ?? topMiddle()));
              void navigate({ to: "/home" });
            }
          : undefined
      }
    />
  );
}

/** The map as the page receives it: plain values, so a test or a story can draw the canvas without a server. */
export type CanvasMap = {
  data: FirmCanvasData | null;
  pending: boolean;
  failed: boolean;
  refused: boolean;
  retry: () => void;
};

/** The canvas itself. Data and the ask come in as props; everything it does with them lives here. */
export function FirmBrainCanvasView({
  profile,
  map,
  ask,
  initialQuestion = null,
  onBack,
}: {
  profile: CanvasProfile;
  map: CanvasMap;
  ask: (question: string, starter: FirmAskStarter | null) => Promise<FirmAskResult>;
  /** Asked as soon as the map is ready: the question handed over from Home. */
  initialQuestion?: string | null;
  /** Shown as a Home button when the page was opened from Home's question box. */
  onBack?: (() => void) | undefined;
}) {
  const profileKey = profile.id ?? "me";
  const reduceMotion = useReducedMotion();
  const mobile = useIsMobile();
  const anchor = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const world = useRef<HTMLDivElement>(null);
  const bleed = useFullBleed(anchor);
  const data = map.data;
  const layout = useMemo(() => (data ? layoutCanvas(data) : null), [data]);
  const seesFees = Boolean(data?.fees);

  const insets: Insets = mobile
    ? { top: 64, bottom: 150, left: 0, right: 0 }
    : { top: 120, bottom: 150, left: 0, right: 0 };
  const camera = useCanvasCamera({ stage, world, insets, reduceMotion });

  const [answers, setAnswersState] = useState<CanvasAnswer[]>(() => kept.get(profileKey) ?? []);
  const answersRef = useRef(answers);
  answersRef.current = answers;
  // The kept list is the source of truth, so an answer that arrives after the page was left still lands, and is there
  // (not stuck pending) when the page opens again.
  const setAnswers = useCallback(
    (update: (list: CanvasAnswer[]) => CanvasAnswer[]) => {
      const next = update(kept.get(profileKey) ?? []);
      kept.set(profileKey, next);
      setAnswersState(next);
    },
    [profileKey],
  );
  // Sharing turned off since an answer landed: its lines from that board go at the next read of the map. Delete,
  // never hide: an answer left with no lines goes too.
  useEffect(() => {
    if (!data) return;
    setAnswers((list) => pruneAnswers(list, new Set(data.threads.map((thread) => thread.id))));
  }, [data, setAnswers]);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [lineCentres, setLineCentres] = useState<Record<string, number[]>>({});
  const [feesOn, setFeesOn] = useState(false);
  const [question, setQuestion] = useState("");
  const [starter, setStarter] = useState<FirmAskStarter | null>(null);
  const [openItem, setOpenItem] = useState<string | null>(null);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [drawing, setDrawing] = useState<"no" | "building" | "done">("no");
  const pending = answers.some((answer) => answer.status === "pending");
  const input = useRef<HTMLTextAreaElement>(null);

  // First frame: fit the whole map (and any kept answers) once the stage has a size.
  const fitted = useRef(false);
  const contentBox = useCallback(() => {
    if (!layout) return null;
    const b = layout.bounds;
    const x0 = b.x;
    let y0 = b.y,
      x1 = b.x + b.w,
      y1 = b.y + b.h;
    for (const answer of answersRef.current) {
      x1 = Math.max(x1, answer.x + CANVAS_SIZES.answerW);
      y0 = Math.min(y0, answer.y);
      y1 = Math.max(y1, answer.y + (answer.h || 300));
    }
    return { x: x0 - 24, y: y0 - 24, w: x1 - x0 + 48, h: y1 - y0 + 48 };
  }, [layout]);
  useEffect(() => {
    if (!layout || fitted.current || !bleed) return;
    const box = contentBox();
    if (!box) return;
    fitted.current = true;
    void camera.fit(box, 1, true);
    if (!drawnOnce.has(profileKey) && !reduceMotion && layout.threads.length)
      setDrawing("building");
    drawnOnce.add(profileKey);
  }, [layout, bleed, contentBox, camera, profileKey, reduceMotion]);
  // The first draw's caption: what is being drawn, then the counts, then it goes. Its own timer, so a re-render
  // of the camera never cuts it short.
  useEffect(() => {
    if (drawing === "no") return;
    const timer = window.setTimeout(
      () => setDrawing(drawing === "building" ? "done" : "no"),
      drawing === "building" ? 2200 : 1600,
    );
    return () => window.clearTimeout(timer);
  }, [drawing]);

  const focused = answers.find((answer) => answer.id === focusId) ?? null;
  const targets = useMemo(() => {
    if (!layout || !focused?.result || focused.status !== "answered")
      return new Map<string, Placed>();
    const centres = lineCentres[focused.id] ?? [];
    return pullTargets(focused, focused.result.claims, centres);
  }, [layout, focused, lineCentres]);
  const { at, bend } = usePull(layout, targets, reduceMotion);

  const hot = useMemo(() => {
    const nodes = new Set<string>();
    if (!layout || !focused?.result) return nodes;
    for (const boardId of answerBoards(focused.result.claims)) {
      const id = canvasThreadId(boardId);
      nodes.add(id);
      for (const edge of layout.edges) {
        if (edge.from === id) nodes.add(edge.to);
        if (edge.to === id) nodes.add(edge.from);
      }
    }
    return nodes;
  }, [layout, focused]);

  const visible = useMemo(
    () => (layout ? visibleIn(layout, camera.view, { keep: hot, at }) : null),
    [layout, camera.view, hot, at],
  );

  const onMeasured = useCallback(
    (id: string, height: number, centres: number[]) => {
      setLineCentres((map) => {
        const old = map[id];
        if (
          old &&
          old.length === centres.length &&
          old.every((value, index) => Math.abs(value - centres[index]!) < 1)
        )
          return map;
        return { ...map, [id]: centres };
      });
      setAnswers((list) => {
        const found = list.find((answer) => answer.id === id);
        if (!found || Math.abs(found.h - height) < 1) return list;
        return list.map((answer) => (answer.id === id ? { ...answer, h: height } : answer));
      });
    },
    [setAnswers],
  );
  const onBuilt = useCallback(
    (id: string) =>
      setAnswers((list) =>
        list.some((a) => a.id === id && !a.built)
          ? list.map((a) => (a.id === id ? { ...a, built: true } : a))
          : list,
      ),
    [setAnswers],
  );

  /** Brings an answer (and the engagements beside it) into view. On a phone, the card alone. */
  const frameAnswer = useCallback(
    (answer: Pick<CanvasAnswer, "x" | "y" | "h">) => {
      const h = answer.h || 320;
      const wide = {
        x: answer.x - CANVAS_SIZES.pullGap - CANVAS_SIZES.nodeW - 60,
        y: answer.y - 24,
        w: CANVAS_SIZES.answerW + CANVAS_SIZES.pullGap + CANVAS_SIZES.nodeW + 100,
        h: h + 48,
      };
      if (camera.fitZoom(wide) >= 0.6) return camera.fit(wide, 1);
      const card = { x: answer.x - 8, y: answer.y - 16, w: CANVAS_SIZES.answerW + 16, h: h + 32 };
      return camera.flyTo(
        card.x + card.w / 2,
        card.y + Math.min(card.h, 360) / 2,
        camera.fitZoom({ ...card, h: Math.min(card.h, 360) }, 1),
      );
    },
    [camera],
  );

  async function run(text: string, chosen: FirmAskStarter | null, reuse?: CanvasAnswer) {
    const place = layout ?? NO_MAP;
    const el = stage.current;
    const centre = el
      ? camera.toWorld(
          el.clientWidth / 2,
          insets.top + (el.clientHeight - insets.top - insets.bottom) / 2,
        )
      : { x: 0, y: 0 };
    const others = answersRef.current
      .filter((answer) => answer.id !== reuse?.id)
      .map((answer) => ({ id: answer.id, x: answer.x, y: answer.y, h: answer.h || 300 }));
    const spot = reuse ? { x: reuse.x, y: reuse.y } : placeAnswer(place, others, 260, [], centre.y);
    const id = reuse?.id ?? `answer-${(nextId += 1)}`;
    const entry: CanvasAnswer = {
      id,
      question: text,
      starter: chosen,
      status: "pending",
      result: null,
      limited: false,
      x: spot.x,
      y: spot.y,
      h: reuse?.h ?? 260,
      startedAt: Date.now(),
      built: false,
    };
    setAnswers((list) =>
      reuse ? list.map((answer) => (answer.id === id ? entry : answer)) : [...list, entry],
    );
    setFocusId(null);
    void frameAnswer(entry);
    try {
      const result: FirmAskResult = await ask(text, chosen);
      const boards = answerBoards(result.claims);
      const height = answersRef.current.find((answer) => answer.id === id)?.h ?? 300;
      const landed = boards.length
        ? placeAnswer(layout ?? NO_MAP, others, height + 120, boards, spot.y)
        : spot;
      setAnswers((list) =>
        list.map((answer) =>
          answer.id === id
            ? { ...answer, status: "answered", result, x: landed.x, y: landed.y }
            : answer,
        ),
      );
      setFocusId(id);
      void frameAnswer({ x: landed.x, y: landed.y, h: height + 120 });
    } catch (error) {
      setAnswers((list) =>
        list.map((answer) =>
          answer.id === id
            ? { ...answer, status: "failed", limited: isFirmBrainLimit(error) }
            : answer,
        ),
      );
    }
  }

  // The question handed over from Home is asked once, as soon as the map is ready to take the answer.
  // It waits only while the map is on its way, so the answer can land beside its threads; when the map failed it is
  // asked anyway and lands in the plain column, never lost (QA M4). A refused person cannot ask at all.
  const askedHanded = useRef(false);
  useEffect(() => {
    if (!initialQuestion || askedHanded.current || map.refused) return;
    if (!layout && map.pending) return;
    askedHanded.current = true;
    void run(initialQuestion, null);
    // run reads the latest state through refs; only the map settling should trigger this.
  }, [layout, initialQuestion, map.pending, map.refused]); // eslint-disable-line react-hooks/exhaustive-deps

  function submit(event?: FormEvent) {
    event?.preventDefault();
    const text = question.trim();
    if (text.length < 3 || pending) return;
    setQuestion("");
    const chosen = starter;
    setStarter(null);
    void run(text, chosen);
  }

  function onKey(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  function pickStarter(next: FirmAskStarter) {
    setStarter(next);
    setQuestion(FIRM_ASK_STARTER_COPY[next].stem);
    requestAnimationFrame(() => {
      const field = input.current;
      if (!field) return;
      field.focus();
      field.setSelectionRange(field.value.length, field.value.length);
    });
  }

  function flyToThread(boardId: string) {
    const node = layout?.byId.get(canvasThreadId(boardId));
    if (!node) return;
    const place = at.get(node.id) ?? node;
    const cited = answersRef.current.find((answer) =>
      answer.result?.claims.some((claim) => claim.boardId === boardId),
    );
    if (cited) setFocusId(cited.id);
    void camera.flyTo(place.x + node.w / 2, place.y, Math.max(camera.cam.current.k, 0.85));
  }

  // A click on empty canvas lets go of the answer in focus; a drag does not.
  const downAt = useRef<{ x: number; y: number } | null>(null);

  // Auto-grow the floating question up to four lines.
  useLayoutEffect(() => {
    const field = input.current;
    if (!field) return;
    field.style.height = "auto";
    field.style.height = `${Math.min(field.scrollHeight, 112)}px`;
  }, [question]);

  const refused = map.refused;
  const lit = (id: string) => (focused ? hot.has(id) : true);
  const listLayout = useMemo(() => (data ? layoutFirmMap(data) : null), [data]);

  return (
    <div ref={anchor} data-testid="firm-brain-canvas" className="h-0">
      <div
        // The tour's beat 2 points here (its anchor is the map, as it was on the old page).
        data-testid="firm-brain-map"
        className="fixed bottom-[calc(56px+env(safe-area-inset-bottom))] right-0 overflow-hidden bg-background md:bottom-0"
        style={
          bleed ? { left: bleed.left, top: bleed.top } : { left: 0, top: 0, visibility: "hidden" }
        }
      >
        <div
          ref={stage}
          role="application"
          aria-label={FIRM_CANVAS_COPY.canvasLabel}
          data-testid="firm-canvas-stage"
          className="fc-stage absolute inset-0 touch-none overflow-hidden"
          onPointerDown={(event) => (downAt.current = { x: event.clientX, y: event.clientY })}
          onClick={(event) => {
            const start = downAt.current;
            if (!start || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 5) return;
            const target = event.target as HTMLElement;
            if (target.closest("[data-canvas-no-pan], button")) return;
            setFocusId(null);
          }}
        >
          {map.pending ? (
            <div aria-hidden data-testid="firm-canvas-skeleton" className="absolute inset-0">
              {[0, 1, 2, 3, 4, 5].map((row) => (
                <div
                  key={row}
                  className="absolute flex gap-6"
                  style={{ left: "8%", top: `${22 + row * 11}%`, right: "18%" }}
                >
                  <Skeleton className="h-3 w-[18%]" />
                  <Skeleton className="h-8 w-[24%]" />
                  <Skeleton className="h-8 w-[24%]" />
                  <Skeleton className="ml-auto h-3 w-[12%]" />
                </div>
              ))}
            </div>
          ) : null}
          <div
            ref={world}
            className={cn(
              "fc-world absolute left-0 top-0 origin-top-left",
              focused && "fc-focus",
              drawing === "building" && "fc-drawing",
            )}
          >
            {layout && visible ? (
              <>
                <svg
                  aria-hidden
                  className="pointer-events-none absolute left-0 top-0 overflow-visible"
                  width={1}
                  height={1}
                >
                  {visible.edges.map((edge, index) => {
                    const ends = edgeEnds(layout, edge, at);
                    if (!ends) return null;
                    const isHot =
                      hot.has(edge.from) && hot.has(edge.to) && (focused ? true : false);
                    return (
                      <path
                        key={edge.id}
                        d={threadPath(ends[0], ends[1], isHot ? bend : 1)}
                        className={cn("fc-edge", isHot && "fc-edge-hot")}
                        style={
                          drawing === "building"
                            ? { animationDelay: `${Math.min(index * 6, 900) + 700}ms` }
                            : undefined
                        }
                      />
                    );
                  })}
                  {focused?.result && focused.status === "answered"
                    ? focused.result.claims.map((claim, index) => {
                        const node = layout.byId.get(canvasThreadId(claim.boardId));
                        const place = node ? at.get(node.id) : undefined;
                        const centre = lineCentres[focused.id]?.[index];
                        if (!node || !place || centre === undefined) return null;
                        return (
                          <path
                            key={`src-${index}`}
                            d={threadPath(
                              { x: place.x + node.w, y: place.y },
                              { x: focused.x, y: focused.y + centre },
                              0.7,
                            )}
                            className="fc-source-link"
                          />
                        );
                      })
                    : null}
                </svg>
                {[...layout.situations, ...layout.threads, ...layout.methods]
                  .filter((node) => visible.nodes.has(node.id))
                  .map((node, index) => {
                    const place = at.get(node.id) ?? node;
                    const delay =
                      drawing === "building"
                        ? {
                            animationDelay: `${node.kind === "situation" ? 0 : node.kind === "thread" ? 400 + Math.min(index * 18, 900) : 1300}ms`,
                          }
                        : {};
                    if (node.kind === "thread") {
                      const fee = feesOn && data?.fees ? data.fees[node.threadId!] : undefined;
                      return (
                        <button
                          key={node.id}
                          type="button"
                          data-canvas-node={node.threadId}
                          onClick={() => flyToThread(node.threadId!)}
                          // Tabbing to an engagement off screen brings it into view (QA L1).
                          onFocus={() => {
                            const v = camera.view;
                            const inView =
                              place.x >= v.x &&
                              place.x + node.w <= v.x + v.w &&
                              place.y >= v.y &&
                              place.y <= v.y + v.h;
                            if (!inView)
                              void camera.flyTo(
                                place.x + node.w / 2,
                                place.y,
                                Math.max(camera.cam.current.k, 0.85),
                              );
                          }}
                          className={cn(
                            "fc-node absolute flex items-center gap-2 rounded-[var(--radius-control)] border bg-card px-2.5 text-left text-(length:--type-small) text-foreground",
                            hot.has(node.id) && focused
                              ? "fc-node-hot border-(--live-edge)"
                              : "border-border",
                            !lit(node.id) && "fc-dim",
                          )}
                          style={{
                            left: place.x,
                            top: place.y - node.h / 2,
                            width: node.w,
                            height: node.h,
                            ...delay,
                          }}
                        >
                          <span className="min-w-0 flex-1 truncate">{node.label}</span>
                          {fee ? (
                            <span className="rounded-[var(--radius-control)] bg-muted px-1.5 font-mono text-(length:--type-label) text-muted-foreground">
                              {fee}
                            </span>
                          ) : null}
                        </button>
                      );
                    }
                    return (
                      <span
                        key={node.id}
                        className={cn(
                          "fc-label absolute flex items-center gap-2 whitespace-nowrap text-(length:--type-small)",
                          node.kind === "situation"
                            ? "justify-end font-semibold text-foreground"
                            : "text-muted-foreground",
                          !lit(node.id) && "fc-dim",
                        )}
                        style={{
                          left: node.x,
                          top: node.y - node.h / 2,
                          width: node.w,
                          height: node.h,
                          ...delay,
                        }}
                      >
                        {node.kind === "method" ? (
                          <span aria-hidden className="fc-method-dot" />
                        ) : null}
                        <span className="truncate">{node.label}</span>
                        {node.kind === "situation" ? (
                          <span aria-hidden className="fc-situation-dot" />
                        ) : null}
                      </span>
                    );
                  })}
              </>
            ) : null}
            {answers.map((answer) => (
              <CanvasAnswerCard
                key={answer.id}
                answer={answer}
                focused={answer.id === focusId}
                dimmed={Boolean(focusId) && answer.id !== focusId}
                reduceMotion={reduceMotion}
                profileId={profile.id}
                onOpenSource={setOpenItem}
                onRetry={(failed) => void run(failed.question, failed.starter, failed)}
                onMeasured={onMeasured}
                onBuilt={onBuilt}
              />
            ))}
          </div>
          {layout && !layout.threads.length ? (
            <p className="absolute left-1/2 top-1/2 w-[min(420px,calc(100%-32px))] -translate-x-1/2 -translate-y-1/2 text-center text-(length:--type-body) text-muted-foreground">
              {FIRM_CANVAS_COPY.empty}
            </p>
          ) : null}
          {map.failed ? (
            <div
              role="alert"
              // Under the title, so an answer asked meanwhile is never hidden behind it (QA M1).
              className="absolute left-1/2 top-24 flex w-[min(420px,calc(100%-32px))] -translate-x-1/2 flex-col items-center gap-2 text-center text-(length:--type-small) text-muted-foreground md:top-32"
            >
              <p>{FIRM_CANVAS_COPY.mapLoadFailed}</p>
              <Button type="button" variant="outline" size="sm" onClick={map.retry}>
                {FIRM_CANVAS_COPY.retry}
              </Button>
            </div>
          ) : null}
        </div>

        {/* The one title, and the quiet numbers under it. On a phone the menu already names the page. */}
        <div className="pointer-events-none absolute left-4 top-4 flex max-w-[calc(100%-150px)] flex-col gap-1 md:left-6 md:top-5 md:max-w-[calc(100%-48px)]">
          <h1 className="sr-only text-(length:--type-display) font-semibold text-foreground md:not-sr-only">
            {FIRM_BRAIN_COPY.title}
          </h1>
          {layout ? (
            <p
              data-testid="firm-canvas-counts"
              className="hidden text-(length:--type-small) text-muted-foreground md:block"
            >
              {(["engagements", "situations", "methods", "lessons"] as const).map((key, index) => (
                <span key={key}>
                  {index ? " · " : ""}
                  <span className="font-mono tabular-nums text-foreground">
                    {layout.totals[key]}
                  </span>{" "}
                  {FIRM_CANVAS_COPY.counts[key]}
                </span>
              ))}
            </p>
          ) : null}
          <div className="pointer-events-auto mt-1 flex flex-wrap gap-2 md:mt-2">
            {onBack ? (
              <button
                type="button"
                data-testid="firm-canvas-back"
                onClick={onBack}
                className={cn(
                  chipVariants({ tone: "quiet" }),
                  "inline-flex items-center gap-1 bg-card",
                )}
              >
                <ArrowLeft aria-hidden className="size-3.5" />
                {FIRM_CANVAS_COPY.backHome}
              </button>
            ) : null}
            {seesFees ? (
              <button
                type="button"
                aria-pressed={feesOn}
                data-testid="firm-canvas-fees"
                onClick={() => setFeesOn((on) => !on)}
                className={cn(chipVariants({ tone: feesOn ? "accent" : "quiet" }), "bg-card")}
              >
                {feesOn ? FIRM_CANVAS_COPY.feesOn : FIRM_CANVAS_COPY.fees}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setToolsOpen(true)}
              className={cn(chipVariants({ tone: "quiet" }), "bg-card")}
            >
              {FIRM_CANVAS_COPY.tools}
            </button>
            {listLayout && listLayout.threads.length ? (
              <button
                type="button"
                onClick={() => setListOpen(true)}
                className={cn(
                  chipVariants({ tone: "quiet" }),
                  "inline-flex items-center gap-1.5 bg-card",
                )}
              >
                <List aria-hidden className="size-3.5" />
                {FIRM_CANVAS_COPY.list}
              </button>
            ) : null}
          </div>
        </div>

        {drawing !== "no" && layout ? (
          <p
            role="status"
            className="fc-mapcap pointer-events-none absolute left-1/2 top-16 flex whitespace-nowrap md:top-4 -translate-x-1/2 items-center gap-2 rounded-[var(--radius-pill)] border border-border bg-card px-3 py-1 text-(length:--type-small) text-muted-foreground"
          >
            <span aria-hidden className={cn("fc-dot", drawing === "done" && "fc-dot-done")} />
            {drawing === "building"
              ? FIRM_CANVAS_COPY.drawing
              : FIRM_CANVAS_COPY.drawn(layout.totals)}
          </p>
        ) : null}

        <div className="absolute right-4 top-4 flex overflow-hidden rounded-[var(--radius-control)] border border-border bg-card md:bottom-5 md:right-5 md:top-auto md:flex-col">
          <button
            type="button"
            aria-label={FIRM_CANVAS_COPY.zoomIn}
            onClick={() => camera.zoomAt(1.25)}
            className="grid size-9 place-items-center text-muted-foreground hover:text-foreground"
          >
            <Plus aria-hidden className="size-4" />
          </button>
          <button
            type="button"
            aria-label={FIRM_CANVAS_COPY.zoomOut}
            onClick={() => camera.zoomAt(0.8)}
            className="grid size-9 place-items-center border-border text-muted-foreground hover:text-foreground max-md:border-l md:border-t"
          >
            <Minus aria-hidden className="size-4" />
          </button>
          <button
            type="button"
            aria-label={FIRM_CANVAS_COPY.fit}
            onClick={() => {
              const box = contentBox();
              if (box) void camera.fit(box, 1);
            }}
            className="grid size-9 place-items-center border-border text-muted-foreground hover:text-foreground max-md:border-l md:border-t"
          >
            <Maximize2 aria-hidden className="size-4" />
          </button>
        </div>

        {!refused ? (
          <div className="absolute bottom-4 left-1/2 flex w-[min(640px,calc(100%-32px))] -translate-x-1/2 flex-col gap-2 md:bottom-5 md:w-[min(640px,calc(100%-160px))]">
            {!answers.length ? (
              <div className="flex flex-wrap justify-center gap-2">
                {startersFor(profile.role).map((key) => (
                  <button
                    key={key}
                    type="button"
                    data-firm-starter={key}
                    onClick={() => pickStarter(key)}
                    className={cn(chipVariants({ tone: "quiet" }), "bg-card")}
                  >
                    {FIRM_ASK_STARTER_COPY[key].label}
                  </button>
                ))}
              </div>
            ) : null}
            <form
              onSubmit={submit}
              className="ph-no-autocapture flex items-end gap-2 rounded-[var(--radius-card)] border border-border bg-card p-2 pl-4 shadow-card"
              data-ph-no-autocapture=""
            >
              <textarea
                ref={input}
                rows={1}
                value={question}
                maxLength={FIRM_ASK_QUESTION_MAX}
                placeholder={FIRM_CANVAS_COPY.ask}
                aria-label={FIRM_CANVAS_COPY.askLabel}
                onKeyDown={onKey}
                onChange={(event) => {
                  setQuestion(event.target.value);
                  if (!event.target.value) setStarter(null);
                }}
                className="min-h-9 flex-1 resize-none bg-transparent py-1.5 text-(length:--type-body) text-foreground outline-none placeholder:text-muted-foreground"
              />
              <Button
                type="submit"
                variant="ink"
                size="icon"
                aria-label={FIRM_CANVAS_COPY.send}
                disabled={pending || question.trim().length < 3}
              >
                <ArrowUp aria-hidden className="size-4" />
              </Button>
            </form>
          </div>
        ) : null}
      </div>

      <FirmSourcePreview
        itemId={openItem}
        profileId={profile.id}
        onClose={() => setOpenItem(null)}
      />

      <Sheet open={toolsOpen} onOpenChange={setToolsOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{FIRM_CANVAS_COPY.toolsTitle}</SheetTitle>
            <SheetDescription className="sr-only">{FIRM_BRAIN_COPY.subtitle}</SheetDescription>
          </SheetHeader>
          <JuniorTools profile={profile} className="mt-4 flex flex-col gap-4" />
        </SheetContent>
      </Sheet>

      <Sheet open={listOpen} onOpenChange={setListOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{FIRM_CANVAS_COPY.listTitle}</SheetTitle>
            <SheetDescription>{FIRM_CANVAS_COPY.listHint}</SheetDescription>
          </SheetHeader>
          {listLayout ? (
            <div className="mt-4">
              <FirmMapList
                layout={listLayout}
                lit={null}
                selected={null}
                onPick={(nodeId) => {
                  if (!nodeId?.startsWith("thread:")) return;
                  setListOpen(false);
                  flyToThread(nodeId.slice("thread:".length));
                }}
              />
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
