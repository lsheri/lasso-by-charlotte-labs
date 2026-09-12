import type { CSSProperties } from "react";

import { hashId } from "@/components/work/pile-scatter";
import { engagementHue } from "@/lib/work-identity";

/**
 * A piece of work drawn as paper. Sandbox A · M5 "Paper physics" (2026:11).
 *
 * Everything here is derived from the item's own id, so a note keeps the same
 * tilt and the same breathing rhythm on every render. Nothing re-randomises
 * under the cursor, and a test can assert a note's angle without seeding.
 */
export type NotePaper = CSSProperties & {
  "--nb-rot": string;
  "--nb-paper-period": string;
  "--nb-paper-phase": string;
};

/**
 * Rotation is deliberately smaller in the columns than in the loose pile.
 *
 * A 220px card at 3deg grows its bounding box about 11px vertically, which eats
 * the gutter and reads as a broken grid rather than as casual placement. The
 * mono stamps are uppercase and letter-spaced, so they are horizontal by
 * nature and disagree with the rules behind them long before the eye forgives
 * it. 1.4deg is the most the grid absorbs cleanly; the pile, which has air,
 * keeps the full 3.
 */
const COLUMN_TILT = 1.8;
const PILE_TILT = 3;

/** Three periods, so a column never breathes in unison. */
const PERIODS = ["7s", "9s", "11s"] as const;

export function notePaper(id: string, place: "column" | "pile" = "column"): NotePaper {
  const hash = hashId(id);
  const unit = ((hash % 2001) - 1000) / 1000; // -1 .. 1
  const tilt = place === "pile" ? PILE_TILT : COLUMN_TILT;
  // A uniform spread lands most notes near zero, and a note at 0deg is just a
  // rectangle. Keep the hash's sign, but never let the magnitude fall below
  // 45% of the maximum, so no note is ever flat.
  const sign = unit < 0 ? -1 : 1;
  const magnitude = 0.45 + 0.55 * Math.abs(unit); // 0.45 .. 1
  const deg = sign * magnitude * tilt;
  return {
    "--nb-rot": `${(Math.round(deg * 100) / 100).toFixed(2)}deg`,
    "--nb-note-period": PERIODS[hash % PERIODS.length]!,
    // Negative delay starts each note mid-cycle, so nothing waits to begin and
    // no two neighbours reach the same extreme together.
    "--nb-note-phase": `-${(hash >>> 5) % 9000}ms`,
  };
}

/**
 * The paper's colour is the engagement it belongs to, drawn from the same eight
 * hues `engagementHue()` already assigns for the mapped-row spine. Promoting it
 * from a 3px spine to the sheet is the whole idea: a wall of work for one
 * engagement should read as one family before a word of it is read.
 *
 * Unmapped and private are handled in CSS instead, because an unmapped piece
 * has no engagement yet and so has no colour to be — which is the honest thing
 * for it to look like.
 */
export function noteHue(engagementId: string | null | undefined): CSSProperties {
  if (!engagementId) return {};
  const ink = `var(${engagementHue(engagementId)})`;
  // engagementHue returns "--engagement-N"; the paper twin is "--paper-N".
  const paper = `var(${engagementHue(engagementId).replace("--engagement-", "--paper-")})`;
  return {
    "--nb-note-fill": paper,
    // A real note's edge is a shadowed version of its own colour, so the ink
    // mixes toward the paper rather than toward white.
    "--nb-note-edge": `color-mix(in oklab, ${ink} 30%, ${paper})`,
  } as CSSProperties;
}
