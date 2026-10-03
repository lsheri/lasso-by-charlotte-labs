import { createFileRoute, redirect } from "@tanstack/react-router";

import { lookupActivationKeyFn } from "@/lib/activation-keys.functions";
import { cleanActivationKey, markActivationKey } from "@/lib/key-entry";

const INTENTS = ["company", "personal", "edu", "partner"] as const;
type KeyIntent = (typeof INTENTS)[number];
const LOOKUP_TIMEOUT_MS = 2500;

/**
 * Unit 19: read the key's register without ever blocking. Any failure,
 * timeout or unknown value returns null and the redirect is unchanged.
 */
export async function resolveKeyIntent(code: string): Promise<KeyIntent | null> {
  try {
    const result = await Promise.race([
      lookupActivationKeyFn({ data: { code } }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), LOOKUP_TIMEOUT_MS)),
    ]);
    const register = (result as { register?: unknown } | null)?.register;
    return typeof register === "string" && (INTENTS as readonly string[]).includes(register)
      ? (register as KeyIntent)
      : null;
  } catch {
    return null;
  }
}

// Unit J1: a partner link. No UI; store the code and hand off to /auth.
export const Route = createFileRoute("/j/$code")({
  ssr: false,
  beforeLoad: async ({ params, location }) => {
    const code = cleanActivationKey(params.code);
    if (code) markActivationKey(code);
    const search = new URLSearchParams(location.searchStr ?? "");
    const from = search.get("from");
    // Unit 20: the link can carry the register itself. A valid r wins and
    // skips the lookup entirely; anything else falls back to the lookup.
    const rParam = search.get("r");
    const linkIntent =
      rParam && (INTENTS as readonly string[]).includes(rParam) ? (rParam as KeyIntent) : null;
    const intent = linkIntent ?? (code ? await resolveKeyIntent(code) : null);
    throw redirect({
      to: "/auth",
      search: {
        ...(intent ? { intent } : {}),
        ...(code ? { key: code } : {}),
        ...(from ? { from } : {}),
      } as never,
    });
  },
});
