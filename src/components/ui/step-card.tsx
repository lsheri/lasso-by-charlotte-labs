import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

import { ArrowLeft, X } from "@/design/brand/icons";
import { useBrand } from "@/components/skin/use-skin";
import { useReducedMotion } from "@/hooks/use-motion";
import { openChatPill } from "@/lib/chat-pill-shared";
import { FOCUS_BLUR, focusBlurAt } from "@/lib/focus-blur-shared";
import { cn } from "@/lib/utils";
import { sheetFollow, sheetSettle, STEP_CARD_COPY, STEP_CARD_MORPH_MS, STEP_CARD_PHONE_MAX, washAt } from "@/lib/step-card-shared";

import "./step-card.css";

/** A phone gets the bottom sheet. Read after hydration, and safe where the browser has no media queries. */
function usePhone(): boolean {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const query = globalThis.window?.matchMedia?.(`(max-width: ${STEP_CARD_PHONE_MAX}px)`);
    if (!query) return;
    setPhone(query.matches);
    const onChange = (event: MediaQueryListEvent) => setPhone(event.matches);
    query.addEventListener?.("change", onChange);
    return () => query.removeEventListener?.("change", onChange);
  }, []);
  return phone;
}

/** How many step cards are open: the page behind stays soft until the last one closes. */
let openCards = 0;

/**
 * The page behind a step card takes the shared focus blur (focus-blur-shared.ts, the same as the full screen chat):
 * so soft that no word behind can be read, while the left menu, which sits outside `data-pill-behind`, stays sharp.
 * Off the app shell (no `data-pill-behind`), the card's own backdrop carries the same blur instead.
 */
function softenBehind(amount: number, instant: boolean): boolean {
  const behind = globalThis.document?.querySelector<HTMLElement>("[data-pill-behind]");
  if (!behind) return false;
  const look = focusBlurAt(amount);
  behind.style.transition = instant
    ? "none"
    : ["filter", "opacity", "transform"].map((p) => `${p} ${FOCUS_BLUR.ms}ms ${FOCUS_BLUR.easing}`).join(", ");
  behind.style.filter = amount > 0 ? look.filter : "";
  behind.style.opacity = amount > 0 ? String(look.opacity) : "";
  behind.style.transform = amount > 0 ? look.transform : "";
  return true;
}

/** While any card is open the root says so, so a moving picture behind (the Home orb) can rest under the blur. */
function flagOpen(open: boolean) {
  const root = globalThis.document?.documentElement;
  if (!root) return;
  if (open) root.setAttribute("data-step-card-open", "");
  else root.removeAttribute("data-step-card-open");
}

/** Where the card centres on a laptop: over the page, not the menu. */
function pageCentre(): number | null {
  const behind = globalThis.document?.querySelector<HTMLElement>("[data-pill-behind]");
  if (!behind) return null;
  const rect = behind.getBoundingClientRect();
  return rect.width > 0 ? rect.left + rect.width / 2 : null;
}

/**
 * StepCard. 21 Nov 2026, click path cards (Liam: "buttons that pop open pleasant looking white background cards for
 * steps ... it shouldnt open chat"; the design note plans/click-path-cards.html). Use it for any task a button
 * starts that has steps: one white card centred over the page (a bottom sheet with a grabber on a phone), with the
 * page behind it out of focus. Steps change inside the same card: the old step slides 24px and fades as the new one
 * comes in, and the card's height morphs to fit. Never stack a second card or a Dialog on top of it.
 *
 * Header: the back arrow (from step 2 on) and close, with the quiet "Step 2 of 3" above the centred title. Footer: one
 * primary that names the next thing, at most one secondary, and a small "Ask Lasso about this" on the left.
 *
 * Use Dialog for a one-off question with no steps, AlertDialog for a destructive confirm.
 *
 * Escape, the close button, a tap on the page behind or a swipe down close it. What a step holds is kept by the
 * card's owner, which stays mounted, so opening it again from the same button comes back to the same step.
 */
