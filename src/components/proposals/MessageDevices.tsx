import type { ReactNode } from "react";

import { BrandMark } from "@/components/layout/BrandLockup";
import { useBrandCopy } from "@/components/skin/use-skin";
import { cn } from "@/lib/utils";

import "./message-devices.css";

/**
 * 20 Nov 2026 (Liam, on the design review): a message is shown the way it arrives. A text or an RCS message sits in
 * an iPhone, in its messages thread; an email sits in an inbox with the email open. The sender is the product, with
 * its own mark and lime thread as the picture, never a phone number and never the service that carries the message.
 *
 * These are pictures. Nothing in them can be pressed and nothing here sends anything. The words are whatever the
 * caller passes, whole and unchanged: the caller takes them from the same place the sender does.
 */

/** The product's own mark as a sender's picture. */
function SenderPicture({ size = "md" }: { size?: "md" | "lg" }) {
  return (
    <span
      data-message-sender-picture
      className={cn("flex shrink-0 items-center justify-center rounded-full border border-border bg-card", size === "lg" ? "size-11" : "size-8")}
    >
      <BrandMark px={size === "lg" ? 30 : 20} />
    </span>
  );
}

/** An iPhone showing one messages thread with the product. */
export function PhoneDevice({ kind, verified, children }: { kind: "text" | "rcs"; verified?: string | undefined; children: ReactNode }) {
  const brand = useBrandCopy();
  return (
    <div data-message-device={kind} className="message-phone w-full max-w-[16rem] border-foreground bg-card">
      <div aria-hidden="true" className="message-phone-island mx-auto bg-foreground" />
      <p className="flex flex-col items-center gap-1 border-b border-border px-3 pb-2 pt-2">
        <SenderPicture size="lg" />
        <span className="text-(length:--type-small) font-medium text-foreground">{brand("Lasso")}</span>
        {verified ? <span className="text-(length:--type-label) text-muted-foreground">{verified}</span> : null}
      </p>
      <div className="flex min-h-40 flex-col items-start gap-2 px-3 py-3">{children}</div>
      <div aria-hidden="true" className="mx-auto mb-1.5 mt-1 h-1 w-24 rounded-full bg-foreground" />
    </div>
  );
}

/** One message as it lands in the thread: the whole of it, in one bubble. */
export function PhoneBubble({ children, ...rest }: { children: ReactNode } & Record<`data-${string}`, string>) {
  return (
    <p {...rest} className="message-bubble max-w-full bg-muted px-3 py-2 text-(length:--type-control) text-foreground [overflow-wrap:anywhere]">
      {children}
    </p>
  );
}

/** An inbox with one email open: the list on the left, the email on the right. */
export function InboxDevice({ subject, children, foot }: { subject: string; children: ReactNode; foot?: string | undefined }) {
  const brand = useBrandCopy();
  return (
    <div data-message-device="email" className="flex w-full max-w-[26rem] overflow-hidden rounded-(--corner-panel) border border-border bg-card">
      <div aria-hidden="true" className="hidden w-24 shrink-0 flex-col gap-2 border-r border-border bg-muted p-2 sm:flex">
        <span className="rounded-(--corner-mark) bg-card p-1.5">
          <span className="block h-1.5 w-10 rounded-full bg-foreground" />
          <span className="mt-1 block h-1.5 w-14 rounded-full bg-border" />
        </span>
        {[0, 1, 2].map((n) => (
          <span key={n} className="p-1.5">
            <span className="block h-1.5 w-8 rounded-full bg-border" />
            <span className="mt-1 block h-1.5 w-14 rounded-full bg-border" />
          </span>
        ))}
      </div>
      <div className="min-w-0 flex-1 px-4 py-3">
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
