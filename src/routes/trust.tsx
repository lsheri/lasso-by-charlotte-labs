import { createFileRoute, Link } from "@tanstack/react-router";

import { TIER_COPY } from "@/lib/data-consent-shared";

import { PublicHeader } from "@/components/layout/PublicHeader";

export const Route = createFileRoute("/trust")({
  head: () => ({
    meta: [
      { title: "Trust & data | Lasso" },
      {
        name: "description",
        content:
          COPY.description,
      },
      { property: "og:title", content: "Trust & data | Lasso" },
      {
        property: "og:description",
        content:
          COPY.description,
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TrustPage,
});

export const COPY = {
  label: "Trust & data",
  heading: "How Lasso handles your work",
  intro: "Your work belongs to you. This page says plainly who can see what, what leaves your workspace, and what we will never build.",
  description: "Who sees what in Lasso, the five data levels, support access, interface measurement and deletion.",
  titles: ["Who sees what", "How your work gets in", "What leaves your workspace", "What we never do", "Measuring the product", "Deletion", "AI features", "Infrastructure"],
  matrix: [
    ["You", "Everything you capture. Only you can delete it."],
    ["A coach or partner you share with", "Only the boards you choose to share, as summaries or as full conversations, your choice per board. Never private work."],
    ["People on a shared board", "The cards on that board, at the level it was shared."],
    ["Your workspace admin", "Settings, people and invites. Never anyone's private work."],
    ["Charlotte Labs", "What your data level allows, below. Our support team can open your workspace only after your admin approves a request: read only, for up to 28 days, and every page we open is listed for you in Settings."],
  ],
  capture: "Capture is consent-first. Nothing is imported without you selecting it. When you import a history file, the conversations you leave unchecked are never transmitted; parsing happens in your browser.",
  connectors: "Connectors and MCP push are opt-in, per source and per item. Everything lands private and unmapped. It becomes shareable only when you map it.",
  levelsIntro: "Each workspace has a data level, and each person can choose the same or less for themselves. New workspaces start at Full work content.",
  levels: {
    t0: "Nothing about your work leaves. Only an anonymous count of which AI models are in use.",
    a: "Counts of which features are used. No person, no titles, no content.",
    b: "The same counts under a random per-person key, so one week can be compared to the next.",
    c: "Adds the shape of the work: kinds of documents, dates, titles, file names and board structure. Not the words inside.",
    d: "Adds the work itself for anything you map or ship: the conversations with AI tools, turn by turn, and the analyses run on them.",
  },
  levelsRights: "Private and unmapped work never leaves, at any level. Anything that leaves stays governed by the level it left under. Change your level any time in Settings, under Your data.",
  never: ["We do not sell your data.", "We do not train AI models on your content.", "We build nothing that rates or ranks people.", "We never change your level without telling you."],
  measurement: "We measure how the interface is used: clicks, load times and masked replays of the screen. Everything readable is masked in your browser before it is sent, and identifiers are one-way salted keys. This is separate from your data level above.",
  deletion: "You can delete any piece of your work at any time. Deleting your account removes your content. Uploaded files are removed from storage with the items that reference them.",
  ai: "Reflect conversations are processed by an AI model through Lovable AI (Google Gemini) to generate responses. They are private to the account owner, never visible to coaches or admins, never surfaced in a packet or any coach-facing view.",
  aiDeletion: "They are never used to train models, and you can delete any session, along with every message in it, at any time.",
  subprocessors: [
    ["Supabase", "Database and authentication. SOC 2 Type II."],
    ["Lovable", "Application hosting."],
    ["Composio", "Connector OAuth for the sources you choose to link."],
    ["Lovable AI (Google)", "AI responses only, Reflect and drafting features."],
    ["PostHog", "Interface measurement, US cloud, masked."],
    ["Resend", "Email delivery."],
  ],
  attestation: "Platform security attestation (auto-generated)",
  back: "← Back to Lasso",
} as const;

function Section({
  label,
  title,
  id,
  children,
}: {
  id?: string;
  label: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="border-t border-[var(--nb-pencil)] pt-8">
      <p className="micro-label text-[9px]">{label}</p>
      <h2 className="section-title mt-2">{title}</h2>
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
          <p className="micro-label text-[9px]">{COPY.label}</p>
          <h1 className="page-title mt-2">{COPY.heading}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {COPY.intro}
          </p>

          <div className="mt-12 space-y-10">
            <Section label="01" title={COPY.titles[0]}>
              <div className="overflow-hidden rounded-[var(--radius-control)] border border-[var(--nb-pencil)] bg-card shadow-card">
                {COPY.matrix.map(([who, what], index) => (
                  <div
                    key={who}
                    className={
                      index === 0
                        ? "grid gap-1 px-5 py-4 sm:grid-cols-[180px_1fr] sm:gap-6"
                        : "grid gap-1 border-t border-[var(--nb-pencil)] px-5 py-4 sm:grid-cols-[180px_1fr] sm:gap-6"
                    }
                  >
                    <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
                      {who}
                    </p>
                    <p className="text-sm text-foreground">{what}</p>
                  </div>
                ))}
              </div>
            </Section>

            <Section label="02" title={COPY.titles[1]}>
              <p>{COPY.capture}</p>
              <p>{COPY.connectors}</p>
            </Section>

            <Section label="03" title={COPY.titles[2]} id="levels">
              <p>{COPY.levelsIntro}</p>
              <ul className="space-y-3">
                {TIER_COPY.map(({ tier, label }) => (
                  <li key={tier}>
                    <p className="font-medium">{label}</p>
                    <p>{COPY.levels[tier]}</p>
                  </li>
                ))}
              </ul>
              <p>{COPY.levelsRights}</p>
            </Section>

            <Section label="04" title={COPY.titles[3]}>
              <ul className="space-y-2">
                {COPY.never.map((line) => (
                  <li key={line} className="flex gap-3">
                    <span aria-hidden className="text-accent">◆</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </Section>

            <Section label="05" title={COPY.titles[4]}>
              <p>{COPY.measurement}</p>
            </Section>

            <Section label="06" title={COPY.titles[5]}>
              <p>{COPY.deletion}</p>
            </Section>

            <Section label="07" title={COPY.titles[6]}>
              <p>{COPY.ai}</p>
              <p>{COPY.aiDeletion}</p>
            </Section>

            <Section label="08" title={COPY.titles[7]}>
              <div className="space-y-2">
                {COPY.subprocessors.map(([name, role]) => (
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
                  {COPY.attestation}
                </a>
              </p>
            </Section>
          </div>

          <div className="mt-14 border-t border-[var(--nb-pencil)] pt-6">
            <Link
              to="/auth"
              className="font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:text-foreground"
            >
              {COPY.back}
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
