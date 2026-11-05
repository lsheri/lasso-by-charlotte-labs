import { Link } from "@tanstack/react-router";

import { NAV_ITEMS, type NavCtx, type NavItemId } from "@/components/layout/nav-config";
import { useNavCtx } from "@/components/layout/use-nav-ctx";
import { useSettingsDialogOptional } from "@/lib/settings-dialog-context";
import * as roles from "@/lib/role-access";

/** NAV-2: places that left the rail, reached from Settings. Presence reads the manifest's own rules. */
export const SETTINGS_PLACES_COPY = {
  members: "Who is in this workspace and what they can do",
  keys: "Keys people asked you for",
  adding: "How people join your workspace",
  affiliation: "The institution this workspace is linked to",
  trust: "What Lasso keeps and who can see it",
  why: "What Lasso is for",
} as const;

function presentFor(id: NavItemId, ctx: NavCtx): boolean {
  const item = NAV_ITEMS.find((entry) => entry.id === id);
  if (!item) return false;
  if (item.types && !item.types.includes(ctx.type)) return false;
  return !item.show || item.show(ctx);
}

export function SettingsPlacesCard({ which }: { which: "people" | "about" }) {
  const { ctx, profile, institution } = useNavCtx();
  const settings = useSettingsDialogOptional();
  const rows: { id: NavItemId; label: string; to: string; hint: string }[] = which === "people"
    ? [
        ...(presentFor("members", ctx) && profile ? [{ id: "members" as const, label: roles.membersLabel(profile), to: "/members", hint: SETTINGS_PLACES_COPY.members }] : []),
        ...(presentFor("workshop-keys", ctx) ? [{ id: "workshop-keys" as const, label: "Workshop keys", to: "/requests", hint: SETTINGS_PLACES_COPY.keys }] : []),
        ...(presentFor("adding-people", ctx) ? [{ id: "adding-people" as const, label: "Adding people", to: "/adding-people", hint: SETTINGS_PLACES_COPY.adding }] : []),
        ...(presentFor("affiliation", ctx) && institution ? [{ id: "affiliation" as const, label: `Your ${institution.name} link`, to: "/affiliation", hint: SETTINGS_PLACES_COPY.affiliation }] : []),
      ]
    : [
        { id: "trust", label: "Trust & data", to: "/trust", hint: SETTINGS_PLACES_COPY.trust },
        { id: "why", label: "Why Lasso", to: "/why", hint: SETTINGS_PLACES_COPY.why },
      ];
  if (rows.length === 0) return null;
  return (
    <div className="rounded-[var(--radius)] border border-border bg-card shadow-card" data-testid={`settings-places-${which}`}>
      {rows.map((row, index) => (
        <Link
          key={row.id}
          to={row.to}
          data-settings-place={row.id}
          onClick={() => settings?.closeSettings()}
          className={`flex min-w-0 flex-col px-4 py-3 transition-colors hover:bg-secondary ${index > 0 ? "border-t border-border" : ""}`}
        >
          <span className="truncate text-sm font-medium text-foreground">{row.label}</span>
          <span className="truncate text-sm text-muted-foreground">{row.hint}</span>
        </Link>
      ))}
    </div>
  );
}
