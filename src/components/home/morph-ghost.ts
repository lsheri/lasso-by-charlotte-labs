/**
 * One object, never a swap: a stand-in for the Home question box that travels between the box and the Firm brain
 * menu row while the page underneath changes. Lives on document.body, so it survives the route change. Under reduced
 * motion nothing moves and the stand-in is never made.
 */

type Rect = { left: number; top: number; width: number; height: number };

const EASE = "cubic-bezier(.45,0,.2,1)";

export function rectOf(element: Element | null | undefined): Rect | null {
  if (!element) return null;
  const r = element.getBoundingClientRect();
  if (!r.width || !r.height) return null;
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

/** The Firm brain row in the menu, if one is on screen (on a phone it sits in More, so there is none). */
export function firmBrainRow(): Element | null {
  const rows = [...document.querySelectorAll('a[href="/firm-brain"]')];
  return rows.find((row) => rectOf(row) !== null) ?? null;
}

/** Where the stand-in lands when there is no menu row: a small pill at the top middle of the screen. */
export function topMiddle(): Rect {
  const width = 160;
  return { left: window.innerWidth / 2 - width / 2, top: 12, width, height: 40 };
}

/** Distance at 0.85 px per ms, between 850 and 1200 ms. */
export function morphDuration(from: Rect, to: Rect): number {
  const distance = Math.hypot(to.left - from.left, to.top - from.top);
  return Math.round(Math.max(850, Math.min(1200, distance / 0.85)));
}

/**
 * Moves a stand-in from one rectangle to another, crossfading the question text into the row's label (or back).
 * Resolves when it has landed and faded. The stand-in copies the page's own card and row styles by class.
 */
export async function morph(options: {
  from: Rect;
  to: Rect;
  text: string;
  label: string;
  toRow: boolean;
  reduceMotion: boolean;
  onHalfway?: () => void;
}): Promise<void> {
  const { from, to, text, label, toRow, reduceMotion } = options;
  if (
    reduceMotion ||
    typeof document === "undefined" ||
    typeof document.body.animate !== "function"
  ) {
    options.onHalfway?.();
    return;
  }
  const ghost = document.createElement("div");
  ghost.setAttribute("aria-hidden", "true");
  ghost.className = "home-morph ph-no-autocapture";
  ghost.dataset["phNoAutocapture"] = "";
  const words = document.createElement("div");
  words.className = "home-morph-words";
  words.textContent = text;
  const row = document.createElement("div");
  row.className = "home-morph-row";
  row.textContent = label;
  ghost.append(words, row);
  Object.assign(ghost.style, {
    left: `${from.left}px`,
    top: `${from.top}px`,
    width: `${from.width}px`,
    height: `${from.height}px`,
  });
  document.body.appendChild(ghost);
  const ms = morphDuration(from, to);
  const box = (r: Rect) => ({
    left: `${r.left}px`,
    top: `${r.top}px`,
    width: `${r.width}px`,
    height: `${r.height}px`,
  });
  ghost.animate([box(from), box(to)], { duration: ms, easing: EASE, fill: "forwards" });
  const show = [{ opacity: 0 }, { opacity: 0, offset: 0.5 }, { opacity: 1 }];
  const hide = [
    { opacity: 1 },
    { opacity: 1, offset: 0.3 },
    { opacity: 0, offset: 0.6 },
    { opacity: 0 },
  ];
  words.animate(toRow ? hide : show, { duration: ms, fill: "forwards" });
  row.animate(toRow ? show : hide, { duration: ms, fill: "forwards" });
  window.setTimeout(() => options.onHalfway?.(), Math.round(ms * 0.35));
  await new Promise((resolve) => window.setTimeout(resolve, ms));
  await ghost
    .animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, easing: EASE, fill: "forwards" })
    .finished.catch(() => undefined);
  ghost.remove();
}
