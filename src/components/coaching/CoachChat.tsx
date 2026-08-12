import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ThinkingIndicator, WorkingLabel } from "@/components/common/Working";
import { MarkdownMessage } from "@/components/markdown/MarkdownMessage";
import { AnswerSources } from "@/components/reflect/AnswerSources";
import { CoverageNote } from "@/components/reflect/CoverageNote";
import { Input } from "@/components/ui/input";
import { useProfile } from "@/hooks/use-profile";
import { askCoachChat } from "@/lib/coach-chat.functions";
import type { ContextSource } from "@/lib/reflect-shared";

type Exchange = {
  question: string;
  answer: string;
  truncated: boolean;
  fullCount: number;
  summaryCount: number;
  sources: ContextSource[];
};

export function CoachChat({
  subjectId,
  engagementId,
  subjectName,
}: {
  subjectId: string;
  engagementId: string;
  subjectName: string;
}) {
  const { data: profile } = useProfile();
  const ask = useServerFn(askCoachChat);
  const [question, setQuestion] = useState("");
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || !profile) return;
    setPending(true);
    setError(null);
    try {
      const result = await ask({
        data: {
          profile_id: profile.id,
          subject_id: subjectId,
          engagement_id: engagementId,
          question: trimmed,
        },
      });
      setExchanges((prev) => [
        ...prev,
        {
          question: trimmed,
          answer: result.answer,
          truncated: result.truncated,
          fullCount: result.fullCount,
          summaryCount: result.summaryCount,
          sources: result.sources,
        },
      ]);
      setQuestion("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-[var(--radius)] border border-border bg-card px-5 py-5 shadow-card">
      <h2 className="micro-label">Ask about this work</h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Answers come only from what {subjectName} has shared here. {subjectName} can see every
        question you ask.
      </p>

      <div className="mt-4 space-y-4">
        {exchanges.map((exchange, index) => (
          <div key={index} className="space-y-1.5">
            <p className="text-sm font-medium text-foreground">{exchange.question}</p>
            <MarkdownMessage content={exchange.answer} className="border-l-2 border-accent pl-4" />
            <AnswerSources sources={exchange.sources} />
            {exchange.truncated ? (
              <CoverageNote fullCount={exchange.fullCount} summaryCount={exchange.summaryCount} />
            ) : null}
          </div>
        ))}
      </div>

      {pending ? (
        <ThinkingIndicator
          className="mt-4"
          stages={["Gathering this record…", "Reading what was shared…", "Thinking it through…"]}
        />
      ) : null}

      <form onSubmit={submit} className="mt-4 flex gap-2">
        <Input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="How did they approach the pricing question?"
        />
        <Button type="submit" disabled={pending || !question.trim()}>
          {pending ? <WorkingLabel>Asking</WorkingLabel> : "Ask"}
        </Button>
      </form>

      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
    </section>
  );
}
