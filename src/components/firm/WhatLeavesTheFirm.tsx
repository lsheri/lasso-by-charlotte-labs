import { ToneCard } from "@/components/notebook/ToneCard";

/**
 * Figma 23:413, "WHAT LEAVES THE FIRM". A three-row table, not two lists: a
 * plain question on the left, the plain answer on the right. The frame makes
 * this readable in one glance, which is the point of the panel.
 *
 * Presentational only, props in and nothing else.
 */
export function WhatLeavesTheFirm({ engagementsShared }: { engagementsShared: number }) {
  const rows: { question: string; answer: string }[] = [
    {
      question: "Shared with outside coaches",
      answer:
        engagementsShared === 0
          ? "nothing, so far"
          : `${engagementsShared} receipt${engagementsShared === 1 ? "" : "s"}, each by the person who owned it`,
    },
    { question: "Raw conversations sent anywhere", answer: "none, ever" },
    { question: "Work visible to this page", answer: "only what someone shipped" },
  ];

  return (
    <ToneCard tone="paper" label="WHAT LEAVES THE FIRM">
      <ul className="mt-1 divide-y divide-border/60">
        {rows.map((row) => (
          <li
            key={row.question}
            className="grid grid-cols-1 gap-x-4 gap-y-0.5 py-2 sm:grid-cols-2"
          >
            <span className="text-foreground">{row.question}</span>
            <span className="text-muted-foreground">{row.answer}</span>
          </li>
        ))}
      </ul>
    </ToneCard>
  );
}
