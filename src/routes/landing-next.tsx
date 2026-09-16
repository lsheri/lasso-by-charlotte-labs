import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import coachSpider from "@/assets/coach-lasso-spider.png.asset.json";
import pastWorkLibrary from "@/assets/past-work-library.png.asset.json";
import { LassoLoopMark } from "@/components/layout/LassoLoopMark";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { ClipPlayer } from "@/components/marketing/ClipPlayer";
import { FocusSection } from "@/components/marketing/FocusSection";
import { InvisibleWorkStrip } from "@/components/marketing/InvisibleWorkStrip";
import { PrivacyToggleDemo } from "@/components/marketing/PrivacyToggleDemo";
import { VendorLabel } from "@/components/marketing/VendorMark";
import { FrontDoorRule, ScrollCue } from "@/components/notebook/marks";
import { Button } from "@/components/ui/button";
import { startSessionReplay, stopSessionReplay } from "@/lib/posthog-client";
import { recordAnonymousEventFn } from "@/lib/telemetry.functions";

type LandingVariant = "a" | "b";

export const Route = createFileRoute("/landing-next")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { v?: "b" } => ({
    v: search.v === "b" ? "b" : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Lasso: see where every fact in a deliverable came from" },
      {
        name: "description",
        content:
          "Circle any fact in a deliverable and see exactly where it came from, across every tool your team used.",
      },
      {
        property: "og:title",
        content: "Lasso: see where every fact in a deliverable came from",
      },
      {
        property: "og:description",
        content:
          "Circle any fact in a deliverable and see exactly where it came from, across every tool your team used.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: LandingNextPage,
});

function ClipSlot({
  id,
  aspect,
  src,
  poster,
  label,
}: {
  id: "inbox" | "find-it" | "decisions" | "coach-note" | "one-on-one";
  aspect: "16 / 10" | "16 / 9";
  src?: string;
  poster?: string;
  label: string;
}) {
  if (src && poster) {
    return (
      <ClipPlayer
        src={src}
        poster={poster}
        width={aspect === "16 / 9" ? 16 : 8}
        height={aspect === "16 / 9" ? 9 : 5}
        aspect={aspect}
        label={label}
      />
    );
  }

  return (
    <div
      id={`clip-slot-${id}`}
      className="landing-next-slot flex w-full items-center justify-center rounded-[var(--radius)] border border-dashed border-rule bg-card"
      style={{ aspectRatio: aspect }}
      aria-label={`${label}. Clip coming soon.`}
    >
      <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
        {id.replaceAll("-", " ")}
      </span>
    </div>
  );
}

function LandingNextPage() {
  const { v } = Route.useSearch();
  const variant: LandingVariant = v === "b" ? "b" : "a";

  useEffect(() => {
    void recordAnonymousEventFn({
      data: {
        event_type: "landing.viewed",
        view_id: crypto.randomUUID(),
        dims: { variant, surface: "landing-next" },
      },
    }).catch(() => {
      /* This signal must never surface to the visitor. */
    });
  }, [variant]);

  useEffect(() => {
    stopSessionReplay();
    return () => startSessionReplay();
  }, []);

  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setScrolled(true);
      return;
    }
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        if (window.scrollY > 120) setScrolled(true);
      });
    };
    onScroll();
    if (!scrolled) window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, [scrolled]);

  return (
    <div className="landing-next min-h-screen overflow-x-clip bg-background">
      <div className="landing-next-loop-large fixed pointer-events-none" aria-hidden="true">
        <LassoLoopMark className="h-full w-full text-rule" />
      </div>
      <div className="landing-next-loop-small fixed pointer-events-none" aria-hidden="true">
        <LassoLoopMark className="h-full w-full text-green" drawWithScroll />
      </div>

      <div className="relative z-10">
        <PublicHeader current="/" />

        <main className="mx-auto max-w-3xl px-6 pb-24 pt-16 md:px-10 md:pt-20">
          <section>
            <h1 className="pencil-title mt-5 text-foreground">
              {variant === "b"
                ? "Your firm bought AI. Now nobody can say where a number came from."
                : "AI made knowledge work invisible. We make it audit ready and coachable."}
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground">
              {variant === "b"
                ? "Analysis, drafting and judgment happen one prompt at a time, across tools nobody keeps a copy of. Lasso keeps the record."
                : "Knowledge work is moving into LLM conversations and AI apps. Analysis, drafting and judgment happen one prompt at a time, and the reasoning behind the answer vanishes when the window closes. Not because anyone hides it, because nothing keeps it."}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild>
                <Link to="/auth" search={{ intent: "personal" }}>
                  Start your record
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/auth" search={{ intent: "company" }}>
                  Set up for a company
                </Link>
              </Button>
            </div>
            <div className="mt-14 flex justify-center">
              <ScrollCue />
            </div>
          </section>

          <FrontDoorRule className="mt-12 h-[10px] w-full" />
          <div className="mt-6 flex flex-col items-center gap-3">
            <p className="micro-label font-bold">HOW IT WORKS</p>
          </div>

          <FocusSection
            className={`mt-12 md:translate-x-8 lg:translate-x-12 ${scrolled ? "" : "landing-locked"}`}
          >
            <p className="micro-label">WHERE THE WORK NOW HAPPENS</p>
            <div className="relative h-16 md:h-8 md:-translate-x-8 lg:-translate-x-12">
              <p
                className="hand-mark hand-mark-ember absolute left-[calc((-100vw+100%)/2+1rem)] top-6"
                aria-hidden="true"
              >
                The Problem
              </p>
            </div>
            <h2 className="pencil-title mt-4">
              Work has shifted into LLMs and AI apps...The process is lost in conversational UIs
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-foreground">
              The thinking has moved. Analysis, drafting and judgment now happen inside ChatGPT,
              Claude, Gemini and Lovable, one prompt at a time, spread across products nobody keeps a
              copy of. The reasoning that shaped the answer scrolls away the moment the window closes.
            </p>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
              What ships is the deliverable. What is lost is how it was made, what it was based on,
              and what a colleague could have learned from it.
            </p>
            <div className="mt-10 grid grid-cols-2 gap-x-3 gap-y-12 sm:gap-x-5 sm:gap-y-14">
              <div className="sm:-rotate-[0.6deg]">
                <VendorLabel vendor="chatgpt" name="ChatGPT" />
                <ClipPlayer src="/videos/lasso-chatgpt.mp4" poster="/videos/poster-chatgpt.jpg" width={720} height={672} cover aspect="4 / 3" group="llm-products" label="Work happening inside ChatGPT" />
              </div>
              <div className="sm:rotate-[0.5deg] sm:translate-y-5">
                <VendorLabel vendor="claude" name="Claude" />
                <ClipPlayer src="/videos/lasso-claude.mp4" poster="/videos/poster-claude.jpg" width={720} height={672} cover aspect="5 / 4" group="llm-products" label="Work happening inside Claude" />
              </div>
              <div className="sm:rotate-[0.4deg]">
                <VendorLabel vendor="gemini" name="Gemini" />
                <ClipPlayer src="/videos/lasso-gemini.mp4" poster="/videos/poster-gemini.jpg" width={720} height={374} cover aspect="5 / 4" group="llm-products" label="Work happening inside Gemini" />
              </div>
              <div className="sm:-rotate-[0.5deg] sm:translate-y-5">
                <VendorLabel vendor="lovable" name="Lovable" />
                <ClipPlayer src="/videos/lasso-lovable.mp4" poster="/videos/poster-lovable.jpg" width={720} height={374} cover aspect="4 / 3" group="llm-products" label="Work happening inside Lovable" />
              </div>
            </div>
          </FocusSection>

          <FocusSection className="mt-24 md:-mx-24 lg:-mx-36">
            <p className="micro-label">THE GAP</p>
            <h2 className="pencil-title mt-4">The output is the only part that survives</h2>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-foreground">
              Every tool feeds the work. The deliverable comes out clean and shareable, while the
              judgment, the decisions, the drafts and the process behind it stay out of reach.
            </p>
            <div className="mt-8 grid gap-8 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center md:gap-10 lg:gap-14">
              <InvisibleWorkStrip />
              <div className="flex items-center justify-center py-2 md:py-0" aria-hidden="true">
                <svg viewBox="0 0 48 48" className="h-10 w-10 rotate-90 text-graphite md:h-12 md:w-12 md:rotate-0" fill="none">
                  <path d="M6 24c10.5-.5 22.5-1 34-1M34 15l9 9-9 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <p className="micro-label mb-3">WHAT COMES OUT</p>
                <ClipPlayer src="/videos/lasso-clean-output.mp4" poster="/videos/poster-clean-output.jpg" width={1280} height={716} group="clean-output" label="A finished deliverable, clean and shareable" />
              </div>
            </div>
          </FocusSection>

          <FocusSection className="landing-next-beat landing-next-beat-left mt-28">
            <p className="micro-label">WHAT LANDS</p>
            <h2 className="pencil-title mt-4">Everything you made this week, in one inbox</h2>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-foreground">
              Chats, files, calls and drafts arrive as they happen. You shape them into work, or
              leave them. Nothing is lost, nothing is required.
            </p>
            <div className="mt-8"><ClipSlot id="inbox" aspect="16 / 10" label="Work arriving in one inbox" /></div>
          </FocusSection>

          <FocusSection className="landing-next-beat landing-next-beat-right mt-28 md:-mx-24 lg:-mx-36">
            <p className="micro-label">FIND IT</p>
            <div className="relative h-16 md:h-8">
              <p className="hand-mark hand-mark-blue absolute right-[calc((-100vw+100%)/2+1rem)] top-6 max-w-64 text-right" aria-hidden="true">
                the one thing nobody else can show
              </p>
            </div>
            <h2 className="pencil-title mt-4">Circle any fact. See where it came from.</h2>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-foreground">
              Drop a deck on the canvas. The conversations that fed it come forward with the exact
              sentence, quoted, and why.
            </p>
            <div className="mt-8"><ClipSlot id="find-it" aspect="16 / 9" label="Finding the source behind a fact" /></div>
          </FocusSection>

          <FocusSection className="landing-next-beat landing-next-beat-left mt-28">
            <p className="micro-label">DECISIONS</p>
            <h2 className="pencil-title mt-4">The decisions you made, written down before you forget them</h2>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-foreground">
              Lasso drafts the decision from the conversation. You confirm it or discard it. A
              firm's judgment stops living in chat scroll.
            </p>
            <div className="mt-8"><ClipSlot id="decisions" aspect="16 / 10" label="A decision drafted from a conversation" /></div>
          </FocusSection>

          <FocusSection className="landing-next-beat landing-next-beat-right mt-28">
            <p className="micro-label">YOUR COACH</p>
            <h2 className="pencil-title mt-4">A note in the margin, not a report on you</h2>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-foreground">
              A coach picks one piece of work and writes to you about it. It shows up as a circle,
              opens as a conversation, and you write back.
            </p>
            <div className="mt-8 grid items-center gap-8 md:grid-cols-[var(--landing-coach-art)_minmax(0,1fr)]">
              <div className="landing-next-coach-art relative mx-auto" aria-hidden="true">
                <LassoLoopMark className="h-full w-full text-green" />
                <img src={coachSpider.url} alt="" className="landing-next-coach-spider absolute" />
              </div>
              <ClipSlot id="coach-note" aspect="16 / 10" label="A coach note opening as a conversation" />
            </div>
          </FocusSection>

          <FocusSection className="landing-next-beat landing-next-beat-left mt-28">
            <p className="micro-label">1:1 PREP</p>
            <h2 className="pencil-title mt-4">Walk into the 1:1 at minute zero</h2>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-foreground">
              A date, a few stickies, and the work behind them. Twenty minutes of reconstruction
              becomes a conversation about the judgment call.
            </p>
            <div className="mt-8"><ClipSlot id="one-on-one" aspect="16 / 10" label="Preparing work for a one to one" /></div>
          </FocusSection>

          <FocusSection className="landing-next-beat landing-next-beat-right mt-20 border-t border-rule pt-10 md:translate-x-10 lg:translate-x-16">
            <p className="micro-label">WHAT ACCUMULATES</p>
            <h2 className="pencil-title mt-4">A library your team can learn from</h2>
            <p className="mt-5 text-base leading-relaxed text-foreground">
              Every finished piece of work keeps the record of how it was made. Over an engagement,
              then a practice, then a firm, those records become something a firm can actually learn
              from: how this kind of analysis gets built here, what the good version looked like,
              which claims held up.
            </p>
            <p className="mt-4 text-base leading-relaxed text-foreground">
              The work belongs to the people who did it. What the firm sees is the work they chose to
              place there, never a feed of what anyone is doing.
            </p>
            <figure className="mt-8">
              <img src={pastWorkLibrary.url} alt="A firm library of finished work, searchable by describing what you are working on" width={1962} height={1174} loading="lazy" decoding="async" className="w-full rounded-[var(--radius)] border border-rule shadow-card" />
            </figure>
          </FocusSection>

          <FocusSection className="landing-next-beat landing-next-beat-left mt-20 border-t border-rule pt-10 md:-translate-x-10 lg:-translate-x-16">
            <p className="micro-label">PRIVACY, DEMONSTRATED</p>
            <h2 className="pencil-title mt-4">What a coach sees.</h2>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-foreground">
              Your work is private by default. You choose what to share with a <strong className="font-semibold text-foreground">manager</strong>, <strong className="font-semibold text-foreground">coach</strong> or enablement lead, and they see only that, so the conversation is about learning, development and getting better at AI shaped work.
            </p>
            <div className="mt-8"><PrivacyToggleDemo /></div>
          </FocusSection>

          <div className="mt-16 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link to="/auth" search={{ intent: "personal" }} className="font-mono text-[11px] uppercase tracking-[0.08em] text-ember-deep transition-colors hover:text-foreground">
              Start my own record →
            </Link>
            <a href="mailto:liam@charlotte-labs.com" className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground">
              Talk to Liam
            </a>
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
            <Link to="/auth" className="transition-colors hover:text-foreground">Sign in</Link>
          </nav>
        </footer>
      </div>
    </div>
  );
}