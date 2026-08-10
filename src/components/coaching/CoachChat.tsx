import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProfile } from "@/hooks/use-profile";
import { askCoachChat } from "@/lib/coach-chat.functions";

type Exchange = { question: string; answer: string };

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
      setExchanges((prev) => [...prev, { question: trimmed, answer: result.answer }]);
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
            <p className="whitespace-pre-wrap border-l-2 border-accent pl-4 text-sm text-foreground">
              {exchange.answer}
            </p>
          </div>
        ))}
      </div>

      <form onSubmit={submit} className="mt-4 flex gap-2">
        <Input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="How did they approach the pricing question?"
        />
        <Button type="submit" disabled={pending || !question.trim()}>
          {pending ? "Asking…" : "Ask"}
        </Button>
      </form>

      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
    </section>
  );
}
