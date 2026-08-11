import { createFileRoute, Link } from "@tanstack/react-router";

import { PublicHeader } from "@/components/layout/PublicHeader";
import { Wordmark } from "@/components/layout/Wordmark";

export const Route = createFileRoute("/trust")({
  head: () => ({
    meta: [
      { title: "Trust & data — Lasso by Charlotte Labs" },
      {
        name: "description",
        content:
          "Who sees what in Lasso, how work gets in, what we never do, and how telemetry and deletion work.",
      },
      { property: "og:title", content: "Trust & data — Lasso" },
      {
        property: "og:description",
        content:
          "Who sees what in Lasso, how work gets in, what we never do, and how telemetry and deletion work.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TrustPage,
});

const MATRIX: [string, string][] = [
  ["You", "Everything you capture. Only you can delete it."],
  [
    "Your coach",
    "Only what you've mapped and chosen to share — never private items, never drafts.",
  ],
  ["Your organization's admin", "Settings and invites. Never anyone's content, ever."],
  ["Charlotte Labs", "Content-free usage events only — no text, no titles, no names."],
];

const NEVER: string[] = [
  "We do not train models on your content.",
  "We do not sell or broker your data.",
  "We build no monitoring or surveillance features.",
  "We do not score or rate people.",
];

const SUBPROCESSORS: [string, string][] = [
  ["Supabase", "Database and authentication. SOC 2 Type II."],
  ["Lovable", "Application hosting."],
  ["Composio", "Connector OAuth for the sources you choose to link."],
  ["Lovable AI (Google)", "AI responses only — Reflect and drafting features."],
  ["PostHog", "Usage analytics, US cloud, content-free events only."],
];

function Section({
  label,
  title,
  children,
}: {
  label: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-border pt-8">
      <p className="micro-label">{label}</p>
      <h2 className="page-title mt-2">{title}</h2>
      <div className="mt-4 space-y-3 text-sm leading-relaxed text-foreground">{children}</div>
    </section>
  );
}

function TrustPage() {
  return (
    <>
      <PublicHeader current="/trust" />
      <main className="min-h-screen bg-background px-6 py-16 md:px-12">
        <div className="mx-auto max-w-2xl">
          <Wordmark size="lg" />
          <p className="micro-label mt-8">Trust &amp; data</p>
          <h1 className="page-title mt-2">How Lasso handles your work</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Lasso exists so the work you do belongs to you. This page states plainly who can see
            what, and what we will never build.
          </p>

          <div className="mt-12 space-y-10">
            <Section label="01" title="Who sees what">
              <div className="overflow-hidden rounded-[var(--radius)] border border-border bg-card shadow-card">
                {MATRIX.map(([who, what], index) => (
                  <div
                    key={who}
                    className={
                      index === 0
                        ? "grid gap-1 px-5 py-4 sm:grid-cols-[180px_1fr] sm:gap-6"
                        : "grid gap-1 border-t border-border px-5 py-4 sm:grid-cols-[180px_1fr] sm:gap-6"
                    }
                  >
                    <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                      {who}
                    </p>
                    <p className="text-sm text-foreground">{what}</p>
                  </div>
                ))}
              </div>
            </Section>

            <Section label="02" title="How your work gets in">
              <p>
                Capture is consent-first. Nothing is imported without you selecting it — when you
                import a history file, the conversations you leave unchecked are never transmitted;
                parsing happens in your browser.
              </p>
              <p>
                Connectors and MCP push are opt-in, per source and per item. Everything lands
                private and unmapped. It becomes shareable only when you map it.
              </p>
            </Section>

            <Section label="03" title="What we never do">
              <ul className="space-y-2">
                {NEVER.map((line) => (
                  <li key={line} className="flex gap-3">
                    <span aria-hidden className="text-accent">
                      ◆
                    </span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </Section>

            <Section label="04" title="Telemetry, plainly">
              <p>
                We record that an event happened — for example, “a work item was captured” — never
                what it contained. No text, no titles, no file names, no email addresses.
              </p>
              <p>
                Identifiers in our analytics are one-way salted hashes, so an event cannot be traced
                back to a person or an organization from the analytics side. Counts are recorded in
                ranges rather than exact values. The full published event list is available on
                request.
              </p>
            </Section>

            <Section label="05" title="Deletion">
              <p>
                You can delete any piece of your work at any time. Deleting your account removes
                your content. Uploaded files are removed from storage with the items that reference
                them.
              </p>
            </Section>

            <Section label="06" title="AI features">
              <p>
                Reflect conversations are processed by an AI model through Lovable AI (Google
                Gemini) to generate responses. They are private to the account owner — never visible
                to coaches or admins, never surfaced in a packet or any coach-facing view.
              </p>
              <p>
                They are never used to train models, and you can delete any session, along with
                every message in it, at any time.
              </p>
            </Section>

            <Section label="07" title="Infrastructure">
              <div className="space-y-2">
                {SUBPROCESSORS.map(([name, role]) => (
                  <div key={name} className="flex flex-wrap gap-x-3 gap-y-1">
                    <span className="font-medium text-foreground">{name}</span>
                    <span className="text-muted-foreground">{role}</span>
                  </div>
                ))}
              </div>
              <p>
                <a
                  href="/.well-known/trust.html"
                  className="text-accent-deep underline underline-offset-4"
                >
                  Platform security attestation (auto-generated)
                </a>
              </p>
            </Section>
          </div>

          <div className="mt-14 border-t border-border pt-6">
            <Link
              to="/auth"
              className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:text-foreground"
            >
              ← Back to Lasso
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
