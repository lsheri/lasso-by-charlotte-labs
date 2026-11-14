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

export type QaResetRow = { email: string; outcome: "reset" | "missing" | "failed"; note?: string };
/** The new password is returned once, to the founder admin who asked, and never logged or stored. */
export type QaResetResult = { password: string; rows: QaResetRow[] };

/**
 * The users a reset may touch: only exact matches for the QA emails, all on the .test domain, so a
 * reset can never reach a real person's account.
 */
export function qaUsersToReset<T extends { id: string; email?: string | null | undefined }>(
  users: readonly T[],
  emails: readonly string[] = QA_EMAILS,
): Map<string, string> {
  const wanted = new Set(emails.filter((email) => email.endsWith("@qaprobe.test")));
  const found = new Map<string, string>();
  for (const user of users) {
    const email = user.email?.toLowerCase();
    if (email && wanted.has(email)) found.set(email, user.id);
  }
  return found;
}

/** A fresh random password: 24 URL-safe characters (144 bits). */
export function newQaPassword(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

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

/**
 * Sets one new random password on every QA identity that exists, and returns it once. For when
 * LASSO_QA_PASSWORD is unknown: the founder admin copies it into a Pane secret, so agents can sign in
 * as QA without anyone needing to remember it. Same gate as seeding: founder org admins only.
 */
export const resetQaPasswords = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { profile_id?: string | undefined }) => input)
  .handler(async ({ data, context }): Promise<QaResetResult> => {
    const { resolveProfile } = await import("./profile-resolve");
    const profile = await resolveProfile(context.supabase, context.userId, data.profile_id);
    if (!profile || profile.role !== "admin" || profile.org_id !== QA_SEED_ORG_ID) {
      throw new Error("Forbidden");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const users: { id: string; email?: string | null | undefined }[] = [];
    for (let page = 1; page <= 50; page++) {
      const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage: 1000,
      });
      if (error) throw new Error(error.message);
      users.push(...list.users);
      if (list.users.length < 1000) break;
    }
    const ids = qaUsersToReset(users);

    const password = newQaPassword();
    const rows: QaResetRow[] = [];
    for (const email of QA_EMAILS) {
      const id = ids.get(email);
      if (!id) {
        rows.push({ email, outcome: "missing" });
        continue;
      }
      const { error } = await supabaseAdmin.auth.admin.updateUserById(id, { password });
      // The password is never part of a message, so an error is safe to show.
      rows.push(
        error ? { email, outcome: "failed", note: error.message } : { email, outcome: "reset" },
      );
    }
    return { password, rows };
  });
