import { useEffect, useRef, useState } from "react";

// One continuous cycle while the phrase is visible. The word text eases in
// as particles gather, holds solid, then eases out as particles disperse.
export const PARTICLE_CYCLE_MS = 5000;
export const PARTICLE_GATHER_MS = 2200;
const PARTICLE_HOLD_END_MS = 4000;
const TEXT_FADE_START = 0.55;

type Particle = {
  x: number;
  y: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  radius: number;
  delay: number;
};

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}

function easeOutCubic(value: number) {
  return 1 - Math.pow(1 - clamp(value), 3);
}

function easeInCubic(value: number) {
  return Math.pow(clamp(value), 3);
}

function seeded(index: number, salt: number) {
  const value = Math.sin(index * 91.73 + salt * 47.21) * 43758.5453;
  return value - Math.floor(value);
}

function ParticleWord({ word, index, startAt }: { word: string; index: number; startAt: number | null }) {
  const wordRef = useRef<HTMLSpanElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const wordNode = wordRef.current;
    const canvas = canvasRef.current;
    if (!wordNode || !canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    if (startAt === null) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reducedMotion.matches) {
      wordNode.style.opacity = "1";
      return;
    }
    let particles: Particle[] = [];
    let frameId: number | null = null;
    let stopped = false;

    const rebuild = () => {
      const rect = wordNode.getBoundingClientRect();
      const width = Math.max(1, Math.ceil(rect.width));
      const height = Math.max(1, Math.ceil(rect.height));
      const padding = Math.ceil(Math.max(48, width * 1.2));
      const canvasWidth = width + padding * 2;
      const canvasHeight = height + padding * 2;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.ceil(canvasWidth * dpr);
      canvas.height = Math.ceil(canvasHeight * dpr);
      canvas.style.left = `${-padding}px`;
      canvas.style.top = `${-padding}px`;
      canvas.style.width = `${canvasWidth}px`;
      canvas.style.height = `${canvasHeight}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      const computed = window.getComputedStyle(wordNode);
      const sample = document.createElement("canvas");
      sample.width = Math.ceil(width * dpr);
      sample.height = Math.ceil(height * dpr);
      const sampleContext = sample.getContext("2d", { willReadFrequently: true });
      if (!sampleContext) return;
      sampleContext.scale(dpr, dpr);
      sampleContext.font = computed.font;
      sampleContext.textBaseline = "alphabetic";
      sampleContext.strokeStyle = "currentColor";
      sampleContext.lineWidth = Math.max(1.4, Number.parseFloat(computed.fontSize) * 0.035);
      sampleContext.lineJoin = "round";
      const baseline = height - Math.max(1, Number.parseFloat(computed.fontSize) * 0.12);
      sampleContext.strokeText(word, 0, baseline);
      const pixels = sampleContext.getImageData(0, 0, sample.width, sample.height).data;
      const targets: { x: number; y: number }[] = [];
      const step = Math.max(3, Math.round(Number.parseFloat(computed.fontSize) / 15));
      for (let y = 0; y < sample.height; y += step * dpr) {
        for (let x = 0; x < sample.width; x += step * dpr) {
          const alpha = pixels[(Math.floor(y) * sample.width + Math.floor(x)) * 4 + 3] ?? 0;
          if (alpha > 72) targets.push({ x: x / dpr, y: y / dpr });
        }
      }
      const stride = Math.max(1, Math.ceil(targets.length / 520));
      particles = targets.filter((_, targetIndex) => targetIndex % stride === 0).map((target, particleIndex) => {
        const angle = seeded(particleIndex + index * 431, 1) * Math.PI * 2;
        const distance = width * (0.45 + seeded(particleIndex + index * 431, 2) * 1.15);
        return {
          x: target.x + padding,
          y: target.y + padding,
          startX: padding + width / 2 + Math.cos(angle) * distance,
          startY: padding + height / 2 + Math.sin(angle) * Math.max(height * 0.9, distance * 0.32),
          endX: padding + width / 2 - Math.cos(angle * 1.37) * distance * 1.15,
          endY: padding + height / 2 - Math.sin(angle * 1.37) * Math.max(height, distance * 0.38),
          radius: 0.8 + seeded(particleIndex + index * 431, 3) * 1.45,
          delay: seeded(particleIndex + index * 431, 4) * 0.3,
        };
      });
    };

    // Every exit path lands here: pause, cancel, cleanup, reduced motion,
    // a hidden tab or a thrown frame. The word always ends readable.
    const stop = () => {
      stopped = true;
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      frameId = null;
      wordNode.style.opacity = "1";
      context.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    };

    const draw = (timestamp: number) => {
      frameId = null;
      if (stopped) return;
      try {
        if (reducedMotion.matches || document.hidden) {
          stop();
          return;
        }
        const cycleElapsed = (timestamp - startAt) % PARTICLE_CYCLE_MS;
        const gatherProgress = clamp(cycleElapsed / PARTICLE_GATHER_MS);
        const textProgress = clamp(
          (gatherProgress - TEXT_FADE_START) / (1 - TEXT_FADE_START),
        );
        const disperseProgress = clamp(
          (cycleElapsed - PARTICLE_HOLD_END_MS) / (PARTICLE_CYCLE_MS - PARTICLE_HOLD_END_MS),
        );
        // Opacity drops below 1 only here, inside a frame that has fired.
        wordNode.style.opacity = String(
          cycleElapsed >= PARTICLE_HOLD_END_MS
            ? 1 - easeInCubic(disperseProgress)
            : easeOutCubic(textProgress),
        );

        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        context.clearRect(0, 0, width, height);
        context.fillStyle = window.getComputedStyle(wordNode).getPropertyValue("--nb-lasso-green").trim();
        if (cycleElapsed < PARTICLE_GATHER_MS || cycleElapsed >= PARTICLE_HOLD_END_MS) {
          for (const particle of particles) {
            const gathering = cycleElapsed < PARTICLE_GATHER_MS;
            const local = gathering
              ? easeOutCubic((gatherProgress - particle.delay) / (1 - particle.delay))
              : easeInCubic(disperseProgress);
            const x = gathering
              ? particle.startX + (particle.x - particle.startX) * local
              : particle.x + (particle.endX - particle.x) * local;
            const y = gathering
              ? particle.startY + (particle.y - particle.startY) * local
              : particle.y + (particle.endY - particle.y) * local;
            context.globalAlpha = gathering
              ? clamp(Math.sin(local * Math.PI) * 0.72 + (1 - local) * 0.18)
              : clamp(Math.sin(local * Math.PI) * 0.72);
            context.beginPath();
            context.arc(x, y, particle.radius, 0, Math.PI * 2);
            context.fill();
          }
        }
        context.globalAlpha = 1;
        frameId = window.requestAnimationFrame(draw);
      } catch {
        stop();
      }
    };

    const onMotionChange = () => { if (reducedMotion.matches) stop(); };
    const onVisibility = () => { if (document.hidden) stop(); };

    rebuild();
    reducedMotion.addEventListener("change", onMotionChange);
    document.addEventListener("visibilitychange", onVisibility);
    frameId = window.requestAnimationFrame(draw);

    return () => {
      stop();
      reducedMotion.removeEventListener("change", onMotionChange);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [index, word, startAt]);

  return (
    <span className="landing-particle-word" aria-hidden="true" data-particle-start={startAt ?? undefined}>
      <span ref={wordRef} className="landing-particle-word-text">{word}</span>
      <canvas ref={canvasRef} className="landing-particle-word-canvas" />
    </span>
  );
}

export function LandingParticlePhrase({ text }: { text: string }) {
  const words = text.split(" ");
  const phraseRef = useRef<HTMLSpanElement | null>(null);
  const isIntersectingRef = useRef(false);
  // The phrase owns one start timestamp so every word moves as one unit.
  const [startAt, setStartAt] = useState<number | null>(null);

  useEffect(() => {
    const node = phraseRef.current;
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (typeof IntersectionObserver === "undefined") {
      setStartAt(performance.now());
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      const isIntersecting = entries.some((entry) => entry.isIntersecting);
      isIntersectingRef.current = isIntersecting;
      // Pausing restores solid text. Re-entry starts one fresh shared cycle.
      setStartAt(isIntersecting ? performance.now() : null);
    });
    const onVisibility = () => {
      if (document.hidden) {
        setStartAt(null);
      } else if (isIntersectingRef.current) {
        setStartAt(performance.now());
      }
    };
    observer.observe(node);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <span ref={phraseRef} className="landing-particle-phrase" aria-label={text}>
      {words.map((word, index) => (
        <span key={`${word}-${index}`}>
          <ParticleWord word={word} index={index} startAt={startAt} />
          {index < words.length - 1 ? " " : null}
        </span>
      ))}
    </span>
  );
}
