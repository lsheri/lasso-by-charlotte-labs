import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { PublicHeader } from "@/components/layout/PublicHeader";
import { Wordmark } from "@/components/layout/Wordmark";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { markEduIntent } from "@/lib/edu-entry";
import { recordAnonymousEventFn } from "@/lib/telemetry.functions";

export const EDU_JOIN_COPY = {
  eyebrow: "Lasso for students",
  headline: "Your work record. Yours, and professors never see it.",
  sub: "Keep every class, project and late night draft in one place you own.",
  points: [
    [
      "Organize your classes and projects",
      "Your AI threads, docs and notes land in the place they belong, so a term of work reads as one story.",
    ],
    [
      "Keep the work you are proud of",
      "Promote a piece to your Portfolio and it stays there, ready when someone asks what you can do.",
    ],
    [
      "Share only what you choose",
      "Nothing leaves your workspace by itself. Pick a mentor, pick what they see, change your mind whenever you like.",
    ],
  ] as const,
  cta: "Create my workspace",
  reassurance: "Free to start. Your workspace belongs to you, not to your school.",
};

export const Route = createFileRoute("/join_/edu")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Lasso for students | Your work record, yours" },
      {
        name: "description",
        content:
          "A private place for university students to organize classes and projects, keep the work they are proud of, and share only what they choose.",
      },
      { property: "og:title", content: "Lasso for students | Your work record, yours" },
      {
        property: "og:description",
        content:
          "Organize your classes and projects, keep the work you are proud of, and share only what you choose.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EduJoinPage,
});

function EduJoinPage() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void recordAnonymousEventFn({
      data: { event_type: "edu.join_opened", view_id: crypto.randomUUID(), dims: {} },
    }).catch(() => {
      /* signals never surface to the person */
    });
  }, []);

  async function start() {
    setBusy(true);
    markEduIntent();
    const { data } = await supabase.auth.getUser();
    if (data.user) navigate({ to: "/onboarding", search: { intent: "edu" } });
    else navigate({ to: "/auth" });
  }

  return (
    <>
      <PublicHeader />
      <main className="min-h-screen bg-background px-4 py-16">
        <div className="mx-auto w-full max-w-3xl">
          <Wordmark size="lg" />
          <p className="micro-label mt-6">{EDU_JOIN_COPY.eyebrow}</p>
          <h1 className="page-title mt-2 text-3xl leading-tight">{EDU_JOIN_COPY.headline}</h1>
          <p className="mt-3 text-base text-muted-foreground">{EDU_JOIN_COPY.sub}</p>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {EDU_JOIN_COPY.points.map(([title, body]) => (
              <div
                key={title}
                className="rounded-[var(--radius)] border border-border bg-card p-5 shadow-card"
              >
                <p className="text-sm font-medium text-foreground">{title}</p>
                <p className="mt-2 text-sm text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Button type="button" disabled={busy} onClick={() => void start()}>
              {busy ? "One moment…" : EDU_JOIN_COPY.cta}
            </Button>
            <p className="text-xs text-muted-foreground">{EDU_JOIN_COPY.reassurance}</p>
          </div>
        </div>
      </main>
    </>
  );
}
