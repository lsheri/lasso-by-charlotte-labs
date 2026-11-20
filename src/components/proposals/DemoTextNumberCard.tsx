import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEMO_NUMBER_COPY, demoNumber, type DemoNumberResult, type DemoNumberStatus } from "@/lib/demo-text-number-shared";
import { clearDemoNumberFn, demoNumberStatusFn, saveDemoNumberFn } from "@/lib/demo-text-number.functions";
import { deskDate } from "@/lib/proposal-desk-shared";

/**
 * 20 Nov 2026 (Liam, D-50): where an admin of a DEMO workspace enters the one phone number its won-proposal text
 * goes to. The number is write-only: once saved the field empties, and the page only ever learns that a number is
 * set, its last two digits and when. Nothing is drawn for anyone else or in any real workspace; the server decides.
 */
export function DemoTextNumberForm({
  status,
  onSave,
  onClear,
}: {
  status: Extract<DemoNumberStatus, { show: true }>;
  onSave: (phone: string, agreed: boolean) => Promise<DemoNumberResult>;
  onClear: () => Promise<DemoNumberResult>;
}) {
  const copy = DEMO_NUMBER_COPY;
  const ids = useId();
  const [editing, setEditing] = useState(false);
  const [phone, setPhone] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState<"save" | "clear" | null>(null);
  const [note, setNote] = useState<{ kind: "ok" | "problem"; text: string } | null>(null);
  const showForm = !status.set || editing;

  function reset() {
    // The typed number leaves the page as soon as it is not needed.
    setPhone("");
    setAgreed(false);
    setEditing(false);
  }

  async function run(kind: "save" | "clear", work: () => Promise<DemoNumberResult>, done: string) {
    if (busy) return;
    setBusy(kind);
    setNote(null);
    try {
      const result = await work();
      if (result.ok) {
        reset();
        setNote({ kind: "ok", text: done });
      } else {
        setNote({ kind: "problem", text: result.problem });
      }
    } catch {
      setNote({ kind: "problem", text: copy.problems.failed });
    } finally {
      setBusy(null);
    }
  }

  function save(event: React.FormEvent) {
    event.preventDefault();
    if (!demoNumber(phone)) return setNote({ kind: "problem", text: copy.problems.number });
    if (!agreed) return setNote({ kind: "problem", text: copy.problems.agreed });
    void run("save", () => onSave(phone, agreed), copy.saved);
  }

  return (
    <section data-testid="demo-text-number" className="mt-8">
      <h2 className="micro-label micro-label-section">{copy.title}</h2>
      <div className="mt-3 space-y-3 rounded-[var(--radius)] border border-border bg-card px-4 py-4 shadow-card">
        <p className="text-sm text-muted-foreground">{copy.line}</p>
        <p className="text-sm text-foreground" data-demo-number-state={status.set ? "set" : "none"}>
          {status.set ? copy.set(status.lastTwo, deskDate(status.setAt)) : copy.none}
        </p>
        {showForm ? (
          <form onSubmit={save} className="space-y-3" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor={`${ids}-phone`} className="micro-label">
                {copy.label}
              </Label>
              <Input
                id={`${ids}-phone`}
                type="tel"
                inputMode="tel"
                autoComplete="off"
                className="max-w-xs"
                placeholder={copy.hint}
                value={phone}
                disabled={busy !== null}
                onChange={(event) => {
                  setPhone(event.target.value);
                  setNote(null);
                }}
              />
            </div>
            <div className="flex items-start gap-2">
              <Checkbox
                id={`${ids}-agreed`}
                className="mt-0.5"
                checked={agreed}
                disabled={busy !== null}
                onCheckedChange={(next) => {
                  setAgreed(next === true);
                  setNote(null);
                }}
              />
              <Label htmlFor={`${ids}-agreed`} className="text-sm font-normal text-foreground">
                {copy.agreed}
              </Label>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" size="sm" disabled={busy !== null}>
                {busy === "save" ? copy.saving : copy.save}
              </Button>
              {status.set ? (
                <Button type="button" variant="ghost" size="sm" disabled={busy !== null} onClick={reset}>
                  {copy.cancel}
                </Button>
              ) : null}
            </div>
          </form>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" disabled={busy !== null} onClick={() => { setEditing(true); setNote(null); }}>
              {copy.change}
            </Button>
            <Button type="button" variant="ghost" size="sm" disabled={busy !== null} onClick={() => void run("clear", onClear, copy.cleared)}>
              {busy === "clear" ? copy.clearing : copy.clear}
            </Button>
          </div>
        )}
        {note ? (
          <p role={note.kind === "problem" ? "alert" : "status"} className={note.kind === "problem" ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
            {note.text}
          </p>
        ) : null}
      </div>
    </section>
  );
}

/** The card on the Proposals page, People tab. Draws nothing unless the server says this is an admin of a demo workspace. */
export function DemoTextNumberCard({ profileId }: { profileId: string | undefined }) {
  const queryClient = useQueryClient();
  const key = ["demo-text-number", profileId];
  const status = useQuery({
    queryKey: key,
    enabled: Boolean(profileId),
    queryFn: () => demoNumberStatusFn({ data: { profile_id: profileId as string } }),
    retry: false,
  });
  if (!profileId || !status.data || !status.data.show) return null;
  const settle = (result: DemoNumberResult) => {
    if (result.ok) queryClient.setQueryData(key, result.status);
    return result;
  };
  return (
    <DemoTextNumberForm
      status={status.data}
      onSave={async (phone, agreed) => settle(await saveDemoNumberFn({ data: { profile_id: profileId, phone, agreed } }))}
      onClear={async () => settle(await clearDemoNumberFn({ data: { profile_id: profileId } }))}
    />
  );
}
