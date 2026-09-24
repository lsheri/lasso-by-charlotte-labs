import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { type FormEvent, useEffect, useRef, useState } from "react";

import { PublicHeader } from "@/components/layout/PublicHeader";
import { FocusSection } from "@/components/marketing/FocusSection";
import { HeroMotion } from "@/components/marketing/HeroMotion";
import { Button } from "@/components/ui/button";
import { startSessionReplay, stopSessionReplay } from "@/lib/posthog-client";
import { submitPilotRequestFn } from "@/lib/pilot-request.functions";
import { recordAnonymousEventFn } from "@/lib/telemetry.functions";

// Fallback variant for the landing hero.
export const HERO_H1_FALLBACK = "Your firm bought AI. Now nobody can say where a number came from.";
export const HERO_H1 = "Your firm bought AI. The human judgment, process, and thinking in your team's work went invisible.";

const BEATS = [
  {
    key: "thinking",
    label: "01 · THE NUMBER",
    title: "Show where the $1.4M scenario came from.",
    body: "The finished slide stays connected to the scenario and pipeline work that shaped it.",
  },
  {
    key: "source",
    label: "02 · THE COMPARABLES",
    title: "Keep the five organizations with the research behind them.",
    body: "The board-chair conversation and research thread remain beside the benchmark slide.",
  },
  {
    key: "answer",
    label: "03 · THE EXACT TURN",
    title: "Return to the choice, not just the finished wording.",
    body: "The chair-term decision opens at the exact conversation turn where the team chose it.",
  },
  {
    key: "share",
    label: "04 · THE RECOMMENDATION",
    title: "Keep the conversations that shaped the recommendation in order.",
    body: "The constraint, structure choice, and merger scenario remain connected to the final slide.",
  },
] as const;

