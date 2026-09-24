import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { type FormEvent, type ReactNode, useEffect, useRef, useState } from "react";

import { PublicHeader } from "@/components/layout/PublicHeader";
import { FocusSection } from "@/components/marketing/FocusSection";
import { DeckWalkthrough } from "@/components/marketing/HeroMotion";
import { Button } from "@/components/ui/button";
import heroMp4Asset from "@/assets/lasso-hero-1440.mp4.asset.json";
import heroPosterAsset from "@/assets/lasso-hero-poster.jpg.asset.json";
import heroWebmAsset from "@/assets/lasso-hero-1440.webm.asset.json";
import { startSessionReplay, stopSessionReplay } from "@/lib/posthog-client";
import { submitPilotRequestFn } from "@/lib/pilot-request.functions";
import { recordAnonymousEventFn } from "@/lib/telemetry.functions";

// Fallback variant for the landing hero.
export const HERO_H1_FALLBACK = "Your firm bought AI. Now nobody can say where a number came from.";
export const HERO_H1 = "Your firm bought AI. The human judgment, process, and thinking in your team's work went invisible.";

const BEAT_KEYS = ["thinking", "source", "answer", "share"] as const;

type UseCaseKey = "bring_work_in" | "every_number" | "check_sources" | "find_lost_idea" | "share_deliverable" | "reasoning_stays";
type AssetPointer = { url: string };
type AssetModule = { default?: AssetPointer } | AssetPointer;

const useCaseAssetModules = import.meta.glob("@/assets/use-*.asset.json", { eager: true }) as Record<string, AssetModule>;

function useCaseAssetUrl(filename: string, fallback: string) {
  const match = Object.entries(useCaseAssetModules).find(([path]) => path.endsWith(`/${filename}.asset.json`));
  const module = match?.[1];
  const pointer = module && "default" in module ? module.default : module;
  return pointer?.url ?? fallback;
}

const USE_CASES: { key: UseCaseKey; file: string; title: string; body: string }[] = [
  { key: "bring_work_in", file: "use-bring-work-in", title: "Your chats, docs and decks on one board.", body: "Claude, ChatGPT, Gemini, Granola and Drive land as cards. Drag them into workstreams. No setup." },
  { key: "every_number", file: "use-every-number-has-a-source", title: "Every number has a source.", body: "Ask where the figure on slide 3 came from. Get the chat, the turn, and the model it came out of." },
  { key: "check_sources", file: "use-check-the-sources", title: "Check the sources before the room.", body: "Under every answer: what was read, what was not. Nothing invented, nothing implied." },
  { key: "find_lost_idea", file: "use-find-the-idea-that-got-lost", title: "Find the idea that got lost.", body: "Something good was set aside in week two. Lasso finds the turn, and the reason." },
  { key: "share_deliverable", file: "use-share-the-deliverable", title: "Share the deliverable, not the drafts.", body: "Send one read-only board. Your reviewer opens what you chose. The link closes itself in 48 hours." },
  { key: "reasoning_stays", file: "use-reasoning-stays-with-the-firm", title: "The reasoning stays with the firm.", body: "When the consultant moves on, the record does not. The next team starts from the decisions, not from zero." },
];

const TRUST = [
  { title: "Notes are never a source.", body: "The record refuses it. Not a filter, a rule the server enforces." },
  { title: "You choose what a reviewer opens.", body: "A shared board is read only, and its link closes after 48 hours." },
  { title: "The record is yours.", body: "Leave the pilot with everything you brought in and everything Lasso wrote." },
] as const;

