import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { PublicHeader } from "@/components/layout/PublicHeader";
import { ClipPlayer } from "@/components/marketing/ClipPlayer";
import { FocusSection } from "@/components/marketing/FocusSection";
import { InvisibleWorkStrip } from "@/components/marketing/InvisibleWorkStrip";
import { PrivacyToggleDemo } from "@/components/marketing/PrivacyToggleDemo";
import { VendorLabel } from "@/components/marketing/VendorMark";
import pastWorkLibrary from "@/assets/past-work-library.png.asset.json";
import { FrontDoorRule, ScrollCue } from "@/components/notebook/marks";
import { Button } from "@/components/ui/button";
import { startSessionReplay, stopSessionReplay } from "@/lib/posthog-client";

/**
 * Draft of the next landing page. Lives at /next so `/` is untouched while this
 * is being judged.
 *
 * Sections 1 to 4 are a deliberate copy of the live page: the hero, the pencil
 * rule, the problem state and the gap, including all four LLM product clips.
 * Those are settled and must not drift from `/`.
 *
 * Sections 5 onward are new. Two changes of substance beyond copy: VERIFICATION
 * and SOURCES are merged into one section, because both answer "can I trace
 * this" and reading them as two near-identical blocks flattened them; and the
 * page now closes on a real call to action instead of a single text link.
 *
 * WHAT ACCUMULATES still shows the static library image. That is the one slot
 * earmarked for a Figma timeline export, since it is the only conceptual claim
 * on the page and the only section with no motion of its own.
 *
 * No `landing.viewed` event is emitted here on purpose. See the route options.
 */
export const Route = createFileRoute("/next")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Lasso draft: see where every fact in a deliverable came from" },
      { name: "robots", content: "noindex, nofollow" },
      {
        name: "description",
        content:
          "Circle any fact in a deliverable and see exactly where it came from, across every tool your team used.",
      },
    ],
  }),
  component: LandingDraft,
});

