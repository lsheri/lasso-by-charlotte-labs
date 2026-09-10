import { ToneCard } from "@/components/notebook/ToneCard";

/**
 * Presentational only, props in and nothing else. It says plainly what a person
 * outside the firm can ever see, and what stays with the person who made it.
 */
export function WhatLeavesTheFirm({ engagementsShared }: { engagementsShared: number }) {
  const leaves = [
    `${engagementsShared} engagement${engagementsShared === 1 ? "" : "s"} shared with a coach, each one shared by the person who owns it.`,
    "Finished work its owner chose to send to the archive, and only until they take it back.",
  ];
  const stays = [
    "The work itself: documents, decks, files and captured threads.",
    "Every conversation with Lasso, and every prompt someone wrote.",
    "Anything nobody has shared. It is invisible here by construction, not by setting.",
  ];

  return (
    <ToneCard tone="paper" label="WHAT LEAVES THE FIRM" title="Sharing is a person's decision.">
      <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-soft">Leaves</p>
      <ul className="mt-1 space-y-1">
        {leaves.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.08em] text-soft">
        Never leaves
      </p>
      <ul className="mt-1 space-y-1">
        {stays.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </ToneCard>
  );
}
