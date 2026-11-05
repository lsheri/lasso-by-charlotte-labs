export type Box = { left: number; top: number; right: number; bottom: number };

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

/** ASK-LOOK-1: a dashed line from a card being read to the nearest edge of Ask. Null when the card is off the board or under Ask. All boxes share one coordinate space. */
export function readingLinePath(card: Box, ask: Box, stage: Box): string | null {
  const cx = (card.left + card.right) / 2;
  const cy = (card.top + card.bottom) / 2;
  if (card.right < stage.left || card.left > stage.right || card.bottom < stage.top || card.top > stage.bottom) return null;
  if (cx > ask.left && cx < ask.right && cy > ask.top && cy < ask.bottom) return null;
  const ax = (ask.left + ask.right) / 2;
  const ay = (ask.top + ask.bottom) / 2;
  const dx = ax - cx;
  const dy = ay - cy;
  if (Math.abs(dx) >= Math.abs(dy)) {
    const s = dx >= 0 ? 1 : -1;
    const fx = s > 0 ? card.right : card.left;
    const tx = s > 0 ? ask.left : ask.right;
    const ty = ask.bottom - ask.top > 48 ? clamp(cy, ask.top + 24, ask.bottom - 24) : ay;
    const o = Math.max(40, Math.abs(tx - fx) / 2);
    return `M ${fx} ${cy} C ${fx + s * o} ${cy}, ${tx - s * o} ${ty}, ${tx} ${ty}`;
  }
  const s = dy >= 0 ? 1 : -1;
  const fy = s > 0 ? card.bottom : card.top;
  const ty = s > 0 ? ask.top : ask.bottom;
  const tx = ask.right - ask.left > 48 ? clamp(cx, ask.left + 24, ask.right - 24) : ax;
  const o = Math.max(40, Math.abs(ty - fy) / 2);
  return `M ${cx} ${fy} C ${cx} ${fy + s * o}, ${tx} ${ty - s * o}, ${tx} ${ty}`;
}
