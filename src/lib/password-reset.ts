/** Only an invite destination survives a reset, same rule as /auth. */
export function safeNext(next: string | null | undefined): string | null {
  return typeof next === "string" && next.startsWith("/join") ? next : null;
}
export function resetRedirectTo(origin: string, next: string | null | undefined): string {
  const n = safeNext(next);
  return n ? `${origin}/reset-password?next=${encodeURIComponent(n)}` : `${origin}/reset-password`;
}
export function afterResetDestination(next: string | null | undefined): string {
  return safeNext(next) ?? "/home";
}
export const RESET_TITLE = "Reset your password";
export const RESET_BODY = "Enter the email you use for Lasso. We will send a link to set a new password.";
export const RESET_BUTTON = "Send the link";
export const RESET_SENT = "If that address has a Lasso account, a link to set a new password is on its way. It works once.";
export const SET_TITLE = "Set a new password";
export const SET_BUTTON = "Save password";
export const FORGOT_LINK = "Forgot your password?";