function LandingDraft() {
  // Anonymous visitors to a public page are not recorded. Kept from the live
  // page. The landing.viewed event is deliberately absent: this is a draft, and
  // counting views of it would pollute the funnel.
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
        {/* 1 · Hero. Unchanged from the live page. */}
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

        {/* 2 · A pencilled stroke closes the pitch and opens the story. Unchanged. */}
        <FrontDoorRule className="mt-12 h-[10px] w-full" />

        <div className="mt-6 flex flex-col items-center gap-3">
          <p className="micro-label font-bold">HOW IT WORKS</p>
        </div>

        {/* 3 · The problem state and the four LLM product clips. Unchanged. */}
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
          <h2 className="pencil-title mt-4">Work has shifted into LLMs and AI apps...The process is lost in conversational UIs</h2>
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

        {/* 4 · The gap. Unchanged. */}
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
              <svg
                viewBox="0 0 48 48"
                className="h-10 w-10 rotate-90 text-graphite md:h-12 md:w-12 md:rotate-0"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M6 24c10.5-.5 22.5-1 34-1M34 15l9 9-9 9"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <div>
              <p className="micro-label mb-3">WHAT COMES OUT</p>
              <ClipPlayer
                src="/videos/lasso-clean-output.mp4"
                poster="/videos/poster-clean-output.jpg"
                width={1280}
                height={716}
                group="clean-output"
                label="A finished deliverable, clean and shareable"
              />
            </div>
          </div>
        </FocusSection>

        {/* ---- Everything below here is new. ---- */}

        {/* 5 · The record. The core claim, kept as its own beat. */}
        <FocusSection className="mt-28 md:-translate-x-24 lg:-translate-x-32">
          <div className="relative h-12 md:h-0 md:translate-x-24 lg:translate-x-32">
            <p
              className="hand-mark hand-mark-blue absolute left-[calc((-100vw+100%)/2+1rem)] -top-1 md:-top-12"
              aria-hidden="true"
            >
              With Lasso
            </p>
          </div>
          <p className="micro-label">THE RECORD</p>
          <h2 className="pencil-title mt-4">How the work was made, kept</h2>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-foreground">
            Every deliverable carries the record of how it was made. The chats, the documents, the
            transcripts and the notes, in the order the work actually happened.
          </p>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
            Lasso reads only the tools you connect yourself, and only the work you point it at.
          </p>
          <div className="mt-8">
            <ClipPlayer
              src="/videos/lasso-work-artifact.mp4"
              poster="/videos/poster-work-artifact.jpg"
              width={1280}
              height={776}
              label="A deliverable with the record of how it was made"
            />
          </div>
        </FocusSection>

        {/* 6 · Verification and sources, merged. Both answer "can I trace this",
            and as two separate blocks they read as the same section twice. */}
        <FocusSection className="mt-28 md:translate-x-16 lg:translate-x-24">
          <p className="micro-label">WHAT YOU CAN ASK OF IT</p>
          <h2 className="pencil-title mt-4">Two questions the record can answer</h2>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-foreground">
            A record is only worth keeping if you can interrogate it. These are the two questions
            that come up before anyone signs off on a piece of work.
          </p>

          <div className="mt-10">
            <p className="micro-label">WHICH NUMBERS WERE CHECKED</p>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Every claim is listed with its status, so you can see what was verified, what was not,
              and the exact check to run for each one.
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
          </div>

          <div className="mt-14">
            <p className="micro-label">WHAT FED THIS</p>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Open a finished deliverable and see which conversations, transcripts and documents fed
              it. Any figure or recommendation traces back to the material behind it, line by line.
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
          </div>
        </FocusSection>

        {/* 7 · What accumulates. Condensed from three paragraphs to a lead plus
            three scannable lines. The image here is the slot earmarked for a
            Figma timeline export. */}
        <FocusSection className="mt-24 border-t border-rule pt-10 md:translate-x-10 lg:translate-x-16">
          <p className="micro-label">WHAT ACCUMULATES</p>
          <h2 className="pencil-title mt-4">A library your team can learn from</h2>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-foreground">
            Every finished piece of work leaves a trace of how it was made. Over an engagement, then
            a practice, then a firm, those traces become something a firm can actually learn from.
          </p>
          <ul className="mt-6 space-y-3">
            <li className="flex gap-3 text-base leading-relaxed text-foreground">
              <span className="mt-1 font-mono text-[11px] text-muted-foreground" aria-hidden="true">
                01
              </span>
              <span>New joiners ramp up on real examples instead of folklore.</span>
            </li>
            <li className="flex gap-3 text-base leading-relaxed text-foreground">
              <span className="mt-1 font-mono text-[11px] text-muted-foreground" aria-hidden="true">
                02
              </span>
              <span>
                Teams see the prompts, sources and moves that produced the best work, and reuse
                them.
              </span>
            </li>
            <li className="flex gap-3 text-base leading-relaxed text-foreground">
              <span className="mt-1 font-mono text-[11px] text-muted-foreground" aria-hidden="true">
                03
              </span>
              <span>
                Leaders get a living picture of where AI genuinely helps, so the next project starts
                from the firm's best attempt rather than a blank page.
              </span>
            </li>
          </ul>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground">
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

        {/* 8 · Privacy, demonstrated. The interactive proof, kept as is. */}
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

        {/* 9 · A real close. The live page ends on a single text link. */}
        <FocusSection className="mt-24 border-t border-rule pt-10">
          <p className="micro-label">START</p>
          <h2 className="pencil-title mt-4">Start with one deliverable</h2>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-foreground">
            Connect one tool, map one piece of work, and look at the record it produces. Nothing is
            captured unless you point Lasso at it.
          </p>
          <ul className="mt-6 space-y-2">
            <li className="text-base leading-relaxed text-muted-foreground">
              It does not score you or rank you.
            </li>
            <li className="text-base leading-relaxed text-muted-foreground">
              It does not measure your pace or your effort.
            </li>
            <li className="text-base leading-relaxed text-muted-foreground">
              You see every note written about your work.
            </li>
          </ul>
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
        </FocusSection>
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
            Trust &amp; data
          </Link>
          <Link to="/auth" className="transition-colors hover:text-foreground">
            Sign in
          </Link>
        </nav>
      </footer>
    </div>
  );
}
