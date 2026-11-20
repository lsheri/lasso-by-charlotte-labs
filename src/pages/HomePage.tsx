import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { AskTheFirm } from "@/components/firm-brain/AskTheFirm";
import { JuniorTools } from "@/components/firm-brain/JuniorTools";
import { HomeAsk } from "@/components/home/HomeAsk";
import { HomeBoard } from "@/components/home/HomeBoard";
import { HomeProposals } from "@/components/home/HomeProposals";
import { UsesHomeCard } from "@/components/person/UsesHomeCard";
import { useEngagementViews } from "@/hooks/use-engagement-views";
import { useEngagements } from "@/hooks/use-engagements";
import { useProfile } from "@/hooks/use-profile";
import { askTheFirm } from "@/lib/firm-ask.functions";
import type { FirmCanvasData } from "@/lib/firm-canvas-shared";
import { getFirmMap } from "@/lib/firm-map.functions";
import { homeAsksTheFirm } from "@/lib/home-ask-shared";
import { orderHomeGrid } from "@/lib/home-grid";

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
          <AskTheFirm profile={profile} />
          <JuniorTools profile={profile} />
          <HomeBoard />
        </>
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
    staleTime: 0,
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
      recentBoard={recent?.title ?? null}
      map={map.data ?? null}
      mapLoading={map.isPending}
      askFirm={(question) =>
        ask({ data: { question, starter: null, profile_id: profile.id ?? null } })
      }
    />
  );
}
