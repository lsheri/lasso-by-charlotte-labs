import { getRequest } from "@tanstack/react-start/server";

/**
 * M3-C3a. Revokes the signed-in person's OAuth grant for one AI tool, the
 * server-side equivalent of auth-js revokeGrant({ clientId }). Never throws;
 * never logs the client id or the token.
 */
export async function revokeOAuthGrant(clientId: string): Promise<boolean> {
  try {
    const SUPABASE_URL = process.env["SUPABASE_URL"];
    const SUPABASE_PUBLISHABLE_KEY = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY || !clientId) return false;
    const authorization = getRequest()?.headers.get("authorization");
    if (!authorization) return false;
    const res = await fetch(
      `${SUPABASE_URL}/auth/v1/user/oauth/grants?client_id=${encodeURIComponent(clientId)}`,
      {
        method: "DELETE",
        headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: authorization },
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!res.ok) {
      console.error(`[oauth-grants] revoke failed with status ${res.status}`);
      return false;
    }
    return true;
  } catch {
    console.error("[oauth-grants] revoke failed with status none");
    return false;
  }
}
