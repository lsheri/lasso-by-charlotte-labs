import { useQuery } from "@tanstack/react-query";

import { JuniorTools } from "@/components/firm-brain/JuniorTools";
import { HomeAsk } from "@/components/home/HomeAsk";
import { HomeBoard } from "@/components/home/HomeBoard";
import { HomeProposals } from "@/components/home/HomeProposals";
import { UsesHomeCard } from "@/components/person/UsesHomeCard";
import { useProfile } from "@/hooks/use-profile";
import { FIRM_MAP_HOME_CACHE, type FirmCanvasData } from "@/lib/firm-canvas-shared";
import { getFirmMap } from "@/lib/firm-map.functions";
import { homeAsksTheFirm } from "@/lib/home-ask-shared";

export function HomePage() {
  const { data: profile } = useProfile();
  const asks = homeAsksTheFirm(profile);
  return (
    <>
      <UsesHomeCard orgId={profile?.org_id} />
      {asks ? (
        // 21 Nov, D-85 PR B: everyone in the firm who is not an admin gets a mini firm brain at the top of Home, with
        // their boards as cards below. Prepare me and How we do this live on Firm brain now.
        <HomeBoard hero={<MiniFirmBrain profile={profile!} />} />
      ) : (
        <>
          {/* 19 Nov (Liam): an admin's Home leads with the proposals picture. */}
          <HomeProposals profile={profile} />
          {/* 20 Nov 2026 (D-97, chat pill PR 1b): Ask the firm lives in the chat pill now, on every page. */}
          <JuniorTools profile={profile} />
          <HomeBoard />
        </>
      )}
    </>
  );
}

/**
 * The greeting and the orb. The orb reads the same firm map as Firm brain (one cache entry, so the canvas opens with
 * it already there); the server leaves fees out for members. Asking happens in the chat pill (D-97).
 */
function MiniFirmBrain({
  profile,
}: {
  profile: { id?: string | null; role?: string | null; display_name?: string | null };
}) {
  const map = useQuery({
    queryKey: ["firm-map", profile.id ?? null],
    // Home is the landing page: it keeps the map for a minute and does not read it again on every focus (QA M3).
    // Firm brain still reads it fresh when opened, and every answer is read live, so sharing turned off applies to
    // answers at once and to the map within a minute.
    ...FIRM_MAP_HOME_CACHE,
    retry: (count, error) => !(error instanceof Response) && count < 1,
    queryFn: (): Promise<FirmCanvasData> =>
      getFirmMap({ data: { profile_id: profile.id ?? null } }),
  });
  return <HomeAsk displayName={profile.display_name} map={map.data ?? null} mapLoading={map.isPending} />;
}
