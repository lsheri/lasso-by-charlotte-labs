import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect } from "react";

import { PublicHeader } from "@/components/layout/PublicHeader";
import { ClipPlayer } from "@/components/marketing/ClipPlayer";
import { PrivacyToggleDemo } from "@/components/marketing/PrivacyToggleDemo";
import { GraphiteRule } from "@/components/notebook/marks";
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

const TRUST_LINES: string[] = [
  "Private by default. Work you do not place stays private.",
  "Nobody is scored. There is no rating, ranking, or percentage about any person.",
  "You own your record. It travels with you.",
];

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

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader current="/" />

      <main className="mx-auto max-w-3xl px-6 pb-24 pt-16 md:px-10 md:pt-20">
        <section>
          
          <h1 className="mt-5 text-2xl font-bold leading-snug tracking-tight text-foreground md:text-4xl">
            AI made knowledge work invisible. We make it audit ready and coachable.
          </h1>
          <GraphiteRule animated className="mt-3 h-[6px] w-full max-w-xl text-graphite" />
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground">
            AI work happens in chat windows, ships inside deliverables, and vanishes. Not because
            anyone hides it, because nothing keeps it.
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
        </section>

<section className="mt-14 md:-translate-x-24 lg:-translate-x-32">
          <p className="text-sm leading-relaxed text-muted-foreground">
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
        </section>

        <section className="mt-14 md:translate-x-24 lg:translate-x-32">
          <p className="text-sm leading-relaxed text-muted-foreground">
            The record also shows what was never checked, and what to run to check it.
          </p>
          <div className="mt-4">
            <ClipPlayer
              src="/videos/lasso-fact-check.mp4"
              poster="/videos/poster-fact-check.jpg"
              width={1280}
              height={832}
              label="A deliverable showing which claims were never checked"
            />
          </div>
        </section>

        <p className="mt-5 font-mono text-[11px] text-soft">
          Sample data from a test engagement. Not client work.
        </p>

        <section className="mt-20 border-t border-rule pt-10">
          <p className="micro-label">WHAT ACCUMULATES</p>
          <p className="mt-5 text-base leading-relaxed text-foreground">
            Every finished piece of work leaves a trace of how it was made. Over an engagement, then
            a practice, then a firm, those traces become something a firm can actually learn from:
            how this kind of analysis gets built here, what the good version looked like, which
            claims held up.
          </p>
          <p className="mt-4 text-base leading-relaxed text-foreground">
            The work belongs to the people who did it. What the firm sees is the work they chose to
            place there, never a feed of what anyone is doing.
          </p>
        </section>

        <section className="mt-20 border-t border-rule pt-10">
          <p className="micro-label">PRIVACY, DEMONSTRATED</p>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            What a coach sees.
          </h2>
          <div className="mt-8">
            <PrivacyToggleDemo />
          </div>
        </section>

        <section className="mt-16 border-t border-rule pt-10">
          <p className="micro-label">HOW IT WORKS</p>
          <div className="mt-5 space-y-3">
            {TRUST_LINES.map((line) => (
              <p key={line} className="text-base leading-relaxed text-foreground">
                {line}
              </p>
            ))}
          </div>
        </section>

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
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-3 gap-y-2 px-6 py-8 font-mono text-[11px] text-muted-foreground md:px-10">
          <span>Charlotte Labs · hello@charlotte-labs.com</span>
          <a
            href="https://charlotte-labs.com"
            className="underline underline-offset-4 transition-colors hover:text-foreground"
          >
            charlotte-labs.com
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
