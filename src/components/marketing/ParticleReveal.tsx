import { useEffect, useRef, useState } from "react";

type Particle = {
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  delay: number;
  size: number;
  lime: boolean;
};

/**
 * Marketing-only scroll reveal. The wrapped content starts invisible and
 * assembles out of drifting graphite/lime particles when it enters the
 * viewport: particles converge into the text area, then the words resolve.
 * Plays once. Under prefers-reduced-motion the content renders plainly.
 */
export function ParticleReveal({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [progress, setProgress] = useState(0); // 0 = hidden, 1 = fully resolved
  const played = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setProgress(1);
      return;
    }
    if (typeof IntersectionObserver === "undefined") {
      setProgress(1);
      return;
    }

    const run = () => {
      if (played.current) return;
      played.current = true;
      const canvas = canvasRef.current;
      if (!canvas) {
        setProgress(1);
        return;
      }
      const rect = node.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.round(rect.width));
      const h = Math.max(1, Math.round(rect.height));
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        setProgress(1);
        return;
      }
      ctx.scale(dpr, dpr);

      const count = Math.min(260, Math.max(120, Math.round((w * h) / 2600)));
      const particles: Particle[] = [];
      for (let i = 0; i < count; i += 1) {
        const edge = Math.random();
        // Start scattered in a halo around the block, converge into it.
        const sx = w / 2 + (Math.random() - 0.5) * w * (edge < 0.5 ? 2.4 : 1.4);
        const sy = h / 2 + (Math.random() - 0.5) * h * (edge < 0.5 ? 6 : 3.4);
        particles.push({
          sx,
          sy,
          tx: Math.random() * w,
          ty: Math.random() * h,
          delay: Math.random() * 0.35,
          size: 0.8 + Math.random() * 1.6,
          lime: Math.random() < 0.3,
        });
      }

      const start = performance.now();
      const duration = 1500;
      let frame = 0;
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        ctx.clearRect(0, 0, w, h);
        for (const p of particles) {
          const local = Math.min(1, Math.max(0, (t - p.delay) / (1 - p.delay)));
          const eased = 1 - Math.pow(1 - local, 3);
          const x = p.sx + (p.tx - p.sx) * eased;
          const y = p.sy + (p.ty - p.sy) * eased;
          // Particles fade as the words take over.
          const alpha = local < 0.75 ? 0.85 : 0.85 * (1 - (local - 0.75) / 0.25);
          ctx.globalAlpha = Math.max(0, alpha);
          ctx.fillStyle = p.lime ? "#04f85b" : "#6b6e6c";
          ctx.beginPath();
          ctx.arc(x, y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        setProgress(t);
        if (t < 1) {
          frame = window.requestAnimationFrame(tick);
        }
      };
      frame = window.requestAnimationFrame(tick);
      return () => window.cancelAnimationFrame(frame);
    };

    let cancel: (() => void) | undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          cancel = run();
          observer.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      cancel?.();
    };
  }, []);

  // Words resolve during the second half of the particle convergence.
  const textIn = Math.min(1, Math.max(0, (progress - 0.45) / 0.5));
  const done = progress >= 1;

  return (
    <div ref={ref} className={`particle-reveal ${className}`}>
      <div
        className="particle-reveal-content"
        style={done ? undefined : { opacity: textIn }}
        aria-hidden={progress === 0 ? true : undefined}
      >
        {children}
      </div>
      {!done && (
        <canvas ref={canvasRef} className="particle-reveal-canvas" aria-hidden="true" />
      )}
    </div>
  );
}
