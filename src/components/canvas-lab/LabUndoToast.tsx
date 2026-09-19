import { useEffect, useRef } from "react";

/**
 * A short paper note in the corner of the board offering one step back.
 * It floats over the surface, so the canvas never moves when it appears.
 */
export function LabUndoToast({ message, onUndo, onClose }: { message: string; onUndo: () => void; onClose: () => void }) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const timer = window.setTimeout(() => closeRef.current(), 6_000);
    return () => window.clearTimeout(timer);
  }, [message]);

  return (
    <div role="status" className="canvas-lab-undo-toast">
      <span>{message}</span>
      <button type="button" onClick={onUndo}>Undo</button>
    </div>
  );
}
