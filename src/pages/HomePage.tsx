import { AskTheFirm } from "@/components/firm-brain/AskTheFirm";
import { JuniorTools } from "@/components/firm-brain/JuniorTools";
import { HomeBoard } from "@/components/home/HomeBoard";
import { HomeProposals } from "@/components/home/HomeProposals";
import { UsesHomeCard } from "@/components/person/UsesHomeCard";
import { useProfile } from "@/hooks/use-profile";

export function HomePage() {
  const { data: profile } = useProfile();
  return (
    <>
      <UsesHomeCard orgId={profile?.org_id} />
      {/* 19 Nov (Liam): an admin's Home leads with the proposals picture. Everyone else's Home is unchanged. */}
      <HomeProposals profile={profile} />
      <AskTheFirm profile={profile} />
      <JuniorTools profile={profile} />
      <HomeBoard />
    </>
  );
}
