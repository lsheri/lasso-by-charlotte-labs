import { useEffect, useRef, useState } from "react";

const STAGES = [
  { label: "You work in your AI tools", body: "Claude, ChatGPT, Drive, meetings." },
  { label: "It flows into Lasso", body: "Only what you choose. Private on arrival." },
  { label: "You map it", body: "Give it an engagement and a task. It becomes a record." },
  { label: "A coach sees what you share", body: "Never your raw files. Only the shared view." },
];

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const listener = (e: MediaQueryListEvent) => setReduced(e.matches);
    query.addEventListener("change", listener);
    return () => query.removeEventListener("change", listener);
  }, []);
  return reduced;
}

/**
 * A ~20 second, plays-once look at the loop. No data, no screenshots, four
 * abstract beats. Reduced motion gets the same four beats, all at once.
 */
export function FlowPreview({ onSkip }: { onSkip?: () => void }) {
  const reduced = usePrefersReducedMotion();
  const [stage, setStage] = useState(reduced ? STAGES.length - 1 : 0);
  const [done, setDone] = useState(reduced);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (reduced) return;
    STAGES.forEach((_, index) => {
      timers.current.push(setTimeout(() => setStage(index), index * 5000));
    });
    timers.current.push(setTimeout(() => setDone(true), STAGES.length * 5000));
    const running = timers.current;
    return () => running.forEach(clearTimeout);
  }, [reduced]);

  function skip() {
    timers.current.forEach(clearTimeout);
    setStage(STAGES.length - 1);
    setDone(true);
    onSkip?.();
  }

  return (
    <section
      aria-label="How Lasso works"
      className="rounded-[var(--radius)] border border-border bg-card px-5 py-5 shadow-card"
    >
      <div className="flex items-baseline justify-between gap-4">
        <p className="micro-label">The loop</p>
        {!done ? (
          <button
            type="button"
            onClick={skip}
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Skip
          </button>
        ) : null}
      </div>

      <div className="mt-4 flex items-center gap-2 sm:gap-3">
        {STAGES.map((item, index) => {
          const active = reduced || index <= stage;
          return (
            <div key={item.label} className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[calc(var(--radius)-2px)] border text-xs font-medium transition-all duration-500"
                style={{
                  borderColor: active
                    ? "color-mix(in oklab, var(--hue-slate-blue) 40%, transparent)"
                    : "var(--border)",
                  background: active
                    ? "color-mix(in oklab, var(--hue-slate-blue) 12%, transparent)"
                    : "transparent",
                  color: active ? "var(--hue-slate-blue)" : "var(--muted-foreground)",
                  opacity: active ? 1 : 0.5,
                }}
              >
                {index + 1}
              </div>
              {index < STAGES.length - 1 ? (
                <div className="h-px min-w-0 flex-1 overflow-hidden bg-border">
                  <div
                    className="h-px bg-[var(--hue-slate-blue)] transition-all duration-[900ms] ease-out"
                    style={{ width: reduced || index < stage ? "100%" : "0%" }}
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="mt-4 min-h-[3.5rem]">
        {reduced ? (
          <ul className="space-y-1">
            {STAGES.map((item) => (
              <li key={item.label} className="text-sm text-muted-foreground">
                <span className="text-foreground">{item.label}</span>, {item.body}
              </li>
            ))}
          </ul>
        ) : (
          <div key={stage} className="animate-fade-in">
            <p className="text-sm font-medium text-foreground">{STAGES[stage]?.label}</p>
            <p className="mt-1 text-sm text-muted-foreground">{STAGES[stage]?.body}</p>
          </div>
        )}
      </div>
    </section>
  );
}
