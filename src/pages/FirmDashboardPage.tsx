import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";

import { ChecksLibrary } from "@/components/firm/ChecksLibrary";
import { FirmArchive } from "@/components/firm/FirmArchive";
import { FirmMetricGrid } from "@/components/firm/FirmMetricGrid";
import { PrivacyPanel } from "@/components/firm/PrivacyPanel";
import { TrustSummary } from "@/components/firm/TrustSummary";
import { WhatLeavesTheFirm } from "@/components/firm/WhatLeavesTheFirm";
import { ToneCard } from "@/components/notebook/ToneCard";
import { PageHeader } from "@/components/layout/PageHeader";
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
      <PageHeader
        title="Firm"
        italicWord="view"
        subtitle="How the workspace is being used, in counts and structure only."
      />

      <div className="space-y-6">
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
            <FirmMetricGrid data={data} reduceMotion={reduceMotion} />
            <ChecksLibrary profileId={profile?.id} runCount={data.assurance.firm_check_runs} />
          </>
        )}

        <FirmArchive />

        {data ? <WhatLeavesTheFirm engagementsShared={data.coaching.engagements_shared} /> : null}

        <PrivacyPanel />

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
