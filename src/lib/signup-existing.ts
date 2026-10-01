/** Supabase answers a sign-up for an address that already has an account with a placeholder user and no identities, and sends nothing. */
export function isExistingAccountSignup(
  data: { user: { identities?: unknown[] | null } | null; session: unknown } | null | undefined,
  error: unknown,
): boolean {
  if (error || !data?.user || data.session) return false;
  return Array.isArray(data.user.identities) && data.user.identities.length === 0;
}
export const EXISTING_ACCOUNT_INVITED = "You already have a Lasso account with this email. Sign in with your password and you will go straight on to accept the invite.";
export const EXISTING_ACCOUNT_OPEN = "You already have a Lasso account with this email. Sign in with your password.";
