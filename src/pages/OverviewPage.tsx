import { useState } from "react";

import { ArchiveTeaser } from "@/components/archive/ArchiveTeaser";
import { PageHeader } from "@/components/layout/PageHeader";
import { OverviewWork } from "@/components/overview/OverviewWork";
import { OneOnOneBrief } from "@/components/oneonone/OneOnOneBrief";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/use-profile";

export function OverviewPage() {
  const { data: profile } = useProfile();
  const [prepOpen, setPrepOpen] = useState(false);

  return (
    <div>
      <PageHeader title="Overview" subtitle="A calm view of your recent work." />
      {profile && profile.role !== "coach" ? (
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


