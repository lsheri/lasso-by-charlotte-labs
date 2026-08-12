import { createFileRoute, Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { Wordmark } from "@/components/layout/Wordmark";

export const Route = createFileRoute("/why")({
  head: () => ({
    meta: [
      { title: "Why Lasso, the coach in your corner" },
      {
        name: "description",
        content:
          "The real work you do with AI is invisible. Lasso makes it yours, a record you own, and a coach you invite into exactly what you choose.",
      },
      { property: "og:title", content: "Why Lasso, the coach in your corner" },
      {
        property: "og:description",
        content:
          "The real work you do with AI is invisible. Lasso makes it yours, a record you own, and a coach you invite into exactly what you choose.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WhyPage,
});

const SECTIONS: { heading: string; body: string[] }[] = [
  {
    heading: "Your work deserves a record",
    body: [
      "Most of the thinking you do with AI disappears the moment the tab closes. The drafts, the dead ends, the call you finally got right, none of it lands anywhere you can point to later.",
      "Lasso keeps that work. You bring in the threads and files you choose, map them to the engagements they belong to, and end up with a record of how the work actually happened, in your own words, in your own order.",
    ],
  },
  {
    heading: "A coach in your corner",
    body: [
      "Growing fast is easier with someone who has seen the road. Lasso lets you invite someone you trust into exactly the work you choose, a coach, a lead, a mentor.",
      "They see what you share, never more. No dashboards over your shoulder, no ratings, no verdicts on you as a person. Just a colleague who can read the real context and tell you something useful.",
    ],
  },
  {
    heading: "Yours, always",
    body: [
      "You own the record. Private stays private, drafts stay drafts, and nothing is shared until you say so. Change your mind and you can unshare or delete it.",
      "Your organization's admins handle settings and invitations, never anyone's content.",
    ],
  },
];

function WhyPage() {
  return (
    <div className="min-h-screen bg-background">
      <PublicHeader current="/why" />

      <main className="mx-auto max-w-3xl px-6 py-16 md:px-10 md:py-24">
        <div className="max-w-xs">
          <Wordmark />
        </div>
        <h1 className="mt-10 text-4xl font-semibold leading-tight tracking-tight text-foreground md:text-5xl">
          The best coach you didn't know you needed.
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground">
          Lasso turns the work you already do with AI into a record you own, and makes it easy to
          put that record in front of someone who can help you get better at it.
        </p>

        <div className="mt-16 space-y-14">
          {SECTIONS.map((section) => (
            <section key={section.heading}>
              <p className="micro-label">{section.heading}</p>
              <div className="mt-3 space-y-4">
                {section.body.map((paragraph) => (
                  <p key={paragraph} className="text-sm leading-relaxed text-foreground">
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-16 rounded-[var(--radius)] border border-border bg-card px-6 py-8 shadow-card">
          <p className="text-sm text-foreground">Start your record. It stays yours.</p>
          <Button asChild className="mt-4">
            <Link to="/auth">Get started</Link>
          </Button>
        </div>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-8 md:px-10">
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
            Lasso by Charlotte Labs
          </p>
          <Link
            to="/trust"
            className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:text-foreground"
          >
            Trust &amp; data
          </Link>
        </div>
      </footer>
    </div>
  );
}
