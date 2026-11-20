import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { AdminHome } from "@/components/home/AdminHome";
import { HomeAsk } from "@/components/home/HomeAsk";
import { HomeBoard } from "@/components/home/HomeBoard";
import { UsesHomeCard } from "@/components/person/UsesHomeCard";
import { useEngagementViews } from "@/hooks/use-engagement-views";
import { useEngagements } from "@/hooks/use-engagements";
import { useProfile } from "@/hooks/use-profile";
import { askTheFirm } from "@/lib/firm-ask.functions";
import { FIRM_MAP_HOME_CACHE, type FirmCanvasData } from "@/lib/firm-canvas-shared";
import { getFirmMap } from "@/lib/firm-map.functions";
import { homeAsksTheFirm } from "@/lib/home-ask-shared";
import { orderHomeGrid } from "@/lib/home-grid";
import { homeShowsProposals } from "@/lib/role-screens-shared";

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
 * The greeting, the orb and the question box, with starters made from the person's most recently opened board. The
 * orb reads the same firm map as Firm brain (one cache entry, so the canvas opens with it already there); the server
 * leaves fees out for members.
 */
function MiniFirmBrain({
  profile,
}: {
  profile: { id?: string | null; role?: string | null; display_name?: string | null };
}) {
  const ask = useServerFn(askTheFirm);
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
  const { data: engagements } = useEngagements(profile.id ?? undefined);
  const { data: views } = useEngagementViews(profile.id ?? undefined);
  const viewed = new Map((views ?? []).map((row) => [row.engagement_id, row.last_viewed_at]));
  const recent = orderHomeGrid(
    (engagements ?? []).map((engagement) => ({
      title: engagement.title,
      lastViewedAt: viewed.get(engagement.id) ?? null,
    })),
  )[0];
  return (
    <HomeAsk
      displayName={profile.display_name}
      role={profile.role}
      profileId={profile.id ?? ""}
      recentBoard={recent?.title ?? null}
      map={map.data ?? null}
      mapLoading={map.isPending}
      askFirm={(question) =>
        ask({ data: { question, starter: null, profile_id: profile.id ?? null } })
      }
    />
  );
}
