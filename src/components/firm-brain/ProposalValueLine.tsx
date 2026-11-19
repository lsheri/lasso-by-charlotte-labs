import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { todayIso } from "@/lib/client-showings-shared";
import {
  boardTimeline,
  formatLedgerAmount,
  LEDGER_COPY,
  LEDGER_CURRENCIES,
  LEDGER_KIND_LABELS,
  ledgerDate,
  ledgerFigureLines,
  MAX_AMOUNT_CHARS,
  parseLedgerAmount,
  type BoardValueSoFar,
  type HumanKind,
  type LedgerSourceLink,
} from "@/lib/proposal-ledger-shared";
import { boardValueSoFar, recordProposalStep, removeProposalStep, setProposalValue } from "@/lib/proposal-ledger.functions";

import { ProposalLedgerFigures } from "./ProposalLedgerFigures";
import { WonTextButton } from "./WonTextButton";

type Editing = { what: "step"; kind: HumanKind; exists: boolean } | { what: "value" } | null;

const LABEL = "font-mono text-(length:--type-label) uppercase tracking-[0.06em] text-muted-foreground";

/**
 * 19 Nov, Firm Brain Build Spec step 9: the compact "Value so far" line on a proposal board (its own file, since
 * nothing renders CanvasLabPage in tests). It shows this proposal's dates as a short timeline with a way to set or
 * correct each, the counts from the first draft and Red pen, and for admins and leads the value. Every figure opens
 * to the ledger rows behind it. The server reads with the person's own access, so the database decides what shows:
 * the board's owner, and admins and leads once the board is shared. Anyone else sees nothing here.
 */
