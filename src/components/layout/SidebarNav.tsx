import { Link } from "@tanstack/react-router";

import { navGroups } from "./nav-config";

export function SidebarNav({ onNavigate }: { onNavigate?: (() => void) | undefined }) {
  return (
    <nav className="flex flex-col gap-7">
      {navGroups.map((group) => (
        <div key={group.label}>
          <div className="micro-label px-3">{group.label}</div>
          <div className="mt-2 flex flex-col gap-0.5">
            {group.items.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={onNavigate}
                className="rounded-md px-3 py-1.5 text-sm text-foreground/80 transition-colors hover:bg-accent-soft hover:text-accent-deep"
                activeProps={{
                  className: "bg-accent-soft text-accent-deep font-medium",
                }}
              >
                {item.label}
              </Link>
            ))}
            {group.emptyState ? (
              <p className="px-3 py-1.5 text-sm text-muted-foreground">{group.emptyState}</p>
            ) : null}
          </div>
        </div>
      ))}
    </nav>
  );
}