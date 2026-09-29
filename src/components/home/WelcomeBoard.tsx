import { useEffect, useRef, useState, type FormEvent } from "react";

import { useServerFn } from "@tanstack/react-start";

import { PasteThreadDialog } from "@/components/work/PasteThreadDialog";
import { Button } from "@/components/ui/button";
import { useOnboardingUi } from "@/hooks/use-onboarding-ui";
import { useProfile } from "@/hooks/use-profile";
import type { OrgType } from "@/lib/org-type";
import { answerWelcomeQuestionFn } from "@/lib/welcome-answer.functions";
import { bucket, logEvent } from "@/lib/telemetry";
import { WELCOME_COPY, welcomeGroups, type WelcomeCard, type WelcomeCardId } from "@/lib/welcome-board-copy";

export type WelcomeHiddenStore = { hidden: boolean; hide: () => void };

/** Persists in profiles.onboarding, the existing per-profile UI memory. No schema change. */
export function useWelcomeHiddenStore(): WelcomeHiddenStore {
  const { ui, update } = useOnboardingUi();
  return { hidden: ui.welcome_board_hidden === true, hide: () => update({ welcome_board_hidden: true }) };
}

/**
 * WELCOME-ONLY ANSWER PATH. The real Ask path needs a stored chat session and
 * reads stored work rows, so the guide asks answerWelcomeQuestionFn, which
 * sends only card ids and resolves the text server side. Nothing is written.
 */
export type WelcomeAnswerFn = (input: {
  question: string;
  cardIds: WelcomeCardId[];
  register: OrgType;
  orgId: string;
}) => Promise<{ text: string }>;

type AnswerState =
  | { kind: "answered"; text: string; cards: readonly WelcomeCard[] }
  | { kind: "fallback"; cards: readonly WelcomeCard[] };

export function WelcomeBoardView({
  register,
  orgId,
  store,
  answerQuestion,
}: {
  register: OrgType;
  orgId: string;
  store: WelcomeHiddenStore;
  answerQuestion: WelcomeAnswerFn;
}) {
  const groups = welcomeGroups(register);
  const [openIds, setOpenIds] = useState<Set<WelcomeCardId>>(new Set());
  const [circled, setCircled] = useState<Set<WelcomeCardId>>(new Set());
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<AnswerState | null>(null);
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const viewed = useRef(false);

  useEffect(() => {
    if (store.hidden || viewed.current) return;
    viewed.current = true;
    logEvent("welcome.viewed", orgId, { register });
  }, [store.hidden, orgId, register]);

  if (store.hidden) return null;

  const all = groups.flatMap((g) => g.cards);

  function toggleOpen(id: WelcomeCardId) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else {
        next.add(id);
        logEvent("welcome.card_opened", orgId, { card_id: id, register });
      }
      return next;
    });
  }

  function toggleCircle(id: WelcomeCardId) {
    setCircled((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function ask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const picked = all.filter((c) => circled.has(c.id));
    if (picked.length === 0) return;
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    logEvent("welcome.ask_used", orgId, { card_count: bucket(picked.length), register });
    const q = question.trim() || WELCOME_COPY.defaultQuestion;
    void (async () => {
      try {
        const res = await answerQuestion({ question: q, cardIds: picked.map((c) => c.id), register, orgId });
        const text = res?.text?.trim();
        setAnswer(text ? { kind: "answered", text, cards: picked } : { kind: "fallback", cards: picked });
      } catch {
        setAnswer({ kind: "fallback", cards: picked });
      } finally {
        inFlight.current = false;
        setPending(false);
      }
    })();
  }

  function hide() {
    logEvent("welcome.dismissed", orgId, { cards_opened_before: bucket(openIds.size), register });
    store.hide();
  }

  return (
    <section
      aria-labelledby="welcome-sign"
      data-testid="welcome-board"
      className="mb-6 rounded-[var(--radius)] border border-border bg-background p-5"
    >
      <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">{WELCOME_COPY.guideLabel}</p>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-[640px]">
          <h2 id="welcome-sign" className="font-hand text-[22px] text-green">{WELCOME_COPY.signTitle}</h2>
          <p className="mt-1 text-[13px] leading-[1.55] text-foreground">{WELCOME_COPY.signBody}</p>
        </div>
        <Button type="button" variant="outline" className="h-11" onClick={hide}>
          {WELCOME_COPY.hide}
        </Button>
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        {groups.map((group) => (
          <div key={group.id} data-testid="welcome-group">
            <h3 className="font-hand text-[18px] text-green">{group.title}</h3>
            <ul className="mt-2 space-y-2">
              {group.cards.map((card) => {
                const isOpen = openIds.has(card.id);
                const isCircled = circled.has(card.id);
                return (
                  <li
                    key={card.id}
                    data-testid="welcome-card"
                    className={`rounded-[var(--radius-control)] border bg-card p-3 ${isCircled ? "border-dashed border-foreground" : "border-border"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        onClick={() => toggleOpen(card.id)}
                        className="min-h-11 text-left text-[13px] font-medium text-foreground"
                      >
                        {card.title}
                      </button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-pressed={isCircled}
                        onClick={() => toggleCircle(card.id)}
                      >
                        {isCircled ? WELCOME_COPY.circled : WELCOME_COPY.circle}
                      </Button>
                    </div>
                    {isOpen ? (
                      <div className="mt-2">
                        <p className="text-[13px] leading-[1.55] text-muted-foreground">{card.body}</p>
                        <div className="mt-2">
                          <PasteThreadDialog
                            trigger={
                              <Button type="button" variant="outline" size="sm">
                                {WELCOME_COPY.tryOwn}
                              </Button>
                            }
                          />
                        </div>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <form onSubmit={ask} className="mt-5 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <input
          aria-label={WELCOME_COPY.askPlaceholder}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={WELCOME_COPY.askPlaceholder}
          className="h-11 min-w-0 rounded-[var(--radius-control)] border border-input bg-card px-3 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <Button type="submit" variant="ink" className="h-11" disabled={circled.size === 0 || pending} aria-busy={pending}>
          {pending ? WELCOME_COPY.askPending : WELCOME_COPY.askButton}
        </Button>
      </form>
      {circled.size === 0 ? <p className="mt-1 nb-type-small text-muted-foreground">{WELCOME_COPY.askHint}</p> : null}
      {answer ? (
        <div data-testid="welcome-answer" className="mt-3 rounded-[var(--radius-control)] border border-border bg-card p-3">
          <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">{WELCOME_COPY.answerLabel}</p>
          {answer.kind === "answered" ? (
            <p className="mt-2 text-[13px] leading-[1.55] text-foreground">{answer.text}</p>
          ) : (
            <>
              <p className="mt-2 text-[13px] text-muted-foreground">{WELCOME_COPY.answerFailed}</p>
              <ul className="mt-2 space-y-2">
                {answer.cards.map((c) => (
                  <li key={c.id} className="text-[13px] leading-[1.55] text-foreground">
                    <span className="font-medium">{c.title}.</span> {c.body}
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="mt-2 nb-type-small text-muted-foreground">
            {WELCOME_COPY.answerUsed}: {answer.cards.map((c) => c.title).join(", ")}
          </p>
        </div>
      ) : null}
    </section>
  );
}

export function WelcomeBoard() {
  const { data: profile } = useProfile();
  const store = useWelcomeHiddenStore();
  const answer = useServerFn(answerWelcomeQuestionFn);
  if (!profile) return null;
  return (
    <WelcomeBoardView
      register={profile.org_type}
      orgId={profile.org_id}
      store={store}
      answerQuestion={(data) => answer({ data })}
    />
  );
}
