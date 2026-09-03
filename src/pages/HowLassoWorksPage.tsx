import { Link } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

import { PageHeader } from "@/components/layout/PageHeader";
import { useProfile } from "@/hooks/use-profile";
import { logEvent } from "@/lib/telemetry";
import { consumeWalkthroughEntry } from "@/lib/walkthrough-entry";
import {
  daysSinceSignupBand,
  walkthroughFor,
  walkthroughVariant,
  type WalkthroughSection,
  type WalkthroughVariant,
} from "@/lib/walkthrough";

function SectionBlock({
  section,
  index,
  variant,
  orgId,
  onSeen,
}: {
  section: WalkthroughSection;
  index: number;
  variant: WalkthroughVariant;
  orgId: string | undefined;
  onSeen: (id: string) => void;
}) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !orgId || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          io.disconnect();
          onSeen(section.id);
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [orgId, section.id, onSeen]);

  return (
    <section ref={ref} className="border-t border-border pt-8">
      <p className="micro-label">
        {String(index + 1).padStart(2, "0")} · {variant === "coach" ? "Coaching" : "Your work"}
      </p>
      <h2 className="mt-2 text-lg text-foreground">{section.title}</h2>
      <div className="mt-4 grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-start">
        <div className="space-y-3">
          {section.body.map((line) => (
            <p key={line} className="text-sm leading-relaxed text-muted-foreground">
              {line}
            </p>
          ))}
          {section.steps ? (
            <ol className="ml-4 list-decimal space-y-1 text-sm text-muted-foreground">
              {section.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          ) : null}
        </div>
        {section.video ? (
          <figure className="m-0">
            <video
              src={section.video.src}
              poster={section.video.poster}
              controls
              muted
              playsInline
              preload="none"
              aria-label={section.video.label}
              className="w-full rounded-[var(--radius)] border border-border bg-card shadow-card"
            />
            <figcaption className="mt-2 text-xs text-muted-foreground">
              {section.video.label}. Everything it shows is written out beside it.
            </figcaption>
          </figure>
        ) : null}
      </div>
    </section>
  );
}

/**
 * The walkthrough. Always reachable from the sidebar, never dismissed for
 * good, and written for the kind of account it is opened in.
 */
export function HowLassoWorksPage() {
  const { data: profile } = useProfile();
  const variant = walkthroughVariant(profile);
  const guide = walkthroughFor(variant);
  const orgId = profile?.org_id;
  const opened = useRef(false);
  const seen = useRef(new Set<string>());

  useEffect(() => {
    if (!orgId || opened.current) return;
    opened.current = true;
    logEvent("walkthrough.opened", orgId, {
      variant,
      entry: consumeWalkthroughEntry(),
      days_since_signup_band: daysSinceSignupBand(profile?.created_at ?? null),
    });
  }, [orgId, variant, profile?.created_at]);

  function handleSeen(id: string) {
    if (!orgId || seen.current.has(id)) return;
    seen.current.add(id);
    const position = guide.sections.findIndex((s) => s.id === id);
    logEvent("walkthrough.section_viewed", orgId, { variant, section: id, position });
  }

  return (
    <div className="max-w-4xl">
      <PageHeader title={guide.title} subtitle={guide.intro} />

      <div className="space-y-10">
        {guide.sections.map((section, index) => (
          <SectionBlock
            key={section.id}
            section={section}
            index={index}
            variant={variant}
            orgId={orgId}
            onSeen={handleSeen}
          />
        ))}

        <section className="border-t border-border pt-8">
          <p className="micro-label">Next</p>
          <p className="mt-2 text-sm text-muted-foreground">{guide.next.note}</p>
          <Link
            to={guide.next.to as never}
            className="nb-pencil-cta mt-4 inline-flex items-center gap-2"
          >
            {guide.next.label}
          </Link>
        </section>
      </div>
    </div>
  );
}
