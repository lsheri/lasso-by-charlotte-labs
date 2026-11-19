import { Link } from "@tanstack/react-router";

import { PublicHeader } from "@/components/layout/PublicHeader";

import type { LegalBlock, LegalDoc } from "./legal-copy";

export const LEGAL_LINKS = [
  { to: "/privacy", label: "Privacy policy" },
  { to: "/terms", label: "Terms of use" },
  { to: "/trust", label: "Trust and data" },
] as const;

const LINK = "text-accent-deep underline underline-offset-4";

/** The row of links every public legal surface ends with. `current` leaves out the page you are on. */
export function LegalLinks({
  current,
}: {
  current?: (typeof LEGAL_LINKS)[number]["to"] | "/texts";
}) {
  return (
    <nav aria-label="Policies" className="flex flex-wrap gap-x-6 gap-y-2">
      {LEGAL_LINKS.filter((link) => link.to !== current).map((link) => (
        <Link
          key={link.to}
          to={link.to}
          className="font-mono text-(length:--type-label) uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:text-foreground"
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

function Block({ block }: { block: LegalBlock }) {
  if (typeof block === "string") return <p>{block}</p>;
  if ("list" in block) {
    return (
      <ul className="space-y-2">
        {block.list.map((line) => (
          <li key={line} className="flex gap-3">
            <span aria-hidden className="text-accent">
              ◆
            </span>
            <span>{line}</span>
          </li>
        ))}
      </ul>
    );
  }
  if ("quote" in block) {
    return (
      <blockquote className="rounded-[var(--radius-control)] border border-border bg-card px-5 py-4 text-foreground shadow-card">
        {block.quote}
      </blockquote>
    );
  }
  if ("rows" in block) {
    return (
      <div className="overflow-hidden rounded-[var(--radius-control)] border border-border bg-card shadow-card">
        {block.rows.map(([name, what], index) => (
          <div
            key={name}
            className={`grid gap-1 px-5 py-4 sm:grid-cols-[180px_1fr] sm:gap-6 ${index === 0 ? "" : "border-t border-border"}`}
          >
            <p className="font-mono text-(length:--type-label) uppercase tracking-[0.08em] text-muted-foreground">
              {name}
            </p>
            <p className="text-sm text-foreground">{what}</p>
          </div>
        ))}
      </div>
    );
  }
  if ("links" in block) {
    return (
      <p className="flex flex-col gap-1">
        {block.links.map((link) => (
          <Link key={link.to} to={link.to} className={LINK}>
            {link.label}
          </Link>
        ))}
      </p>
    );
  }
  return (
    <p>
      <a href={`mailto:${block.contact}`} className={LINK}>
        {block.contact}
      </a>
    </p>
  );
}

/** One public legal document: /privacy and /terms. The words come whole from legal-copy.ts. */
export function LegalPage({ doc, current }: { doc: LegalDoc; current: "/privacy" | "/terms" }) {
  return (
    <>
      <PublicHeader />
      <main className="min-h-screen bg-background px-6 py-16 md:px-12">
        <div className="mx-auto max-w-2xl">
          <p className="micro-label text-(length:--type-label)">{doc.label}</p>
          <h1 className="page-title mt-2">{doc.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">Last updated: {doc.updated}</p>
          <p className="mt-4 text-sm leading-relaxed text-foreground">{doc.intro}</p>

          <div className="mt-12 space-y-10">
            {doc.sections.map((section, index) => (
              <section key={section.id} id={section.id} className="border-t border-border pt-8">
                <p className="micro-label text-(length:--type-label)">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <h2 className="section-title mt-2">{section.title}</h2>
                <div className="mt-4 space-y-3 break-words text-sm leading-relaxed text-foreground">
                  {section.blocks.map((block, at) => (
                    <Block key={at} block={block} />
                  ))}
                </div>
              </section>
            ))}
          </div>

          <div className="mt-14 border-t border-border pt-6">
            <LegalLinks current={current} />
          </div>
        </div>
      </main>
    </>
  );
}
