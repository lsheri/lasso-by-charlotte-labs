export type InviteEmailResult = {
  sent: boolean;
  /** "not_configured" means the copy-the-link fallback should be shown. */
  reason: "sent" | "not_configured" | "failed";
  message: string | null;
};
