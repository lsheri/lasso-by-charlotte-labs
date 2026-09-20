import { Button } from "@/components/ui/button";
import { EXAMPLE_LINKS, EXAMPLE_NODES } from "@/components/canvas-lab/example-board";

/**
 * The sample board's "What fed this" view. It is the same shape as the real
 * reasoning trail, built from the static sample only: no query, no server call,
 * no comments, no highlights, nothing saved and no event sent.
 */

const DECK_ID = "example-deck";

/** Everything with a drawn line into the deck, kept in the trail's own groups. */
function feeders() {
  const inbound = EXAMPLE_LINKS.filter((link) => link.toId === DECK_ID);
  const byId = new Map(EXAMPLE_NODES.map((node) => [node.id, node]));
  const rows = inbound.flatMap((link) => {
    const node = byId.get(link.fromId);
    return node ? [{ node, relation: link.relation }] : [];
  });
  return {
    context: rows.filter((row) => row.node.kind === "source"),
    aiWork: rows.filter((row) => row.node.kind === "work"),
    judgment: rows.filter((row) => row.node.kind === "judgment"),
    decisions: rows.filter((row) => row.node.kind === "decision"),
  };
}

function TrailGroup({ label, rows }: { label: string; rows: { node: { id: string; title: string }; relation: string }[] }) {
  return (
    <section className="mb-4">
      <h2 className="font-hand text-[16px] text-green">{label}</h2>
      {rows.length === 0 ? (
        <p className="mt-1 text-[11.5px] text-muted-foreground">Nothing attached here.</p>
      ) : (
        <ul className="mt-1 space-y-1">
          {rows.map((row) => (
            <li key={row.node.id} className="border-l-2 border-[var(--nb-green)] pl-2 text-[11.5px] leading-[17px] text-foreground">
              {row.node.title}
              {row.relation === "context" ? "" : ` · ${row.relation}`}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function ExampleReview({ onClose }: { onClose: () => void }) {
  const groups = feeders();
  const deck = EXAMPLE_NODES.find((node) => node.id === DECK_ID);
  const upstream = EXAMPLE_NODES.filter((node) => node.id !== DECK_ID);
  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-background" data-testid="canvas-lab-example-review">
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-green">What fed this</p>
          <h1 className="truncate font-serif text-[26px] text-foreground">{deck?.title}</h1>
        </div>
        <Button type="button" variant="ghost" onClick={onClose}>Back to the example</Button>
      </header>
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside className="w-full shrink-0 overflow-y-auto border-b border-border bg-[var(--nb-paper)] p-3 lg:w-[280px] lg:border-b-0 lg:border-r">
          <TrailGroup label="Context" rows={groups.context} />
          <TrailGroup label="AI work" rows={groups.aiWork} />
          <TrailGroup label="Human judgment" rows={groups.judgment} />
          <TrailGroup label="Decisions" rows={groups.decisions} />
        </aside>
        <main className="min-h-0 flex-1 overflow-y-auto p-5">
          <p className="font-hand text-[16px] text-green">a sample trail, nothing here is yours</p>
          <p className="mt-2 text-[13px] leading-[20px] text-foreground">{deck?.summary}</p>
          <ul className="mt-4 space-y-2">
            {upstream.map((node) => (
              <li key={node.id} className="border border-border bg-card p-3">
                <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">{node.typeLabel}</p>
                <p className="mt-1 text-[13px] leading-[20px] text-foreground">{node.title}</p>
                <p className="text-[11.5px] leading-[17px] text-muted-foreground">{node.summary}</p>
              </li>
            ))}
          </ul>
        </main>
      </div>
    </div>
  );
}
