/**
 * The rules the lab is testing, said plainly. This is a legend, not a control:
 * nothing here changes what anyone may do.
 */
export function PermissionLegend() {
  const rows: { label: string; body: string }[] = [
    { label: "Your source", body: "Arrange it, open it." },
    { label: "Teammate source", body: "Read, summarize, branch, comment. Never alter the original." },
    { label: "Your draft", body: "Edit it here. It lives in this browser only." },
  ];
  return (
    <div className="w-[248px] rounded-[var(--radius-control)] border border-[var(--nb-pencil)] bg-card p-3">
      <h2 className="section-title mb-2">who can do what</h2>
      <ul className="flex flex-col gap-2">
        {rows.map((row) => (
          <li key={row.label}>
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-soft">
              {row.label}
            </span>
            <p className="nb-type-small leading-[17px] text-muted-foreground">{row.body}</p>
          </li>
        ))}
      </ul>
      <p className="mt-2 border-t border-[var(--nb-rule)] pt-2 font-mono text-[10px] uppercase tracking-[0.08em] text-soft">
        Other people shown here are examples
      </p>
    </div>
  );
}
