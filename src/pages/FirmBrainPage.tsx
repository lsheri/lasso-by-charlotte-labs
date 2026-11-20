import { AskTheFirm } from "@/components/firm-brain/AskTheFirm";
import { FirmBrainMap } from "@/components/firm-brain/FirmBrainMap";
import { JuniorTools } from "@/components/firm-brain/JuniorTools";
import { PageHeader } from "@/components/layout/PageHeader";
import { useProfile } from "@/hooks/use-profile";
import { FIRM_BRAIN_COPY, firmBrainAccess } from "@/lib/role-screens-shared";
import { profileHasFirmView } from "@/lib/workspace-capabilities";

const CARD = "rounded-[var(--radius)] border border-border bg-card p-4 shadow-card";

/**
 * 19 Nov 2026 (Liam, layout A): the Firm brain page behind its own menu row. It is made only from parts that already
 * exist, each with its own server check: the firm map for admins and leads (as on Firm view), Ask the firm for
 * everyone else in the firm, then How we do this and Prepare me. No fee or value is shown here to anyone who does
 * not see fees elsewhere: the ask box picks its starters by role, and the server writes fees from data for admins
 * and leads only.
 */
export function FirmBrainPage() {
  const { data: profile } = useProfile();
  const access = firmBrainAccess(profile);

  if (profile && access === "none") {
    return (
      <div data-testid="firm-brain-not-here">
        <PageHeader title={FIRM_BRAIN_COPY.title} subtitle={profile.role === "coach" && profileHasFirmView(profile) ? FIRM_BRAIN_COPY.notHereCoach : FIRM_BRAIN_COPY.notHere} />
      </div>
    );
  }

  return (
    <div className="pb-16" data-testid="firm-brain-page">
      <PageHeader title={FIRM_BRAIN_COPY.title} subtitle={FIRM_BRAIN_COPY.subtitle} />
      {profile ? (
        <div className="space-y-6">
          {access === "map" ? <FirmBrainMap profile={profile} /> : <AskTheFirm profile={profile} className={CARD} />}
          <JuniorTools profile={profile} className="grid gap-4 lg:grid-cols-2" />
        </div>
      ) : null}
    </div>
  );
}
