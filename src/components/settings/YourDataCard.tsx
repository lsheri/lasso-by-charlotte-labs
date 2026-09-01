import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useProfile } from "@/hooks/use-profile";
import {
  ABOVE_CEILING_LINE,
  CEILING_LINE_PREFIX,
  CONTENT_SWITCH_LINE,
  RESEARCH_BODY,
  RESEARCH_HEADING,
  RESEARCH_SAVED_LINE,
  RIGHTS_BLOCK,
  SURFACE_NAME,
  TIER_COPY,
  effectiveTier,
  tierCopy,
  tierLabel,
  tierRank,
  type DataTier,
  type ResearchChoice,
} from "@/lib/data-consent-shared";
import {
  getDataConsent,
  recordResearchChoice,
  setDataConsent,
} from "@/lib/data-consent.functions";

import { SampleEventDialog } from "./SampleEventDialog";

function useConsent() {
  const { data: profile } = useProfile();
  const load = useServerFn(getDataConsent);
  const query = useQuery({
    queryKey: ["data-consent", profile?.id],
    enabled: Boolean(profile?.id),
    queryFn: () => load({ data: { profile_id: profile?.id } }),
  });
  return { profile, ...query };
}

function TierList({
  value,
  ceiling,
  onPick,
  name,
}: {
  value: DataTier;
  ceiling?: DataTier | undefined;
  onPick: (tier: DataTier) => void;
  name: string;
}) {
  return (
    <div className="mt-4 space-y-2">
      {TIER_COPY.map((copy) => {
        const blocked = ceiling ? tierRank(copy.tier) > tierRank(ceiling) : false;
        const selected = value === copy.tier;
        return (
          <label
            key={copy.tier}
            className={`flex cursor-pointer items-start gap-3 rounded-[var(--radius)] border px-4 py-3 ${
              selected ? "border-foreground bg-secondary" : "border-border bg-card"
            } ${blocked ? "cursor-not-allowed opacity-60" : ""}`}
          >
            <input
              type="radio"
              name={name}
              className="mt-1"
              checked={selected}
              disabled={blocked}
              onChange={() => onPick(copy.tier)}
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-foreground">
                {copy.label}
                {selected ? " (current)" : ""}
              </span>
              <span className="mt-1 block text-sm text-muted-foreground">{copy.description}</span>
              {blocked ? (
                <span className="mt-1 block text-xs text-muted-foreground">
                  {ABOVE_CEILING_LINE}
                </span>
              ) : null}
            </span>
          </label>
        );
      })}
    </div>
  );
}

