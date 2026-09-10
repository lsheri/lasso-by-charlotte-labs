import { useFirmCheckLibrary } from "@/hooks/use-firm-dashboard";
import { useShippedWork } from "@/hooks/use-shipped-work";

/**
 * Figma 23:413, "What the firm produced". Four numbers across the page, each a
 * large serif numeral over a mono label with one plain line underneath.
 *
 * The frame's own subject is production, not adoption: what the firm made and
 * what stands behind it. Every number here is counted off reads this page
 * already runs, so the component owns them itself and the page's hook list and
 * hook order are untouched.
 *
 * Deliberate deviation, recorded rather than faked: the frame's second tile is
 * "ON THE RECORD · N calls, each with its reason". No read available to this
 * page counts decisions across the firm — `useEngagementDecisions` is scoped to
 * one engagement — so that slot carries "ANALYSES RUN", which is true and is
 * already the assurance number this page reports. It is not relabelled as calls.
 */
function StatColumn({
  label,
  value,
  caveat,
}: {
  label: string;
  value: number;
  caveat: string;
}) {
  return (
    <div className="rounded-[var(--radius)] border border-[var(--nb-pencil)] bg-card px-4 py-3.5">
      <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-soft">{label}</p>
      {/* Instrument Serif at display size, the way the frame sets a headline
          number: light, roomy, nothing bold about it. */}
      <p className="mt-1 font-serif text-[40px] leading-[46px] tabular-nums text-foreground">
        {value}
      </p>
      <p className="mt-1 text-[12px] leading-[18px] text-muted-foreground">{caveat}</p>
    </div>
  );
}

export function FirmProduced({
  profileId,
  analysesRun,
}: {
  profileId: string | undefined;
  analysesRun: number;
}) {
  const { data: shipped } = useShippedWork();
  const { data: checks } = useFirmCheckLibrary(profileId);

  const cards = shipped ?? [];
  const clientCount = new Set(
    cards.map((card) => card.client_label).filter((label): label is string => Boolean(label)),
  ).size;
  const tracedFacts = cards.reduce((sum, card) => sum + card.traced_facts, 0);
  const activeChecks = (checks ?? []).filter((row) => row.active).length;

  return (
    <div
      data-testid="firm-produced"
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
    >
      <StatColumn
        label="Shipped work"
        value={cards.length}
        caveat={`piece${cards.length === 1 ? "" : "s"}, across ${clientCount} client${
          clientCount === 1 ? "" : "s"
        }`}
      />
      <StatColumn
        label="Analyses run"
        value={analysesRun}
        caveat="counts only, never results and never a rate"
      />
      <StatColumn
        label="Checked at source"
        value={tracedFacts}
        caveat={`claim${tracedFacts === 1 ? "" : "s"} traced to a document`}
      />
      <StatColumn
        label="Reusable processes"
        value={activeChecks}
        caveat="written from real work"
      />
    </div>
  );
}