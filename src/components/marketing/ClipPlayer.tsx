import { useEffect, useRef, useState } from "react";

/**
 * A silent product clip for the logged-out landing page.
 *
 * The clips are silent, so there is no audio UI. Playback starts only
 * while the element is on screen and pauses the moment it leaves, so two loops
 * never run at once. Under prefers-reduced-motion the poster stands still and
 * the visitor gets an explicit control.
 */
/**
 * Only one clip on the page ever runs. Whichever clip is most in view claims
 * playback and every other clip is paused, so scrolling hands the loop along.
 */
const players = new Set<{ el: HTMLVideoElement; ratio: number }>();

function arbitrate() {
  let best: { el: HTMLVideoElement; ratio: number } | null = null;
  for (const p of players) {
    if (p.ratio < 0.35) continue;
    if (!best || p.ratio > best.ratio) best = p;
  }
  for (const p of players) {
    if (best && p.el === best.el) void p.el.play().catch(() => {});
    else p.el.pause();
  }
}

export function ClipPlayer({
  src,
  poster,
  width,
  height,
  label,
  className,
}: {
  src: string;
  poster: string;
  width: number;
  height: number;
  label: string;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [reduced, setReduced] = useState(false);
  const [manual, setManual] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduced && !manual) {
      el.pause();
      return;
    }
    if (typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) void el.play().catch(() => {});
          else el.pause();
        }
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduced, manual]);

  return (
    <figure className="relative m-0">
      <video
        ref={ref}
        src={src}
        poster={poster}
        muted
        loop
        playsInline
        preload="none"
        aria-label={label}
        className="w-full rounded-[var(--radius)] border border-rule bg-nb-white shadow-card"
        style={{ aspectRatio: `${width} / ${height}` }}
      />
      {reduced && !manual ? (
        <button
          type="button"
          onClick={() => {
            setManual(true);
            void ref.current?.play().catch(() => {});
          }}
          className="absolute bottom-3 left-3 rounded-[var(--radius)] border border-graphite bg-nb-white px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-graphite"
        >
          Play clip
        </button>
      ) : null}
    </figure>
  );
}