export function StepCard({
  open,
  onOpenChange,
  stepKey,
  direction = "forward",
  marker,
  title,
  hideTitle = false,
  intro,
  onBack,
  busy = false,
  aside,
  onReopen,
  askLabel,
  footer,
  children,
  testId,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Changes when the step changes: the card morphs to the new step. */
  stepKey: string;
  /** Which way the new step slides in. */
  direction?: "forward" | "back";
  /** The quiet marker above the title, e.g. "Step 2 of 3". None for a card with one step. */
  marker?: string | null;
  title: ReactNode;
  /** The step draws its own heading (the lead sheet does): the title is kept for screen readers only. */
  hideTitle?: boolean;
  /** One plain line under the title. */
  intro?: ReactNode;
  /** Shows the back arrow. */
  onBack?: (() => void) | null;
  /** While something is being saved the card cannot be closed, so a write never lands on a card nobody sees. */
  busy?: boolean;
  /** The small link on the footer's left. Left out, and `onReopen` given, it is "Ask Lasso about this". */
  aside?: ReactNode;
  /**
   * Opens this card again at the same step. Given, the card offers "Ask Lasso about this": it closes the card (its
   * owner keeps what was typed), then opens the chat with the step's name and a way back here.
   */
  onReopen?: (() => void) | null | undefined;
  /** The step's name as the chat says it. Defaults to the title when that is plain text. */
  askLabel?: string | undefined;
  /** The step's buttons, secondary first, primary last (it sits on the right; full width on a phone). */
  footer?: ReactNode;
  children?: ReactNode;
  testId?: string;
  className?: string;
}) {
  const phone = usePhone();
  const brand = useBrand();
  const reduce = useReducedMotion();
  const ghosts = useRef<HTMLDivElement>(null);
  const pane = useRef<HTMLDivElement>(null);
  const shownKey = useRef(stepKey);
  const lastPane = useRef<HTMLDivElement | null>(null);
  // The key of the step that slides in: the first step arrives with the card and does not slide on its own.
  const entering = useRef<string | null>(null);
  if (stepKey !== shownKey.current) entering.current = stepKey;
  const [height, setHeight] = useState<number | null>(null);
  const [pull, setPull] = useState<number | null>(null);
  const [centre, setCentre] = useState<number | null>(null);
  const [ownBlur, setOwnBlur] = useState(false);
  const drag = useRef<{ id: number; y: number; t: number; v: number; moved: boolean; last: number } | null>(null);
  const sheet = useRef<HTMLDivElement>(null);

  // The page behind goes soft while the card is open, and comes back as it closes.
  useEffect(() => {
    if (!open) return;
    openCards += 1;
    flagOpen(true);
    setOwnBlur(!softenBehind(1, reduce));
    if (!phone) setCentre(pageCentre());
    return () => {
      openCards -= 1;
      if (openCards === 0) {
        softenBehind(0, reduce);
        flagOpen(false);
      }
    };
  }, [open, phone, reduce]);

  // A sheet pulled down lifts the soft page with it, so the gesture shows where it is going.
  useEffect(() => {
    if (!open || pull === null) return;
    softenBehind(washAt(Math.max(0, pull), sheet.current?.offsetHeight ?? 0), true);
  }, [open, pull]);

  // The step that was showing leaves as a picture of itself: its own node, already let go by React, fades and slides
  // out in a layer React never touches, while the new step comes in. Nothing is mounted twice.
  useLayoutEffect(() => {
    const now = pane.current;
    const old = lastPane.current;
    if (shownKey.current !== stepKey && old && old !== now && !reduce && ghosts.current) {
      old.removeAttribute("data-entering");
      old.setAttribute("data-leaving", direction);
      old.setAttribute("aria-hidden", "true");
      old.inert = true;
      old.removeAttribute("id");
      old.querySelectorAll("[id]").forEach((node) => node.removeAttribute("id"));
      ghosts.current.appendChild(old);
      window.setTimeout(() => old.remove(), STEP_CARD_MORPH_MS);
    }
    shownKey.current = stepKey;
    lastPane.current = now;
  });

  // The card's height follows its step, so it grows or shrinks to fit instead of jumping. Measured from the pane
  // itself as it mounts (the portal mounts it a render after `open` turns on), and never from a pane on its way out,
  // which reads 0 as it goes. A closed card forgets its height, so the next open measures afresh.
  const observer = useRef<ResizeObserver | null>(null);
  const paneRef = useCallback((node: HTMLDivElement | null) => {
    observer.current?.disconnect();
    observer.current = null;
    pane.current = node;
    if (!node) return;
    const measure = () => {
      if (!node.isConnected || node.hasAttribute("data-leaving")) return;
      const h = node.offsetHeight;
      if (h > 0) setHeight(h);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    observer.current = new ResizeObserver(measure);
    observer.current.observe(node);
  }, []);
  useEffect(() => {
    if (!open) setHeight(null);
  }, [open]);

  // Focus goes back where it came from when the card closes: the button that opened it, unless something else (the
  // chat, opened from "Ask Lasso about this") has taken it since.
  const opener = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(false);
  if (open && !wasOpen.current && typeof document !== "undefined") {
    const active = document.activeElement;
    opener.current = active instanceof HTMLElement && active !== document.body ? active : null;
  }
  wasOpen.current = open;

  function close() {
    if (busy) return;
    onOpenChange(false);
  }

  // A phone's sheet follows a finger pulled down from its top, and closes on a long pull or a flick.
  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!phone || busy || event.button !== 0) return;
    if ((event.target as HTMLElement).closest("button")) return;
    drag.current = { id: event.pointerId, y: event.clientY, t: event.timeStamp, v: 0, moved: false, last: 0 };
  }
  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || d.id !== event.pointerId) return;
    const dy = event.clientY - d.y;
    if (!d.moved && Math.abs(dy) < 6) return;
    if (!d.moved) {
      d.moved = true;
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }
    const dt = Math.max(1, event.timeStamp - d.t);
    d.v = (dy - d.last) / dt;
    d.t = event.timeStamp;
    d.last = dy;
    setPull(sheetFollow(dy));
  }
  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const d = drag.current;
    drag.current = null;
    if (!d || d.id !== event.pointerId || !d.moved) return;
    const settle = sheetSettle(pull ?? 0, d.v);
    setPull(null);
    if (settle === "close") close();
    else softenBehind(1, false);
  }

  const label = askLabel ?? (typeof title === "string" ? title : "");
  const askLink =
    aside === undefined && onReopen ? (
      <button
        type="button"
        data-step-ask=""
        disabled={busy}
        onClick={() => {
          // The card closes first, so the chat is free to use and the page's blur hands over cleanly.
          onOpenChange(false);
          openChatPill({ label, reopen: onReopen });
        }}
      >
        {STEP_CARD_COPY.askAbout(brand.name)}
      </button>
    ) : (aside ?? null);

  const style: Record<string, string> = {};
  if (pull !== null) style["--step-card-pull"] = `${pull}px`;
  if (centre !== null && !phone) style["--step-card-x"] = `${centre}px`;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="step-card-scrim" data-own-blur={ownBlur ? "" : undefined} />
        <DialogPrimitive.Content
          ref={sheet}
          aria-describedby={undefined}
          data-testid={testId}
          data-step-card=""
          data-phone={phone ? "" : undefined}
          data-pulling={pull !== null ? "" : undefined}
          data-reduce-motion={reduce ? "" : undefined}
          className={cn("step-card", className)}
          style={style as CSSProperties}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            const back = opener.current;
            const now = document.activeElement;
            const free = !now || now === document.body || !now.isConnected || Boolean(sheet.current?.contains(now));
            if (back && back.isConnected && free) back.focus({ preventScroll: true });
          }}
          onEscapeKeyDown={(event) => {
            if (busy) event.preventDefault();
          }}
          onInteractOutside={(event) => {
            if (busy) event.preventDefault();
          }}
        >
          <div
            className="step-card__viewport"
            data-measured={height !== null ? "" : undefined}
            style={height !== null ? ({ "--step-card-h": `${height}px` } as CSSProperties) : undefined}
          >
            <div ref={ghosts} className="step-card__ghosts" aria-hidden="true" />
            <div
              ref={paneRef}
              key={stepKey}
              className="step-card__pane"
              data-entering={entering.current === stepKey ? direction : undefined}
              data-step={stepKey}
            >
              <div className={hideTitle ? "sr-only" : "step-card__head"}>
                {marker ? (
                  <span className="step-card__marker" data-step-marker="">
                    {marker}
                  </span>
                ) : null}
                <DialogPrimitive.Title className="step-card__title">{title}</DialogPrimitive.Title>
                {intro ? <p className="step-card__intro">{intro}</p> : null}
              </div>
              {hideTitle && marker ? (
                <span className="step-card__marker step-card__marker--alone" data-step-marker="" aria-hidden="true">
                  {marker}
                </span>
              ) : null}
              {children}
            </div>
          </div>
          {/* After the steps, so the corner buttons draw above them without a z-index. */}
          <div
            className="step-card__top"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={() => {
              drag.current = null;
              setPull(null);
              softenBehind(1, false);
            }}
          >
            {phone ? <span className="step-card__grabber" role="presentation" title={STEP_CARD_COPY.grabber} /> : null}
            {onBack ? (
              <button
                type="button"
                className="step-card__icon step-card__icon--back"
                aria-label={STEP_CARD_COPY.back}
                disabled={busy}
                onClick={onBack}
              >
                <ArrowLeft aria-hidden className="size-4" />
              </button>
            ) : null}
            <DialogPrimitive.Close asChild>
              <button type="button" className="step-card__icon step-card__icon--close" aria-label={STEP_CARD_COPY.close} disabled={busy}>
                <X aria-hidden className="size-4" />
              </button>
            </DialogPrimitive.Close>
          </div>
          {footer || askLink ? (
            <div className="step-card__foot" data-step-foot="">
              <div className="step-card__aside">{askLink}</div>
              <div className="step-card__actions">{footer}</div>
            </div>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
