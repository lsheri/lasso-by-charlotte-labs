import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** The founder workspace. Only an admin of this org may seed QA people. */
export const QA_SEED_ORG_ID = "9aba1545-7354-4caf-b631-cdbae82d7e06";

/**
 * QA identities, one per product shape. Nothing else is created: no orgs and
 * no profiles, so every one of these people walks the real onboarding.
 */
export const QA_EMAILS = [
  "qa.company.admin@qaprobe.test",
  "qa.company.em@qaprobe.test",
  "qa.company.coach@qaprobe.test",
  "qa.personal@qaprobe.test",
  "qa.edu.teacher@qaprobe.test",
  "qa.edu.student@qaprobe.test",
] as const;

export type QaSeedRow = { email: string; outcome: "created" | "existed" | "failed"; note?: string };
export type QaSeedResult = { rows: QaSeedRow[] };

function looksLikeAlreadyRegistered(message: string): boolean {
  const text = message.toLowerCase();
  return (
    text.includes("already registered") ||
    text.includes("already been registered") ||
    text.includes("already exists") ||
    text.includes("duplicate")
  );
}

export const seedQaPeople = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { profile_id?: string | undefined }) => input)
  .handler(async ({ data, context }): Promise<QaSeedResult> => {
    const { resolveProfile } = await import("./profile-resolve");
    const profile = await resolveProfile(context.supabase, context.userId, data.profile_id);
    if (!profile || profile.role !== "admin" || profile.org_id !== QA_SEED_ORG_ID) {
      throw new Error("Forbidden");
    }

    const password = process.env["LASSO_QA_PASSWORD"];
    if (!password) {
      throw new Error(
        "LASSO_QA_PASSWORD is not set. Add it in Project Settings, Secrets, then try again.",
      );
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rows: QaSeedRow[] = [];
    for (const email of QA_EMAILS) {
      const { error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (!error) {
        rows.push({ email, outcome: "created" });
        continue;
      }
      if (looksLikeAlreadyRegistered(error.message)) {
        rows.push({ email, outcome: "existed" });
        continue;
      }
      // The password is never part of a message, so an error is safe to show.
      rows.push({ email, outcome: "failed", note: error.message });
    }
    return { rows };
  });
