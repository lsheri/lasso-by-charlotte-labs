import { createClient } from "@supabase/supabase-js";
import { getRequestHeader } from "@tanstack/react-start/server";

import type { Database } from "@/integrations/supabase/types";

export type Viewer = { userId: string; email: string | null };

/**
 * The accept route is reachable signed out, so its server function cannot use
 * requireSupabaseAuth. When a bearer token is present we still verify it, so
 * "signed in" is proven rather than asserted by the client.
 */
export async function readOptionalViewer(): Promise<Viewer | null> {
  const header = getRequestHeader("authorization");
  if (!header || !header.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length);
  if (token.split(".").length !== 3) return null;

  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) return null;

  const client = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        headers.set("apikey", key);
        headers.set("Authorization", `Bearer ${token}`);
        return fetch(input, { ...init, headers });
      },
    },
  });

  try {
    const { data, error } = await client.auth.getClaims(token);
    const sub = data?.claims?.sub;
    if (error || !sub) return null;
    const email = typeof data.claims["email"] === "string" ? (data.claims["email"] as string) : null;
    return { userId: sub, email };
  } catch {
    return null;
  }
}
