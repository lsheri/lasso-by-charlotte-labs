import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adjacentSection, hasPeriodSection, sectionForDate, todayDay, type JumpSection } from "@/lib/board-section";
import { logEvent } from "@/lib/telemetry";

export type BoardJumpTo = "this_week" | "date" | "next" | "previous";

/** SECD-2: every word a person reads on the jump controls. */
export const BOARD_JUMP_COPY = {
  thisWeek: "This week",
  date: "Go to date",
  next: "Next section",
  previous: "Previous section",
  group: "Find a section",
} as const;

/** Pans only: the page moves the view to the chosen section and nothing else. */
export function BoardJumpControls({ orgId, sections, currentId, phone, onJump }: {
  orgId: string | undefined;
  sections: JumpSection[];
  currentId: string | null;
  phone: boolean;
  onJump: (sectionId: string) => void;
}) {
  if (!hasPeriodSection(sections)) return null;
  function go(target: string | null, to: BoardJumpTo) {
    if (!target) return;
    onJump(target);
    if (orgId) logEvent("workboard.board_jumped", orgId, { to });
  }
  const next = !phone && currentId ? adjacentSection(sections, currentId, "next") : null;
  const previous = !phone && currentId ? adjacentSection(sections, currentId, "previous") : null;
  return <div role="group" aria-label={BOARD_JUMP_COPY.group} className="flex items-center gap-1" data-toolbar-control="board-jump">
    {!phone && currentId ? <Button type="button" size="icon" variant="outline" aria-label={BOARD_JUMP_COPY.previous} disabled={!previous} onClick={() => go(previous, "previous")}><ChevronLeft size={18} /></Button> : null}
    <Button type="button" size="sm" variant="outline" onClick={() => go(sectionForDate(sections, todayDay()), "this_week")}>{BOARD_JUMP_COPY.thisWeek}</Button>
    {!phone && currentId ? <Button type="button" size="icon" variant="outline" aria-label={BOARD_JUMP_COPY.next} disabled={!next} onClick={() => go(next, "next")}><ChevronRight size={18} /></Button> : null}
    {!phone ? <Input type="date" aria-label={BOARD_JUMP_COPY.date} className="h-9 w-40" value="" onChange={(event) => {
      const day = event.target.value;
      if (/^\d{4}-\d{2}-\d{2}$/.test(day)) go(sectionForDate(sections, day), "date");
    }} /> : null}
  </div>;
}
