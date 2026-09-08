import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { useProfile } from "@/hooks/use-profile";
import { linkDims, type CoachingLinkRow } from "@/lib/coaching-access";
import {
  actOnCoachingLink,
  listCoachLinkPeople,
  listItemExclusions,
  listMyCoachingLinks,
  setItemShared,
} from "@/lib/coaching-links.functions";
import { logEvent } from "@/lib/telemetry";
import type { TelemetryEvent } from "@/lib/telemetry-shared";

/** PASS 170 — the coaching link reads and writes the surfaces share. */

export function useMyCoachingLinks() {
  const { data: profile } = useProfile();
  const list = useServerFn(listMyCoachingLinks);
  return useQuery({
    queryKey: ["coaching-links", "mine", profile?.id],
    enabled: Boolean(profile?.id),
    queryFn: () => list({ data: { profile_id: profile?.id } }),
  });
}

export function useCoachLinkPeople() {
  const { data: profile } = useProfile();
  const list = useServerFn(listCoachLinkPeople);
  return useQuery({
    queryKey: ["coaching-links", "people", profile?.id],
    enabled: Boolean(profile?.id),
    queryFn: () => list({ data: { profile_id: profile?.id } }),
  });
}

const ACTION_EVENT: Record<string, TelemetryEvent> = {
  consent: "coachlink.consented",
  decline: "coachlink.ended",
  withdraw: "coachlink.withdrawn",
  disclose: "coachlink.disclosed",
  end: "coachlink.ended",
};

export function useCoachingLinkAction() {
  const { data: profile } = useProfile();
  const act = useServerFn(actOnCoachingLink);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      link: CoachingLinkRow;
      action: "consent" | "decline" | "withdraw" | "disclose" | "end";
    }) => {
      await act({ data: { profile_id: profile?.id, link_id: input.link.id, action: input.action } });
      const name = ACTION_EVENT[input.action];
      if (profile && name) logEvent(name, profile.org_id, linkDims(input.link));
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["coaching-links"] });
    },
  });
}

export function useItemExclusions(workItemId: string | null) {
  const { data: profile } = useProfile();
  const list = useServerFn(listItemExclusions);
  return useQuery({
    queryKey: ["coaching-links", "item", workItemId, profile?.id],
    enabled: Boolean(profile?.id && workItemId),
    queryFn: () => list({ data: { profile_id: profile?.id, work_item_id: workItemId ?? "" } }),
  });
}

export function useSetItemShared() {
  const { data: profile } = useProfile();
  const save = useServerFn(setItemShared);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { link: CoachingLinkRow; workItemId: string; shared: boolean }) => {
      await save({
        data: {
          profile_id: profile?.id,
          link_id: input.link.id,
          work_item_id: input.workItemId,
          shared: input.shared,
        },
      });
      if (profile) {
        logEvent(
          input.shared ? "coachlink.item_restored" : "coachlink.item_excluded",
          profile.org_id,
          linkDims(input.link),
        );
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["coaching-links"] });
    },
  });
}
