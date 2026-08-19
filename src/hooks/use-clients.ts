import { useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { QUICK_FOLDER_ENGAGEMENT_TITLE } from "@/lib/clients";
import { CLIENT_RENAME_REFUSAL, saveOutcome } from "@/lib/save-guard";

export type ClientRow = {
  id: string;
  name: string;
  code: string | null;
  quick_folder: boolean;
};

export function useClients(orgId: string | undefined) {
  return useQuery({
    queryKey: ["clients", orgId],
    staleTime: 60_000,
    enabled: Boolean(orgId),
    queryFn: async (): Promise<ClientRow[]> => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, code, quick_folder")
        .eq("org_id", orgId as string)
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ClientRow[];
    },
  });
}

export function useInvalidateClients() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ["clients"] });
    void queryClient.invalidateQueries({ queryKey: ["engagements"] });
  };
}

/** Creates a client row and returns its id. Ordinary member insert, no SQL. */
export async function createClient(input: {
  orgId: string;
  name: string;
  quickFolder: boolean;
}): Promise<string> {
  const id = crypto.randomUUID();
  const { error } = await supabase.from("clients").insert({
    id,
    org_id: input.orgId,
    name: input.name,
    quick_folder: input.quickFolder,
  });
  if (error) throw new Error(error.message);
  return id;
}

/**
 * Renames a client. The row comes back so a refusal cannot read as a save.
 */
export async function renameClient(input: { clientId: string; name: string }): Promise<void> {
  const result = await supabase
    .from("clients")
    .update({ name: input.name })
    .eq("id", input.clientId)
    .select("id");
  const outcome = saveOutcome(result, CLIENT_RENAME_REFUSAL);
  if (!outcome.ok) throw new Error(outcome.message);
}

/**
 * A quick folder in one step: the client, then the hidden engagement that
 * carries its work. The engagement title is never surfaced anywhere.
 */
export async function createQuickFolder(input: {
  orgId: string;
  profileId: string;
  name: string;
}): Promise<{ clientId: string; engagementId: string }> {
  const clientId = await createClient({ orgId: input.orgId, name: input.name, quickFolder: true });
  const engagementId = crypto.randomUUID();
  const code = `QF-${input.name.replace(/[^A-Za-z0-9]/g, "").slice(0, 6).toUpperCase() || "FOLDER"}-${engagementId.slice(0, 4).toUpperCase()}`;
  const { error } = await supabase.from("engagements").insert({
    id: engagementId,
    org_id: input.orgId,
    client_id: clientId,
    code,
    title: QUICK_FOLDER_ENGAGEMENT_TITLE,
  });
  if (error) throw new Error(error.message);
  const { error: memberError } = await supabase.from("engagement_members").insert({
    engagement_id: engagementId,
    profile_id: input.profileId,
    member_role: "em",
  });
  if (memberError) throw new Error(memberError.message);
  return { clientId, engagementId };
}
