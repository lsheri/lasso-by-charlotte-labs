import { useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { CLIENT_MOVE_REFUSAL, CLIENT_RENAME_REFUSAL, saveOutcome } from "@/lib/save-guard";

export type ClientRow = {
  id: string;
  name: string;
  code: string | null;
  quick_folder: boolean;
  kind: "client" | "folder";
  parent_id: string | null;
};

export function useClients(orgId: string | undefined) {
  return useQuery({
    queryKey: ["clients", orgId],
    staleTime: 60_000,
    enabled: Boolean(orgId),
    queryFn: async (): Promise<ClientRow[]> => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, code, quick_folder, kind, parent_id")
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

/**
 * Creates a client or folder row and returns its id. Ordinary member insert,
 * no SQL. quick_folder is never written: the column keeps its default. The
 * database trigger owns the nesting rules and its message is thrown as is.
 */
export async function createClient(input: {
  orgId: string;
  name: string;
  /** Accepted for older callers and ignored. Nothing writes quick_folder now. */
  quickFolder?: boolean;
  kind?: "client" | "folder";
  parentId?: string | null;
}): Promise<string> {
  const id = crypto.randomUUID();
  const { error } = await supabase.from("clients").insert({
    id,
    org_id: input.orgId,
    name: input.name,
    ...(input.kind ? { kind: input.kind } : {}),
    ...(input.parentId ? { parent_id: input.parentId } : {}),
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
 * Moves a client under another container, or back to the top with null. The
 * row comes back so a refusal cannot read as a save. This does NOT call
 * eligibleParents: the caller checks eligibility, this performs the write.
 */
export async function reparentClient(input: {
  clientId: string;
  parentId: string | null;
}): Promise<void> {
  const result = await supabase
    .from("clients")
    .update({ parent_id: input.parentId })
    .eq("id", input.clientId)
    .select("id");
  const outcome = saveOutcome(result, CLIENT_MOVE_REFUSAL);
  if (!outcome.ok) throw new Error(outcome.message);
}
