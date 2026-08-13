import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { labelFinding } from "@/lib/telemetry-v2.functions";

/**
 * The human label. One tap, no counter, no score shown back. It is the only
 * judgement in the product that comes from the person rather than the model.
 */
export function FindingLabel({
  preset,
  claims,
  profileId,
  runId,
}: {
  preset: string;
  claims: number;
  profileId?: string | undefined;
  runId?: string | undefined;
}) {
  const send = useServerFn(labelFinding);
  const [done, setDone] = useState(false);

  if (done) return <p className="mt-3 text-xs text-muted-foreground">Noted.</p>;

  function tap(label: "confirmed" | "rejected") {
    setDone(true);
    void send({
      data: { preset, label, claims_rendered: claims, profile_id: profileId, run_id: runId },
    }).catch(() => {
      /* a label is never worth an error in front of someone */
    });
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => tap("confirmed")}
        className="rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent-soft"
      >
        This matched my work
      </button>
      <button
        type="button"
        onClick={() => tap("rejected")}
        className="rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent-soft"
      >
        This missed
      </button>
    </div>
  );
}
