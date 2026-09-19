import { useEffect, useRef } from "react";

import type { LabNode } from "@/components/canvas-lab/canvas-lab-model";

export function LabLinkRejection({ target, message, onClear }: { target: LabNode; message: string; onClear: () => void }) {
  const clearRef = useRef(onClear);
  clearRef.current = onClear;
  useEffect(() => {
    const timer = window.setTimeout(() => clearRef.current(), 3_000);
    return () => window.clearTimeout(timer);
  }, [message, target.id]);

  return <div role="status" className="canvas-lab-link-rejection" style={{ left: target.x + target.width + 12, top: target.y }}>{message}</div>;
}