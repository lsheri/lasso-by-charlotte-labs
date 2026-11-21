import { useQuery } from "@tanstack/react-query";

import { AdminHome } from "@/components/home/AdminHome";
import { HomeAsk } from "@/components/home/HomeAsk";
import { HomeBoard } from "@/components/home/HomeBoard";
import { HomeStartProposal } from "@/components/home/HomeStartProposal";
import { LeadUpNext } from "@/components/home/LeadUpNext";
import { UsesHomeCard } from "@/components/person/UsesHomeCard";
import { useProfile } from "@/hooks/use-profile";
import { FIRM_MAP_HOME_CACHE, type FirmCanvasData } from "@/lib/firm-canvas-shared";
import { getFirmMap } from "@/lib/firm-map.functions";
import { pillAccess } from "@/lib/chat-pill-shared";
import { homeAsksTheFirm } from "@/lib/home-ask-shared";
import { homeShowsProposals } from "@/lib/role-screens-shared";

export function HomePage() {
  const { data: profile } = useProfile();
  const asks = homeAsksTheFirm(profile);
  return (
    <>
      <UsesHomeCard orgId={profile?.org_id} />
      {/* 21 Nov 2026, PR 4b: the proposals this person leads, first. Renders nothing for someone who leads none. */}
      {pillAccess(profile) === "firm" ? <LeadUpNext profileId={profile?.id} /> : null}
      {/* 21 Nov 2026, click path cards: start a proposal (or pass a brief) on a step card, never through the chat. */}
      {pillAccess(profile) === "firm" && profile ? <HomeStartProposal profile={profile} /> : null}
      {asks ? (
        // 21 Nov, D-85 PR B: everyone in the firm who is not an admin gets a mini firm brain at the top of Home, with
        // their boards as cards below. Prepare me and How we do this live on Firm brain now.
        <HomeBoard hero={<MiniFirmBrain profile={profile!} />} />
      ) : homeShowsProposals(profile) ? (
        // 21 Nov, D-82: an admin's Home is only the operating picture: what waits on them, then earlier today. Ask the
        // firm lives on Firm brain (one row away in the menu) and the boards sit in the menu's lower Boards section.
        <AdminHome profile={profile} />
      ) : (
        <HomeBoard />
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
