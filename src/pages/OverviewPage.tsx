import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";

import { ArchiveTeaser } from "@/components/archive/ArchiveTeaser";
import { PageHeader } from "@/components/layout/PageHeader";
import { OverviewWork } from "@/components/overview/OverviewWork";
import { OneOnOneBrief } from "@/components/oneonone/OneOnOneBrief";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/use-profile";
import { isCoach } from "@/lib/role-access";

export function OverviewPage() {
  const { data: profile } = useProfile();
  const navigate = useNavigate();
  const [prepOpen, setPrepOpen] = useState(false);
  const coach = isCoach(profile);

  // Overview is a person's own work. A coach has none, and their home is the
  // list of people who have shared work with them, so send them there.
  useEffect(() => {
    if (coach) void navigate({ to: "/coaching", replace: true });
  }, [coach, navigate]);

  if (coach) {
    return (
      <div>
        <PageHeader title="Shared with you" subtitle="Taking you to the people you coach." />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Overview" subtitle="A calm view of your recent work." />
      <CoachingLinkNotices />
      {profile ? (
        <>
          <Button type="button" onClick={() => setPrepOpen(true)}>
            Prepare a 1:1
          </Button>
          <OneOnOneBrief
            open={prepOpen}
            onOpenChange={setPrepOpen}
            profileId={profile.id}
            scopeLabel="All of your work"
          />
        </>
      ) : null}
      <OverviewWork />
      <ArchiveTeaser />
    </div>
  );
}
