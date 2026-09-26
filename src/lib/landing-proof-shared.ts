import type { SharedBoardTurn } from "./board-share-shared";

export type LandingProof = {
  itemId: string;
  title: string;
  vendor: string;
  turns: Pick<SharedBoardTurn, "turn_no" | "role" | "content" | "ts">[];
};

export type LandingProofModel = {
  scenarioA: number;
  scenarioB: number;
  scenarioC: number;
  savings: number;
  transition: number;
  inputs: [string, string];
  lines: { label: string; amount: number }[];
  unconfirmed: string;
};

function amount(text: string, pattern: RegExp): number | null {
  const match = text.match(pattern);
  return match?.[1] ? Number(match[1]) : null;
}

/** All displayed figures are parsed from the public-safe demo turns. */
export function parseLandingProof(proof: LandingProof): LandingProofModel | null {
  const turn2 = proof.turns.find((turn) => turn.turn_no === 2)?.content ?? "";
  const turn4 = proof.turns.find((turn) => turn.turn_no === 4)?.content ?? "";
  const turn6 = proof.turns.find((turn) => turn.turn_no === 6)?.content ?? "";
  const scenarioA = amount(turn2, /Scenario A[\s\S]*?net benefit about \$(\d+(?:\.\d+)?)M/i);
  const scenarioB = amount(turn2, /Net \$(\d+(?:\.\d+)?)M in year two/i);
  const scenarioC = amount(turn2, /Scenario C[\s\S]*?Net about \$(\d+(?:\.\d+)?)M in year two/i);
  const savings = amount(turn2, /savings[\s\S]*?of \$(\d+(?:\.\d+)?)M in year two/i);
  const transition = amount(turn2, /less \$(\d+(?:\.\d+)?)M of transition cost/i);
  const inputMatch = turn2.match(/Working from the (FY25 audited statements)[\s\S]*?and the (Meridian cost sheet) from the (14 August) call/i);
  const lineMatch = turn4.match(/finance and accounting \$(\d+(?:\.\d+)?)M, HR and benefits administration \$(\d+(?:\.\d+)?)M, IT and licensing \$(\d+(?:\.\d+)?)M, revenue cycle \$(\d+(?:\.\d+)?)M/i);
  const unconfirmedMatch = turn6.match(/revenue cycle savings \([^)]*\)[^;]*;\s*([^.]*(?:unconfirmed)[^.]*\.)/i);
  if ([scenarioA, scenarioB, scenarioC, savings, transition].some((value) => value === null) || !inputMatch || !lineMatch) return null;
  return {
    scenarioA: scenarioA as number,
    scenarioB: scenarioB as number,
    scenarioC: scenarioC as number,
    savings: savings as number,
    transition: transition as number,
    inputs: [inputMatch[1] ?? "", `${inputMatch[2] ?? ""} ${inputMatch[3] ?? ""}`],
    lines: [
      { label: "Finance", amount: Number(lineMatch[1]) },
      { label: "HR", amount: Number(lineMatch[2]) },
      { label: "IT", amount: Number(lineMatch[3]) },
      { label: "Revenue cycle", amount: Number(lineMatch[4]) },
    ],
    unconfirmed: `$${lineMatch[4]}M revenue cycle depends on Meridian's vendor contract. ${unconfirmedMatch?.[1] ?? "Unconfirmed as of 14 August."}`,
  };
}