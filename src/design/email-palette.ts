/**
 * The colours the Lasso emails use, matching the published invite template (invite-member). Email clients cannot read
 * CSS custom properties, so emails carry literal colours; they live here, with the brand, and nowhere else.
 */
export const EMAIL_PALETTE = {
  page: "#ffffff",
  heading: "#16181a",
  body: "#2a2d2b",
  quiet: "#9a9c98",
  link: "#0a628f",
  button: "#2a2d2b",
  buttonText: "#ffffff",
} as const;
