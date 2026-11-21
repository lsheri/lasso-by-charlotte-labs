import { useState, type FormEvent, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";

import { BrandMark } from "@/components/layout/BrandLockup";
import { ArrowUp } from "@/design/brand/icons";
import { PILL_COPY, PILL_DOCK_COPY } from "@/lib/chat-pill-shared";

/**
 * 21 Nov 2026, chat pill Phase 1c (Liam's recording, corrected the same day): on Home the chat lands big in the centre
 * over the blurred page, with the logo twice its usual size, a greeting, the page's hint in the question box and a
 * six-dot handle. Asking opens the full chat with the question in it. Dragging the handle (or clicking it and picking a
 * spot) sends the chat to a corner, and Home shows clear again. Chat only: no task buttons live here.
 */
export function PillLanding({
  firstName,
  brandName,
  welcome,
  hint,
  onAsk,
  onHandleDown,
  onHandleClick,
}: {
  firstName: string;
  /** The product name the shell shows (Charlotte or Lasso). */
  brandName: string;
  welcome: string;
  hint: string;
  onAsk: (text: string) => void;
  onHandleDown: (event: ReactPointerEvent<HTMLElement>) => void;
  onHandleClick: () => void;
}) {
  const [text, setText] = useState("");
  const send = () => {
    const clean = text.trim();
    if (clean.length < 3) return;
    setText("");
    onAsk(clean);
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    send();
  };
  const onKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  };
  return (
    <section className="pill-landing" data-pill-landing-chat="" aria-label={PILL_COPY.panel(brandName)}>
      <button
        type="button"
        className="pill-landing__handle"
        aria-label={PILL_DOCK_COPY.handle}
        title={PILL_DOCK_COPY.handle}
        data-pill-handle=""
        onPointerDown={onHandleDown}
        onClick={onHandleClick}
      >
        <i aria-hidden />
      </button>
      <h2 className="pill-landing__hello">
        <BrandMark px={48} />
        <span>{PILL_COPY.hello(firstName)}</span>
      </h2>
      <p className="pill-landing__welcome">{welcome}</p>
      <form className="pill-landing__form" onSubmit={submit} autoComplete="off">
        <textarea
          rows={2}
          value={text}
          placeholder={hint}
          aria-label={PILL_COPY.label}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={onKey}
          className="pill-landing__input"
        />
        <button type="submit" className="chat-pill__send" aria-label={PILL_COPY.send} disabled={text.trim().length < 3}>
          <ArrowUp className="size-[18px]" aria-hidden />
        </button>
      </form>
      <p className="chat-pill__foot">{PILL_COPY.footer}</p>
    </section>
  );
}
