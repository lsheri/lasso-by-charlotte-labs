/**
 * Whether a sign-up attempt hit an address that already has an account. Supabase answers this in one of two ways,
 * depending on the project's settings: a placeholder user with no identities and no error (email confirmation on,
 * enumeration protection on), or an error "User already registered" (code user_already_exists, status 422). Live
 * answers with the error (found 20 Nov 2026: an invited person who already had a login was stuck on "Create account"
 * with that raw message). Both shapes count.
 */
export function isExistingAccountSignup(
  data: { user: { identities?: unknown[] | null } | null; session: unknown } | null | undefined,
  error: unknown,
): boolean {
  if (error) return isAlreadyRegisteredError(error);
  if (!data?.user || data.session) return false;
  return Array.isArray(data.user.identities) && data.user.identities.length === 0;
}

/** The error form of "this address already has an account". Any other error is a real error. */
export function isAlreadyRegisteredError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: unknown; message?: unknown };
  if (e.code === "user_already_exists" || e.code === "email_exists") return true;
  return typeof e.message === "string" && /already (been )?registered|already exists/i.test(e.message);
}

export const EXISTING_ACCOUNT_INVITED = "You already have a Lasso account with this email. Sign in with your password and you will go straight on to accept the invite.";
export const EXISTING_ACCOUNT_OPEN = "You already have a Lasso account with this email. Sign in with your password.";
/** Shown when the password typed on the sign-up form was not the account's: the next press signs in. */
export const EXISTING_ACCOUNT_WRONG_PASSWORD = "You already have a Lasso account with this email, and that password did not match it. Type your account's password, or use Forgot your password or Email me a sign-in link below; any of them brings you back to the invite.";
