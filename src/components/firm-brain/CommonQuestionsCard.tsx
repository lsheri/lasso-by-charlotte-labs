import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";

import { canAskTheFirm } from "@/lib/firm-ask-shared";
import { canSeeCommonQuestions, COMMON_QUESTIONS_COPY, type CommonQuestion } from "@/lib/manager-tools-shared";
import { commonQuestionKindsFn } from "@/lib/manager-tools.functions";

type CardProfile = { id?: string | null; role?: string | null; has_firm_view?: boolean | null; org_type?: string | null; is_guest?: boolean | null };

/** Who sees the card: a company workspace, an admin or lead, never a guest. The server checks again. */
export function canSeeCommonQuestionsCard(profile: CardProfile | null | undefined): boolean {
  return canAskTheFirm(profile) && profile?.is_guest !== true && canSeeCommonQuestions(profile?.role);
}

/**
 * 19 Nov, Firm Brain Build Spec step 8: "What people ask the firm", on the firm view for admins and leads. Each line
 * is a fixed label and a band of people. A kind appears only once five people have asked it, the database decides
 * that, and there is no name, no exact count and no wording of any question anywhere on it.
 */
export function CommonQuestionsCard({ profile }: { profile: CardProfile | null | undefined }) {
  const allowed = canSeeCommonQuestionsCard(profile);
  const read = useServerFn(commonQuestionKindsFn);
  const profileId = profile?.id ?? null;
  const [lines, setLines] = useState<CommonQuestion[] | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error" | "refused">("loading");

  useEffect(() => {
    if (!allowed) return;
    let live = true;
    setState("loading");
    read({ data: { profile_id: profileId } }).then(
      (next) => {
        if (!live) return;
        setLines(next);
        setState("ready");
      },
      (error: unknown) => {
        if (!live) return;
        // The server said no (a role change, a guest): the card goes away rather than showing an error.
        setState(error instanceof Response && error.status === 403 ? "refused" : "error");
      },
    );
    return () => {
      live = false;
    };
  }, [allowed, profileId, read]);

  if (!allowed || state === "refused") return null;

  return (
    <section data-testid="common-questions" aria-labelledby="common-questions-title" className="rounded-[var(--radius)] border border-border bg-card p-4 shadow-card">
      <h2 id="common-questions-title" className="text-(length:--type-title) font-medium text-foreground">
        {COMMON_QUESTIONS_COPY.title}
      </h2>
      <p className="mt-1 max-w-prose text-(length:--type-small) text-muted-foreground">{COMMON_QUESTIONS_COPY.helper}</p>
      {state === "loading" ? (
        <p role="status" className="mt-3 text-(length:--type-small) text-muted-foreground">
          {COMMON_QUESTIONS_COPY.loading}
        </p>
      ) : state === "error" ? (
        <p role="alert" className="mt-3 text-(length:--type-small) text-destructive">
          {COMMON_QUESTIONS_COPY.error}
        </p>
      ) : !lines || lines.length === 0 ? (
        <p data-common-questions-empty className="mt-3 text-(length:--type-body) text-foreground">
          {COMMON_QUESTIONS_COPY.empty}
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {lines.map((line) => (
            <li key={line.label} data-common-question className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 text-(length:--type-body) text-foreground">{line.label}</span>
              <span className="shrink-0 font-mono text-(length:--type-label) tabular-nums text-muted-foreground">{line.band}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
