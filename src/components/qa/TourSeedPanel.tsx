import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { resetTourFn, seedTourLoginsFn } from "@/lib/demo-firm.functions";

export const TOUR_SEED_COPY = {
  title: "Demo tour",
  line: "Two logins for the guided tour of the demo firm, and the reset to run after each session. Neither login is an admin, and neither uses the demo firm's shared password.",
  add: "Add the tour logins",
  confirmAdd: "Yes, create them or give them new passwords",
  reset: "Reset the tour",
  cancel: "Cancel",
  passwords: "Tour passwords, shown once. Save each in Pane under Settings, Secrets. Pressing the button again makes new ones.",
  clean: "Reset done. The Marrowfield board is not shared and holds one draft, three ledger rows and its value.",
  refused: "Nothing was changed.",
  notClean: "The reset ran but the board is not as it should be. Tell the builder before the next session.",
} as const;

type Login = { email: string; name: string; plays: string; password: string };

/** Founder-only controls for the demo tour, on the QA seed page. Nothing is written until a button is pressed. */
export function TourSeedPanel({ profileId }: { profileId: string | undefined }) {
  const add = useServerFn(seedTourLoginsFn);
  const reset = useServerFn(resetTourFn);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [logins, setLogins] = useState<Login[]>([]);
  const [log, setLog] = useState<string[]>([]);

  async function run(work: () => Promise<string[]>) {
    setBusy(true);
    setConfirming(false);
    setLog([]);
    try {
      setLog(await work());
    } catch (error) {
      setLog([`Stopped: ${error instanceof Error ? error.message : String(error)}`]);
    } finally {
      setBusy(false);
    }
  }

  const addLogins = () =>
    run(async () => {
      const made = await add({ data: { profile_id: profileId } });
      setLogins(made.logins);
      return [`${made.logins.length} logins ready`];
    });

  const resetNow = () =>
    run(async () => {
      const result = await reset({ data: { profile_id: profileId } });
      const left = result.left
        ? [`Left: ${result.left.shared ? "shared" : "not shared"}, ${result.left.ledgerRows} ledger rows, value ${result.left.value ?? "none"}, ${result.left.marks} marks, draft ${result.left.draft ? "kept" : "missing"}`]
        : [];
      const head = result.ok ? TOUR_SEED_COPY.clean : result.refused ? TOUR_SEED_COPY.refused : TOUR_SEED_COPY.notClean;
      return [head, ...result.problems, ...left];
    });

  return (
    <section className="space-y-3 border-t pt-6" aria-labelledby="tour-seed-title">
      <h2 id="tour-seed-title" className="text-lg font-semibold">
        {TOUR_SEED_COPY.title}
      </h2>
      <p className="text-sm text-muted-foreground">{TOUR_SEED_COPY.line}</p>
      <div className="flex flex-wrap gap-2">
        {confirming ? (
          <>
            <Button type="button" onClick={() => void addLogins()} disabled={busy}>
              {TOUR_SEED_COPY.confirmAdd}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setConfirming(false)}>
              {TOUR_SEED_COPY.cancel}
            </Button>
          </>
        ) : (
          <Button type="button" onClick={() => setConfirming(true)} disabled={busy}>
            {TOUR_SEED_COPY.add}
          </Button>
        )}
        <Button type="button" variant="outline" onClick={() => void resetNow()} disabled={busy}>
          {TOUR_SEED_COPY.reset}
        </Button>
      </div>
      {logins.length ? (
        <div className="space-y-2">
          <p className="text-sm font-medium">{TOUR_SEED_COPY.passwords}</p>
          {logins.map((login) => (
            <div key={login.email} className="space-y-1">
              <label className="block text-sm" htmlFor={`tour-password-${login.email}`}>
                {`${login.plays}: ${login.name}, ${login.email}`}
              </label>
              <input
                id={`tour-password-${login.email}`}
                readOnly
                value={login.password}
                onFocus={(event) => event.currentTarget.select()}
                className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm"
              />
            </div>
          ))}
        </div>
      ) : null}
      {log.length ? (
        <pre role="status" className="whitespace-pre-wrap font-mono text-xs text-foreground">
          {log.join("\n")}
        </pre>
      ) : null}
    </section>
  );
}
