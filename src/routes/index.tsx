import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { PublicHeader } from "@/components/layout/PublicHeader";
import { ClipPlayer } from "@/components/marketing/ClipPlayer";
import { FocusSection } from "@/components/marketing/FocusSection";
import { PrivacyToggleDemo } from "@/components/marketing/PrivacyToggleDemo";
import { VendorLabel } from "@/components/marketing/VendorMark";
import pastWorkLibrary from "@/assets/past-work-library.png.asset.json";
import { FrontDoorRule, ScrollCue } from "@/components/notebook/marks";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { startSessionReplay, stopSessionReplay } from "@/lib/posthog-client";
import { recordAnonymousEventFn } from "@/lib/telemetry.functions";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
    if (data.user) throw redirect({ to: "/overview" });
  },
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
    ],
  }),
  component: LandingPage,
});



function LandingPage() {
  // Content-free, and unchanged from the existing landing signal.
  useEffect(() => {
    void recordAnonymousEventFn({
      data: { event_type: "landing.viewed", view_id: crypto.randomUUID(), dims: {} },
    }).catch(() => {
      /* telemetry must never surface to the user */
    });
  }, []);

  // Anonymous visitors to this public page are not recorded.
  useEffect(() => {
    stopSessionReplay();
    return () => startSessionReplay();
  }, []);

  // The story below the fold stays blurred until the visitor actually scrolls.
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
    <div className="min-h-screen bg-background">
      <PublicHeader current="/" />

      <main className="mx-auto max-w-3xl px-6 pb-24 pt-16 md:px-10 md:pt-20">
        <section>
          <h1 className="pencil-title mt-5 text-foreground">
            AI made knowledge work invisible. We make it audit ready and coachable.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground">
            Knowledge work is moving into LLM conversations and AI apps. Analysis, drafting and
            judgment happen one prompt at a time, and the reasoning behind the answer vanishes when
            the window closes. Not because anyone hides it, because nothing keeps it.
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

        {/* A pencilled stroke closes the pitch and opens the story. */}
        <FrontDoorRule className="mt-12 h-[10px] w-full" />

        <div className="mt-6 flex flex-col items-center gap-3">
          <p className="micro-label font-bold">HOW IT WORKS</p>
        </div>

        <FocusSection
          className={`mt-12 md:translate-x-8 lg:translate-x-12 ${scrolled ? "" : "landing-locked"}`}
        >
          <p className="micro-label">WHERE THE WORK NOW HAPPENS</p>
          <p
            className="hand-mark hand-mark-ember -ml-2 mt-6 md:-ml-10 lg:-ml-16"
            aria-hidden="true"
          >
            The Problem
          </p>
          <h2 className="pencil-title mt-4">Where the work now happens</h2>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-foreground">
            The thinking has moved. Analysis, drafting and judgment now happen inside ChatGPT,
            Claude, Gemini and Lovable, one prompt at a time, spread across products nobody keeps a
            copy of. The reasoning that shaped the answer scrolls away the moment the window closes.
          </p>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
            What ships is the deliverable. What is lost is how it was made, what it was based on,
            and what a colleague could have learned from it.
          </p>
          {/* A loose collage: each tile labelled with its product, offset off the grid. */}
          <div className="mt-10 grid grid-cols-2 gap-x-3 gap-y-12 sm:gap-x-5 sm:gap-y-14">
            <div className="sm:-rotate-[0.6deg]">
              <VendorLabel vendor="chatgpt" name="ChatGPT" />
              <ClipPlayer
                src="/videos/lasso-chatgpt.mp4"
                poster="/videos/poster-chatgpt.jpg"
                width={720}
                height={672}
                cover
                aspect="4 / 3"
                group="llm-products"
                label="Work happening inside ChatGPT"
              />
            </div>
            <div className="sm:rotate-[0.5deg] sm:translate-y-5">
              <VendorLabel vendor="claude" name="Claude" />
              <ClipPlayer
                src="/videos/lasso-claude.mp4"
                poster="/videos/poster-claude.jpg"
                width={720}
                height={672}
                cover
                aspect="5 / 4"
                group="llm-products"
                label="Work happening inside Claude"
              />
            </div>
            <div className="sm:rotate-[0.4deg]">
              <VendorLabel vendor="gemini" name="Gemini" />
              <ClipPlayer
                src="/videos/lasso-gemini.mp4"
                poster="/videos/poster-gemini.jpg"
                width={720}
                height={374}
                cover
                aspect="5 / 4"
                group="llm-products"
                label="Work happening inside Gemini"
              />
            </div>
            <div className="sm:-rotate-[0.5deg] sm:translate-y-5">
              <VendorLabel vendor="lovable" name="Lovable" />
              <ClipPlayer
                src="/videos/lasso-lovable.mp4"
                poster="/videos/poster-lovable.jpg"
                width={720}
                height={374}
                cover
                aspect="4 / 3"
                group="llm-products"
                label="Work happening inside Lovable"
              />
            </div>
          </div>
        </FocusSection>

        <FocusSection className="mt-28 md:-translate-x-24 lg:-translate-x-32">
          <p
            className="hand-mark hand-mark-blue -ml-2 -mt-3 md:-ml-10 lg:-ml-16"
            aria-hidden="true"
          >
            With Lasso
          </p>
          <p className="micro-label">THE RECORD</p>
          <h2 className="pencil-title mt-4">How the work was made</h2>

          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Every deliverable carries the record of how it was made. Email, chats, drive, in the
            order the work actually happened.
          </p>
          <div className="mt-4">
            <ClipPlayer
              src="/videos/lasso-work-artifact.mp4"
              poster="/videos/poster-work-artifact.jpg"
              width={1280}
              height={776}
              label="A deliverable with the record of how it was made"
            />
          </div>
        </FocusSection>

        <FocusSection className="mt-28 md:translate-x-24 lg:translate-x-32">
          <p className="micro-label">VERIFICATION</p>
          <h2 className="pencil-title mt-4">What has not been verified</h2>

          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Every claim in a deliverable is listed with its status, so you can see which numbers
            were verified, which were not, and the exact check to run for each one.
          </p>
          <div className="mt-4">
            <ClipPlayer
              src="/videos/lasso-fact-check.mp4"
              poster="/videos/poster-fact-check.jpg"
              width={1280}
              height={832}
              label="A deliverable listing unverified claims and the check to run for each"
            />
          </div>
        </FocusSection>

        <FocusSection className="mt-28 md:-translate-x-24 lg:-translate-x-32">
          <p className="micro-label">SOURCES</p>
          <h2 className="pencil-title mt-4">What chats fed this deliverable</h2>

          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Open a finished deliverable and see exactly which conversations, transcripts and
            documents fed it. Each section links back to the source it came from, so any figure or
            recommendation can be traced to the material behind it and verified line by line.
          </p>
          <div className="mt-4">
            <ClipPlayer
              src="/videos/lasso-what-fed-this.mp4"
              poster="/videos/poster-what-fed-this.jpg"
              width={2692}
              height={1520}
              label="Tracing a deliverable back to the chats and documents that fed it"
            />
          </div>
        </FocusSection>


        <FocusSection className="mt-20 border-t border-rule pt-10 md:translate-x-10 lg:translate-x-16">
          <p className="micro-label">WHAT ACCUMULATES</p>
          <h2 className="pencil-title mt-4">A library your team can learn from</h2>
          <p className="mt-5 text-base leading-relaxed text-foreground">
            Every finished piece of work leaves a trace of how it was made. Over an engagement, then
            a practice, then a firm, those traces become something a firm can actually learn from:
            how this kind of analysis gets built here, what the good version looked like, which
            claims held up.
          </p>
          <p className="mt-4 text-base leading-relaxed text-foreground">
            New joiners ramp up on real examples instead of folklore. Teams see the prompts, sources
            and moves that produced the best work, and reuse them. Leaders get a living picture of
            where AI genuinely helps, so the next project starts from the firm's best attempt rather
            than a blank page.
          </p>
          <p className="mt-4 text-base leading-relaxed text-foreground">
            The work belongs to the people who did it. What the firm sees is the work they chose to
            place there, never a feed of what anyone is doing.
          </p>
          <figure className="mt-8">
            <img
              src={pastWorkLibrary.url}
              alt="A firm library of shipped work, searchable by describing what you are working on"
              width={1962}
              height={1174}
              loading="lazy"
              decoding="async"
              className="w-full rounded-[var(--radius)] border border-rule shadow-card"
            />
          </figure>
        </FocusSection>

        <FocusSection className="mt-20 border-t border-rule pt-10 md:-translate-x-10 lg:-translate-x-16">
          <p className="micro-label">PRIVACY, DEMONSTRATED</p>
          <h2 className="pencil-title mt-4">What a coach sees.</h2>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-foreground">
            Your work is private by default. You choose what to share with a{" "}
            <strong className="font-semibold text-foreground">manager</strong>,{" "}
            <strong className="font-semibold text-foreground">coach</strong> or enablement lead, and
            they see only that, so the conversation is about learning, development and getting
            better at AI shaped work.
          </p>
          <div className="mt-8">
            <PrivacyToggleDemo />
          </div>
        </FocusSection>



        <div className="mt-16">
          <Link
            to="/auth"
            search={{ intent: "personal" }}
            className="inline-block font-mono text-[11px] uppercase tracking-[0.08em] text-ember-deep transition-colors hover:text-foreground"
          >
            Start my own record →
          </Link>
        </div>
      </main>

      <footer className="border-t border-rule">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-4 gap-y-2 px-6 py-8 font-mono text-[11px] text-muted-foreground md:px-10">
          <span>Charlotte Labs</span>
          <a
            href="https://charlotte-labs.com"
            className="underline underline-offset-4 transition-colors hover:text-foreground"
          >
            charlotte-labs.com
          </a>
          <a
            href="mailto:liam@charlotte-labs.com"
            className="underline underline-offset-4 transition-colors hover:text-foreground"
          >
            liam@charlotte-labs.com
          </a>
          <a
            href="https://www.linkedin.com/company/charlotte-labs"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-4 transition-colors hover:text-foreground"
          >
            LinkedIn
          </a>
        </div>
        <nav className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-5 gap-y-2 px-6 pb-8 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground md:px-10">
          <Link to="/why" className="transition-colors hover:text-foreground">
            Why Lasso
          </Link>
          <Link to="/trust" className="transition-colors hover:text-foreground">
            Trust & data
          </Link>
          <Link to="/auth" className="transition-colors hover:text-foreground">
            Sign in
          </Link>
        </nav>
      </footer>
    </div>
  );
}
