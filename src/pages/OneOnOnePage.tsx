import { useState } from "react";

import { PageHeader } from "@/components/layout/PageHeader";
import { ToneCard } from "@/components/notebook/ToneCard";
import { ConfirmedCalls } from "@/components/oneonone/ConfirmedCalls";
import { OneOnOneBrief } from "@/components/oneonone/OneOnOneBrief";
import { SavedForOneOnOne } from "@/components/oneonone/SaveForOneOnOne";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/use-profile";

export function OneOnOnePage() {
  const { data: profile } = useProfile();
  // PASS A1 — preparing a brief lived on the retired Overview. This is the
  // page it was always about, so it moves here unchanged.
  const [prepOpen, setPrepOpen] = useState(false);
  return (
    <div>
      <PageHeader
        title="1:1"
        italicWord="prep"
        subtitle="Structured context for your next coaching conversation."
      />
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-10">
        <div>
          {profile ? (
            <div className="mb-6">
              <Button type="button" variant="secondary" onClick={() => setPrepOpen(true)}>
                Prepare a 1:1
              </Button>
              <OneOnOneBrief
                open={prepOpen}
                onOpenChange={setPrepOpen}
                profileId={profile.id}
                scopeLabel="All of your work"
              />
            </div>
          ) : null}
          {profile ? <SavedForOneOnOne profileId={profile.id} /> : null}
          <p className="font-hand text-green">cut anything. it is your hour.</p>
          <ConfirmedCalls />
        </div>

        <aside className="mt-10 space-y-4 lg:mt-0">
          {/* Figma 32:1323 ticks each promise in green. The tick is the point:
              this is a list of what leaves, checked off one by one. */}
          <ToneCard tone="record" label="WHAT YOUR COACH WILL SEE WHEN YOU SEND" className="gap-3 p-4">
            {[
              "The work each one points at",
              "The reasoning you attached",
              "Nothing else from this week",
            ].map((line) => (
              <div key={line} className="flex items-start gap-2">
                <span aria-hidden className="mt-[1px] shrink-0 text-green">
                  ✓
                </span>
                <p>{line}</p>
              </div>
            ))}
          </ToneCard>
          <ToneCard tone="paper" label="WHAT YOUR COACH WILL NEVER SEE" className="gap-3 p-4">
            <div className="flex items-center gap-2">
              <span className="w-[18px] border-t border-[var(--nb-pencil)]" aria-hidden="true" />
              <p>Work you have not mapped to an engagement</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-[18px] border-t border-[var(--nb-pencil)]" aria-hidden="true" />
              <p>Reflections you did not send</p>
            </div>
            <p className="text-soft">Sending is a decision you make, not a default.</p>
          </ToneCard>
        </aside>
      </div>
    </div>
  );
}
