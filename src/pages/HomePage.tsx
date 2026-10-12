import { HomeBoard } from "@/components/home/HomeBoard";
import { UsesHomeCard } from "@/components/person/UsesHomeCard";
import { useProfile } from "@/hooks/use-profile";

export function HomePage() {
  const { data: profile } = useProfile();
  return (
    <>
      <UsesHomeCard orgId={profile?.org_id} />
      <HomeBoard />
    </>
  );
}
