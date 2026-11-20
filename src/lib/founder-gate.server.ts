import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { isStaffEmail } from "@/lib/ai-costs-shared";

type Admin = SupabaseClient<Database>;

function refuse(): never {
  throw new Response("Forbidden", { status: 403 });
}

/**
 * 20 Nov 2026: the gate for founder-only writes (Set up a pilot). The same two checks as the AI costs page, both on
 * the server, both must pass, and any error fails closed with 403: the signed-in user's email is an exact
 * charlotte-labs.com address, and they hold an active platform_admins row with the founder role. A workspace admin of
 * any firm, QA (@qaprobe.test) and demo (@kestrelbay.test) people all fail.
 */
export async function requireFounder(admin: Admin, userId: string | null | undefined): Promise<void> {
  if (!userId) refuse();
  let email: string | null | undefined;
  try {
    const { data, error } = await admin.auth.admin.getUserById(userId);
    if (error) refuse();
    email = data?.user?.email;
  } catch {
    refuse();
  }
  if (!isStaffEmail(email)) refuse();
  try {
    const { data, error } = await admin.from("platform_admins").select("role").eq("user_id", userId).is("disabled_at", null).limit(5);
    if (error) refuse();
    if (!((data ?? []) as { role: string }[]).some((row) => row.role === "founder")) refuse();
  } catch (e) {
    if (e instanceof Response) throw e;
    refuse();
  }
}
