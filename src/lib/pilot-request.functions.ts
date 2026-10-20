import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const PILOT_TEAM_SIZES = ["1-5", "6-15", "16-40", "40+"] as const;

export const pilotRequestSchema = z.object({
  name: z.string().trim().min(1).max(200),
  firm: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(320),
  team_size: z.enum(PILOT_TEAM_SIZES),
  note: z.string().trim().max(2000).optional(),
  website: z.string().max(500).optional(),
});

export type PilotRequestInput = z.infer<typeof pilotRequestSchema>;

export type SavedPilotRequest = PilotRequestInput & { id: string; created_at: string };

export async function notifyLiamByInkbox(
  request: SavedPilotRequest,
): Promise<"sent" | "skipped"> {
  const apiKey = process.env["INKBOX_API_KEY"];
  if (!apiKey) return "skipped";

  // TODO: INKBOX_API_KEY is pending. Implement after Inkbox confirms its REST endpoint and request contract.
  void request;
  throw new Error("Inkbox notification is not configured");
}

type PilotRequestExtra = { user_id?: string; source?: "signup"; status?: "pending" };

/** Shared insert and notify for the landing form and the signup gate. */
async function savePilotRequest(data: PilotRequestInput, extra: PilotRequestExtra): Promise<void> {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error: insertError } = await supabaseAdmin
      .from("pilot_requests")
      // user_id, source and status arrive with the Oct 20 runbook columns.
      .insert({
        name: data.name,
        firm: data.firm,
        email: data.email,
        team_size: data.team_size,
        note: data.note || null,
        ...extra,
        email_status: "pending",
        notify_status: "pending",
      } as never)
      .select("id, created_at")
      .single();

    if (insertError || !row) throw new Error("Could not save pilot request");

    const saved: SavedPilotRequest = { ...data, id: row.id, created_at: row.created_at };
    let emailStatus: "sent" | "failed" = "failed";
    try {
      const { sendPilotNotification } = await import("./pilot-request.server");
      emailStatus = (await sendPilotNotification(saved)) ? "sent" : "failed";
    } catch {
      emailStatus = "failed";
    }

    let notifyStatus: "sent" | "failed" | "skipped" = "skipped";
    try {
      notifyStatus = await notifyLiamByInkbox(saved);
    } catch {
      notifyStatus = "failed";
    }

    await supabaseAdmin
      .from("pilot_requests")
      .update({ email_status: emailStatus, notify_status: notifyStatus })
      .eq("id", row.id);

}

export const submitPilotRequestFn = createServerFn({ method: "POST" })
  .inputValidator((input: PilotRequestInput) => pilotRequestSchema.parse(input))
  .handler(async ({ data }) => {
    if (data.website) return { ok: true } as const;

    await savePilotRequest(data, {});
    return { ok: true } as const;
  });
/** Signup gate: the signed-in company or partner person asks for a pilot. */
export const signupPilotRequestSchema = pilotRequestSchema.omit({ email: true, website: true });
export type SignupPilotRequestInput = z.infer<typeof signupPilotRequestSchema>;

export const submitSignupPilotRequestFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: SignupPilotRequestInput) => signupPilotRequestSchema.parse(input))
  .handler(async ({ data, context }) => {
    const email = (context.claims as { email?: unknown }).email;
    if (typeof email !== "string" || !email) throw new Error("Your account has no email address");
    await savePilotRequest(
      { ...data, email },
      { user_id: context.userId, source: "signup", status: "pending" },
    );
    return { ok: true } as const;
  });
