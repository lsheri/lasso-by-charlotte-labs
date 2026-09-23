import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";

/** What a finished answer offers when it can be kept. */
export type KeptAnswer = {
  messageId: number;
  text: string;
  reads: { id: string; depth: string }[];
};

type Keep = (answer: KeptAnswer, via?: "button" | "drag") => void;

const AnswerKeepContext = createContext<Keep | null>(null);

/**
 * The workboard is the only place an answer can be kept as a card, so the
 * board supplies the action and every other Ask Lasso surface offers nothing.
 */
export function AnswerKeepProvider({ keep, children }: { keep: Keep; children: ReactNode }) {
  const value = useMemo(() => keep, [keep]);
  return <AnswerKeepContext.Provider value={value}>{children}</AnswerKeepContext.Provider>;
}

export function useAnswerKeep(): Keep | null {
  return useContext(AnswerKeepContext);
}
