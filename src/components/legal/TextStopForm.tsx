import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  checkTextStop,
  TEXT_STOP_COPY as COPY,
  type TextStopInput,
  type TextStopResult,
} from "@/lib/text-consent-shared";

/**
 * 19 Nov 2026: stopping texts from a person's own link, as well as by replying STOP. Shown on /texts only when the
 * link names a roster person. The person types the number they agreed with; the answer is the same whether anything
 * was stopped or not, so the form cannot be used to find out whose number is on file. The number is never shown
 * back. It stops texts from the one firm whose link this is.
 */
export function TextStopForm({
  submit,
  workspace,
  contact,
}: {
  submit: (input: TextStopInput) => Promise<TextStopResult>;
  workspace: string;
  contact: string;
}) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const lock = useRef(false);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    if (!checkTextStop({ phone, workspace, contact }).ok) return setProblem(COPY.problem);
    lock.current = true;
    setBusy(true);
    setProblem(null);
    let result: TextStopResult;
    try {
      result = await submit({ phone, workspace, contact });
    } catch {
      result = { ok: false, reason: "unavailable" };
    }
    lock.current = false;
    setBusy(false);
    if (result.ok) {
      setPhone("");
      return setDone(true);
    }
    setProblem(COPY.failures[result.reason]);
  }

  if (done) {
    return (
      <div role="status" className="space-y-1">
        <p className="font-medium">{COPY.doneHeading}</p>
        <p className="text-sm leading-relaxed text-muted-foreground">{COPY.done}</p>
      </div>
    );
  }

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        {COPY.open}
      </Button>
    );
  }

  return (
    <form onSubmit={send} noValidate className="space-y-3">
      <div>
        <p className="font-medium">{COPY.heading}</p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{COPY.intro}</p>
      </div>
      <div className="space-y-1">
        <Label htmlFor="text-stop-phone">{COPY.phoneLabel}</Label>
        <Input
          id="text-stop-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          aria-invalid={problem !== null}
          aria-describedby={problem ? "text-stop-problem" : undefined}
          onChange={(event) => {
            setPhone(event.target.value);
            setProblem(null);
          }}
        />
      </div>
      {problem ? (
        <p id="text-stop-problem" role="alert" className="text-sm text-destructive">
          {problem}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="outline" disabled={busy}>
          {busy ? COPY.sending : COPY.submit}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setOpen(false);
            setPhone("");
            setProblem(null);
          }}
        >
          {COPY.cancel}
        </Button>
      </div>
    </form>
  );
}
