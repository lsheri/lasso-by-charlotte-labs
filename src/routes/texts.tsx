import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";

import { PublicHeader } from "@/components/layout/PublicHeader";
import { LegalLinks } from "@/components/legal/LegalPage";
import { TextConsentForm } from "@/components/legal/TextConsentForm";
import { startSessionReplay, stopSessionReplay } from "@/lib/posthog-client";
import { cleanWorkspace, TEXT_CONSENT_COPY as COPY } from "@/lib/text-consent-shared";
import { recordTextConsentFn } from "@/lib/text-consent.functions";

/**
 * 19 Nov 2026: the public page where a person agrees to receive text messages from Lasso. No sign-in: the person
 * agreeing is usually a consultant who has no account. They reach it by a link a firm's admin sends them, either
 * /texts on its own or /texts?w=<workspace id>, which files the agreement under that workspace. Screen replay is
 * stopped while this page is open and the form is marked ph-no-capture, so a name or number typed here never
 * reaches analytics, masked or not.
 */
export const Route = createFileRoute("/texts")({
  validateSearch: (search: Record<string, unknown>): { w?: string } => {
    const workspace = cleanWorkspace(search["w"]);
    return workspace ? { w: workspace } : {};
  },
  head: () => ({
    meta: [
      { title: "Text messages from Lasso" },
      {
        name: "description",
        content:
          "Agree to receive text messages from Lasso about proposals and projects you help with.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TextsPage,
});

function TextsPage() {
  const { w } = Route.useSearch();
  const record = useServerFn(recordTextConsentFn);
  useEffect(() => {
    stopSessionReplay();
    return () => startSessionReplay();
  }, []);
  return (
    <>
      <PublicHeader />
      <main className="min-h-screen bg-background px-6 py-16 md:px-12">
        <div className="mx-auto max-w-xl">
          <p className="micro-label text-(length:--type-label)">{COPY.label}</p>
          <h1 className="page-title mt-2">{COPY.heading}</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{COPY.intro}</p>
          <div className="ph-no-capture mt-10">
            <TextConsentForm workspace={w ?? null} submit={(input) => record({ data: input })} />
          </div>
          <div className="mt-14 border-t border-border pt-6">
            <LegalLinks current="/texts" />
          </div>
        </div>
      </main>
    </>
  );
}
