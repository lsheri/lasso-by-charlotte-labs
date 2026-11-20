import type { ReactNode } from "react";

import { useBrandCopy } from "@/components/skin/use-skin";
import { tagVariants } from "@/components/ui/tag";
import { MESSAGE_EXAMPLES_COPY } from "@/lib/won-text-shared";

/**
 * 20 Nov 2026 (Liam): the won-proposal message drawn three ways, side by side: the text that is really sent, the
 * email that comes later and the RCS message that is coming soon. Email and RCS are pictures only. Nothing in them
 * can be pressed and nothing here sends anything; the Send button beside this belongs to the text alone.
 */
export function MessageExamples({ words }: { words: string }) {
  const copy = MESSAGE_EXAMPLES_COPY;
  const brand = useBrandCopy();
  return (
    <div data-message-examples className="flex flex-col gap-2">
      <ul className="flex flex-wrap items-start gap-3" aria-label={copy.heading}>
        <Example name={copy.text} state={copy.textState} live>
          <p data-won-text-words className="rounded-[var(--radius)] bg-muted px-3 py-2 text-foreground">
            {words}
          </p>
        </Example>
        <Example name={copy.email} state={copy.emailState}>
          <div className="rounded-[var(--radius)] border border-border bg-card px-3 py-2">
            <p className="font-medium text-foreground">{copy.subject}</p>
            <p className="mt-1 text-foreground">{copy.emailBody}</p>
            <p className="mt-2 border-t border-border pt-2 text-muted-foreground">{copy.emailFoot}</p>
          </div>
        </Example>
        <Example name={copy.rcs} state={copy.rcsState}>
          <div className="overflow-hidden rounded-[var(--radius)] border border-border bg-card">
            <p className="flex items-baseline justify-between gap-2 border-b border-border px-3 py-2">
              <span className="font-medium text-foreground">{brand("Lasso")}</span>
              <span className="text-muted-foreground">{copy.rcsSender}</span>
            </p>
            <div className="px-3 py-2">
              <p className="font-medium text-foreground">{copy.rcsTitle}</p>
              <p className="mt-1 text-foreground">{copy.rcsBody}</p>
            </div>
            {/* Drawn replies, not buttons: an example must not be pressable. */}
            <p className="border-t border-border px-3 py-2 text-center font-medium text-foreground">{copy.rcsYes}</p>
            <p className="border-t border-border px-3 py-2 text-center text-muted-foreground">{copy.rcsNo}</p>
          </div>
        </Example>
      </ul>
      <p className="max-w-[60ch] text-muted-foreground">{copy.note}</p>
    </div>
  );
}

function Example({ name, state, live, children }: { name: string; state: string; live?: boolean; children: ReactNode }) {
  return (
    <li data-message-example={live ? "live" : "example"} className="flex w-full max-w-[34ch] flex-col gap-1.5 sm:w-[30ch]">
      <p className="flex items-center gap-2">
        <span className="font-medium text-foreground">{name}</span>
        <span className={tagVariants({ tone: live ? "accent" : "outline" })}>{state}</span>
      </p>
      {children}
    </li>
  );
}
