import { useEffect, useState } from "react";

/**
 * PIN-1 P4 (ask-v2): a one-time tip on the first pinned answer someone can edit.
 * Only the "seen" mark lives in browser storage, a per-viewer convenience; the
 * pin itself is a board row. If storage is blocked the tip shows once per page.
 */
export const PIN_TIP_KEY = "lasso.pin-edit-tip.seen";
export const PIN_TIP_COPY = { text: "Click the text to edit it. Your edit keeps the original.", ok: "Got it" };

let claimedBy: string | null = null;
let seenThisPage = false;

function readSeen(): boolean {
  if (seenThisPage) return true;
  try { return window.localStorage.getItem(PIN_TIP_KEY) === "1"; } catch { return false; }
}

export function markPinTipSeen(): void {
  seenThisPage = true;
  claimedBy = null;
  try { window.localStorage.setItem(PIN_TIP_KEY, "1"); } catch { /* storage blocked: once per page */ }
}

/** Test seam. */
export function resetPinTip(): void {
  claimedBy = null;
  seenThisPage = false;
}

/** True for exactly one card at a time, and never again once seen. */
export function usePinTip(nodeId: string, eligible: boolean): [boolean, () => void] {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!eligible || readSeen()) return;
    if (claimedBy !== null && claimedBy !== nodeId) return;
    claimedBy = nodeId;
    setShow(true);
    return () => { if (claimedBy === nodeId) claimedBy = null; };
  }, [eligible, nodeId]);
  const dismiss = () => { markPinTipSeen(); setShow(false); };
  return [show && eligible, dismiss];
}

export function PinEditTip({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div role="note" className="mt-2 flex items-center justify-between gap-2 rounded-[var(--radius-control)] border border-border bg-muted px-2 py-1.5 text-[12px] text-foreground" data-testid="pin-edit-tip" onPointerDown={(event) => event.stopPropagation()}>
      <span>{PIN_TIP_COPY.text}</span>
      <button type="button" className="shrink-0 text-[12px] underline-offset-2 hover:underline" onClick={(event) => { event.stopPropagation(); onDismiss(); }}>{PIN_TIP_COPY.ok}</button>
    </div>
  );
}
