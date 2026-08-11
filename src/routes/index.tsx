import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect } from "react";

import { PublicHeader } from "@/components/layout/PublicHeader";
import { LassoLogo } from "@/components/layout/LassoLogo";
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
      { title: "Lasso — Your AI work, on the record" },
      {
        name: "description",
        content:
          "Lasso captures the real work you do with AI into a record you own, organize, and choose to share.",
      },
      { property: "og:title", content: "Lasso — Your AI work, on the record" },
      {
        property: "og:description",
        content:
          "Lasso captures the real work you do with AI into a record you own, organize, and choose to share.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LandingPage,
});

const STEPS: [string, string][] = [
  [
    "Capture",
    "Bring in your AI threads and files — paste, export, or connect. Nothing is imported unless you select it.",
  ],
  ["Organize", "Map work to real engagements. Confirm the sequence it actually happened in."],
  ["Share on your terms", "Invite a coach into exactly what you choose. Private stays private."],
];

const AUDIENCES: {
  intent: "company" | "personal" | "invite";
  title: string;
  body: string;
  cta: string;
}[] = [
  {
    intent: "company",
    title: "For my company",
    body: "Your organization owns the tenancy. Each person's work stays private to them.",
    cta: "Set up for a company",
  },
  {
    intent: "personal",
    title: "Just for me",
    body: "Your work, your record. You own everything here.",
    cta: "Start my own record",
  },
  {
    intent: "invite",
    title: "I have an invite",
    body: "Coach or teammate — your link drops you straight into context.",
    cta: "Use my invite",
  },
];

const TRUST_LINES: string[] = [
  "Consent-first capture",
  "We never train on your content",
  "Admins never see anyone's work",
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
          <p className="micro-label">Lasso by Charlotte Labs</p>
          <h1 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight text-foreground md:text-5xl">
            Your AI work, on the record.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
            Lasso captures the real work you do with AI — across every tool — into a record you own,
            organize, and choose to share.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild>
              <Link to="/auth" search={{ intent: "personal" }}>
                Get started
              </Link>
            </Button>
            <Button asChild variant="outline">
              <a href="#who-its-for">For companies</a>
            </Button>
          </div>
          </div>
          <LassoLogo size="xl" className="justify-self-center" />
        </section>

        <section className="mt-20 border-t border-border pt-10">
          <p className="micro-label">How it works</p>
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {STEPS.map(([title, body], i) => (
              <div
                key={title}
                className="rounded-[var(--radius)] border border-border bg-card p-5 shadow-card"
              >
                <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                  {String(i + 1).padStart(2, "0")}
                </p>
                <p className="mt-3 text-sm font-medium text-foreground">{title}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="who-its-for" className="mt-20 scroll-mt-8 border-t border-border pt-10">
          <p className="micro-label">Who it&apos;s for</p>
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {AUDIENCES.map((card) => (
              <div
                key={card.intent}
                className="flex flex-col rounded-[var(--radius)] border border-border bg-card p-5 shadow-card"
              >
                <p className="text-sm font-medium text-foreground">{card.title}</p>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                  {card.body}
                </p>
                <Button asChild className="mt-4">
                  <Link to="/auth" search={{ intent: card.intent }}>
                    {card.cta}
                  </Link>
                </Button>
                <Link
                  to="/trust"
                  className="mt-3 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:text-foreground"
                >
                  How your data works →
                </Link>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-20 border-t border-border pt-10">
          <p className="micro-label">Trust</p>
          <ul className="mt-5 space-y-2">
            {TRUST_LINES.map((line) => (
              <li key={line} className="flex gap-3 text-sm text-foreground">
                <span aria-hidden className="text-accent">
                  ◆
                </span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
          <Link
            to="/trust"
            className="mt-5 inline-block font-mono text-[11px] uppercase tracking-[0.08em] text-accent-deep transition-colors hover:text-foreground"
          >
            Read the full trust page →
          </Link>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-8 md:px-10">
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
      </footer>
    </div>
  );
}
