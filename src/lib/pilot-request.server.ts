import type { PilotRequestInput, SavedPilotRequest } from "./pilot-request.functions";

const TEAM_SIZE_LABELS: Record<PilotRequestInput["team_size"], string> = {
  "1-5": "1 to 5",
  "6-15": "6 to 15",
  "16-40": "16 to 40",
  "40+": "40+",
};

export const PILOT_NOTIFY_TO = "liam@charlotte-labs.com";

/** Internal notification through the published Resend template. The template supplies from and subject. */
export async function sendPilotNotification(request: SavedPilotRequest): Promise<boolean> {
  const { resendApiKey, sendResendTemplate } = await import("./invites.server");
  const apiKey = resendApiKey();
  if (!apiKey) return false;
  const result = await sendResendTemplate(apiKey, {
    to: PILOT_NOTIFY_TO,
    template: "pilot-request-notify",
    replyTo: request.email,
    variables: {
      NAME: request.name,
      FIRM: request.firm,
      // EMAIL is reserved by Resend for the recipient; the submitter goes here.
      SUBMITTER_EMAIL: request.email,
      TEAM_SIZE: TEAM_SIZE_LABELS[request.team_size],
      CREATED_AT: new Date(request.created_at).toLocaleString("en-GB", {
        dateStyle: "long",
        timeStyle: "short",
        timeZone: "UTC",
      }),
      NOTE: request.note || "None provided",
    },
  });
  return result.ok;
}
