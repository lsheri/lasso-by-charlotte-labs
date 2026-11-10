import { Spinner } from "@/components/common/Working";

/*
 * T2c-2 (one view, 9 Nov): a card with no work behind it yet, or a note written on the board, opens in
 * the same view as everything else. The old full-screen reader is no longer reached from the board.
 */

export const LIFT_NOTE_COPY = {
  loading: "Loading work…",
  unavailable: "This card's work could not be loaded. Please try again.",
} as const;

export function LiftedNoteBody({
  summary,
  prompt,
  state,
}: {
  summary: string;
  prompt?: string | null | undefined;
  /** note: words on the board. loading: its work is on the way. unavailable: its work could not be read. */
  state: "note" | "loading" | "unavailable";
}) {
  if (state === "loading") {
    return (
      <div className="lift-note" data-testid="lift-note" aria-live="polite" aria-busy="true">
        <p className="flex items-center gap-2 text-muted-foreground">
          <Spinner />
          {LIFT_NOTE_COPY.loading}
        </p>
      </div>
    );
  }
  return (
    <div className="lift-note" data-testid="lift-note">
      {summary ? <p className="whitespace-pre-wrap">{summary}</p> : null}
      {prompt ? <p className="whitespace-pre-wrap">{prompt}</p> : null}
      {state === "unavailable" ? (
        <p className="text-muted-foreground">{LIFT_NOTE_COPY.unavailable}</p>
      ) : null}
    </div>
  );
}
