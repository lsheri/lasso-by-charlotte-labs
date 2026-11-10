import { clampUnit, type StickyAnchor } from "@/lib/stickies-shared";

/**
 * S2 (stickies on the work): finding the spot a sticky is dropped on, and finding it again when the work
 * opens. The work marks its spots: slides `data-anchor-page`, chat turns `data-turn-no`, sheet rows
 * `data-anchor-row`, a doc's paper `data-anchor-doc` with its headings `data-anchor-section`, a picture
 * `data-anchor-media`. Anything else is the piece as a whole.
 */

export type DropSpot = { anchor: StickyAnchor; el: HTMLElement; posX: number; posY: number };

const SPOT_SELECTOR =
  "[data-anchor-page],[data-turn-no],[data-anchor-row],[data-anchor-doc],[data-anchor-media]";

/** The heading a point in a doc sits under, or null above the first heading. */
function sectionAt(doc: HTMLElement, clientY: number): string | null {
  let found: string | null = null;
  doc.querySelectorAll<HTMLElement>("[data-anchor-section]").forEach((heading) => {
    if (heading.getBoundingClientRect().top <= clientY)
      found = heading.getAttribute("data-anchor-section");
  });
  return found;
}

function at(el: HTMLElement, clientX: number, clientY: number) {
  const rect = el.getBoundingClientRect();
  return {
    posX: clampUnit(rect.width ? (clientX - rect.left) / rect.width : 0.5),
    posY: clampUnit(rect.height ? (clientY - rect.top) / rect.height : 0.5),
  };
}

/** Where a drop at (clientX, clientY) lands inside `root`, or null when it is outside the work. */
export function spotAt(
  target: Element | null,
  root: HTMLElement,
  clientX: number,
  clientY: number,
): DropSpot | null {
  if (!target || !root.contains(target)) return null;
  const el = target.closest<HTMLElement>(SPOT_SELECTOR);
  if (el && root.contains(el)) {
    const pos = at(el, clientX, clientY);
    const page = el.getAttribute("data-anchor-page");
    if (page) return { anchor: { kind: "page", pageNo: Number(page) }, el, ...pos };
    const turn = el.getAttribute("data-turn-no");
    if (turn !== null) return { anchor: { kind: "turn", turnNo: Number(turn) }, el, ...pos };
    const row = el.getAttribute("data-anchor-row");
    if (row) return { anchor: { kind: "row", rowKey: row }, el, ...pos };
    if (el.hasAttribute("data-anchor-doc")) {
      const section = sectionAt(el, clientY);
      return section
        ? { anchor: { kind: "section", sectionKey: section }, el, ...pos }
        : { anchor: { kind: "item" }, el: root, ...at(root, clientX, clientY) };
    }
    if (el.hasAttribute("data-anchor-media")) return { anchor: { kind: "media" }, el, ...pos };
  }
  return { anchor: { kind: "item" }, el: root, ...at(root, clientX, clientY) };
}

/**
 * The element a stored sticky sits on, or null when its spot is no longer in the work (a slide removed, a
 * heading renamed). Null is shown as "This spot changed"; a sticky is never put somewhere it was not left.
 */
export function anchorElement(root: HTMLElement, anchor: StickyAnchor): HTMLElement | null {
  const css = (value: string) =>
    typeof CSS !== "undefined" && CSS.escape ? CSS.escape(value) : value.replace(/"/g, '\\"');
  switch (anchor.kind) {
    case "page":
      return root.querySelector<HTMLElement>(`[data-anchor-page="${anchor.pageNo}"]`);
    case "turn":
      return root.querySelector<HTMLElement>(`[data-turn-no="${anchor.turnNo}"]`);
    case "row":
      return root.querySelector<HTMLElement>(`[data-anchor-row="${css(anchor.rowKey)}"]`);
    case "section": {
      const doc = root.querySelector<HTMLElement>("[data-anchor-doc]");
      return doc && doc.querySelector(`[data-anchor-section="${css(anchor.sectionKey)}"]`)
        ? doc
        : null;
    }
    case "media":
      return root.querySelector<HTMLElement>("[data-anchor-media]");
    default:
      return root;
  }
}

/** A sticky's top-left in the scrolling content's own coordinates, so it scrolls with the work. */
export function placeIn(
  content: HTMLElement,
  el: HTMLElement,
  posX: number,
  posY: number,
): { left: number; top: number } {
  const box = content.getBoundingClientRect();
  const rect = el.getBoundingClientRect();
  return {
    left: rect.left - box.left + content.scrollLeft + posX * rect.width,
    top: rect.top - box.top + content.scrollTop + posY * rect.height,
  };
}

/**
 * S2c: a paged file (a PDF deck) shows one page at a time. A page sticky whose page is in the file but not
 * on screen is on another page, not gone.
 */
export function pagedHost(root: HTMLElement): { el: HTMLElement; count: number } | null {
  const el = root.matches("[data-anchor-pages]")
    ? root
    : root.querySelector<HTMLElement>("[data-anchor-pages]");
  const count = Number(el?.getAttribute("data-anchor-pages"));
  return el && Number.isInteger(count) && count > 0 ? { el, count } : null;
}

export function onAnotherPage(root: HTMLElement, anchor: StickyAnchor): boolean {
  if (anchor.kind !== "page") return false;
  const host = pagedHost(root);
  return Boolean(host && anchor.pageNo <= host.count && !anchorElement(root, anchor));
}

/** Ask a paged file to show a page. */
export function showPage(root: HTMLElement, pageNo: number): boolean {
  const host = pagedHost(root);
  if (!host || pageNo > host.count) return false;
  host.el.dispatchEvent(new CustomEvent("lasso-go-page", { detail: pageNo }));
  return true;
}
