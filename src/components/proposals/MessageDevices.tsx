import type { ReactNode } from "react";

import { BrandMark } from "@/components/layout/BrandLockup";
import { useBrandCopy } from "@/components/skin/use-skin";

/**
 * 20 Nov 2026 (Liam, on the design review): a message is shown the way it arrives. A text or an RCS message sits in
 * a phone; an email sits in an inbox with the email open. The sender is the product, with its own mark as the
 * picture, never a phone number and never the service that carries the message.
 *
 * These are pictures. Nothing in them can be pressed and nothing here sends anything. The words are whatever the
 * caller passes, whole and unchanged: the caller takes them from the same place the sender does.
 */

/** The product's own mark as a sender's picture. */
function SenderPicture() {
  return (
    <span data-message-sender-picture className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-card">
      <BrandMark px={18} />
    </span>
  );
}

/** A phone showing one conversation with the product. */
export function PhoneDevice({ kind, verified, children }: { kind: "text" | "rcs"; verified?: string | undefined; children: ReactNode }) {
  const brand = useBrandCopy();
  return (
    <div data-message-device={kind} className="w-full max-w-[17rem] rounded-(--corner-float) border-4 border-foreground bg-card p-1">
      <div aria-hidden="true" className="mx-auto mb-1 h-1.5 w-12 rounded-full bg-foreground" />
      <p className="flex flex-col items-center gap-1 border-b border-border px-3 pb-2 pt-1">
        <SenderPicture />
        <span className="text-(length:--type-small) font-medium text-foreground">{brand("Lasso")}</span>
        {verified ? <span className="text-(length:--type-label) text-muted-foreground">{verified}</span> : null}
      </p>
      <div className="flex min-h-28 flex-col items-start gap-2 px-3 py-3">{children}</div>
    </div>
  );
}

/** One message as it lands in the phone: the whole of it, in one bubble. */
export function PhoneBubble({ children, ...rest }: { children: ReactNode } & Record<`data-${string}`, string>) {
  return (
    <p {...rest} className="max-w-full rounded-(--corner-float) rounded-bl-(--corner-mark) bg-muted px-3 py-2 text-(length:--type-control) text-foreground [overflow-wrap:anywhere]">
      {children}
    </p>
  );
}

/** An inbox with one email open. */
export function InboxDevice({ subject, children, foot }: { subject: string; children: ReactNode; foot?: string | undefined }) {
  const brand = useBrandCopy();
  return (
    <div data-message-device="email" className="w-full max-w-[22rem] overflow-hidden rounded-(--corner-panel) border border-border bg-card">
      <div aria-hidden="true" className="flex gap-1 border-b border-border bg-muted px-3 py-2">
        <span className="size-2 rounded-full bg-border" />
        <span className="size-2 rounded-full bg-border" />
        <span className="size-2 rounded-full bg-border" />
      </div>
      <div className="px-4 py-3">
        <p className="text-(length:--type-lead) font-semibold text-foreground">{subject}</p>
        <p className="mt-2 flex items-center gap-2">
          <SenderPicture />
          <span className="text-(length:--type-small) font-medium text-foreground">{brand("Lasso")}</span>
        </p>
        <div className="mt-3 text-(length:--type-control) text-foreground">{children}</div>
        {foot ? <p className="mt-3 border-t border-border pt-2 text-(length:--type-small) text-muted-foreground">{foot}</p> : null}
      </div>
    </div>
  );
}
