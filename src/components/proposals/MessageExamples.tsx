import type { ReactNode } from "react";

import { InboxDevice, PhoneBubble, PhoneDevice } from "@/components/proposals/MessageDevices";
import { tagVariants } from "@/components/ui/tag";
import { MESSAGE_EXAMPLES_COPY } from "@/lib/won-text-shared";

/**
 * 20 Nov 2026 (Liam): the won-proposal message drawn three ways, side by side: the text that is really sent, the
 * email that comes later and the RCS message that is coming soon. Each sits in the device it arrives on. Email and
 * RCS are pictures only. Nothing in them can be pressed and nothing here sends anything; the Send button beside
 * this belongs to the text alone.
 */
export function MessageExamples({ words, off }: { words: string; /** Texting is not switched on: the text is an example too. */ off?: boolean }) {
  const copy = MESSAGE_EXAMPLES_COPY;
  return (
    <div data-message-examples className="flex flex-col gap-2">
      <ul className="flex flex-wrap items-start gap-4" aria-label={copy.heading}>
        <Example name={copy.text} state={off ? copy.textOffState : copy.textState} live={!off}>
          <PhoneDevice kind="text">
            <PhoneBubble data-won-text-words="">{words}</PhoneBubble>
          </PhoneDevice>
        </Example>
        <Example name={copy.email} state={copy.emailState}>
          <InboxDevice subject={copy.subject} foot={copy.emailFoot}>
            <p>{copy.emailBody}</p>
          </InboxDevice>
        </Example>
        <Example name={copy.rcs} state={copy.rcsState}>
          <PhoneDevice kind="rcs" verified={copy.rcsSender}>
            <div className="w-full overflow-hidden rounded-(--corner-panel) border border-border bg-card text-(length:--type-control)">
              <div className="px-3 py-2">
                <p className="font-medium text-foreground">{copy.rcsTitle}</p>
                <p className="mt-1 text-foreground">{copy.rcsBody}</p>
              </div>
              {/* Drawn replies, not buttons: an example must not be pressable. */}
              <p className="border-t border-border px-3 py-2 text-center font-medium text-foreground">{copy.rcsYes}</p>
              <p className="border-t border-border px-3 py-2 text-center text-muted-foreground">{copy.rcsNo}</p>
            </div>
          </PhoneDevice>
        </Example>
      </ul>
      <p className="max-w-[60ch] text-muted-foreground">{off ? copy.noteOff : copy.note}</p>
    </div>
  );
}

function Example({ name, state, live, children }: { name: string; state: string; live?: boolean; children: ReactNode }) {
  return (
    <li data-message-example={live ? "live" : "example"} className="flex w-full max-w-[22rem] flex-col gap-1.5 sm:w-auto">
      <p className="flex items-center gap-2">
        <span className="font-medium text-foreground">{name}</span>
        <span className={tagVariants({ tone: live ? "accent" : "outline" })}>{state}</span>
      </p>
      {children}
    </li>
  );
}
