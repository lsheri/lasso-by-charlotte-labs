import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { EXEMPLAR_COPY } from "@/lib/manager-tools-shared";

/**
 * The small "Exemplar" mark on work an admin or lead flagged as an example of good work. It says the work is marked
 * and nothing else: never who marked it, and never whose work it is. Shown on the signed-in board, in firm answers'
 * sources and in the proposal panel only; shared, demo, tour, firm and rollup surfaces never render it.
 */
export function ExemplarBadge({ className }: { className?: string }) {
  return (
    <Badge variant="outline" data-exemplar title={EXEMPLAR_COPY.badgeTitle} className={cn("shrink-0 bg-background", className)}>
      {EXEMPLAR_COPY.badge}
    </Badge>
  );
}
