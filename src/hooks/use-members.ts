import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  changeMemberRole,
  deactivateMember,
  listMembers,
  reactivateMember,
  revokeInvite,
} from "@/lib/members.functions";
import type { MembersPayload } from "@/lib/members-shared";

export function useMembers(profileId: string | undefined) {
  return useQuery({
    queryKey: ["members", profileId],
    enabled: Boolean(profileId),
    queryFn: (): Promise<MembersPayload> =>
      listMembers({ data: { profile_id: profileId as string } }),
  });
}

type Action =
  | { kind: "deactivate"; member_id: string }
  | { kind: "reactivate"; member_id: string }
  | { kind: "role"; member_id: string; role: "em" | "lead" }
  | { kind: "revoke"; code: string };

export function useMemberAction(profileId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (action: Action) => {
      const profile_id = profileId as string;
      if (action.kind === "deactivate")
        return deactivateMember({ data: { profile_id, member_id: action.member_id } });
      if (action.kind === "reactivate")
        return reactivateMember({ data: { profile_id, member_id: action.member_id } });
      if (action.kind === "role")
        return changeMemberRole({
          data: { profile_id, member_id: action.member_id, role: action.role },
        });
      return revokeInvite({ data: { profile_id, code: action.code } });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["members"] });
      void queryClient.invalidateQueries({ queryKey: ["profiles"] });
    },
  });
}