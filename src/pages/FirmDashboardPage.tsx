import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";

import { ChecksLibrary } from "@/components/firm/ChecksLibrary";
import { FirmArchive } from "@/components/firm/FirmArchive";
import { FirmMetricGrid } from "@/components/firm/FirmMetricGrid";
import { FirmProduced } from "@/components/firm/FirmProduced";
import { PrivacyPanel } from "@/components/firm/PrivacyPanel";
import { TrustSummary } from "@/components/firm/TrustSummary";
import { WhatLeavesTheFirm } from "@/components/firm/WhatLeavesTheFirm";
import { ToneCard } from "@/components/notebook/ToneCard";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionHeader } from "@/components/notebook/SectionHeader";
import { useFirmDashboard } from "@/hooks/use-firm-dashboard";
import { isBusinessOrg, useProfile } from "@/hooks/use-profile";

export function FirmDashboardPage() {
  const { data: profile } = useProfile();
  const canSee =
    isBusinessOrg(profile) && (profile?.role === "admin" || profile?.role === "lead");
  const { data, isLoading, error } = useFirmDashboard(canSee ? profile?.id : undefined);
  const [reduceMotion, setReduceMotion] = useState(true);

  useEffect(() => {
    setReduceMotion(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false);
  }, []);

  if (profile && !canSee) {
    return (
      <div>
        <PageHeader title="Firm view" subtitle="This view is for firm workspaces." />
        <p className="text-sm text-muted-foreground">
          Your workspace does not have a firm view.
        </p>
      </div>
    );
  }

  return (
    <div className="pb-16">
      {/*
        Figma 23:413 states the page's scope in the subtitle: who is in it and
        how far back it reaches.

        Deliberate deviation: the frame names clients ("Meridian Health,
        Northwind and 4 other clients"). No read on this page lists the firm's
        clients, so the line says what is true instead of naming names it cannot
        see, and "counts from the last N days" says what the window actually is
        rather than calling it "months of record".
      */}
      <PageHeader
        title="Firm"
        italicWord="view"
        subtitle={
          data
            ? `${data.adoption.active_members} ${
                data.adoption.active_members === 1 ? "person" : "people"
              } · counts from the last ${data.window_days} days`
            : "Counts and structure only."
        }
      />

      <div className="space-y-8">
        <ToneCard tone="record" label="WHAT THIS PAGE MEASURES">
          <TrustSummary />
        </ToneCard>

        {error ? (
          <p className="text-sm text-destructive">That could not be loaded. Try again.</p>
        ) : null}
        {isLoading || !data ? (
          <p className="text-sm text-muted-foreground">Counting.</p>
        ) : (
          <>
            {/* The frame's headline row: four production numbers across the page. */}
            <section>
              <SectionHeader title="What the firm produced" />
              <FirmProduced
                profileId={profile?.id}
                analysesRun={data.assurance.total_runs}
              />
            </section>

            {/*
              The frame pairs the archive with the check library at roughly 2:1,
              and the honesty panels the same way underneath. Below `lg` each
              pair stacks, because a check library in a third of a phone is not
              a panel, it is a column of broken words.
            */}
            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <FirmArchive />
              <ChecksLibrary profileId={profile?.id} runCount={data.assurance.firm_check_runs} />
            </div>

            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <WhatLeavesTheFirm engagementsShared={data.coaching.engagements_shared} />
              <PrivacyPanel />
            </div>

            {/* Kept below the frame's content: the adoption and health picture
                the firm still needs, under a head of its own. */}
            <FirmMetricGrid data={data} reduceMotion={reduceMotion} />
          </>
        )}

        <p className="text-sm text-muted-foreground">
          Looking for the roster, invites, or the plan?{" "}
          <Link to="/members" className="text-accent-deep underline underline-offset-2">
            Members
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
