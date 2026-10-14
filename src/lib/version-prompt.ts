/**
 * VP-1. Which prompt caused a version.
 *
 * The trigger is the person's own last instruction before the thing was made.
 * It is derived on the server from turn positions, never asked of the client:
 * a model guessing which of its own prompts caused its own output is exactly
 * what the produced_at_turn tool description already forbids.
 *
 * This describes a piece of work, never a person. A revision must never be
 * aggregated into revisions-per-person, time-to-final, or any per-person rate,
 * and must never appear in a firm rollup at individual grain.
 * Provenance, never proportion.
 */
export function promptedByTurn(
  producedAt: number | undefined,
  userTurnPositions: readonly number[],
): number | undefined {
  try {
    if (typeof producedAt !== "number" || !Number.isInteger(producedAt) || producedAt <= 0 || !Array.isArray(userTurnPositions)) {
      return undefined;
    }
    let preceding: number | undefined;
    for (const position of userTurnPositions) {
      if (typeof position === "number" && Number.isInteger(position) && position > 0 && position < producedAt && (preceding === undefined || position > preceding)) {
        preceding = position;
      }
    }
    return preceding;
  } catch {
    return undefined;
  }
}