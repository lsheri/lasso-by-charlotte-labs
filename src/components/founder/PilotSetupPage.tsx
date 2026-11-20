import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { tagVariants } from "@/components/ui/tag";
import { cleanPilotInput, PILOT_COPY as C, type PilotRow, type PilotSetupResult } from "@/lib/pilot-setup-shared";
import { listPilotsFn, setUpPilotFn } from "@/lib/pilot-setup.functions";

/** A 403 from the founder gate, or no session at all. */
export function isRefusal(error: unknown): boolean {
  if (error instanceof Response) return error.status === 403 || error.status === 401;
  const message = error instanceof Error ? error.message : "";
  return /^(Unauthorized|Forbidden)/.test(message);
}

const when = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

/**
 * 20 Nov 2026, /founder/pilots: Set up a pilot. Charlotte Labs founders only, enforced by both server functions; the
 * page shows nothing but one line when refused. Not linked from any navigation, like /founder/costs.
 */
export function PilotSetupPage() {
  const setUp = useServerFn(setUpPilotFn);
  const list = useServerFn(listPilotsFn);
  const queryClient = useQueryClient();
  const [firmName, setFirmName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PilotSetupResult | null>(null);
  const [refused, setRefused] = useState(false);
  const [copied, setCopied] = useState(false);
  // One press at a time: a second press while the first is out sends nothing.
  const inFlight = useRef(false);

  const pilots = useQuery<PilotRow[]>({ queryKey: ["founder-pilots"], queryFn: () => list(), retry: false, staleTime: 30_000 });

  if (refused || (pilots.error && isRefusal(pilots.error))) {
    return (
      <div className="mx-auto max-w-xl p-8">
        <p role="alert" className="text-(length:--type-body) text-muted-foreground">
          {C.refused}
        </p>
      </div>
    );
  }

  // Nothing about the page shows until the server has said who this is (QA of #286, L4).
  if (pilots.isPending) return null;

  const check = cleanPilotInput({ firm_name: firmName, admin_email: adminEmail });
  // A long paste is not cut short in the box: the line says what is wrong (QA of #286, L5).
  const nameWrong = firmName.trim() !== "" && !cleanPilotInput({ firm_name: firmName, admin_email: "a@b.co" }).ok;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (inFlight.current || !check.ok) return;
    inFlight.current = true;
    setBusy(true);
    setCopied(false);
    try {
      const outcome = await setUp({ data: { firm_name: firmName, admin_email: adminEmail } });
      setResult(outcome);
      if (outcome.ok) {
        setFirmName("");
        setAdminEmail("");
        void queryClient.invalidateQueries({ queryKey: ["founder-pilots"] });
      }
    } catch (error) {
      if (isRefusal(error)) setRefused(true);
      else setResult({ ok: false, reason: "failed" });
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-4 sm:p-8">
      <header className="space-y-2">
        <h1 className="page-title">{C.title}</h1>
        <p className="text-(length:--type-small) text-muted-foreground">{C.intro}</p>
      </header>

      <form className="space-y-4" onSubmit={submit} aria-busy={busy}>
        <label className="flex flex-col gap-1 text-(length:--type-small) text-muted-foreground">
          {C.firmName}
          <Input value={firmName} aria-invalid={nameWrong} disabled={busy} onChange={(e) => setFirmName(e.target.value)} autoComplete="off" />
        </label>
        {nameWrong ? (
          <p data-pilot-name-problem className="text-(length:--type-small) text-destructive">
            {C.invalid.firm_name}
          </p>
        ) : null}
        <label className="flex flex-col gap-1 text-(length:--type-small) text-muted-foreground">
          {C.adminEmail}
          <Input type="email" value={adminEmail} disabled={busy} onChange={(e) => setAdminEmail(e.target.value)} autoComplete="off" />
        </label>
        <Button type="submit" disabled={busy || !check.ok}>
          {busy ? C.working : C.submit}
        </Button>
      </form>

      {result ? (
        <div role="status" data-pilot-result className="space-y-2 rounded-md border border-border p-4 text-(length:--type-small)">
          {result.ok ? (
            <>
              <p className="font-medium">{C.done(result.orgName)}</p>
              <p className="text-muted-foreground">{C.emailed[result.emailed]}</p>
              <div className="flex flex-wrap items-center gap-2">
                <code className="break-all rounded bg-muted px-2 py-1">{result.joinUrl}</code>
                <Button type="button" variant="outline" size="sm" onClick={() => void copy(result.joinUrl)}>
                  {copied ? C.copied : C.copyLink}
                </Button>
              </div>
            </>
          ) : (
            <p className="text-destructive">{result.reason === "invalid" ? C.invalid[result.field] : result.reason === "exists" ? C.exists : result.reason === "stuck" ? C.stuck : C.failed}</p>
          )}
        </div>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-(length:--type-body) font-medium">{C.listTitle}</h2>
        {pilots.isPending ? null : !pilots.data?.length ? (
          <p className="text-(length:--type-small) text-muted-foreground">{C.listEmpty}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{C.firmName}</TableHead>
                <TableHead>{C.adminEmail}</TableHead>
                <TableHead>Set up</TableHead>
                <TableHead>State</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pilots.data.map((row) => (
                <TableRow key={row.orgId}>
                  <TableCell>{row.name}</TableCell>
                  <TableCell className="break-all">{row.inviteEmail ?? ""}</TableCell>
                  <TableCell>{Number.isFinite(Date.parse(row.setUpAt)) ? when.format(new Date(row.setUpAt)) : ""}</TableCell>
                  <TableCell>
                    <span className={tagVariants()}>{C.invite[row.invite]}</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}
