import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";

/** What a finished answer offers when it can be kept. */
export type KeptAnswer = {
  messageId: number;
  text: string;
  reads: { id: string; depth: string }[];
  /** ASK-D2: the Ask session it came from. Only the preview-gated drafts set it. */
  sessionId?: string | undefined;
  /** ASK-D2: how a draft pin was placed. Only the preview-gated drafts set it. */
  pinVia?: "place" | "auto" | undefined;
};

type Keep = (answer: KeptAnswer, via?: "button" | "drag") => void;

const AnswerKeepContext = createContext<Keep | null>(null);
/** ASK-D2: an optional button label beside the keep action. Absent means the default words. */
const AnswerKeepLabelContext = createContext<string | null>(null);

/**
 * The workboard is the only place an answer can be kept as a card, so the
 * board supplies the action and every other Ask Lasso surface offers nothing.
 */
export function AnswerKeepProvider({ keep, label, children }: { keep: Keep; label?: string | undefined; children: ReactNode }) {
  const value = useMemo(() => keep, [keep]);
  const inner = <AnswerKeepContext.Provider value={value}>{children}</AnswerKeepContext.Provider>;
  return label ? <AnswerKeepLabelContext.Provider value={label}>{inner}</AnswerKeepLabelContext.Provider> : inner;
}

export function useAnswerKeepLabel(): string | null {
  return useContext(AnswerKeepLabelContext);
}

export function useAnswerKeep(): Keep | null {
  return useContext(AnswerKeepContext);
}
