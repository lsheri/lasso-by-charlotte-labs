import { PageHeader } from "@/components/layout/PageHeader";
import { SavedForOneOnOne } from "@/components/oneonone/SaveForOneOnOne";
import { useProfile } from "@/hooks/use-profile";

export function OneOnOnePage() {
  const { data: profile } = useProfile();
  return (
    <div>
      <PageHeader
        title="1:1 prep"
        subtitle="Structured context for your next coaching conversation."
      />
      {profile ? <SavedForOneOnOne profileId={profile.id} /> : null}
    </div>
  );
}