export function ProposalValueLine({
  engagementId,
  profileId,
  refreshKey = 0,
  onOpenSource,
}: {
  engagementId: string;
  profileId: string | null | undefined;
  /** Bump to read again after something else wrote a row (a new draft, questions marked as sent). */
  refreshKey?: number | undefined;
  onOpenSource?: ((link: LedgerSourceLink) => void) | undefined;
}) {
  const load = useServerFn(boardValueSoFar);
  const record = useServerFn(recordProposalStep);
  const remove = useServerFn(removeProposalStep);
  const saveValue = useServerFn(setProposalValue);
  const [data, setData] = useState<BoardValueSoFar | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [editing, setEditing] = useState<Editing>(null);
  const [date, setDate] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<string>(LEDGER_CURRENCIES[0]);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [savedValue, setSavedValue] = useState<string | null>(null);
  // A second click before the first request returns is ignored; a request that returns after the panel closed
  // changes nothing.
  const lock = useRef(false);
  const live = useRef(true);

  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);

  useEffect(() => {
    let current = true;
    setFailed(false);
    load({ data: { engagement_id: engagementId, profile_id: profileId ?? null } })
      .then((next) => {
        if (current) setData(next);
      })
      .catch(() => {
        if (current) setFailed(true);
      });
    return () => {
      current = false;
    };
  }, [engagementId, profileId, refreshKey, attempt, load]);

  const input = { engagement_id: engagementId, profile_id: profileId ?? null };

  async function run(work: () => Promise<{ ok: true } | { ok: false; problem: string }>, refusedLine: string, after?: () => void) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setProblem(null);
    try {
      const result = await work();
      if (!live.current) return;
      if (!result.ok) {
        setProblem(result.problem);
        return;
      }
      setEditing(null);
      after?.();
      setAttempt((count) => count + 1);
    } catch {
      if (live.current) setProblem(refusedLine);
    } finally {
      lock.current = false;
      if (live.current) setBusy(false);
    }
  }

  function editStep(kind: HumanKind, current: string | null) {
    setProblem(null);
    setDate(current ?? todayIso());
    setEditing({ what: "step", kind, exists: current !== null });
  }

  function saveStep(kind: HumanKind) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setProblem(LEDGER_COPY.badDate);
    if (date > todayIso()) return setProblem(LEDGER_COPY.futureDate);
    void run(() => record({ data: { ...input, kind, date } }), LEDGER_COPY.refused);
  }

  function editValue() {
    setProblem(null);
    setSavedValue(null);
    setAmount(data?.value ? String(data.value.amount) : "");
    setCurrency(data?.value?.currency ?? LEDGER_CURRENCIES[0]);
    setEditing({ what: "value" });
  }

  function submitValue() {
    const parsed = parseLedgerAmount(amount, currency);
    if (!parsed.ok) return setProblem(parsed.problem);
    void run(
      async () => {
        const result = await saveValue({ data: { ...input, amount_text: amount, currency } });
        if (result.ok && result.value && live.current) setSavedValue(formatLedgerAmount(result.value.amount, result.value.currency));
        return result;
      },
      LEDGER_COPY.valueRefused,
    );
  }

  if (failed && !data) {
    return (
      <section aria-label={LEDGER_COPY.title} data-testid="proposal-value-line" className="flex flex-col gap-1">
        <p className={LABEL}>{LEDGER_COPY.title}</p>
        <p role="alert" className="text-(length:--type-small) text-destructive">
          {LEDGER_COPY.loadFailed}
        </p>
        <Button type="button" size="sm" variant="outline" className="self-start" onClick={() => setAttempt((count) => count + 1)}>
          {LEDGER_COPY.retry}
        </Button>
      </section>
    );
  }
  if (!data) return null;
  if (data.access === "none" && !data.canSetValue) return null;

  const alert = problem ? (
    <p role="alert" className="text-(length:--type-small) text-destructive">
      {problem}
    </p>
  ) : null;

  const valueForm =
    editing?.what === "value" ? (
      <form
        data-ledger-value-form
        className="flex flex-col gap-1"
        onSubmit={(event) => {
          event.preventDefault();
          submitValue();
        }}
      >
        <p className="text-(length:--type-small) text-muted-foreground">{LEDGER_COPY.valueHelper}</p>
        <div className="flex gap-2">
          <Input aria-label={LEDGER_COPY.amountLabel} value={amount} maxLength={MAX_AMOUNT_CHARS} placeholder={LEDGER_COPY.amountPlaceholder} disabled={busy} onChange={(event) => setAmount(event.target.value)} className="h-9" />
          <NativeSelect aria-label={LEDGER_COPY.currencyLabel} value={currency} disabled={busy} onChange={(event) => setCurrency(event.target.value)} className="w-24 shrink-0">
            {LEDGER_CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </NativeSelect>
        </div>
        {alert}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm" disabled={busy}>
            {LEDGER_COPY.save}
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setEditing(null)}>
            {LEDGER_COPY.cancel}
          </Button>
          {data.value ? (
            <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => void run(() => saveValue({ data: { ...input, clear: true } }), LEDGER_COPY.valueRefused)}>
              {LEDGER_COPY.removeValue}
            </Button>
          ) : null}
        </div>
      </form>
    ) : null;

  // An admin or lead on a board the database does not show them yet: they can set the value, and are told who sees it.
  if (data.access === "none") {
    return (
      <section aria-label={LEDGER_COPY.title} data-testid="proposal-value-line" data-ledger-access="none" className="flex flex-col gap-1 rounded-[var(--radius)] border border-border bg-background p-3">
        <p className={LABEL}>{LEDGER_COPY.title}</p>
        <p className="text-(length:--type-small) text-muted-foreground">{LEDGER_COPY.valueWriteOnly}</p>
        {savedValue ? <p data-ledger-value-saved className="text-(length:--type-small) text-foreground">{LEDGER_COPY.valueSaved(savedValue)}</p> : null}
        {valueForm ?? (
          <Button type="button" size="sm" variant="outline" className="self-start" onClick={editValue}>
            {LEDGER_COPY.setValue}
          </Button>
        )}
      </section>
    );
  }

  const timeline = boardTimeline(data.rows);
  const lines = ledgerFigureLines(data.figures, "board");
  const stepForm = (kind: HumanKind, exists: boolean) => (
    <form
      data-ledger-step-form={kind}
      // The picker still greys out later days (max); the refusal is our plain line, not the browser's bubble.
      noValidate
      className="mt-1 flex flex-col gap-1"
      onSubmit={(event) => {
        event.preventDefault();
        saveStep(kind);
      }}
    >
      <Input type="date" aria-label={LEDGER_COPY.dateLabel(LEDGER_KIND_LABELS[kind])} value={date} max={todayIso()} disabled={busy} onChange={(event) => setDate(event.target.value)} className="h-9" />
      {alert}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={busy}>
          {LEDGER_COPY.save}
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setEditing(null)}>
          {LEDGER_COPY.cancel}
        </Button>
        {exists ? (
          <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => void run(() => remove({ data: { ...input, kind } }), LEDGER_COPY.refused)}>
            {LEDGER_COPY.remove}
          </Button>
        ) : null}
      </div>
    </form>
  );
  const editingStep = editing?.what === "step" ? editing : null;

  return (
    <section aria-label={LEDGER_COPY.title} data-testid="proposal-value-line" data-ledger-access={data.access} className="flex flex-col gap-2 rounded-[var(--radius)] border border-border bg-background p-3">
      <p className={LABEL}>{LEDGER_COPY.title}</p>
      {data.figures.empty ? <p data-ledger-empty className="text-(length:--type-small) text-muted-foreground">{LEDGER_COPY.empty}</p> : null}
      <ol data-ledger-timeline className="flex flex-col gap-1">
        {timeline.steps.map((step) => (
          <li key={step.kind} data-ledger-step={step.kind} className="text-(length:--type-small)">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-foreground">{LEDGER_KIND_LABELS[step.kind]}</span>
              <span className="flex items-baseline gap-2 text-muted-foreground">
                {step.date ? ledgerDate(step.date) : LEDGER_COPY.notRecorded}
                {data.canEdit && step.editable && editingStep?.kind !== step.kind ? (
                  <button type="button" className="underline" aria-label={`${step.date ? LEDGER_COPY.change : LEDGER_COPY.setDate}: ${LEDGER_KIND_LABELS[step.kind]}`} onClick={() => editStep(step.kind as HumanKind, step.date)}>
                    {step.date ? LEDGER_COPY.change : LEDGER_COPY.setDate}
                  </button>
                ) : null}
              </span>
            </div>
            {editingStep?.kind === step.kind ? stepForm(step.kind as HumanKind, editingStep.exists) : null}
          </li>
        ))}
        <li data-ledger-step="outcome" className="text-(length:--type-small)">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-foreground">{LEDGER_COPY.outcome}</span>
            <span className="flex flex-wrap items-baseline gap-2 text-muted-foreground">
              {timeline.outcome ? `${LEDGER_KIND_LABELS[timeline.outcome.kind]}, ${ledgerDate(timeline.outcome.date)}` : LEDGER_COPY.notDecided}
              {data.canEdit && !editingStep && timeline.outcome ? (
                <button type="button" className="underline" aria-label={`${LEDGER_COPY.change}: ${LEDGER_COPY.outcome}`} onClick={() => editStep(timeline.outcome!.kind, timeline.outcome!.date)}>
                  {LEDGER_COPY.change}
                </button>
              ) : null}
              {data.canEdit && !editingStep && !timeline.outcome ? (
                <>
                  <button type="button" className="underline" onClick={() => editStep("won", null)}>
                    {LEDGER_COPY.markWon}
                  </button>
                  <button type="button" className="underline" onClick={() => editStep("lost", null)}>
                    {LEDGER_COPY.markLost}
                  </button>
                </>
              ) : null}
            </span>
          </div>
          {editingStep && (editingStep.kind === "won" || editingStep.kind === "lost") ? stepForm(editingStep.kind, editingStep.exists) : null}
          {timeline.outcome?.kind === "won" && !editingStep ? <WonTextButton engagementId={engagementId} profileId={profileId} /> : null}
          {data.finished && !timeline.outcome && data.canEdit ? <p data-ledger-finished-hint className="mt-1 text-muted-foreground">{LEDGER_COPY.finishedHint}</p> : null}
        </li>
      </ol>
      <ProposalLedgerFigures lines={lines} rows={data.rows} sources={data.sources} onOpenSource={onOpenSource} />
      {data.canSeeValue ? (
        <div data-ledger-value className="text-(length:--type-small)">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-foreground">{LEDGER_COPY.valueLabel}</span>
            <span className="flex items-baseline gap-2 text-muted-foreground">
              {data.value ? formatLedgerAmount(data.value.amount, data.value.currency) : LEDGER_COPY.valueNotSet}
              {data.canSetValue && editing?.what !== "value" ? (
                <button type="button" className="underline" onClick={editValue}>
                  {data.value ? LEDGER_COPY.change : LEDGER_COPY.setValue}
                </button>
              ) : null}
            </span>
          </div>
          {valueForm}
        </div>
      ) : null}
      {data.access === "owner" && !data.shared ? <p data-ledger-unshared className="text-(length:--type-small) text-muted-foreground">{LEDGER_COPY.unsharedNote}</p> : null}
    </section>
  );
}
