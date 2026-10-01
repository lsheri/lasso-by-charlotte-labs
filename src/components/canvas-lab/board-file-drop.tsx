import { useCallback, useEffect, useRef, useState, type CSSProperties, type DragEvent } from "react";
import { toast } from "sonner";

import { useCaptureFiles } from "@/components/work/use-capture-files";
import { useReducedMotion } from "@/hooks/use-motion";
import type { Point } from "@/lib/canvas-drag";

export const BOARD_FILE_DROP_COPY = {
  prompt: "Drop to add to this board",
  capped: "Added the first 10. Drop the rest in another go.",
  failed: (name: string) => `${name} did not come in.`,
} as const;

export const BOARD_FILE_DROP_CAP = 10;
const MAX_FLAKES = 60;

type DropPoint = Point & { id: number };
type PencilFlake = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  spin: number;
  size: number;
  opacityClass: string;
  toneClass: string;
  bornAt: number;
  lifetime: number;
};

/** Only a real file drag from the desktop, never a sidebar or answer drag. */
export function isFileDrag(types: ReadonlyArray<string> | DOMStringList | undefined | null): boolean {
  if (!types) return false;
  return Array.from(types as ArrayLike<string>).includes("Files");
}

/**
 * DD1-a: files dropped on the board go through the same capture path as the
 * upload button, then land as cards at the release point.
 */
export function useBoardFileDrop({
  enabled,
  toBoard,
  place,
}: {
  enabled: boolean;
  toBoard: (clientX: number, clientY: number) => Point;
  place: (ids: string[], at: Point) => Promise<void> | void;
}) {
  const { captureWithResult } = useCaptureFiles();
  const [over, setOver] = useState(false);
  const [pointer, setPointer] = useState<Point>({ x: 0, y: 0 });
  const [dropBurst, setDropBurst] = useState<DropPoint | null>(null);
  const [clearSignal, setClearSignal] = useState(0);
  const busy = useRef(false);

  const localPoint = useCallback((event: DragEvent<HTMLElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }, []);

  const onDragEnter = useCallback((event: DragEvent<HTMLElement>) => {
    if (!enabled || !isFileDrag(event.dataTransfer?.types)) return;
    event.preventDefault();
    setOver(true);
  }, [enabled]);

  const onDragOver = useCallback((event: DragEvent<HTMLElement>) => {
    if (!enabled || !isFileDrag(event.dataTransfer?.types)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setPointer(localPoint(event));
    setOver(true);
  }, [enabled, localPoint]);

  const onDragLeave = useCallback((event: DragEvent<HTMLElement>) => {
    const related = event.relatedTarget as Node | null;
    if (related && (event.currentTarget as Node).contains(related)) return;
    setOver(false);
    setClearSignal((value) => value + 1);
  }, []);

  const onDrop = useCallback((event: DragEvent<HTMLElement>) => {
    if (!isFileDrag(event.dataTransfer?.types)) return;
    event.preventDefault();
    const releasePoint = localPoint(event);
    setDropBurst({ ...releasePoint, id: Date.now() });
    setOver(false);
    if (!enabled || busy.current) return;
    const all = Array.from(event.dataTransfer.files ?? []);
    if (all.length === 0) return;
    const files = all.slice(0, BOARD_FILE_DROP_CAP);
    if (all.length > BOARD_FILE_DROP_CAP) toast(BOARD_FILE_DROP_COPY.capped);
    const at = toBoard(event.clientX, event.clientY);
    busy.current = true;
    void (async () => {
      try {
        const { ids, failures } = await captureWithResult(files, { channel: "drop" });
        for (const failure of failures) toast.error(BOARD_FILE_DROP_COPY.failed(failure.name));
        if (ids.length > 0) await place(ids, at);
      } finally {
        busy.current = false;
      }
    })();
  }, [enabled, toBoard, place, captureWithResult, localPoint]);

  return { over, pointer, dropBurst, clearSignal, handlers: { onDragEnter, onDragOver, onDragLeave, onDrop } };
}

function makeFlakes(point: Point, count: number, firstId: number): PencilFlake[] {
  const tones = ["bg-pencil", "bg-mid", "bg-soft"];
  const opacities = ["opacity-25", "opacity-40", "opacity-60"];
  return Array.from({ length: count }, (_, index) => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 18 + Math.random() * 38;
    return {
      id: firstId + index,
      x: point.x,
      y: point.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 18,
      rotation: Math.random() * 180,
      spin: (Math.random() - 0.5) * 280,
      size: 2 + Math.random() * 3,
      opacityClass: opacities[index % opacities.length] ?? "opacity-40",
      toneClass: tones[index % tones.length] ?? "bg-pencil",
      bornAt: performance.now(),
      lifetime: 500 + Math.random() * 400,
    };
  });
}

