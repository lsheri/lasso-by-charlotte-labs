/**
 * The Kestrel Bay demo story, part 2: a daily spend cap for the tour logins (Liam, D-6: USD 2 per login per day).
 *
 * Called once before every model request, from the one place models are called (ai.server.ts). It does nothing, and
 * reads nothing, unless the call is made in the demo firm's workspace. There it finds out whether the caller is a
 * tour login (by the sign-in email, which the person cannot change) and, only for a tour login, adds up what that
 * login has spent since midnight UTC from the usage ledger. At or over the cap the request is refused before any
 * model is called, with the message below. Every other demo person and every other workspace is never capped.
 *
 * If it cannot tell whether someone is a tour login, it lets the call through: an ordinary demo must not break on
 * this. If it knows someone is a tour login and cannot read their spend, it refuses: the cap must not fail open.
 */

import { KESTREL_BAY_ORG_ID } from "./firm-story-shared";

/** Sign-in emails of the tour logins. Seeding them is a separate, approved step; until then nobody matches. */
export const TOUR_LOGIN_EMAILS: readonly string[] = ["tour-partner@kestrelbay.test", "tour-lead@kestrelbay.test"];
export const TOUR_DAILY_CAP_USD = 2;
export const TOUR_CAP_MESSAGE = "This demo login has reached its AI limit for today. Show the recorded answer, or try again tomorrow.";

export function isTourLoginEmail(email: string | null | undefined): boolean {
  return typeof email === "string" && TOUR_LOGIN_EMAILS.includes(email.trim().toLowerCase());
}

/** Midnight UTC of the day `now` falls on, as the ledger writes its times. */
export function startOfUtcDay(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

export function overCap(costs: readonly (number | null | undefined)[], cap: number = TOUR_DAILY_CAP_USD): boolean {
  let total = 0;
  for (const cost of costs) total += typeof cost === "number" && Number.isFinite(cost) && cost > 0 ? cost : 0;
  return total >= cap;
}

export type TourCapMeta = { orgId?: string | null | undefined; profileId?: string | null | undefined } | undefined;

export type TourCapDeps = {
  /** The sign-in email behind a profile, or null when it cannot be found. Throws when the lookup itself fails. */
  emailOfProfile: (profileId: string) => Promise<string | null>;
  /** The cost of every model call this profile made since the given time. Throws when the read fails. */
  costsSince: (profileId: string, sinceIso: string) => Promise<(number | null)[]>;
  now: () => Date;
};

export class TourCapReached extends Error {
  constructor() {
    super(TOUR_CAP_MESSAGE);
    this.name = "TourCapReached";
  }
}

// Whether a profile is a tour login does not change, so it is asked once per server instance.
const known = new Map<string, boolean>();

async function liveDeps(): Promise<TourCapDeps> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return {
    now: () => new Date(),
    emailOfProfile: async (profileId) => {
      const { data, error } = await supabaseAdmin.from("profiles").select("user_id, org_id").eq("id", profileId).maybeSingle();
      if (error) throw new Error(error.message);
      if (!data?.user_id || data.org_id !== KESTREL_BAY_ORG_ID) return null;
      const user = await supabaseAdmin.auth.admin.getUserById(data.user_id);
      if (user.error) throw new Error(user.error.message);
      return user.data.user?.email ?? null;
    },
    costsSince: async (profileId, sinceIso) => {
      const { data, error } = await supabaseAdmin.from("ai_usage").select("cost_usd").eq("profile_id", profileId).gte("created_at", sinceIso).limit(5000);
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => row.cost_usd);
    },
  };
}

/** Resolves when the call may go ahead; throws TourCapReached when a tour login is at its cap for the day. */
export async function assertWithinTourCap(meta: TourCapMeta, deps?: TourCapDeps): Promise<void> {
  if (meta?.orgId !== KESTREL_BAY_ORG_ID || !meta.profileId) return;
  const profileId = meta.profileId;
  let tourLogin = deps ? undefined : known.get(profileId);
  const use = deps ?? (tourLogin === false ? null : await liveDeps().catch(() => null));
  if (tourLogin === undefined) {
    if (!use) return;
    try {
      tourLogin = isTourLoginEmail(await use.emailOfProfile(profileId));
      if (!deps) known.set(profileId, tourLogin);
    } catch {
      return; // Cannot tell who this is: an ordinary demo person must not be stopped.
    }
  }
  if (!tourLogin || !use) return;
  let costs: (number | null)[];
  try {
    costs = await use.costsSince(profileId, startOfUtcDay(use.now()));
  } catch {
    throw new TourCapReached(); // A tour login whose spend cannot be read is refused, never waved through.
  }
  if (overCap(costs)) throw new TourCapReached();
}
