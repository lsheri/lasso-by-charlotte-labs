import { effectiveWorkDate, formatDate, type WorkItemRow } from "@/lib/work-types";

export function FoundationGuide({ brief, tasks, work }: { brief: string | null; tasks: { id: string; name: string; detail: string | null }[]; work: WorkItemRow[] }) {
  const latest = [...work].sort((a, b) => effectiveWorkDate(b).localeCompare(effectiveWorkDate(a)))[0];
  return (
    <section className="canvas-lab-start-here" aria-labelledby="start-here-title">
      <div className="flex items-baseline justify-between gap-2"><h2 id="start-here-title" className="font-hand text-[18px] text-green">Start here</h2><span className="font-mono text-[9px] uppercase tracking-[0.08em] text-soft">real record unless labelled</span></div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div><p className="font-mono text-[9px] uppercase tracking-[0.08em] text-soft">Brief</p><p className="mt-1 line-clamp-4 text-[11.5px] leading-[17px] text-foreground">{brief?.trim() || "No brief written yet."}</p></div>
        <div><p className="font-mono text-[9px] uppercase tracking-[0.08em] text-soft">Key questions</p><ul className="mt-1 space-y-1 text-[11.5px] leading-[17px] text-foreground">{tasks.slice(0, 3).map((task) => <li key={task.id}>{task.detail?.trim() || task.name}</li>)}</ul></div>
        <div><p className="font-mono text-[9px] uppercase tracking-[0.08em] text-soft">Latest status</p><p className="mt-1 text-[11.5px] leading-[17px] text-foreground">{latest ? `${latest.title} · ${formatDate(effectiveWorkDate(latest))}` : "No dated work is mapped yet."}</p></div>
        <div><p className="font-mono text-[9px] uppercase tracking-[0.08em] text-soft">Unresolved issues</p><p className="mt-1 text-[11.5px] leading-[17px] text-muted-foreground">Prototype prompt: What still needs evidence or a decision?</p></div>
      </div>
    </section>
  );
}