export function B2BLanding({ surface }: { surface: "home" | "landing-next" }) {
  const viewId = useRef<string>(crypto.randomUUID());
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  const [activeBeat, setActiveBeat] = useState(0);
  const seenBeats = useRef(new Set<number>());
  const inputMode = useRef<"scroll" | "control" | "timer">("scroll");
  const storyRef = useRef<HTMLElement | null>(null);
  const restartTimer = useRef<() => void>(() => {});
  const pauseTimer = useRef<() => void>(() => {});
  const closeRef = useRef<HTMLElement | null>(null);
  const [closeResolved, setCloseResolved] = useState(false);
  const submitPilot = useServerFn(submitPilotRequestFn);

  useEffect(() => {
    void recordAnonymousEventFn({
      data: {
        event_type: "landing.viewed",
        view_id: viewId.current,
        dims: { variant: "b2b", surface },
      },
    }).catch(() => {
      /* This signal must never surface to the visitor. */
    });
  }, []);

  useEffect(() => {
    // Desktop: the section is pinned for four viewport heights, one step per
    // quarter of scroll. Phone: no pinning, steps advance every 8 seconds
    // while the section is on screen.
    const section = storyRef.current;
    if (!section) return;
    const phone = window.matchMedia("(max-width: 767px)");
    let timer: ReturnType<typeof setInterval> | null = null;
    let visible = false;

    const onScroll = () => {
      if (phone.matches) return;
      const rect = section.getBoundingClientRect();
      const travel = section.offsetHeight - window.innerHeight;
      if (travel <= 0) return;
      const progress = Math.min(0.999, Math.max(0, -rect.top / travel));
      const next = Math.floor(progress * 4);
      setActiveBeat((prev) => {
        if (prev !== next) inputMode.current = "scroll";
        return next;
      });
    };
    const startTimer = () => {
      if (timer || !phone.matches || !visible) return;
      timer = setInterval(() => {
        inputMode.current = "timer";
        setActiveBeat((prev) => (prev + 1) % BEATS.length);
      }, 8000);
    };
    const stopTimer = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    restartTimer.current = () => { stopTimer(); startTimer(); };
    pauseTimer.current = stopTimer;

    const observer = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver((entries) => {
      visible = entries.some((entry) => entry.isIntersecting);
      if (visible) startTimer(); else stopTimer();
    }, { threshold: 0.2 });
    observer?.observe(section);
    const onMode = () => { stopTimer(); startTimer(); onScroll(); };
    window.addEventListener("scroll", onScroll, { passive: true });
    phone.addEventListener("change", onMode);
    onScroll();
    return () => {
      stopTimer();
      observer?.disconnect();
      window.removeEventListener("scroll", onScroll);
      phone.removeEventListener("change", onMode);
    };
  }, []);

  function goToStep(index: number) {
    inputMode.current = "control";
    const section = storyRef.current;
    if (section && !window.matchMedia("(max-width: 767px)").matches) {
      const travel = section.offsetHeight - window.innerHeight;
      const top = section.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: top + ((index + 0.5) / 4) * travel, behavior: "smooth" });
    } else {
      pauseTimer.current();
    }
    setActiveBeat(index);
  }

  useEffect(() => {
    if (seenBeats.current.has(activeBeat)) return;
    seenBeats.current.add(activeBeat);
    const beat = BEATS[activeBeat];
    if (!beat) return;
    void recordAnonymousEventFn({
      data: {
        event_type: "landing.story_section_viewed",
        view_id: viewId.current,
        dims: { section: beat.key, input_mode: inputMode.current },
      },
    }).catch(() => {
      /* This signal must never surface to the visitor. */
    });
  }, [activeBeat]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setCloseResolved(true);
      return;
    }
    const close = closeRef.current;
    if (!close) return;
    const reveal = () => {
      if (close.getBoundingClientRect().top <= window.innerHeight * 0.6) {
        setCloseResolved(true);
        window.removeEventListener("scroll", reveal);
      }
    };
    window.addEventListener("scroll", reveal, { passive: true });
    reveal();
    return () => window.removeEventListener("scroll", reveal);
  }, []);

  useEffect(() => {
    stopSessionReplay();
    return () => startSessionReplay();
  }, []);

  function notePilotClick(location: "hero" | "pilot") {
    void recordAnonymousEventFn({
      data: {
        event_type: "landing.pilot_cta_clicked",
        view_id: viewId.current,
        dims: { location },
      },
    }).catch(() => {
      /* This signal must never surface to the visitor. */
    });
  }

  function notePlacedPilotClick(placement: "header" | "close") {
    void recordAnonymousEventFn({
      data: {
        event_type: "landing.pilot_cta_clicked",
        view_id: viewId.current,
        dims: { placement },
      },
    }).catch(() => {
      /* This signal must never surface to the visitor. */
    });
  }

  function noteSeeItWorkClick() {
    void recordAnonymousEventFn({
      data: {
        event_type: "landing.see_it_work_clicked",
        view_id: viewId.current,
        dims: { location: "hero" },
      },
    }).catch(() => {
      /* This signal must never surface to the visitor. */
    });
  }

  async function submitPilotRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    notePilotClick("pilot");
    setSubmitting(true);
    setSubmitError(false);
    const form = event.currentTarget;
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
      void recordAnonymousEventFn({
        data: {
          event_type: "landing.pilot_requested",
          view_id: viewId.current,
          dims: { team_size: teamSize },
        },
      }).catch(() => {
        /* This signal must never surface to the visitor. */
      });
      setSubmitted(true);
    } catch {
      setSubmitError(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="landing-next min-h-screen overflow-x-clip bg-background">
      <div className="relative z-10">
        <PublicHeader
          current="/"
          cta={
            <a
              href="#pilot"
              onClick={() => notePlacedPilotClick("header")}
              className="landing-header-cta rounded-[var(--radius)] bg-foreground px-4 py-3 font-mono text-[13px] uppercase tracking-[0.08em] text-background transition-opacity hover:opacity-85 sm:px-6 sm:text-[18px]"
            >
              Book a pilot
            </a>
          }
        />

        <main className="landing-beats-root pb-24 pt-16 md:pt-20">
          <div className="mx-auto max-w-5xl px-6 md:px-10">
            <section className="landing-next-hero">
              <h1 className="pencil-title mt-5 text-foreground">
                Your firm bought AI. <span className="landing-hero-highlight">The human judgment, process, and thinking</span> in your team's work went invisible.
              </h1>
              <h2 className="mt-6 max-w-3xl text-[26px] leading-relaxed text-muted-foreground">
                Lasso is the reasoning and judgment layer for AI-assisted consulting. It connects the work across tools to the client deliverable and keeps the decisions your team made, so they can show where a claim came from and why it stayed.
              </h2>
              <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
                <Button asChild>
                  <a href="#pilot" onClick={() => notePilotClick("hero")}>
                    Book a pilot
                  </a>
                </Button>
                <a
                  href="#beats"
                  onClick={noteSeeItWorkClick}
                  className="story-link text-sm text-foreground transition-colors hover:text-muted-foreground"
                >
                  See it work ↓
                </a>
              </div>
              <Link
                to="/auth"
                search={{ intent: "personal" }}
                className="mt-5 inline-block text-xs text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
              >
                Start your own record
              </Link>
            </section>
          </div>

          <section id="beats" ref={storyRef} className="landing-story-pin mt-16" aria-label="How Lasso works">
            <div className="landing-story-pin-inner mx-auto max-w-[1480px] px-4 md:px-6">
              <div className="landing-story-pin-head">
                <p className="micro-label">HOW IT WORKS</p>
                <h2 className="pencil-title">The work stays connected from first thought to final answer.</h2>
              </div>
              <HeroMotion step={activeBeat} onStepChange={goToStep} />
              {BEATS.map((beat, index) => (
                <article key={beat.key} className="landing-story-beat" data-story-index={index} data-active={activeBeat === index} hidden={activeBeat !== index}>
                  <p className="micro-label">{beat.label}</p>
                  <h3>{beat.title}</h3>
                  <p>{beat.body}</p>
                  {index === 3 ? <p className="font-mono text-[11.5px] text-muted-foreground">Shared boards are read only. Their links close after 48 hours.</p> : null}
                </article>
              ))}
            </div>
          </section>

          <section ref={closeRef} className="landing-close mx-auto max-w-4xl px-6 md:px-10" data-resolved={closeResolved} onPointerDown={() => { if (window.matchMedia("(max-width: 767px)").matches) setCloseResolved(true); }}>
            <h2 className="landing-close-line1 landing-close-wordmark">Deliverables you can defend to a client, a partner, or a board.</h2>
            <div className="landing-close-ink-wrap">
              <p className="landing-close-line2">The work, judgment, thinking. Visible.</p>
              <span className="landing-close-particles" aria-hidden="true" />
            </div>
            <div className="mt-10">
              <Button asChild>
                <a href="#pilot" onClick={() => notePlacedPilotClick("close")}>
                  Book a pilot
                </a>
              </Button>
            </div>
            <p className="mt-6 text-base text-foreground">Three months. Your firm's real work. No prompts shown to anyone.</p>
            <p className="mt-2 font-mono text-[11.5px] text-muted-foreground">A 30-minute call · we set up one engagement with you · you keep the record either way</p>
          </section>

          <div className="mx-auto max-w-3xl px-6 md:px-10">
            <div id="pilot">
            <FocusSection className="mt-20 border-t border-rule pt-10">
              <p className="micro-label">PILOT</p>
              <h2 className="pencil-title mt-4">Run it on one engagement.</h2>
              <p className="mt-5 max-w-2xl text-base leading-relaxed text-foreground">
                Four months, one real engagement, your team, your tools. You keep every record whether
                or not you continue.
              </p>
              <p className="mt-3 max-w-2xl font-mono text-[11.5px] text-muted-foreground">
                Fixed fee for the pilot. No per-seat pricing until you've seen it work.
              </p>

              {submitted ? (
                <p className="mt-8 border-l-2 border-green pl-4 text-base text-foreground" role="status">
                  Thanks. Liam will be in touch within a day.
                </p>
              ) : (
                <form className="landing-next-pilot-form mt-8 grid gap-5" onSubmit={submitPilotRequest}>
                  <label className="sr-only" aria-hidden="true">
                    <span>Website</span>
                    <input name="website" tabIndex={-1} autoComplete="off" />
                  </label>
                  <label>
                    <span>Name</span>
                    <input name="name" autoComplete="name" required />
                  </label>
                  <label>
                    <span>Firm</span>
                    <input name="firm" autoComplete="organization" required />
                  </label>
                  <label>
                    <span>Work email</span>
                    <input name="email" type="email" autoComplete="email" required />
                  </label>
                  <label>
                    <span>Team size</span>
                    <select name="teamSize" required defaultValue="">
                      <option value="" disabled>Select team size</option>
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
                  <div><Button type="submit" disabled={submitting}>{submitting ? "Sending…" : "Book a pilot"}</Button></div>
                  {submitError ? (
                    <p className="text-sm text-destructive" role="alert">
                      That didn't go through. Email liam@charlotte-labs.com and we'll pick it up.
                    </p>
                  ) : null}
                </form>
              )}

              <a href="mailto:liam@charlotte-labs.com" className="mt-6 inline-block text-sm text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground">
                liam@charlotte-labs.com
              </a>
            </FocusSection>
            </div>
          </div>
        </main>

        <footer className="border-t border-rule">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-4 gap-y-2 px-6 py-8 font-mono text-[11px] text-muted-foreground md:px-10">
            <span>Charlotte Labs</span>
            <a href="https://charlotte-labs.com" className="underline underline-offset-4 transition-colors hover:text-foreground">charlotte-labs.com</a>
            <a href="mailto:liam@charlotte-labs.com" className="underline underline-offset-4 transition-colors hover:text-foreground">liam@charlotte-labs.com</a>
            <a href="https://www.linkedin.com/company/charlotte-labs" target="_blank" rel="noreferrer" className="underline underline-offset-4 transition-colors hover:text-foreground">LinkedIn</a>
          </div>
          <nav className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-5 gap-y-2 px-6 pb-8 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground md:px-10">
            <Link to="/why" className="transition-colors hover:text-foreground">Why Lasso</Link>
            <Link to="/trust" className="transition-colors hover:text-foreground">Trust &amp; data</Link>
            <Link to="/personal" className="transition-colors hover:text-foreground">For individuals</Link>
            <Link to="/auth" className="transition-colors hover:text-foreground">Sign in</Link>
          </nav>
        </footer>
      </div>
    </div>
  );
}
