import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useFirmCheckLibrary, useSetFirmCheckActive } from "@/hooks/use-firm-dashboard";

const SCOPE_WORD = {
  firm: "For the whole firm",
  engagement: "For one engagement",
  person: "For one person",
} as const;

/**
 * The library of checks this firm has written. Checks are retired, never
 * deleted, so a piece of work analysed last month still explains itself.
 */
export function ChecksLibrary({
  profileId,
  runCount,
}: {
  profileId: string | undefined;
  runCount: number;
}) {
  const { data: checks } = useFirmCheckLibrary(profileId);
  const setActive = useSetFirmCheckActive(profileId);
  const [showRetired, setShowRetired] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rows = (checks ?? []).filter((row) => showRetired || row.active);

  async function toggle(id: string, active: boolean) {
    setError(null);
    try {
      await setActive.mutateAsync({ check_id: id, active });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <section className="rounded-[var(--radius)] border border-border bg-card px-5 py-4 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="micro-label">Checks library</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            What this firm asks of its work. Everyone the check applies to can read it. New checks
            are written on an engagement or in a coaching packet.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowRetired((v) => !v)}>
          {showRetired ? "Active only" : "Show retired"}
        </Button>
      </div>

      <p className="mt-3 text-sm text-muted-foreground">
        {runCount} firm checks {runCount === 1 ? "analysis has" : "analyses have"} been run in the
        last period. That counts runs of the checks analysis, not which single check was met.
      </p>

      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}

      <div className="mt-4 space-y-2">
        {rows.map((check) => (
          <div key={check.id} className="rounded-[var(--radius)] border border-border px-4 py-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <p className="text-sm font-medium text-foreground">{check.title}</p>
              <button
                type="button"
                onClick={() => void toggle(check.id, !check.active)}
                disabled={setActive.isPending}
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                {check.active ? "Retire" : "Restore"}
              </button>
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{check.body}</p>
            <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
              {SCOPE_WORD[check.scope]}
              {check.active ? "" : " · retired"}
            </p>
          </div>
        ))}
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {showRetired ? "No checks written yet." : "No active checks right now."}
          </p>
        ) : null}
      </div>
    </section>
  );
}
