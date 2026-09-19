/**
 * Slice 2a unit 1: resolving a text selection to one chat turn and the
 * character offsets inside that turn's own text.
 *
 * A selection that crosses two turns is refused rather than clipped: a
 * highlight stands for a passage a person chose, so guessing which half they
 * meant would be putting words in their mouth.
 */

export type TurnSelection = { turnNo: number; charStart: number; charEnd: number; text: string };

export type TurnSelectionResult =
  | { kind: "none" }
  | { kind: "cross_turn" }
  | { kind: "ok"; selection: TurnSelection };

function turnContainer(node: Node | null): HTMLElement | null {
  const element = node?.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : (node?.parentElement ?? null);
  return element?.closest<HTMLElement>("[data-turn-content]") ?? null;
}

/** Characters of rendered text before this point inside the container. */
export function offsetWithin(container: HTMLElement, node: Node, offset: number): number {
  if (node === container) {
    let total = 0;
    for (let index = 0; index < offset && index < container.childNodes.length; index += 1) {
      total += container.childNodes[index]?.textContent?.length ?? 0;
    }
    return total;
  }
  const walker = container.ownerDocument.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let total = 0;
  let current = walker.nextNode();
  while (current) {
    if (current === node) return total + offset;
    total += current.textContent?.length ?? 0;
    current = walker.nextNode();
  }
  return total;
}

export function resolveTurnSelection(range: Range): TurnSelectionResult {
  const startContainer = turnContainer(range.startContainer);
  const endContainer = turnContainer(range.endContainer);
  if (!startContainer || !endContainer) return { kind: "none" };
  if (startContainer !== endContainer) return { kind: "cross_turn" };

  const turnNo = Number(startContainer.getAttribute("data-turn-content"));
  if (!Number.isInteger(turnNo)) return { kind: "none" };

  const charStart = offsetWithin(startContainer, range.startContainer, range.startOffset);
  const charEnd = offsetWithin(startContainer, range.endContainer, range.endOffset);
  const text = range.toString();
  if (charEnd <= charStart || text.trim().length === 0) return { kind: "none" };
  return { kind: "ok", selection: { turnNo, charStart, charEnd, text } };
}
