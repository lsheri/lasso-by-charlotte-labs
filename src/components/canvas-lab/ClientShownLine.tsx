import { shownDate, shownLine, sortShowings, type ClientShowing } from "@/lib/client-showings-shared";

/**
 * The quiet "Shown to client" line on a board card. Rendered only by the signed-in board (CanvasLabPage passes the
 * marks); shared, demo, tour, firm and rollup surfaces never pass them, so they never show it.
 */
export function ClientShownLine({ marks }: { marks: ClientShowing[] }) {
  const line = shownLine(marks);
  if (!line) return null;
  const all = sortShowings(marks)
    .map((showing) => `${shownDate(showing.shownOn)}${showing.occasion ? `, ${showing.occasion}` : ""}`)
    .join("; ");
  return (
    <span className="canvas-lab-client-shown" data-client-shown title={`Shown to client: ${all}`}>
      {line}
    </span>
  );
}
