import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

export type AuthedRequest = { supabase: SupabaseClient<Database>; userId: string };

/**
 * The same bearer check the server-function middleware does, for the streaming
 * routes, which are plain HTTP and so cannot use function middleware.
 */
export async function authenticateBearer(request: Request): Promise<AuthedRequest | null> {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Missing Supabase environment variables.");

  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  if (token.split(".").length !== 3) return null;

  const supabase = createClient<Database>(url, key, {
    global: {
      fetch: (input, init) => {
        const headers = new Headers(
          typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
        );
        if (init?.headers) new Headers(init.headers).forEach((v, k) => headers.set(k, v));
        if (headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
        headers.set("apikey", key);
        headers.set("Authorization", `Bearer ${token}`);
        return fetch(input, { ...init, headers });
      },
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims?.sub) return null;
  return { supabase, userId: data.claims.sub };
}

/** One newline-delimited JSON frame per event. Deltas first, one done frame last. */
export type StreamFrame =
  { t: "delta"; v: string } | { t: "done"; payload: unknown } | { t: "error"; message: string };

export function ndjsonStream(
  run: (emit: (frame: StreamFrame) => void) => Promise<unknown>,
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (frame: StreamFrame) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(frame)}\n`));
      };
      try {
        const payload = await run(emit);
        emit({ t: "done", payload });
      } catch (e) {
        emit({ t: "error", message: (e as Error).message || "Something went wrong." });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
