import { useState } from "react";

import { MarkdownMessage } from "@/components/markdown/MarkdownMessage";
import { AnswerSources } from "@/components/reflect/AnswerSources";
import { CoverageNote } from "@/components/reflect/CoverageNote";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useAllCoachSubjects, type CoachSubjectAcrossOrgs } from "@/hooks/use-coaching";
import { useProfile } from "@/hooks/use-profile";
import { streamChatRequest } from "@/lib/stream-client";
import type { CoachChatResult } from "@/lib/coach-chat-run.server";
import type { ContextSource } from "@/lib/reflect-shared";

type Turn = {
  role: "user" | "ai";
  text: string;
  sources?: ContextSource[];
  coverage?: { truncated: boolean; fullCount: number; summaryCount: number };
};

/** Three grey dots, the same waiting treatment the dock uses. */
function NbDots({ label = "Thinking" }: { label?: string }) {
  return (
    <span className="nb-dots" role="status" aria-label={label}>
      <span className="nb-dot" />
      <span className="nb-dot" />
      <span className="nb-dot" />
    </span>
  );
}

function CoachAskChat({ subject }: { subject: CoachSubjectAcrossOrgs }) {
  const [draft, setDraft] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [streamed, setStreamed] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const question = draft.trim();
    if (!question || pending) return;
    setPending(true);
    setError(null);
    setStreamed("");
    setTurns((prev) => [...prev, { role: "user", text: question }]);
    setDraft("");
    try {
      const result = await streamChatRequest<CoachChatResult>(
        "/api/coach-chat/stream",
        {
          profile_id: subject.coach_profile_id,
          subject_id: subject.subject_id,
          engagement_id: subject.engagement_id,
          question,
        },
        (delta) => setStreamed((prev) => prev + delta),
      );
      setTurns((prev) => [
        ...prev,
        {
          role: "ai",
          text: result.answer,
          sources: result.sources,
          coverage: {
            truncated: result.truncated,
            fullCount: result.fullCount,
            summaryCount: result.summaryCount,
          },
        },
      ]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
      setStreamed("");
    }
  }

  return (
    <>
      <div className="nb-binder min-h-0 flex-1 overflow-y-auto">
        <div className="nb-binder-body px-4">
          {turns.length === 0 ? (
            <p className="nb-binder-line text-sm text-foreground">
              Ask about what {subject.subject_name} has shared here. They can see every question you
              ask.
            </p>
          ) : null}

          {turns.map((turn, index) => (
            <div key={index}>
              <p className={`nb-binder-label${turn.role === "user" ? "" : " nb-speaker-ai"}`}>
                {turn.role === "user" ? "You" : "AI"}
              </p>
              {turn.role === "user" ? (
                <p className="nb-binder-line whitespace-pre-wrap text-sm text-foreground">
                  {turn.text}
                </p>
              ) : (
                <>
                  <MarkdownMessage content={turn.text} variant="binder" />
                  <div className="nb-binder-inset">
                    <AnswerSources sources={turn.sources ?? []} />
                    {turn.coverage?.truncated ? (
                      <CoverageNote
                        fullCount={turn.coverage.fullCount}
                        summaryCount={turn.coverage.summaryCount}
                      />
                    ) : null}
                  </div>
                </>
              )}
            </div>
          ))}

          {pending && streamed ? (
            <div>
              <p className="nb-binder-label nb-speaker-ai">AI</p>
              <MarkdownMessage content={streamed} variant="binder" className="nb-stream" />
            </div>
          ) : null}

          {pending ? (
            <div className="nb-binder-line flex items-center gap-2">
              <NbDots />
              <span className="text-sm text-muted-foreground">
                {streamed ? "Writing" : "Reading the shared record"}
              </span>
            </div>
          ) : null}
        </div>
      </div>

      {error ? <p className="px-4 pb-2 text-sm text-destructive">{error}</p> : null}

      <footer className="shrink-0 border-t border-border bg-card">
        <div className="flex items-end gap-2 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3">
          <Textarea
            value={draft}
            rows={2}
            enterKeyHint="send"
            onChange={(event) => setDraft(event.target.value)}
            placeholder="How did they approach the pricing question?"
            className="min-h-[64px] resize-none"
          />
          <Button onClick={() => void submit()} disabled={pending || !draft.trim()}>
            {pending ? <NbDots label="Sending" /> : "Send"}
          </Button>
        </div>
      </footer>
    </>
  );
}

/**
 * The coach's Ask tab on a phone: messages and nothing else. No history, no
 * analyses, no scope chip. The list of people below is the scope: it is the
 * coach's own shared queue, so there is no way to ask about anything else.
 */
export function CoachAskSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { profiles } = useProfile();
  const { data: subjects, isLoading } = useAllCoachSubjects(profiles);
  const [chosen, setChosen] = useState<string | null>(null);

  const only = subjects.length === 1 ? subjects[0] : null;
  const subject =
    only ?? subjects.find((s) => `${s.engagement_id}.${s.subject_id}` === chosen) ?? null;

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setChosen(null);
      }}
    >
      <SheetContent
        side="bottom"
        className="flex h-[100dvh] max-h-[100dvh] w-full flex-col gap-0 rounded-none border-0 bg-background p-0"
      >
        <SheetTitle className="sr-only">Ask about shared work</SheetTitle>
        <SheetDescription className="sr-only">
          Questions answered only from what has been shared with you
        </SheetDescription>

        <header className="shrink-0 border-b border-border px-4 pb-2 pt-[calc(1rem+env(safe-area-inset-top))]">
          <p className="micro-label micro-label-ai pr-12">Ask</p>
          <h2 className="page-title mt-1 break-words text-[17px] leading-snug">
            {subject ? `${subject.subject_name} · ${subject.engagement_title}` : "Shared with you"}
          </h2>
        </header>

        {subject ? (
          <CoachAskChat subject={subject} />
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            {isLoading ? (
              <div className="flex items-center gap-2">
                <NbDots label="Loading" />
                <span className="text-sm text-muted-foreground">Finding what is shared</span>
              </div>
            ) : subjects.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing has been shared with you yet, so there is nothing to ask about.
              </p>
            ) : (
              <div className="flex flex-col gap-0.5">
                {subjects.map((row) => (
                  <button
                    key={`${row.engagement_id}.${row.subject_id}`}
                    type="button"
                    onClick={() => setChosen(`${row.engagement_id}.${row.subject_id}`)}
                    className="nb-nav-item min-h-[48px] text-left"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-foreground">
                        {row.subject_name}
                      </span>
                      <span className="block truncate font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                        {row.engagement_title}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
