import { Link } from "@tanstack/react-router";
import { useId, useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  checkTextConsent,
  TEXT_CONSENT_COPY as COPY,
  TEXT_CONSENT_WORDING,
  type TextConsentInput,
  type TextConsentProblem,
  type TextConsentResult,
} from "@/lib/text-consent-shared";

const LINK = "text-accent-deep underline underline-offset-4";

/**
 * 19 Nov 2026: the form where a person agrees to receive text messages from Lasso. Name, mobile number, and the tick
 * box with the registered wording, never ticked for them. Props in, effects out: the page passes `submit`, so this
 * renders in a test with no server. A refused or failed save keeps the form open with a plain line; the confirmation
 * shows only after the server says it saved, and never repeats the number.
 */
export function TextConsentForm({
  submit,
  workspace = null,
  contact = null,
}: {
  submit: (input: TextConsentInput) => Promise<TextConsentResult>;
  workspace?: string | null;
  contact?: string | null;
}) {
  const id = useId();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [problems, setProblems] = useState<TextConsentProblem[]>([]);
  const [failure, setFailure] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  // A ref as well as state: two presses in one tick both see the same state value.
  const busy = useRef(false);

  if (done) {
    return (
      <div
        role="status"
        className="rounded-[var(--radius-control)] border border-border bg-card px-5 py-6 shadow-card"
      >
        <h2 className="section-title">{COPY.doneHeading}</h2>
        <p className="mt-3 text-sm leading-relaxed text-foreground">{COPY.done}</p>
        <p className="mt-2 text-sm text-muted-foreground">{COPY.doneNote}</p>
      </div>
    );
  }

  const has = (problem: TextConsentProblem) => problems.includes(problem);
  // A complaint about a field goes the moment the person changes that field; the next press checks it again.
  const clear = (problem: TextConsentProblem) =>
    setProblems((now) => (now.includes(problem) ? now.filter((p) => p !== problem) : now));

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy.current) return;
    setFailure(null);
    const input: TextConsentInput = { name, phone, agreed, workspace, contact };
    const check = checkTextConsent(input);
    if (!check.ok) {
      setProblems(check.problems);
      return;
    }
    setProblems([]);
    busy.current = true;
    setSending(true);
    try {
      const result = await submit(input);
      if (result.ok) setDone(true);
      else {
        if (result.problems?.length) setProblems(result.problems);
        setFailure(COPY.failures[result.reason] ?? COPY.failures.unavailable);
      }
    } catch {
      setFailure(COPY.failures.unavailable);
    } finally {
      busy.current = false;
      setSending(false);
    }
  }

  return (
    <form noValidate onSubmit={onSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor={`${id}-name`}>{COPY.nameLabel}</Label>
        <Input
          id={`${id}-name`}
          name="name"
          autoComplete="name"
          maxLength={120}
          value={name}
          disabled={sending}
          aria-invalid={has("name")}
          aria-describedby={has("name") ? `${id}-name-problem` : undefined}
          onChange={(event) => {
            setName(event.target.value);
            clear("name");
          }}
          className="h-11"
        />
        {has("name") && (
          <p id={`${id}-name-problem`} className="text-sm text-destructive">
            {COPY.problems.name}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${id}-phone`}>{COPY.phoneLabel}</Label>
        <Input
          id={`${id}-phone`}
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          maxLength={32}
          value={phone}
          disabled={sending}
          aria-invalid={has("phone")}
          aria-describedby={`${id}-phone-hint${has("phone") ? ` ${id}-phone-problem` : ""}`}
          onChange={(event) => {
            setPhone(event.target.value);
            clear("phone");
          }}
          className="h-11"
        />
        <p id={`${id}-phone-hint`} className="text-sm text-muted-foreground">
          {COPY.phoneHint}
        </p>
        {has("phone") && (
          <p id={`${id}-phone-problem`} className="text-sm text-destructive">
            {COPY.problems.phone}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-start gap-3">
          <Checkbox
            id={`${id}-agree`}
            checked={agreed}
            disabled={sending}
            aria-invalid={has("agree")}
            aria-describedby={has("agree") ? `${id}-agree-problem` : undefined}
            onCheckedChange={(value) => {
              setAgreed(value === true);
              clear("agree");
            }}
            className="mt-0.5 h-5 w-5"
          />
          <Label
            htmlFor={`${id}-agree`}
            className="cursor-pointer text-sm font-normal leading-relaxed text-foreground"
          >
            {TEXT_CONSENT_WORDING}
          </Label>
        </div>
        {has("agree") && (
          <p id={`${id}-agree-problem`} className="text-sm text-destructive">
            {COPY.problems.agree}
          </p>
        )}
      </div>

      <p className="text-sm leading-relaxed text-muted-foreground">
        {COPY.legalBefore}{" "}
        <Link to="/privacy" className={LINK}>
          {COPY.privacy}
        </Link>{" "}
        {COPY.legalBetween}{" "}
        <Link to="/terms" className={LINK}>
          {COPY.terms}
        </Link>
        {COPY.legalAfter}
      </p>

      {failure && (
        <p role="alert" className="text-sm text-destructive">
          {failure}
        </p>
      )}

      <Button type="submit" pending={sending} disabled={sending} className="h-11 w-full sm:w-auto">
        {sending ? COPY.sending : COPY.submit}
      </Button>
    </form>
  );
}
