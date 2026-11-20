/**
 * 20 Nov 2026, chat pill PR 1b (QA M1 of PR 290): the answer card flies from the chat onto the Firm brain canvas, as
 * one object, the way the prototype hands it over (its flyGhost). A copy of the card in a fixed layer travels and
 * scales from where it was to where the canvas placed the same answer, then fades as the real card shows. With
 * reduced motion, or when the canvas card does not appear in time, nothing travels.
 */

import { flightMs } from "@/lib/chat-pill-shared";

const ease = "cubic-bezier(.45,0,.2,1)";

/** Waits up to `timeoutMs` for an element, checking each frame. */
function waitFor(find: () => HTMLElement | null, timeoutMs: number): Promise<HTMLElement | null> {
  return new Promise((resolve) => {
    const start = performance.now();
    const tick = () => {
      const found = find();
      if (found && found.getBoundingClientRect().width > 0) return resolve(found);
      if (performance.now() - start > timeoutMs) return resolve(null);
      requestAnimationFrame(tick);
    };
    tick();
  });
}

/** Takes a picture of the card where it is now. Call before the page changes. */
export function liftCard(source: HTMLElement): { ghost: HTMLElement; from: DOMRect } | null {
  const from = source.getBoundingClientRect();
  if (!from.width || !from.height) return null;
  const ghost = document.createElement("div");
  ghost.className = "chat-pill-ghost";
  ghost.setAttribute("aria-hidden", "true");
  const copy = source.cloneNode(true) as HTMLElement;
  copy.removeAttribute("data-testid");
  copy.removeAttribute("data-firm-answer");
  copy.style.width = `${from.width}px`;
  ghost.appendChild(copy);
  Object.assign(ghost.style, {
    left: `${from.left}px`,
    top: `${from.top}px`,
    width: `${from.width}px`,
    height: `${from.height}px`,
  });
  document.body.appendChild(ghost);
  return { ghost, from };
}

/** Flies a lifted card to the canvas card that `findTarget` finds, or lets it go. Resolves when it has landed. */
export async function landCard(
  lifted: { ghost: HTMLElement; from: DOMRect },
  findTarget: () => HTMLElement | null,
  timeoutMs = 4000,
): Promise<boolean> {
  const { ghost, from } = lifted;
  const target = await waitFor(findTarget, timeoutMs);
  if (!target) {
    const fade = ghost.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: 350,
      easing: ease,
      fill: "forwards",
    });
    await fade.finished.catch(() => undefined);
    ghost.remove();
    return false;
  }
  const to = target.getBoundingClientRect();
  const copy = ghost.firstElementChild as HTMLElement | null;
  const previous = target.style.opacity;
  target.style.opacity = "0";
  const ms = flightMs(Math.hypot(to.left - from.left, to.top - from.top));
  const scale = to.width / from.width;
  const flight = ghost.animate(
    [
      {
        left: `${from.left}px`,
        top: `${from.top}px`,
        width: `${from.width}px`,
        height: `${from.height}px`,
      },
      {
        left: `${to.left}px`,
        top: `${to.top}px`,
        width: `${to.width}px`,
        height: `${to.height}px`,
      },
    ],
    { duration: ms, easing: ease, fill: "forwards" },
  );
  copy?.animate([{ transform: "scale(1)" }, { transform: `scale(${scale})` }], {
    duration: ms,
    easing: ease,
    fill: "forwards",
  });
  await flight.finished.catch(() => undefined);
  target.style.opacity = previous;
  const fade = ghost.animate([{ opacity: 1 }, { opacity: 0 }], {
    duration: 350,
    easing: ease,
    fill: "forwards",
  });
  await fade.finished.catch(() => undefined);
  ghost.remove();
  return true;
}
