export function UserCard({ name, onSignOut }: { name: string; onSignOut: () => void }) {
  return (
    <div className="rounded-[var(--radius)] border border-border bg-card px-4 py-3 shadow-card">
      <p className="truncate text-sm font-medium text-foreground">{name}</p>
      <div className="mt-0.5 flex items-center justify-between gap-2">
        <span className="micro-label">Engagement Mgr</span>
        <button
          type="button"
          onClick={onSignOut}
          className="text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}