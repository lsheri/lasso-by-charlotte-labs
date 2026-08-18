import { useEffect } from "react";

import { clearGuide, usePendingGuide, type GuideId } from "@/lib/onboarding-guide";

const NOTES: Record<GuideId, string> = {
  connect: "Pick one place your AI work already happens. Nothing comes in until you say so.",
  capture: "Paste a thread, upload a file or import your history. Any one of these is a start.",
  map: "Use Map to a workstream on any row. Mapping is what gives a piece of work a home.",
  analyze: "Open a mapped item and run an analysis. You see the result before anyone else does.",
  "invite-coach": "Create an invite here. A coach sees only the work you have mapped.",
  naming: "Set how engagements should be named, so the record reads the same way for everyone.",
  "invite-team": "Invite people here. Each person's work stays private to them.",
  "shared-engagement": "These are the engagements someone has shared with you. Open one to begin.",
  "coach-analysis": "Scope the analysis to a shared engagement, then run it.",
  "firm-check": "Write the standard you want the work held to. The person sees it as a chip.",
  "one-on-one": "Build a 1:1 from what has been shared with you.",
};

/**
 * One small note per navigation, dismissed on any click. Not a tour engine,
 * not a queue, and never more than one on screen.
 */
export function StepPopover() {
  const guide = usePendingGuide();

  useEffect(() => {
    if (!guide) return;
    const dismiss = () => clearGuide();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") clearGuide();
    };
    const timer = window.setTimeout(() => {
      document.addEventListener("click", dismiss, { capture: true });
      document.addEventListener("keydown", onKey);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("click", dismiss, { capture: true });
      document.removeEventListener("keydown", onKey);
    };
  }, [guide]);

  if (!guide) return null;

  return (
    <div
      role="note"
      className="pointer-events-none fixed left-1/2 top-[calc(0.75rem+env(safe-area-inset-top))] z-50 w-[min(24rem,90vw)] -translate-x-1/2 rounded-[var(--radius)] border border-border bg-card px-4 py-3 shadow-card md:left-auto md:right-8 md:translate-x-0 print:hidden"
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
        Getting started
      </p>
      <p className="mt-1 text-sm text-foreground">{NOTES[guide]}</p>
    </div>
  );
}
