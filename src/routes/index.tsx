import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect } from "react";

import { PublicHeader } from "@/components/layout/PublicHeader";
import { LassoLogo } from "@/components/layout/LassoLogo";
import { PrivacyToggleDemo } from "@/components/marketing/PrivacyToggleDemo";
import { Button } from "@/components/ui/button";
import { fetchProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { logEvent } from "@/lib/telemetry";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
    if (data.user) throw redirect({ to: "/overview" });
  },
  head: () => ({
    meta: [
      { title: "Lasso: Turn AI usage into AI ability" },
      {
        name: "description",
        content:
          "Lasso is the record of your AI work that you own, and the coaching that makes it compound. Individuals build it. Teams get better because of it.",
      },
      { property: "og:title", content: "Lasso: Turn AI usage into AI ability" },
      {
        property: "og:description",
        content:
          "Lasso is the record of your AI work that you own, and the coaching that makes it compound. Individuals build it. Teams get better because of it.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LandingPage,
});

const ORG_POINTS: string[] = [
  "Coaching lands on actual work from this week, not exercises.",
  "Each person owns their record and chooses what to share. That is why they adopt it, and adoption is where development budgets usually die.",
  "You see coaching activity and aggregate patterns, never individual files.",
];

const TRUST_ITEMS: string[] = [
  "Private by default",
  "No admin access to anyone's content",
  "Your record leaves with you",
  "Telemetry is counts, never content",
];

function LandingPage() {
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session || cancelled) return;
      const profile = await fetchProfile().catch(() => null);
      if (!profile || cancelled) return;
      logEvent("landing.viewed", profile.org_id, {});
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader current="/" />

      <main className="mx-auto max-w-5xl px-6 pb-20 md:px-10">
        <section className="grid items-center gap-8 pt-14 md:grid-cols-[minmax(0,1fr)_auto] md:pt-20">
          <div>
            <p className="micro-label">Your team already works with AI.</p>
            <h1 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight text-foreground md:text-5xl">
              Turn AI usage into AI ability.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
              Lasso is the record of your AI work that you own, and the coaching that makes it
              compound. Individuals build it. Teams get better because of it.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild>
                <Link to="/auth" search={{ intent: "personal" }}>
                  Start your record
                </Link>
              </Button>
              <Button asChild variant="outline">
                <a href="#for-organizations">Bring Lasso to your team</a>
              </Button>
            </div>
          </div>
          <LassoLogo size="xl" className="justify-self-center" />
        </section>

        <section className="mt-20 border-t border-border pt-10">
          <p className="micro-label">The problem</p>
          <h2 className="mt-4 max-w-2xl text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            Invisible AI is already doing visible work.
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
            It happens in chat windows, ships inside deliverables, and vanishes. Not because people
            hide it. Because nothing keeps it. The skill building up in your team has no record, no
            coach, and no owner.
          </p>
          <p
            className="mt-6 max-w-2xl border-l-[3px] pl-5 text-lg leading-relaxed text-foreground md:text-xl"
            style={{ borderColor: "var(--ember)" }}
          >
            Lasso gives AI work a home its owner controls. Visible to a coach when shared. Invisible
            to everyone when not.
          </p>
        </section>

        <section className="mt-20 border-t border-border pt-10">
          <p className="micro-label">Privacy, demonstrated</p>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            What a coach sees.
          </h2>
          <div className="mt-8">
            <PrivacyToggleDemo />
          </div>
        </section>

        <section
          id="for-organizations"
          className="mt-20 scroll-mt-8 border-t border-border pt-10"
        >
          <p className="micro-label">For organizations</p>
          <h2 className="mt-4 max-w-2xl text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            The coaching layer for AI work.
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
            Your people already use AI every day. What they&apos;re missing is the loop that turns
            use into judgment: a coach who sees the real work and makes the next decision better.
          </p>
          <ul className="mt-6 max-w-2xl space-y-3">
            {ORG_POINTS.map((point) => (
              <li key={point} className="flex gap-3 text-sm leading-relaxed text-foreground">
                <span aria-hidden style={{ color: "var(--state-teal)" }}>
                  ◆
                </span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
          <p className="mt-6 max-w-2xl rounded-[var(--radius)] border border-border bg-card p-5 text-sm leading-relaxed text-muted-foreground shadow-card">
            Coaches see which AI produced the work by default, so feedback can fit the tool. Want
            tool-blind review instead? Vendor-neutral mode is an org setting, chosen with us at
            implementation, and every member is told before it ever changes.
          </p>
          <div className="mt-6">
            <Button asChild>
              <Link to="/auth" search={{ intent: "company" }}>
                Set up for a company
              </Link>
            </Button>
          </div>
        </section>

        <section className="mt-20 border-t border-border pt-10">
          <p className="micro-label">For individuals</p>
          <h2 className="mt-4 text-xl font-semibold tracking-tight text-foreground md:text-2xl">
            Your judgment, on the record.
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Capture from any AI you use. Map what matters. Get coached on the decisions you actually
            made. Keep the record when you change jobs.
          </p>
          <Link
            to="/auth"
            search={{ intent: "personal" }}
            className="mt-5 inline-block font-mono text-[11px] uppercase tracking-[0.08em] text-ember-deep transition-colors hover:text-foreground"
          >
            Start my own record →
          </Link>
        </section>

        <section
          className="mt-20 rounded-[var(--radius)] px-6 py-8"
          style={{ background: "var(--ember-wash)" }}
        >
          <p className="mx-auto max-w-3xl text-center text-base leading-relaxed text-foreground">
            The cost of AI training is not the license. It is the gap between a course and changed
            behavior. Coaching on real work closes it.
          </p>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-5xl px-6 py-8 md:px-10">
          <ul className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {TRUST_ITEMS.map((item, i) => (
              <li
                key={item}
                className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground"
              >
                {i > 0 ? <span aria-hidden>·</span> : null}
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
              Lasso by Charlotte Labs
            </p>
            <div className="flex flex-wrap items-center gap-5">
              <Link
                to="/why"
                className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:text-foreground"
              >
                Why Lasso
              </Link>
              <Link
                to="/trust"
                className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:text-foreground"
              >
                Trust &amp; data
              </Link>
              <Link
                to="/auth"
                className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:text-foreground"
              >
                Feedback
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