function ConfirmDialog({
  pending,
  scope,
  onCancel,
  onConfirm,
  busy,
}: {
  pending: DataTier | null;
  scope: "org" | "user";
  onCancel: () => void;
  onConfirm: () => void;
  busy: boolean;
}) {
  return (
    <AlertDialog open={Boolean(pending)} onOpenChange={(open) => (open ? null : onCancel())}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {pending ? `Change to "${tierLabel(pending)}"?` : SURFACE_NAME}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {pending ? tierCopy(pending).description : ""}
            {scope === "org"
              ? " This sets what the whole organization may share. People can choose less for themselves."
              : " You can change this at any time."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Keep as is</AlertDialogCancel>
          <AlertDialogAction disabled={busy} onClick={onConfirm}>
            Save this level
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function dateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** The organization level, admin only. Lives beside People and invites. */
export function OrgDataCard() {
  const { profile, data } = useConsent();
  const queryClient = useQueryClient();
  const save = useServerFn(setDataConsent);
  const [pending, setPending] = useState<DataTier | null>(null);

  const mutation = useMutation({
    mutationFn: (input: { tier: DataTier; tier_d_switch?: boolean }) =>
      save({
        data: {
          scope: "org" as const,
          tier: input.tier,
          tier_d_switch: input.tier_d_switch ?? data?.org_tier_d_switch ?? false,
          surface: "org_settings",
          profile_id: profile?.id,
        },
      }),
    onSuccess: async () => {
      setPending(null);
      await queryClient.invalidateQueries({ queryKey: ["data-consent", profile?.id] });
      toast.success("Saved");
    },
    onError: (e: unknown) => {
      setPending(null);
      toast.error((e as Error)?.message || "That could not be saved. Try again.");
    },
  });

  if (!data || !data.is_admin) return null;

  return (
    <section>
      <h2 className="micro-label micro-label-section">{SURFACE_NAME}</h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
        What this organization shares outside the workspace. You can change it at any time.
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-3">
        <p className="text-sm text-foreground">Current level: {tierLabel(data.org_tier)}</p>
        <SampleEventDialog tier={data.org_tier} />
      </div>

      <TierList
        name="org-data-level"
        value={data.org_tier}
        onPick={(tier) => (tier === data.org_tier ? null : setPending(tier))}
      />

      {data.org_tier === "d" ? (
        <div className="mt-3 flex items-start justify-between gap-4 rounded-[var(--radius)] border border-border bg-card px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">Include shared work content</p>
            <p className="mt-1 text-sm text-muted-foreground">{CONTENT_SWITCH_LINE}</p>
          </div>
          <Switch
            checked={data.org_tier_d_switch}
            disabled={mutation.isPending}
            aria-label="Include shared work content"
            onCheckedChange={(next) => mutation.mutate({ tier: "d", tier_d_switch: next })}
          />
        </div>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">{CONTENT_SWITCH_LINE}</p>
      )}

      <h3 className="micro-label micro-label-section mt-6">Changes</h3>
      {data.changes.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">No changes yet.</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {data.changes.map((change) => (
            <li
              key={change.version}
              className="rounded-[var(--radius)] border border-border bg-card px-4 py-2.5 text-xs text-muted-foreground"
            >
              {dateLabel(change.created_at)} · {change.actor_name ?? "Someone"} ·{" "}
              {change.old_tier ? tierLabel(change.old_tier as DataTier) : "Default"} to{" "}
              {tierLabel(change.new_tier as DataTier)}
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        pending={pending}
        scope="org"
        busy={mutation.isPending}
        onCancel={() => setPending(null)}
        onConfirm={() => (pending ? mutation.mutate({ tier: pending }) : null)}
      />
    </section>
  );
}

/** The person's own level, bounded by the organization. Coaches see nothing. */
export function PersonalDataCard() {
  const { profile, data } = useConsent();
  const queryClient = useQueryClient();
  const save = useServerFn(setDataConsent);
  const [pending, setPending] = useState<DataTier | null>(null);

  const mutation = useMutation({
    mutationFn: (tier: DataTier) =>
      save({
        data: {
          scope: "user" as const,
          tier,
          surface: "personal_settings",
          profile_id: profile?.id,
        },
      }),
    onSuccess: async () => {
      setPending(null);
      await queryClient.invalidateQueries({ queryKey: ["data-consent", profile?.id] });
      toast.success("Saved");
    },
    onError: (e: unknown) => {
      setPending(null);
      toast.error((e as Error)?.message || "That could not be saved. Try again.");
    },
  });

  if (!data || data.role === "coach") return null;

  return (
    <section>
      <h2 className="micro-label micro-label-section">{SURFACE_NAME}</h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
        {CEILING_LINE_PREFIX}
        {tierLabel(data.org_tier)}
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-3">
        <p className="text-sm text-foreground">Your level: {tierLabel(data.user_tier)}</p>
        <SampleEventDialog tier={effectiveTier(data.org_tier, data.user_tier)} />
      </div>

      <TierList
        name="personal-data-level"
        value={data.user_tier}
        ceiling={data.org_tier}
        onPick={(tier) => (tier === data.user_tier ? null : setPending(tier))}
      />

      <p className="mt-4 text-sm text-muted-foreground">{RIGHTS_BLOCK}</p>

      {data.org_tier === "t0" ? null : <ResearchBlock profileId={profile?.id} />}


      <ConfirmDialog
        pending={pending}
        scope="user"
        busy={mutation.isPending}
        onCancel={() => setPending(null)}
        onConfirm={() => (pending ? mutation.mutate(pending) : null)}
      />
    </section>
  );
}
