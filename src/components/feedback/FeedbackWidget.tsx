import { useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { MessageSquare } from "lucide-react";
import { useState, type ReactNode } from "react";

import { SuggestDot } from "@/components/common/Suggested";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useProfile } from "@/hooks/use-profile";
import { FEEDBACK_CATEGORIES, routePattern, submitFeedback } from "@/lib/feedback.functions";

export function FeedbackDialog({ trigger }: { trigger: ReactNode }) {
  const { data: profile } = useProfile();
  const send = useServerFn(submitFeedback);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const pattern = routePattern(path);

  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<string>("Bug");
  const [expected, setExpected] = useState("");
  const [actual, setActual] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setCategory("Bug");
    setExpected("");
    setActual("");
    setDone(false);
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await send({
        data: {
          category,
          expected: expected.trim() || undefined,
          actual: actual.trim(),
          url_path: pattern,
          profile_id: profile?.id,
        },
      });
      setDone(true);
    } catch (e) {
      setError((e as Error).message || "Could not send that just now.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="page-title">Send feedback</DialogTitle>
          <DialogDescription>
            Tell us what's working and what isn't. It goes straight to the founder.
          </DialogDescription>
        </DialogHeader>

        {done ? (
          <div className="space-y-4">
            <p className="text-sm text-foreground">
              Got it, thank you. This goes straight to the founder.
            </p>
            <Button className="w-full" onClick={() => setOpen(false)}>
              Close
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <span className="micro-label">Category</span>
              <div className="flex flex-wrap gap-2">
                {FEEDBACK_CATEGORIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategory(c)}
                    className={`rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-[0.08em] transition-colors ${
                      category === c
                        ? "border-accent-deep bg-accent-soft text-accent-deep"
                        : "border-border bg-card text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="fb-expected" className="micro-label">
                What were you trying to do? (optional)
              </Label>
              <Textarea
                id="fb-expected"
                rows={2}
                value={expected}
                onChange={(e) => setExpected(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="fb-actual" className="micro-label">
                What happened, or what's your suggestion?
              </Label>
              <Textarea
                id="fb-actual"
                rows={4}
                required
                value={actual}
                onChange={(e) => setActual(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <span className="micro-label">Page</span>
              <p className="rounded-[var(--radius)] border border-border bg-secondary px-3 py-2 font-mono text-xs text-muted-foreground">
                {pattern}
              </p>
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={pending || !actual.trim()}>
              {pending ? "Sending…" : "Send feedback"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Floating desktop entry point. On phones the header button is the entry. */
export function FeedbackWidget() {
  return (
    <div className="fixed bottom-4 right-4 z-40 hidden md:block print:hidden">
      <FeedbackDialog
        trigger={
          <button
            type="button"
            style={{
              background: "var(--suggest-wash)",
              borderLeftWidth: "3px",
              borderLeftColor: "var(--suggest-edge)",
            }}
            className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 font-mono text-[11px] uppercase tracking-[0.08em] text-foreground shadow-card transition-colors hover:text-foreground"
          >
            <SuggestDot />
            <MessageSquare className="h-3.5 w-3.5" aria-hidden /> Feedback
          </button>
        }
      />
    </div>
  );
}
