import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

import { setActiveProfileId, type Profile } from "@/hooks/use-profile";
import { logEvent } from "@/lib/telemetry";
import { isBusinessType } from "@/lib/workspace-capabilities";

export function workspaceTypeLabel(profile: Profile | null): string {
  if (!profile) return "INDIVIDUAL";
  const type = { company: "FIRM", partner: "PARTNER", personal: "INDIVIDUAL", edu: "SCHOOL" }[profile.org_type];
  return isBusinessType(profile.org_type)
    ? `${type} · ${profile.role === "admin" ? "ADMIN" : profile.role === "lead" ? "LEAD" : "MEMBER"}` : type;
}

/**
 * The switcher also renders outside a router (and under partial router mocks
 * in tests). Either way it behaves the same on every render, so the hook
 * order never changes; without a router a switch simply does not navigate.
 */
function useOptionalRouter(): { navigate: (opts: { to: "/home"; replace: boolean }) => unknown } | undefined {
  try {
    return useRouter({ warn: false }) as unknown as { navigate: (opts: { to: "/home"; replace: boolean }) => unknown } | undefined;
  } catch {
    return undefined;
  }
}

/**
 * Not an organisation picker: it says which hat you are wearing. The role
 * leads, the workspace sits underneath it. Hidden for a single profile.
 */
export function OrgSwitcher({ profiles, active, children, header, onOpen }: { profiles: Profile[]; active: Profile | null; children?: ReactNode; header?: ReactNode; onOpen?: () => void }) {
  const queryClient = useQueryClient();
  const router = useOptionalRouter();
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu open={open} onOpenChange={(value) => { setOpen(value); if (value) onOpen?.(); }}>
      <DropdownMenuTrigger asChild><Button variant="ghost"
        type="button"
        aria-label={`Change workspace. Current: ${active?.org_name ?? "Workspace"}, ${workspaceTypeLabel(active)}`}
        aria-expanded={open}
        onPointerDown={(event) => event.preventDefault()}
        onClick={() => { if (!open) onOpen?.(); setOpen((value) => !value); }}
        className="grid h-auto w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-[var(--radius-md)] border border-[var(--nb-pencil)] px-3 py-2 text-left transition-colors hover:bg-accent-soft"
      >
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-foreground">{active?.org_name ?? "Workspace"}</span>
          <span className="block truncate font-mono text-[12px] uppercase tracking-[0.08em] text-muted-foreground">
            {workspaceTypeLabel(active)}
          </span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0" aria-hidden />
      </Button></DropdownMenuTrigger>

      {open ? (
        <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-[240px] bg-sidebar" aria-label="Workspace menu">
          {header ? <><DropdownMenuLabel>{header}</DropdownMenuLabel><DropdownMenuSeparator /></> : null}
          {profiles.length > 1 ? <>
          <div className="micro-label px-2 py-1.5">Choose workspace</div>
          <div className="flex flex-col gap-1">
            {profiles.map((profile) => {
              const isActive = profile.id === active?.id;
              return (
                <DropdownMenuItem
                  key={profile.id}
                  aria-current={isActive ? "true" : undefined}
                  onSelect={() => {
                    // MN-1: a re-pick is a repair, not a switch. It still
                    // rewrites the row, but records no switch and stays put.
                    if (active && !isActive) {
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
                      const accepted = await setActiveProfileId(profile.id);
                      if (!accepted) return;
                      // Land where sign-in lands every profile, guests included
                      // (src/routes/auth.tsx), so no old workspace page lingers.
                      if (!isActive) void router?.navigate({ to: "/home", replace: true });
                      // Deliberately unfiltered: switching workspace invalidates every
                      // profile scoped key, so no previous workspace data can linger.
                      void queryClient.invalidateQueries();
                    })();
                  }}
                  className={
                    isActive
                      ? "flex w-full gap-2 rounded-[var(--radius-md)] bg-accent-soft px-3 py-2 text-left"
                      : "flex w-full gap-2 rounded-[var(--radius-md)] px-3 py-2 text-left transition-colors hover:bg-accent-soft"
                  }
                >
                  <span className="min-w-0 flex-1"><span className={isActive ? "block truncate text-sm font-medium text-accent-deep" : "block truncate text-sm font-medium text-foreground/80"}>{profile.org_name}</span>
                  <span className="block truncate font-mono text-[12px] uppercase tracking-[0.08em] text-muted-foreground">{workspaceTypeLabel(profile)}</span></span>
                  {isActive ? <Check className="size-4 shrink-0" aria-label="Active workspace" /> : null}
                </DropdownMenuItem>
              );
            })}
          </div>
          {children ? <DropdownMenuSeparator /> : null}</> : null}
          {children}
        </DropdownMenuContent>
      ) : null}
    </DropdownMenu>
  );
}
