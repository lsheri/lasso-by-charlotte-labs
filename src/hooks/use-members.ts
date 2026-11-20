import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  changeMemberRoleFn,
  deactivateMember,
  listMembers,
  reactivateMember,
  resendInvite,
  revokeInvite,
} from "@/lib/members.functions";
import type { MembersPayload } from "@/lib/members-shared";

export function useMembers(profileId: string | undefined) {
  return useQuery({
    queryKey: ["members", profileId],
    staleTime: 60_000,
    enabled: Boolean(profileId),
    queryFn: (): Promise<MembersPayload> =>
      listMembers({ data: { profile_id: profileId as string } }),
  });
}

type Action =
  | { kind: "deactivate"; member_id: string }
  | { kind: "reactivate"; member_id: string }
  | { kind: "revoke"; code: string }
  | { kind: "resend"; code: string };

export function useMemberAction(profileId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (action: Action) => {
      const profile_id = profileId as string;
      if (action.kind === "deactivate")
        return deactivateMember({ data: { profile_id, member_id: action.member_id } });
      if (action.kind === "reactivate")
        return reactivateMember({ data: { profile_id, member_id: action.member_id } });
      if (action.kind === "resend")
        return resendInvite({
          data: { profile_id, code: action.code },
        });
      return revokeInvite({ data: { profile_id, code: action.code } });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["members"] });
      void queryClient.invalidateQueries({ queryKey: ["profiles"] });
    },
  });
}

/** 20 Nov 2026: change a teammate's role between Admin, Lead and Member. Every rule runs on the server. */
export function useChangeMemberRole(profileId: string | undefined) {
  return (memberId: string, role: import("@/lib/member-roles-shared").MemberRole) =>
    changeMemberRoleFn({ data: { profile_id: profileId, member_id: memberId, role } });
}
