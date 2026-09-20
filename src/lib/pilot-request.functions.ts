import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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

const TEAM_SIZE_LABELS: Record<PilotRequestInput["team_size"], string> = {
  "1-5": "1 to 5",
  "6-15": "6 to 15",
  "16-40": "16 to 40",
  "40+": "40+",
};

type SavedPilotRequest = PilotRequestInput & { id: string; created_at: string };

export async function notifyLiamByInkbox(
  request: SavedPilotRequest,
): Promise<"sent" | "skipped"> {
  const apiKey = process.env["INKBOX_API_KEY"];
  if (!apiKey) return "skipped";

  // TODO: INKBOX_API_KEY is pending. Implement after Inkbox confirms its REST endpoint and request contract.
  void request;
  throw new Error("Inkbox notification is not configured");
}

export const submitPilotRequestFn = createServerFn({ method: "POST" })
  .inputValidator((input: PilotRequestInput) => pilotRequestSchema.parse(input))
  .handler(async ({ data }) => {
    if (data.website) return { ok: true } as const;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error: insertError } = await supabaseAdmin
      .from("pilot_requests")
      .insert({
        name: data.name,
        firm: data.firm,
        email: data.email,
        team_size: data.team_size,
        note: data.note || null,
        email_status: "pending",
        notify_status: "pending",
      })
      .select("id, created_at")
      .single();

    if (insertError || !row) throw new Error("Could not save pilot request");

    const saved: SavedPilotRequest = { ...data, id: row.id, created_at: row.created_at };
    let emailStatus: "sent" | "failed" = "failed";
    try {
      const [{ sendTemplateEmail }, { pilotRequestTemplate }, { TEMPLATES }] = await Promise.all([
        import("./email-templates/send-email"),
        import("./email-templates/pilot-request"),
        import("./email-templates/registry"),
      ]);
      TEMPLATES["pilot-request"] = pilotRequestTemplate;
      const result = await sendTemplateEmail("pilot-request", "liam@charlotte-labs.com", {
        replyTo: data.email,
        idempotencyKey: `pilot-request-${row.id}`,
        templateData: {
          name: data.name,
          firm: data.firm,
          email: data.email,
          teamSize: data.team_size,
          teamSizeLabel: TEAM_SIZE_LABELS[data.team_size],
          note: data.note,
          createdAt: new Date(row.created_at).toLocaleString("en-GB", {
            dateStyle: "long",
            timeStyle: "short",
            timeZone: "UTC",
          }),
        },
      });
      emailStatus = result.sent ? "sent" : "failed";
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

    return { ok: true } as const;
  });