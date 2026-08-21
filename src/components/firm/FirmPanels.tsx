import type { LabelledCount, Stat } from "@/lib/firm-dashboard-shared";

export function Panel({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[var(--radius)] border border-border bg-card px-5 py-4 shadow-card">
      <h2 className="micro-label micro-label-section">{title}</h2>
      {note ? <p className="mt-1 text-xs text-muted-foreground">{note}</p> : null}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

/** A number only when the floor allows it, otherwise the honest sentence. */
export function StatBlock({ label, stat }: { label: string; stat: Stat }) {
  return (
    <div>
      <p className="micro-label">{label}</p>
      {stat.value === null ? (
        <p className="mt-1 text-sm text-muted-foreground">{stat.sentence}</p>
      ) : (
        <>
          <p className="mt-1 text-3xl font-semibold tabular-nums text-foreground">{stat.value}</p>
          <p className="mt-1 text-sm text-muted-foreground">{stat.sentence}</p>
        </>
      )}
    </div>
  );
}

export function CountRow({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/60 py-1.5 last:border-b-0">
      <span className="text-sm text-foreground">{label}</span>
      <span className="font-mono text-sm tabular-nums text-muted-foreground">{count}</span>
    </div>
  );
}

export function CountList({ rows, empty }: { rows: LabelledCount[]; empty: string }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <div>
      {rows.map((row) => (
        <CountRow key={row.label} label={row.label} count={row.count} />
      ))}
    </div>
  );
}
