import { useEffect } from "react";

import type { LabNode } from "@/components/canvas-lab/canvas-lab-model";

export function LabLinkRejection({ target, message, onClear }: { target: LabNode; message: string; onClear: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onClear, 3_000);
    return () => window.clearTimeout(timer);
  }, [onClear]);

  return <div role="status" className="canvas-lab-link-rejection" style={{ left: target.x + target.width + 12, top: target.y }}>{message}</div>;
}