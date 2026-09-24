import { useEffect, useRef } from "react";

const CYCLE_MS = 6000;
export const PARTICLE_TEXT_HOLD_MS = 2000;
const GATHER_END_MS = 1500;
const HOLD_END_MS = GATHER_END_MS + PARTICLE_TEXT_HOLD_MS;
const DISPERSE_END_MS = 5000;

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

function seeded(index: number, salt: number) {
  const value = Math.sin(index * 91.73 + salt * 47.21) * 43758.5453;
  return value - Math.floor(value);
}

function ParticleWord({ word, index }: { word: string; index: number }) {
  const wordRef = useRef<HTMLSpanElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const wordNode = wordRef.current;
    const canvas = canvasRef.current;
    if (!wordNode || !canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    let particles: Particle[] = [];
    let frameId: number | null = null;
    let visible = typeof IntersectionObserver === "undefined";
    let cycleStartedAt = performance.now();
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const rebuild = () => {
      const rect = wordNode.getBoundingClientRect();
      const width = Math.max(1, Math.ceil(rect.width));
      const height = Math.max(1, Math.ceil(rect.height));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.ceil(width * dpr);
      canvas.height = Math.ceil(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
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
      sampleContext.fillStyle = "currentColor";
      const baseline = height - Math.max(1, Number.parseFloat(computed.fontSize) * 0.12);
      sampleContext.fillText(word, 0, baseline);
      const pixels = sampleContext.getImageData(0, 0, sample.width, sample.height).data;
      const targets: { x: number; y: number }[] = [];
      const step = Math.max(3, Math.round(Number.parseFloat(computed.fontSize) / 15));
      for (let y = 0; y < sample.height; y += step * dpr) {
        for (let x = 0; x < sample.width; x += step * dpr) {
          const alpha = pixels[(Math.floor(y) * sample.width + Math.floor(x)) * 4 + 3] ?? 0;
          if (alpha > 72) targets.push({ x: x / dpr, y: y / dpr });
        }
      }
      const stride = Math.max(1, Math.ceil(targets.length / 420));
      particles = targets.filter((_, targetIndex) => targetIndex % stride === 0).map((target, particleIndex) => {
        const angle = seeded(particleIndex + index * 431, 1) * Math.PI * 2;
        const distance = width * (0.45 + seeded(particleIndex + index * 431, 2) * 1.15);
        return {
          ...target,
          startX: width / 2 + Math.cos(angle) * distance,
          startY: height / 2 + Math.sin(angle) * Math.max(height * 0.9, distance * 0.32),
          endX: width / 2 - Math.cos(angle * 1.37) * distance * 1.15,
          endY: height / 2 - Math.sin(angle * 1.37) * Math.max(height, distance * 0.38),
          radius: 0.8 + seeded(particleIndex + index * 431, 3) * 1.45,
          delay: seeded(particleIndex + index * 431, 4) * 0.3,
        };
      });
    };

    const draw = (timestamp: number) => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      context.clearRect(0, 0, width, height);

      if (reducedMotion.matches) {
        wordNode.style.opacity = "1";
        return;
      }

      const elapsed = (timestamp - cycleStartedAt) % CYCLE_MS;
      const gathering = elapsed < GATHER_END_MS;
      const holding = elapsed >= GATHER_END_MS && elapsed < HOLD_END_MS;
      const dispersing = elapsed >= HOLD_END_MS && elapsed < DISPERSE_END_MS;
      const textIn = clamp((elapsed - 1120) / 380);
      const textOut = clamp((elapsed - HOLD_END_MS) / 260);
      wordNode.style.opacity = holding ? "1" : gathering ? String(textIn) : dispersing ? String(1 - textOut) : "0";

      const styles = window.getComputedStyle(wordNode);
      const green = styles.getPropertyValue("--nb-lasso-green").trim();
      context.fillStyle = green;
      const rawProgress = gathering ? elapsed / GATHER_END_MS : dispersing ? (elapsed - HOLD_END_MS) / (DISPERSE_END_MS - HOLD_END_MS) : 1;

      if (gathering || dispersing) {
        for (const particle of particles) {
          const local = easeOutCubic((rawProgress - particle.delay) / (1 - particle.delay));
          const fromX = gathering ? particle.startX : particle.x;
          const fromY = gathering ? particle.startY : particle.y;
          const toX = gathering ? particle.x : particle.endX;
          const toY = gathering ? particle.y : particle.endY;
          const x = fromX + (toX - fromX) * local;
          const y = fromY + (toY - fromY) * local;
          const alpha = gathering ? Math.sin(local * Math.PI) * 0.72 + (1 - local) * 0.18 : (1 - local) * 0.92;
          context.globalAlpha = clamp(alpha);
          context.beginPath();
          context.arc(x, y, particle.radius, 0, Math.PI * 2);
          context.fill();
        }
      }
      context.globalAlpha = 1;
      if (visible) frameId = window.requestAnimationFrame(draw);
    };

    const start = () => {
      if (!visible || frameId !== null) return;
      cycleStartedAt = performance.now();
      frameId = window.requestAnimationFrame(draw);
    };
    const stop = () => {
      if (frameId === null) return;
      window.cancelAnimationFrame(frameId);
      frameId = null;
    };
    const onMotionChange = () => {
      stop();
      if (reducedMotion.matches) {
        wordNode.style.opacity = "1";
        context.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
      } else {
        cycleStartedAt = performance.now();
        start();
      }
    };

    rebuild();
    const resizeObserver = new ResizeObserver(rebuild);
    resizeObserver.observe(wordNode);
    const observer = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false;
      if (visible) start(); else stop();
    });
    observer?.observe(wordNode);
    reducedMotion.addEventListener("change", onMotionChange);
    if (!observer) start();

    return () => {
      stop();
      observer?.disconnect();
      resizeObserver.disconnect();
      reducedMotion.removeEventListener("change", onMotionChange);
    };
  }, [index, word]);

  return (
    <span className="landing-particle-word" aria-hidden="true">
      <span ref={wordRef} className="landing-particle-word-text">{word}</span>
      <canvas ref={canvasRef} className="landing-particle-word-canvas" />
    </span>
  );
}

export function LandingParticlePhrase({ text }: { text: string }) {
  const words = text.split(" ");
  return (
    <span className="landing-particle-phrase" aria-label={text}>
      {words.map((word, index) => (
        <span key={`${word}-${index}`}>
          <ParticleWord word={word} index={index} />
          {index < words.length - 1 ? " " : null}
        </span>
      ))}
    </span>
  );
}