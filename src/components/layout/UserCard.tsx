import { ROLE_LABELS } from "@/hooks/use-profile";

/** First letters of the first two words, e.g. "Liam Sheridan" -> "LS". */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function UserCard({
  name,
  role,
  onSignOut,
}: {
  name: string;
  role: string | undefined;
  onSignOut: () => void;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        aria-hidden
        className="grid size-7 shrink-0 place-items-center rounded-full border-[1.2px] border-graphite bg-card font-mono text-[9px] font-medium text-foreground"
      >
        {initialsOf(name)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11.5px] font-medium leading-4 text-foreground">{name}</p>
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[9px] uppercase leading-3 tracking-[0.08em] text-soft">
            {(role && ROLE_LABELS[role]) ?? "Engagement Mgr"}
          </span>
          <button
            type="button"
            onClick={onSignOut}
            className="shrink-0 font-mono text-[9px] uppercase tracking-[0.08em] text-soft transition-colors hover:text-foreground"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