function UseCaseIcon({ card }: { card: UseCaseKey }) {
  const paths: Record<UseCaseKey, ReactNode> = {
    bring_work_in: <><rect x="3" y="4" width="7" height="6" rx="1" /><rect x="14" y="4" width="7" height="6" rx="1" /><rect x="8" y="14" width="8" height="6" rx="1" /></>,
    every_number: <><path d="M4 20V10M10 20V6M16 20v-8" /><path d="M3 20h18" /></>,
    check_sources: <><circle cx="11" cy="11" r="6" /><path d="M20 20l-4.5-4.5" /></>,
    find_lost_idea: <><path d="M12 3a6 6 0 0 0-3.5 10.9V16h7v-2.1A6 6 0 0 0 12 3z" /><path d="M9.5 20h5" /></>,
    share_deliverable: <><path d="M6 12v7h12v-7" /><path d="M12 4v11M8 8l4-4 4 4" /></>,
    reasoning_stays: <><path d="M5 4h11l3 3v13H5z" /><path d="M9 10h6M9 14h6" /></>,
  };
  return <svg className="landing-usecase-icon" viewBox="0 0 24 24" aria-hidden="true">{paths[card]}</svg>;
}

function UseCaseCard({ card, onPlayed }: { card: (typeof USE_CASES)[number]; onPlayed: (key: UseCaseKey, mode: "hover" | "tap") => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mode = useRef<"hover" | "tap">("hover");
  const [posterOk, setPosterOk] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const poster = useCaseAssetUrl(`${card.file}-poster.jpg`, `/videos/${card.file}-poster.jpg`);
  const clip = useCaseAssetUrl(`${card.file}.mp4`, `/videos/${card.file}.mp4`);

  useEffect(() => {
    const probe = new Image();
    probe.onload = () => setPosterOk(true);
    probe.onerror = () => setPosterOk(false);
    probe.src = poster;
  }, [poster]);

  function play(next: "hover" | "tap") {
    const el = videoRef.current;
    if (!el || videoFailed) return;
    mode.current = next;
    void el.play().catch(() => setVideoFailed(true));
  }
  function pause() {
    videoRef.current?.pause();
  }

  return (
    <article className="landing-usecase" data-usecase={card.key}>
      <button
        type="button"
        className="landing-usecase-media"
        aria-label={`Play: ${card.title}`}
        data-playing={playing}
        onPointerEnter={(event) => { if (event.pointerType === "mouse") play("hover"); }}
        onPointerLeave={(event) => { if (event.pointerType === "mouse") pause(); }}
        onClick={() => {
          if (window.matchMedia("(hover: hover)").matches) return;
          if (playing) pause(); else play("tap");
        }}
      >
        <span className="landing-usecase-placeholder" aria-hidden="true">{card.title}</span>
        {posterOk ? <img className="landing-usecase-poster" src={poster} alt="" aria-hidden="true" /> : null}
        {videoFailed ? null : (
          <video
            ref={videoRef}
            className="landing-usecase-video"
            src={clip}
            muted
            playsInline
            preload="none"
            poster={posterOk ? poster : undefined}
            onPlaying={() => { setPlaying(true); onPlayed(card.key, mode.current); }}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
            onError={() => setVideoFailed(true)}
          />
        )}
      </button>
      <div className="landing-usecase-copy">
        <UseCaseIcon card={card.key} />
        <h3>{card.title}</h3>
        <p>{card.body}</p>
      </div>
    </article>
  );
}

function HeroVideo() {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [reduced] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [started, setStarted] = useState(false);
  return (
    <figure className="landing-hero-media">
      <div className="landing-hero-video-box">
        <video
          ref={ref}
          className="landing-hero-video"
          autoPlay={!reduced}
          muted
          loop
          playsInline
          preload="metadata"
          poster={heroPosterAsset.url}
          onPlaying={() => setStarted(true)}
        >
          {/* Unit 11 phone-source slot: add a vertical WebM/MP4 pair here with media="(max-width: 767px)" when supplied. */}
          <source src={heroWebmAsset.url} type="video/webm" />
          <source src={heroMp4Asset.url} type="video/mp4" />
        </video>
        {reduced && !started ? (
          <button type="button" aria-label="Play" className="landing-hero-play" onClick={() => { void ref.current?.play().catch(() => {}); }}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
          </button>
        ) : null}
      </div>
      <figcaption className="landing-hero-caption">Illustrative engagement · every figure is made up</figcaption>
    </figure>
  );
}

export function B2BLanding({ surface }: { surface: "home" | "landing-next" }) {
  const viewId = useRef<string>(crypto.randomUUID());
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  const [activeBeat, setActiveBeat] = useState(0);
  const seenBeats = useRef(new Set<number>());
  const playedCards = useRef(new Set<UseCaseKey>());
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
    if (seenBeats.current.has(activeBeat)) return;
    seenBeats.current.add(activeBeat);
    const beat = BEAT_KEYS[activeBeat];
    if (!beat) return;
    void recordAnonymousEventFn({
      data: {
        event_type: "landing.story_section_viewed",
        view_id: viewId.current,
        dims: { section: beat, input_mode: "scroll" },
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

  function noteUseCasePlayed(card: UseCaseKey, inputMode: "hover" | "tap") {
    if (playedCards.current.has(card)) return;
    playedCards.current.add(card);
    void recordAnonymousEventFn({
      data: {
        event_type: "landing.usecase_played",
        view_id: viewId.current,
        dims: { card, input_mode: inputMode },
      },
    }).catch(() => {
      /* This signal must never surface to the visitor. */
    });
  }

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
          <div className="mx-auto mt-14 max-w-[1200px] px-4 md:px-6">
            <HeroVideo />
          </div>

          <section id="beats" className="landing-walkthrough mx-auto mt-24 max-w-[1320px] px-4 md:px-6" aria-label="How Lasso works">
            <div className="landing-section-head">
              <p className="micro-label">How it works</p>
              <h2 className="pencil-title">Deliverables you can defend to a client, a partner, or a board.</h2>
            </div>
            <DeckWalkthrough onActiveChange={setActiveBeat} />
          </section>

          <section className="landing-usecases mx-auto mt-24 max-w-[1200px] px-4 md:px-6" aria-label="What consultants use it for">
            <div className="landing-section-head">
              <p className="micro-label">What consultants use it for</p>
              <h2 className="pencil-title">Built for the questions that come after the deliverable.</h2>
            </div>
            <div className="landing-usecase-grid">
              {USE_CASES.map((card) => <UseCaseCard key={card.key} card={card} onPlayed={noteUseCasePlayed} />)}
            </div>
          </section>

          <section className="landing-trust mx-auto mt-24 max-w-[1200px] px-4 md:px-6" aria-label="What the record promises">
            <div className="landing-trust-row">
              {TRUST.map((item) => (
                <div key={item.title} className="landing-trust-item">
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </div>
              ))}
            </div>
          </section>

          <section ref={closeRef} className="landing-close mx-auto max-w-4xl px-6 md:px-10" data-resolved={closeResolved} onPointerDown={() => { if (window.matchMedia("(max-width: 767px)").matches) setCloseResolved(true); }}>
            <h2 className="landing-close-line1 landing-close-wordmark">Every claim, traced to the work behind it.</h2>
            <div className="landing-close-ink-wrap">
              <p className="landing-close-line2">The work, judgment, thinking. Visible.</p>
              <span className="landing-close-particles landing-close-particles-a" aria-hidden="true" />
              <span className="landing-close-particles landing-close-particles-b" aria-hidden="true" />
              <span className="landing-close-particles landing-close-particles-c" aria-hidden="true" />
            </div>
            <div className="mt-10">
              <Button asChild>
                <a href="#pilot" onClick={() => notePlacedPilotClick("close")}>
                  Book a pilot
                </a>
              </Button>
            </div>
            <p className="mt-6 text-base text-foreground">Three months. Your firm's real work. Share what you choose, when you choose: one review pass instead of five, and a record the firm keeps.</p>
            <p className="mt-2 font-mono text-[11.5px] text-muted-foreground">A 30-minute call · we set up one engagement with you · you keep the record either way</p>
          </section>

          <div className="mx-auto max-w-3xl px-6 md:px-10">
            <div id="pilot">
            <FocusSection className="mt-20 border-t border-rule pt-10">
              <p className="micro-label">PILOT</p>
              <h2 className="pencil-title mt-4">Run it on one engagement.</h2>
              <p className="mt-5 max-w-2xl text-base leading-relaxed text-foreground">
                Three months, one real engagement, your team, your tools. You keep every record whether
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
