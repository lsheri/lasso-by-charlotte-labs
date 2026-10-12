import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { getDataUse } from "@/lib/consent.functions";
import { setDataConsent } from "@/lib/data-consent.functions";
import { effectiveTier, needsReconfirm, RIGHTS_BLOCK, tierLabel, type DataTier } from "@/lib/data-consent-shared";
import { ConfirmDialog, OrgDataCard, ReconfirmNotice, ResearchBlock, TierList, useConsent } from "./YourDataCard";
import { DataUseCard } from "./DataUseCard";
import { SampleEventDialog } from "./SampleEventDialog";

export const COPY = {
  individualHeading: "What leaves your workspace",
  rightNow: (label: string) => `Right now: ${label}.`,
  personalHeading: "Your level",
  ceiling: (workspace: string, label: string) => `${workspace} allows up to ${label}. Your workspace admin sets this.`,
  improvement: "Your workspace also allows de-identified product improvement.",
  wholeWorkspace: "For the whole workspace",
  purposes: "What workspace data may be used for",
  coach: "Nothing of yours leaves through this workspace. You see only what people choose to share with you.",
  membersLink: "The workspace data level is in Settings, under Your data.",
} as const;

/** The existing queries and mutations remain the authority for each scope. */
export function DataSection() {
  const { profile, data } = useConsent();
  if (!profile) return null;
  if (profile.role === "coach" || data?.role === "coach") {
    return <p className="text-sm leading-relaxed text-muted-foreground">{COPY.coach}</p>;
  }
  if (!data) return null;
  return <DataLevels individual={profile.org_type === "personal" && data.is_admin} />;
}

function DataLevels({ individual }: { individual: boolean }) {
  const { profile, data } = useConsent();
  const queryClient = useQueryClient();
  const save = useServerFn(setDataConsent);
  const loadPurposes = useServerFn(getDataUse);
  const { data: purposes } = useQuery({
    queryKey: ["data-use", profile?.id],
    enabled: Boolean(profile?.id) && !individual,
    queryFn: () => loadPurposes({ data: { profile_id: profile?.id } }),
  });
  const [pending, setPending] = useState<DataTier | null>(null);
  const mutation = useMutation({
    mutationFn: async (tier: DataTier) => {
      if (individual) {
        await save({ data: { scope: "org", tier, tier_d_switch: tier === "d", surface: "personal_settings", profile_id: profile?.id } });
      }
      return save({ data: { scope: "user", tier, surface: "personal_settings", profile_id: profile?.id } });
    },
    onSuccess: () => { setPending(null); toast.success("Saved"); },
    onError: (error: unknown) => { setPending(null); toast.error(error instanceof Error ? error.message : "That could not be saved. Try again."); },
    // Read back even if the second Individual write fails, since the first may have succeeded.
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["data-consent", profile?.id] }),
  });
  if (!data) return null;
  const current = individual ? effectiveTier(data.org_tier, data.user_tier) : data.user_tier;
  const reconfirm = needsReconfirm(data.user_tier, data.user_text_version) || (individual && needsReconfirm(data.org_tier, data.org_text_version));
  return (
    <div className="space-y-6">
      <section>
        <h2 className="micro-label micro-label-section">{individual ? COPY.individualHeading : COPY.personalHeading}</h2>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <p className="text-sm text-foreground">{individual ? COPY.rightNow(tierLabel(current)) : tierLabel(current)}</p>
          <SampleEventDialog tier={effectiveTier(data.org_tier, data.user_tier)} />
        </div>
        {reconfirm ? <ReconfirmNotice busy={mutation.isPending} onConfirm={() => mutation.mutate("d")} /> : null}
        <TierList name="personal-data-level" value={current} ceiling={individual ? undefined : data.org_tier}
          onPick={(tier) => tier === current ? null : setPending(tier)} />
        {individual ? null : <>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{COPY.ceiling(profile?.org_name ?? "", tierLabel(data.org_tier))}</p>
          {purposes?.grants["deidentified_improvement"] === true ? <p className="mt-2 text-sm text-muted-foreground">{COPY.improvement}</p> : null}
        </>}
      </section>
      {individual ? <DataUseCard individual heading={COPY.purposes} /> : null}
      {!individual && data.is_admin ? <section className="rounded-[var(--radius-control)] border border-border p-4">
        <h2 className="mb-4 font-medium text-foreground">{COPY.wholeWorkspace}</h2>
        <OrgDataCard />
        <div className="mt-6"><DataUseCard heading={COPY.purposes} /></div>
      </section> : null}
      {data.org_tier === "t0" ? null : <ResearchBlock profileId={profile?.id} choice={data.research_choice} />}
      <p className="text-sm leading-relaxed text-muted-foreground">{RIGHTS_BLOCK}</p>
      <ConfirmDialog pending={pending} scope="user" busy={mutation.isPending}
        onCancel={() => setPending(null)} onConfirm={() => pending ? mutation.mutate(pending) : null} />
    </div>
  );
}