import { useServerFn } from "@tanstack/react-start";
import { useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  canAskTheFirm,
  FIRM_ASK_COPY,
  FIRM_ASK_QUESTION_MAX,
  FIRM_ASK_STARTER_COPY,
  startersFor,
  type FirmAskResult,
  type FirmAskStarter,
} from "@/lib/firm-ask-shared";
import { askTheFirm } from "@/lib/firm-ask.functions";

import { FirmAnswer } from "./FirmAnswer";
import { FirmSourcePreview } from "./FirmSourcePreview";

type AskProfile = { id?: string | null; role?: string | null; has_firm_view?: boolean | null; org_type?: string | null };

/**
 * 17 Nov, firm brain: the Ask the firm box, on Home and the firm view. Hidden unless the
 * workspace is a company and the person is not a coach; the server checks again and refuses guests. Nothing about the
 * question is kept: the answer lives in this component's state only.
 */
export function AskTheFirm({
  profile,
  className,
  onResult,
}: {
  profile: AskProfile | null | undefined;
  className?: string;
  /** The firm map's answer trace: null when a new question starts, then the answer. Nothing else about the question leaves. */
  onResult?: (result: FirmAskResult | null) => void;
}) {
  const ask = useServerFn(askTheFirm);
  const [question, setQuestion] = useState("");
  const [starter, setStarter] = useState<FirmAskStarter | null>(null);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [refused, setRefused] = useState(false);
  const [result, setResult] = useState<FirmAskResult | null>(null);
  const [openItem, setOpenItem] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  if (!canAskTheFirm(profile) || refused) return null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const text = question.trim();
    if (text.length < 3 || pending) return;
    setPending(true);
    setFailed(false);
    onResult?.(null);
    try {
      const answer = await ask({ data: { question: text, starter, profile_id: profile?.id ?? null } });
      setResult(answer);
      onResult?.(answer);
    } catch (error) {
      // A guest or someone outside a company workspace: the server says no, so the box goes away.
      if (error instanceof Response && error.status === 403) setRefused(true);
      else setFailed(true);
    } finally {
      setPending(false);
    }
  }

  function pickStarter(next: FirmAskStarter) {
    setStarter(next);
    setQuestion(FIRM_ASK_STARTER_COPY[next].stem);
    requestAnimationFrame(() => {
      const field = input.current;
      if (!field) return;
      field.focus();
      field.setSelectionRange(field.value.length, field.value.length);
    });
  }

  return (
    <section
      data-testid="ask-the-firm"
      aria-labelledby="ask-the-firm-title"
      className={className ?? "mx-4 mt-4 rounded-[var(--radius)] border border-border bg-card p-4 shadow-card md:mx-6"}
    >
      <h2 id="ask-the-firm-title" className="text-(length:--type-title) font-medium text-foreground">
        {FIRM_ASK_COPY.title}
      </h2>
      <p className="mt-1 text-(length:--type-small) text-muted-foreground">{FIRM_ASK_COPY.hint}</p>
      <form onSubmit={(event) => void submit(event)} className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Input
          ref={input}
          value={question}
          maxLength={FIRM_ASK_QUESTION_MAX}
          placeholder={FIRM_ASK_COPY.placeholder}
          aria-label={FIRM_ASK_COPY.inputLabel}
          onChange={(event) => {
            setQuestion(event.target.value);
            if (!event.target.value) setStarter(null);
          }}
          className="h-10 flex-1"
        />
        <Button type="submit" variant="ink" className="h-10" disabled={pending || question.trim().length < 3}>
          {FIRM_ASK_COPY.submit}
        </Button>
      </form>
      <div className="mt-2 flex flex-wrap gap-2">
        {startersFor(profile?.role).map((key) => (
          <button
            key={key}
            type="button"
            data-firm-starter={key}
            onClick={() => pickStarter(key)}
            className="rounded-full border border-border px-3 py-1 text-(length:--type-small) text-muted-foreground hover:border-foreground/40 hover:text-foreground"
          >
            {FIRM_ASK_STARTER_COPY[key].label}
          </button>
        ))}
      </div>
      {pending ? (
        <p role="status" className="mt-4 flex items-center gap-2 text-(length:--type-small) text-muted-foreground">
          <span className="nb-dots" aria-hidden>
            <span className="nb-dot" />
            <span className="nb-dot" />
            <span className="nb-dot" />
          </span>
          {FIRM_ASK_COPY.pending}
        </p>
      ) : null}
      {failed ? <p className="mt-4 text-(length:--type-small) text-destructive">{FIRM_ASK_COPY.error}</p> : null}
      {result && !pending ? <FirmAnswer result={result} onOpenSource={setOpenItem} profileId={profile?.id} /> : null}
      <FirmSourcePreview itemId={openItem} profileId={profile?.id} onClose={() => setOpenItem(null)} />
    </section>
  );
}
