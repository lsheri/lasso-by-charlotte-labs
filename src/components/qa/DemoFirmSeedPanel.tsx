import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  demoFirmStatus,
  finishDemoFirmSeed,
  resetDemoFirmFn,
  seedDemoFirmBoard,
  seedDemoFirmPeople,
} from "@/lib/demo-firm.functions";

export const DEMO_FIRM_COPY = {
  title: "Demo firm",
  line: "Seeds Kestrel Bay Advisory, an invented strategy firm with 33 people and 30 boards, into its own company workspace for buyer demos. Logins use the kestrelbay.test domain and share one password, shown once.",
  seed: "Seed the demo firm",
  resume: "Seed missing boards",
  reset: "Reset the demo firm",
  confirmReset: "Yes, remove the demo firm",
  cancel: "Cancel",
  exists: "The demo firm is seeded.",
  missing: "The demo firm is not seeded.",
  password: "Demo password, shown once. Save it in Pane under Settings, Secrets.",
} as const;

/** Founder-only controls for the demo firm, on the QA seed page. Steps run one board at a time so none times out. */
export function DemoFirmSeedPanel({ profileId }: { profileId: string | undefined }) {
  const status = useServerFn(demoFirmStatus);
  const people = useServerFn(seedDemoFirmPeople);
  const board = useServerFn(seedDemoFirmBoard);
  const finish = useServerFn(finishDemoFirmSeed);
  const reset = useServerFn(resetDemoFirmFn);
  const [exists, setExists] = useState<boolean | null>(null);
  const [boards, setBoards] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [password, setPassword] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const note = (line: string) => setLog((current) => [...current, line]);

  const refresh = async () => {
    const result = await status({ data: { profile_id: profileId } });
    setExists(result.exists);
    setBoards(result.boards);
  };
  useEffect(() => {
    void refresh().catch((error: Error) => note(error.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  async function seed() {
    setBusy(true);
    setLog([]);
    try {
      if (!exists) {
        const made = await people({ data: { profile_id: profileId } });
        setPassword(made.password);
        note(`${made.people} people created`);
      }
      for (const key of boards) {
        const result = await board({ data: { profile_id: profileId, board: key } });
        note(result.skipped ? `${key}: already there` : `${key}: ${result.items} items, ${result.showings} client marks`);
      }
      await finish({ data: { profile_id: profileId } });
      note("Done");
    } catch (error) {
      note(`Stopped: ${error instanceof Error ? error.message : String(error)}. Run it again to continue.`);
    } finally {
      setBusy(false);
      await refresh().catch(() => {});
    }
  }

  async function remove() {
    setBusy(true);
    setConfirming(false);
    setLog([]);
    try {
      const result = await reset({ data: { profile_id: profileId } });
      note(result.removed ? "Removed" : `Not fully removed: ${result.problems.join("; ")}`);
    } catch (error) {
      note(`Stopped: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
      await refresh().catch(() => {});
    }
  }

  return (
    <section className="space-y-3 border-t pt-6" aria-labelledby="demo-firm-title">
      <h2 id="demo-firm-title" className="text-lg font-semibold">
        {DEMO_FIRM_COPY.title}
      </h2>
      <p className="text-sm text-muted-foreground">{DEMO_FIRM_COPY.line}</p>
      {exists !== null ? <p className="text-sm">{exists ? DEMO_FIRM_COPY.exists : DEMO_FIRM_COPY.missing}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => void seed()} disabled={busy || exists === null}>
          {exists ? DEMO_FIRM_COPY.resume : DEMO_FIRM_COPY.seed}
        </Button>
        {exists && !confirming ? (
          <Button type="button" variant="outline" onClick={() => setConfirming(true)} disabled={busy}>
            {DEMO_FIRM_COPY.reset}
          </Button>
        ) : null}
        {confirming ? (
          <>
            <Button type="button" variant="destructive" onClick={() => void remove()} disabled={busy}>
              {DEMO_FIRM_COPY.confirmReset}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setConfirming(false)}>
              {DEMO_FIRM_COPY.cancel}
            </Button>
          </>
        ) : null}
      </div>
      {password ? (
        <div className="space-y-1">
          <label className="block text-sm font-medium" htmlFor="demo-firm-password">
            {DEMO_FIRM_COPY.password}
          </label>
          <input
            id="demo-firm-password"
            readOnly
            value={password}
            onFocus={(event) => event.currentTarget.select()}
            className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm"
          />
        </div>
      ) : null}
      {log.length ? <pre className="whitespace-pre-wrap font-mono text-xs text-foreground">{log.join("\n")}</pre> : null}
    </section>
  );
}
