import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

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
  const [open, setOpen] = useState(false);
  if (profiles.length < 2) return null;

  return (
    <div className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="workspace-options"
        onClick={() => setOpen((value) => !value)}
        className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-[var(--radius-md)] border border-[var(--nb-pencil)] px-3 py-2 text-left transition-colors hover:bg-accent-soft"
      >
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-foreground">{roleLabel(active)}</span>
          <span className="block truncate font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
            {active?.org_name ?? ""}
          </span>
        </span>
        <span className="shrink-0 font-hand text-[16px] text-green" aria-hidden>
          {open ? "close" : "change"}
        </span>
      </button>

      {open ? (
        <div
          id="workspace-options"
          className="absolute bottom-[calc(100%+0.5rem)] left-0 z-50 max-h-[min(60vh,440px)] w-full overflow-y-auto rounded-[var(--radius-md)] border border-[var(--nb-pencil)] bg-sidebar p-1 shadow-lg"
        >
          <div className="micro-label px-2 py-1.5">Choose workspace</div>
          <div className="flex flex-col gap-1">
            {profiles.map((profile) => {
              const isActive = profile.id === active?.id;
              return (
                <button
                  key={profile.id}
                  type="button"
                  aria-current={isActive ? "true" : undefined}
                  onClick={() => {
                    if (isActive) {
                      setOpen(false);
                      return;
                    }
                    if (active) {
                      logEvent("profile.switched", profile.org_id, {
                        from_role: active.role,
                        to_role: profile.role,
                        same_org: active.org_id === profile.org_id,
                      });
                    }
                    setOpen(false);
                    void (async () => {
                      // The database has to know the new workspace before anything
                      // refetches, or the refetch caches the old workspace's rows.
                      await setActiveProfileId(profile.id);
                      // Deliberately unfiltered: switching workspace invalidates every
                      // profile scoped key, so no previous workspace data can linger.
                      void queryClient.invalidateQueries();
                    })();
                  }}
                  className={
                    isActive
                      ? "flex w-full flex-col gap-0.5 rounded-[var(--radius-md)] bg-accent-soft px-3 py-2 text-left"
                      : "flex w-full flex-col gap-0.5 rounded-[var(--radius-md)] px-3 py-2 text-left transition-colors hover:bg-accent-soft"
                  }
                >
                  <span className={isActive ? "truncate text-sm font-medium text-accent-deep" : "truncate text-sm font-medium text-foreground/80"}>
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
      ) : null}
    </div>
  );
}
