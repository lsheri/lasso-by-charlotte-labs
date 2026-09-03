import { useQueryClient } from "@tanstack/react-query";

import { ROLE_LABELS, setActiveProfileId, type Profile } from "@/hooks/use-profile";
import { logEvent } from "@/lib/telemetry";

function roleLabel(profile: Profile | null): string {
  if (!profile) return "Signed in";
  return ROLE_LABELS[profile.role] ?? profile.role;
}

/**
 * Not an organisation picker: it says which hat you are wearing. The role
 * leads, the workspace sits underneath it. Hidden for a single profile.
 */
export function OrgSwitcher({ profiles, active }: { profiles: Profile[]; active: Profile | null }) {
  const queryClient = useQueryClient();
  if (profiles.length < 2) return null;

  return (
    <div>
      <div className="micro-label px-1">You are acting as</div>
      <div className="mt-1 px-1">
        <div className="truncate text-sm font-medium text-foreground">{roleLabel(active)}</div>
        <div className="truncate text-xs text-muted-foreground">{active?.org_name ?? ""}</div>
      </div>
      <div className="mt-2 flex flex-col gap-1">
        {profiles.map((profile) => {
          const isActive = profile.id === active?.id;
          return (
            <button
              key={profile.id}
              type="button"
              onClick={() => {
                if (isActive) return;
                if (active) {
                  logEvent("profile.switched", profile.org_id, {
                    from_role: active.role,
                    to_role: profile.role,
                    same_org: active.org_id === profile.org_id,
                  });
                }
                setActiveProfileId(profile.id);
                // Deliberately unfiltered: switching workspace invalidates every
                // profile scoped key, so no previous workspace data can linger.
                void queryClient.invalidateQueries();
              }}
              className={
                isActive
                  ? "flex flex-col gap-0.5 rounded-md bg-accent-soft px-3 py-1.5 text-left"
                  : "flex flex-col gap-0.5 rounded-md px-3 py-1.5 text-left transition-colors hover:bg-accent-soft"
              }
            >
              <span
                className={
                  isActive
                    ? "truncate text-sm font-medium text-accent-deep"
                    : "truncate text-sm font-medium text-foreground/80"
                }
              >
                {ROLE_LABELS[profile.role] ?? profile.role}
              </span>
              <span className="truncate font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                {profile.org_name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
