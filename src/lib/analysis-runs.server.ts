import type { Database } from "@/integrations/supabase/types";

type RunInsert = Database["public"]["Tables"]["analysis_runs"]["Insert"];
type RunUpdate = Database["public"]["Tables"]["analysis_runs"]["Update"];

export type CreateRunFields = Pick<
  RunInsert,
  | "preset"
  | "scope_type"
  | "scope_id"
  | "idempotency_key"
  | "org_id"
  | "owner_id"
  | "run_by_profile_id"
  | "session_id"
>;

export type CompleteRunFields = Pick<
  RunUpdate,
  | "items_read"
  | "tokens_in"
  | "tokens_out"
  | "cost_usd"
  | "claims_rendered"
  | "suppressed_claims"
>;

export async function createRun(fields: CreateRunFields): Promise<{ id: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("analysis_runs")
    .insert({ ...fields, status: "running" })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "analysis_run_create_failed");
  return data;
}

export async function failRun(runId: string, errorClass: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin
    .from("analysis_runs")
    .update({
      status: "failed",
      error_class: errorClass,
      completed_at: new Date().toISOString(),
    })
    .eq("id", runId);
  if (error) throw new Error(error.message);
}

export async function completeRun(runId: string, fields: CompleteRunFields): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin
    .from("analysis_runs")
    .update({ ...fields, status: "completed", completed_at: new Date().toISOString() })
    .eq("id", runId);
  if (error) throw new Error(error.message);
}