export function BoardFileDropOverlay({
  show,
  pointer = { x: 0, y: 0 },
  dropBurst = null,
  clearSignal = 0,
}: {
  show: boolean;
  pointer?: Point;
  dropBurst?: DropPoint | null;
  clearSignal?: number;
}) {
  const reduced = useReducedMotion();
  const [flakes, setFlakes] = useState<PencilFlake[]>([]);
  const pointerRef = useRef(pointer);
  const nextIdRef = useRef(0);
  const burstTimerRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);
  pointerRef.current = pointer;

  const clearAnimation = useCallback(() => {
    if (burstTimerRef.current !== null) window.clearTimeout(burstTimerRef.current);
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    burstTimerRef.current = null;
    frameRef.current = null;
    setFlakes([]);
  }, []);

  const emit = useCallback((point: Point, count: number) => {
    if (reduced) return;
    const made = makeFlakes(point, count, nextIdRef.current);
    nextIdRef.current += count;
    setFlakes((current) => [...current, ...made].slice(-MAX_FLAKES));
  }, [reduced]);

  useEffect(() => {
    if (!show || reduced) {
      if (burstTimerRef.current !== null) window.clearTimeout(burstTimerRef.current);
      burstTimerRef.current = null;
      return;
    }
    const schedule = () => {
      burstTimerRef.current = window.setTimeout(() => {
        emit(pointerRef.current, 5 + Math.floor(Math.random() * 5));
        schedule();
      }, 400 + Math.random() * 300);
    };
    schedule();
    return () => {
      if (burstTimerRef.current !== null) window.clearTimeout(burstTimerRef.current);
      burstTimerRef.current = null;
    };
  }, [emit, reduced, show]);

  useEffect(() => {
    if (!dropBurst || reduced) return;
    emit(dropBurst, 14);
  }, [dropBurst, emit, reduced]);

  useEffect(() => {
    if (flakes.length === 0 || reduced) return;
    const animate = () => {
      const now = performance.now();
      setFlakes((current) => current.filter((flake) => now - flake.bornAt < flake.lifetime));
      frameRef.current = window.requestAnimationFrame(animate);
    };
    frameRef.current = window.requestAnimationFrame(animate);
    return () => {
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [flakes.length, reduced]);

  useEffect(() => {
    clearAnimation();
  }, [clearAnimation, clearSignal]);

  useEffect(() => clearAnimation, [clearAnimation]);

  const now = typeof performance === "undefined" ? 0 : performance.now();
  return (
    <div
      data-testid="board-file-drop"
      aria-live="polite"
      data-active={show ? "true" : "false"}
      className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center opacity-0 transition-[opacity,box-shadow] duration-100 ease-out data-[active=true]:opacity-100 data-[active=true]:duration-[140ms] motion-reduce:transition-none"
      style={{
        boxShadow: show
          ? "inset 0 24px 64px -12px color-mix(in oklab, var(--nb-ink) 35%, transparent), inset 0 5px 14px color-mix(in oklab, var(--nb-graphite) 24%, transparent)"
          : "inset 0 24px 64px -12px transparent, inset 0 5px 14px transparent",
      }}
    >
      <span className="relative z-10 text-sm text-foreground">{BOARD_FILE_DROP_COPY.prompt}</span>
      {!reduced ? flakes.map((flake) => {
        const elapsed = Math.max(0, now - flake.bornAt) / 1000;
        const progress = Math.min(1, (elapsed * 1000) / flake.lifetime);
        const style = {
          left: flake.x,
          top: flake.y,
          width: flake.size,
          height: flake.size * (0.55 + (flake.id % 3) * 0.18),
          clipPath: flake.id % 2 === 0 ? "polygon(12% 0, 100% 18%, 82% 100%, 0 76%)" : "polygon(0 22%, 88% 0, 100% 78%, 18% 100%)",
          opacity: 1 - progress,
          transform: `translate(${flake.vx * elapsed}px, ${flake.vy * elapsed + 58 * elapsed * elapsed}px) rotate(${flake.rotation + flake.spin * elapsed}deg)`,
        } satisfies CSSProperties;
        return <i key={flake.id} data-testid="pencil-flake" aria-hidden="true" className={`absolute ${flake.toneClass} ${flake.opacityClass}`} style={style} />;
      }) : null}
    </div>
  );
}
