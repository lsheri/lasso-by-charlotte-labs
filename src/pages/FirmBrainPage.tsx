import { FirmBrainCanvas } from "@/components/firm-brain/FirmBrainCanvas";
import { PageHeader } from "@/components/layout/PageHeader";
import { useProfile } from "@/hooks/use-profile";
import { FIRM_BRAIN_COPY, firmBrainAccess } from "@/lib/role-screens-shared";
import { profileHasFirmView } from "@/lib/workspace-capabilities";

/**
 * 20 Nov 2026, D-85 (Liam): the Firm brain page is one canvas. The firm map fills the page, the question floats on it,
 * and each answer builds beside the threads it came from. Everyone in the firm sees the map; fees reach admins and
 * leads only, and the server leaves them out for everyone else. Prepare me and How we do this open from the canvas.
 * A coach, a guest, or a workspace that is not a company is told plainly that the page is not for them.
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
    <div data-testid="firm-brain-page">
      {profile ? <FirmBrainCanvas profile={profile} /> : null}
    </div>
  );
}
