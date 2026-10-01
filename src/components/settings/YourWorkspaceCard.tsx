import { useQuery } from "@tanstack/react-query";

import { useProfile, type Profile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_ORG_TIER, isDataTier, tierLabel } from "@/lib/data-consent-shared";

type WorkspaceDetails = {
  name: string | null;
  type: string;
  plan: string | null;
  seats: number | null;
  admins: string[];
  tier: string;
  clients: boolean;
  naming: string | null;
};

export function showWorkspaceCard(profile: Pick<Profile, "role" | "org_type"> | null): boolean {
  return Boolean(
    profile &&
      profile.role !== "admin" &&
      profile.org_type !== "personal" &&
      ["em", "lead", "coach"].includes(profile.role),
  );
}

function typeLabel(type: string): string {
  if (type === "edu") return "School";
  if (type === "partner") return "Partner firm";
  return "Company";
}

function planLine(plan: string | null, seats: number | null): string | null {
  if (!plan) return null;
  const name = plan.charAt(0).toUpperCase() + plan.slice(1).replaceAll("_", " ");
  return seats === null ? name : `${name}, ${seats} seats`;
}

function oneLine(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const clean = value.replace(/\s+/g, " ").trim();
  return clean || null;
}

export function YourWorkspaceCard() {
  const { data: profile } = useProfile();
  const visible = showWorkspaceCard(profile ?? null);
  const { data } = useQuery({
    queryKey: ["your-workspace-settings", profile?.id],
    enabled: visible && Boolean(profile?.id),
    queryFn: async (): Promise<WorkspaceDetails> => {
      const orgId = profile?.org_id as string;
      const [orgResult, entitlementResult, consentResult, adminsResult] = await Promise.all([
        supabase.from("orgs").select("name, settings, clients_enabled").eq("id", orgId).maybeSingle(),
        supabase
          .from("entitlements")
          .select("plan, seats")
          .eq("org_id", orgId)
          .eq("status", "active")
          .maybeSingle(),
        supabase
          .from("data_consent_state")
          .select("tier")
          .eq("org_id", orgId)
          .eq("scope", "org")
          .maybeSingle(),
        supabase
          .from("profiles")
          .select("display_name")
          .eq("org_id", orgId)
          .eq("role", "admin")
          .is("deactivated_at", null)
          .order("created_at", { ascending: true }),
      ]);
      const error =
        orgResult.error ?? entitlementResult.error ?? consentResult.error ?? adminsResult.error;
      if (error) throw error;
      const settings = (orgResult.data?.settings ?? {}) as Record<string, unknown>;
      return {
        name: oneLine(orgResult.data?.name),
        type: profile?.org_type ?? "company",
        plan: oneLine(entitlementResult.data?.plan),
        seats: entitlementResult.data?.seats ?? null,
        admins: (adminsResult.data ?? [])
          .map((row) => oneLine(row.display_name))
          .filter((name): name is string => Boolean(name)),
        tier: isDataTier(consentResult.data?.tier) ? consentResult.data.tier : DEFAULT_ORG_TIER,
        clients: orgResult.data?.clients_enabled === true,
        naming: oneLine(settings["naming_conventions"]),
      };
    },
  });

  if (!visible || !data) return null;
  const plan = planLine(data.plan, data.seats);
  const firstAdmin = data.admins[0] ?? "your workspace admin";

  return (
    <section>
      <h2 className="micro-label micro-label-section">Your workspace</h2>
      <div className="mt-3 space-y-2 rounded-[var(--radius)] border border-border bg-card px-4 py-4 shadow-card">
        {data.name ? <p className="text-sm text-foreground">Workspace: {data.name}</p> : null}
        <p className="text-sm text-foreground">Type: {typeLabel(data.type)}</p>
        {plan ? <p className="text-sm text-foreground">Plan: {plan}</p> : null}
        {data.admins.length ? (
          <p className="text-sm text-foreground">Admin: {data.admins.join(", ")}</p>
        ) : null}
        <p className="text-sm text-foreground">
          Workspace data level: {tierLabel(data.tier as Parameters<typeof tierLabel>[0])}
        </p>
        <p className="text-sm text-muted-foreground">Your own level can be at most this.</p>
        <p className="text-sm text-foreground">Clients: {data.clients ? "on" : "off"}</p>
        <p className="text-sm text-foreground">Naming conventions: {data.naming ?? "none set"}</p>
        <p className="pt-2 text-sm text-muted-foreground">
          Set by your workspace admin. Ask {firstAdmin} to change these.
        </p>
      </div>
    </section>
  );
}