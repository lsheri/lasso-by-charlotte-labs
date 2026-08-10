import { useQueryClient } from "@tanstack/react-query";

import { ROLE_LABELS, setActiveProfileId, type Profile } from "@/hooks/use-profile";

export function OrgSwitcher({
  profiles,
  active,
}: {
  profiles: Profile[];
  active: Profile | null;
}) {
  const queryClient = useQueryClient();
  if (profiles.length < 2) return null;

  return (
    <div>
      <div className="micro-label px-1">Workspace</div>
      <div className="mt-2 flex flex-col gap-1">
        {profiles.map((profile) => {
          const isActive = profile.id === active?.id;
          return (
            <button
              key={profile.id}
              type="button"
              onClick={() => {
                setActiveProfileId(profile.id);
                void queryClient.invalidateQueries();
              }}
              className={
                isActive
                  ? "flex items-center justify-between gap-2 rounded-md bg-accent-soft px-3 py-1.5 text-left text-sm font-medium text-accent-deep"
                  : "flex items-center justify-between gap-2 rounded-md px-3 py-1.5 text-left text-sm text-foreground/80 transition-colors hover:bg-accent-soft"
              }
            >
              <span className="truncate">{profile.org_name}</span>
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                {ROLE_LABELS[profile.role] ?? profile.role}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
