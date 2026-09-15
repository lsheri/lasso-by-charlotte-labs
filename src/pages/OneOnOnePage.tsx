import { useState } from "react";

import { PageHeader } from "@/components/layout/PageHeader";
import { ToneCard } from "@/components/notebook/ToneCard";
import { ConfirmedCalls } from "@/components/oneonone/ConfirmedCalls";
import { OneOnOneBrief } from "@/components/oneonone/OneOnOneBrief";
import { SavedForOneOnOne } from "@/components/oneonone/SaveForOneOnOne";
import { SessionStickies } from "@/components/oneonone/SessionStickies";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/use-profile";

export function OneOnOnePage() {
  const { data: profile } = useProfile();
  // PASS A1 — preparing a brief lived on the retired Overview. This is the
  // page it was always about, so it moves here unchanged.
  const [prepOpen, setPrepOpen] = useState(false);
  // PASS C — the hour belongs to the person having it. A coach keeps the page
  // they had; the sticky wall is the subject's own and is never drawn for them.
  const isCoach = profile?.role === "coach";
  return (
    <div>
      <PageHeader
        title="Your"
        italicWord="hour"
        subtitle="What you want to bring up. Nothing here is sent until you choose to."
      />
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-10">
        <div>
          {profile && !isCoach ? (
            <SessionStickies profileId={profile.id} orgId={profile.org_id} />
          ) : null}
          {isCoach ? <p className="mb-6 text-sm text-muted-foreground">Nothing to prepare yet.</p> : null}
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
          {/* PASS C — the send is drawn so the promise cards have a subject, and
              it is inert on purpose. There is no send in the product yet. */}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="ink" disabled aria-disabled="true">
              Send to your coach
            </Button>
            <p className="font-hand text-[16px] text-soft">sending comes after the pilot</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
