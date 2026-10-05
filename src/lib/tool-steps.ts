/**
 * TT1. Turns with role "tool" are an AI's tool calls and raw tool results.
 * People see them collapsed behind one quiet line; they stay stored, and AI
 * readers keep reading them, because a tool result can be where a fact came from.
 */

export function isToolRole(role: string | null | undefined): boolean {
  return (role ?? "").trim().toLowerCase() === "tool";
}

/** "1 tool step", "3 tool steps". */
export function toolStepsLabel(count: number): string {
  return `${count} ${count === 1 ? "tool step" : "tool steps"}`;
}

export type StepsBand = "1" | "2-4" | "5+";

export function stepsBand(count: number): StepsBand {
  if (count >= 5) return "5+";
  if (count >= 2) return "2-4";
  return "1";
}

export type TurnSegment<T> =
  | { kind: "turn"; turn: T }
  | { kind: "tools"; key: string; turns: T[] };

/** Consecutive tool turns fold into one segment; every other turn stands alone. */
export function groupToolRuns<T extends { role: string | null; turn_no: number }>(
  turns: readonly T[],
): TurnSegment<T>[] {
  const out: TurnSegment<T>[] = [];
  for (const turn of turns) {
    if (isToolRole(turn.role)) {
      const last = out[out.length - 1];
      if (last && last.kind === "tools") last.turns.push(turn);
      else out.push({ kind: "tools", key: `tools-${turn.turn_no}`, turns: [turn] });
    } else {
      out.push({ kind: "turn", turn });
    }
  }
  return out;
}
