import { CountList, CountRow } from "@/components/firm/FirmPanels";
import { SectionHeader } from "@/components/notebook/SectionHeader";
import { ToneCard } from "@/components/notebook/ToneCard";
import {
  WAITING_LABEL,
  buildFirmMetrics,
  relativeDayPhrase,
  waitingLine,
  type FirmDashboard,
  type MetricTile,
} from "@/lib/firm-dashboard-shared";

/** One number, one plain label, one caveat. Tokens only, no fills, no charts. */
export function StatTile({ tile, reduceMotion }: { tile: MetricTile; reduceMotion: boolean }) {
  return (
    <div
      data-testid={`firm-tile-${tile.key}`}
      className={reduceMotion ? "nb-chip-enter-static" : "nb-chip-enter"}
    >
      <ToneCard tone="paper" label={tile.name}>
        <p className="text-3xl font-semibold tabular-nums leading-tight text-foreground">
          {tile.value}
        </p>
        <p className="mt-1">{tile.caveat}</p>
      </ToneCard>
    </div>
  );
}


/** Every withholding, preserved, one line each. */
export function WaitingStrip({ names }: { names: string[] }) {
  if (names.length === 0) return null;
  return (
    <section
      data-testid="firm-waiting-strip"
      className="rounded-[var(--radius)] border border-border bg-muted/40 px-4 py-3"
    >
      <p className="micro-label micro-label-section">{WAITING_LABEL}</p>
      <ul className="mt-2 space-y-0.5">
        {names.map((name) => (
          <li key={name} className="text-xs text-muted-foreground">
            {waitingLine(name)}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** A small list panel for the structural counts that are not single numbers. */
function ListTile({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[var(--radius)] border border-border bg-card px-4 py-4">
      <p className="micro-label">{title}</p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

export function FirmMetricGrid({
  data,
  reduceMotion,
}: {
  data: FirmDashboard;
  reduceMotion: boolean;
}) {
  const { tiles, withheld } = buildFirmMetrics(data);
  const failures = [
    ...data.data_health.errors_by_kind,
    ...(data.data_health.connector_errors > 0
      ? [{ label: "connector error", count: data.data_health.connector_errors }]
      : []),
  ];

  return (
    <section data-testid="firm-metric-grid">
      <SectionHeader
        title="What the firm produced"
        action={
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-soft">
            Last {data.window_days} days
          </span>
        }
      />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {tiles.map((tile) => (
          <StatTile key={tile.key} tile={tile} reduceMotion={reduceMotion} />
        ))}

        <ListTile title="Deliverables by state">
          {data.activity.deliverables_total === 0 ? (
            <p className="text-sm text-muted-foreground">No deliverables in the workspace yet.</p>
          ) : (
            data.activity.deliverables.map((row) => (
              <CountRow key={row.status} label={row.label} count={row.count} />
            ))
          )}
        </ListTile>

        <ListTile title="Analyses run">
          <CountList rows={data.activity.analyses_by_preset} empty="No analyses run this period." />
        </ListTile>

        <ListTile title="Connected sources">
          <CountList
            rows={data.data_health.connectors_by_vendor}
            empty="No sources connected yet."
          />
          <p className="mt-2 text-xs text-muted-foreground">
            {relativeDayPhrase(data.data_health.last_capture_days_ago)}
          </p>
        </ListTile>

        <ListTile title="Failures this period">
          <CountList rows={failures} empty="Nothing has failed this period." />
        </ListTile>
      </div>

      <WaitingStrip names={withheld} />
    </section>
  );
}
