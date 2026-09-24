import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { type FormEvent, useEffect, useRef, useState } from "react";

import { LassoLoopMark } from "@/components/layout/LassoLoopMark";
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
    label: "01 · THE THINKING",
    title: "Keep the thinking, not just the output.",
    body: "Bring work from the AI tools your team already uses into one durable record. The analysis, alternatives, and human choices stay with the finished work.",
  },
  {
    key: "source",
    label: "02 · THE SOURCE",
    title: "Move from a claim to its source in one click.",
    body: "Connect a deck statement to the conversation and human choice behind it. Open the exact turn instead of reconstructing the story later.",
  },
  {
    key: "answer",
    label: "03 · THE ANSWER",
    title: "Know what shaped the answer.",
    body: "See what was read, what was left out, and why. Ask a plain-language question about the work and get the source with the answer.",
  },
  {
    key: "share",
    label: "04 · THE HANDOFF",
    title: "Share the work without surrendering the whole record.",
    body: "Coaches see only the work you choose to share. Nobody is told when you keep something back.",
  },
] as const;

export function B2BLanding({ surface }: { surface: "home" | "landing-next" }) {
  const viewId = useRef<string>(crypto.randomUUID());
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  const [activeBeat, setActiveBeat] = useState(0);
  const seenBeats = useRef(new Set<number>());
  const inputMode = useRef<"scroll" | "control">("scroll");
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
    // One observer: each stage runs only while it is on screen.
    const targets = Array.from(document.querySelectorAll<HTMLElement>("[data-landing-beats-play]"));
    if (typeof IntersectionObserver === "undefined") return;
    // The hero runs whenever any of it shows; of the beats, only the one
    // most in view runs.
    const ratios = new Map<HTMLElement, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          ratios.set(entry.target as HTMLElement, entry.isIntersecting ? entry.intersectionRatio : 0);
        }
        let lead: HTMLElement | null = null;
        for (const target of targets) {
          if (target.tagName !== "ARTICLE") continue;
          const ratio = ratios.get(target) ?? 0;
          if (ratio > 0 && (!lead || ratio > (ratios.get(lead) ?? 0))) lead = target;
        }
        for (const target of targets) {
          const on = target.tagName === "ARTICLE" ? target === lead : (ratios.get(target) ?? 0) > 0;
          target.dataset["play"] = on ? "running" : "paused";
        }
        if (lead?.dataset["storyIndex"]) {
          const next = Number(lead.dataset["storyIndex"]);
          if (Number.isInteger(next)) {
            inputMode.current = "scroll";
            setActiveBeat(next);
          }
        }
      },
      { threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] },
    );
    for (const target of targets) observer.observe(target);
    return () => observer.disconnect();
  }, []);

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
      <div className="landing-next-loop-small pointer-events-none fixed" aria-hidden="true">
        <LassoLoopMark className="h-full w-full text-lasso-green" drawWithScroll />
      </div>

      <div className="relative z-10">
        <PublicHeader current="/" />

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

          <div className="landing-beats-play mx-auto mt-12 max-w-[1480px] px-4 md:px-6" data-landing-beats-play>
            <HeroMotion activeSlide={activeBeat} onSlideChange={(index) => { inputMode.current = "control"; setActiveBeat(index); }} />
          </div>

          <section id="beats" className="landing-story-carousel mx-auto mt-24 max-w-6xl px-6 md:px-10" aria-label="How Lasso works">
            <div className="landing-story-carousel-copy landing-story-carousel-copy-mobile">
              <p className="micro-label">HOW IT WORKS</p>
              <h2 className="pencil-title mt-4">The work stays connected from first thought to final answer.</h2>
            </div>
            <div className="landing-story-carousel-grid">
              <div className="landing-story-sticky" aria-hidden="true">
                <div className="landing-story-carousel-copy">
                  <p className="micro-label">HOW IT WORKS</p>
                  <h2 className="pencil-title mt-3">The work stays connected from first thought to final answer.</h2>
                </div>
                <HeroMotion activeSlide={activeBeat} />
              </div>
              <div className="landing-story-beats">
                {BEATS.map((beat, index) => (
                  <article key={beat.key} className="landing-beats-play landing-story-beat" data-landing-beats-play data-story-index={index} data-active={activeBeat === index}>
                    <p className="micro-label">{beat.label}</p>
                    <h3 className="pencil-title mt-4">{beat.title}</h3>
                    <p className="mt-5 max-w-xl text-base leading-relaxed text-foreground">{beat.body}</p>
                    {index === 3 ? <p className="mt-5 font-mono text-[11.5px] text-muted-foreground">Shared boards are read only. Their links close after 48 hours.</p> : null}
                    <div className="landing-story-beat-motion">
                      <HeroMotion activeSlide={index} onSlideChange={(nextIndex) => { inputMode.current = "control"; setActiveBeat(nextIndex); }} />
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <div className="mx-auto max-w-3xl px-6 md:px-10">
            <section className="mt-24 border-t border-rule pt-10">
              <h2 className="pencil-title">Deliverables you can defend to a client, a partner, or a board...</h2>
              <p className="mt-5 max-w-2xl text-base leading-relaxed text-foreground">
                The work, judgment, thinking...VISIBLE*
              </p>
            </section>

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
