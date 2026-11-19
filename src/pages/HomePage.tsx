import { AskTheFirm } from "@/components/firm-brain/AskTheFirm";
import { JuniorTools } from "@/components/firm-brain/JuniorTools";
import { HomeBoard } from "@/components/home/HomeBoard";
import { UsesHomeCard } from "@/components/person/UsesHomeCard";
import { useProfile } from "@/hooks/use-profile";

export function HomePage() {
  const { data: profile } = useProfile();
  return (
    <>
      <UsesHomeCard orgId={profile?.org_id} />
      <AskTheFirm profile={profile} />
      <JuniorTools profile={profile} />
      <HomeBoard />
    </>
  );
}
