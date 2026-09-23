/**
 * B1: a drag whose release never arrived (released over an embedded preview,
 * outside the window, or cancelled by the browser) ends on the first move
 * that reports no buttons held.
 */
export function shouldEndOnMove(buttons: number, live: boolean): boolean {
  return live && buttons === 0;
}
