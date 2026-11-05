import { useEffect, useRef, type RefObject } from "react";
import { toast } from "sonner";

import { isBoardImageFile } from "@/components/canvas-lab/board-image";
import { noteWorkboardPasted } from "@/components/canvas-lab/canvas-lab-telemetry";
import { BOARD_PASTE_COPY, pasteBelongsToBoard, readPaste } from "@/lib/board-paste";
import type { Point } from "@/lib/canvas-drag";

/** PASTE-1: Cmd+V on the board lands files, images or a sticky at the pointer. */
export function useBoardPaste(args: {
  enabled: boolean;
  shellRef: RefObject<HTMLElement | null>;
  toBoard: (clientX: number, clientY: number) => Point;
  viewportPoint: () => Point;
  addFiles: (files: File[], at: Point, channel: "drop" | "paste") => Promise<{ added: number; failed: number }>;
  addText: (text: string, at: Point) => Promise<boolean>;
  orgId: string | undefined;
}): void {
  const latest = useRef(args);
  latest.current = args;
  const { enabled, shellRef } = args;

  useEffect(() => {
    if (!enabled) return;
    const shell = shellRef.current;
    let last: { x: number; y: number } | null = null;
    const onMove = (event: PointerEvent) => { last = { x: event.clientX, y: event.clientY }; };
    const onLeave = () => { last = null; };

    const onPaste = (event: ClipboardEvent) => {
      if (!pasteBelongsToBoard(event.target, document.activeElement)) return;
      const dt = event.clipboardData;
      if (!dt) return;
      const files = Array.from(dt.files);
      const read = readPaste({ files, text: dt.getData("text/plain"), html: dt.getData("text/html"), uriList: dt.getData("text/uri-list") });
      if (read.kind === "none") return;
      event.preventDefault();
      const a = latest.current;
      const at = last ? a.toBoard(last.x, last.y) : a.viewportPoint();
      void (async () => {
        if (read.kind === "files") {
          let result = { added: 0, failed: 0 };
          try { result = await a.addFiles(files, at, "paste"); } catch { result = { added: 0, failed: files.length }; }
          // Zeros on both sides means addFiles returned early (busy or disabled): nothing came in and nothing toasted yet.
          if (result.added === 0 && result.failed === 0) toast(BOARD_PASTE_COPY.failed);
          noteWorkboardPasted(a.orgId, files.every(isBoardImageFile) ? "image" : "file", result.added > 0 ? "added" : "failed");
          return;
        }
        if (read.kind === "text") {
          let ok = false;
          try { ok = await a.addText(read.text, at); } catch { ok = false; }
          if (!ok) {
            toast(BOARD_PASTE_COPY.failed);
            noteWorkboardPasted(a.orgId, "text", "failed");
            return;
          }
          if (read.capped) toast(BOARD_PASTE_COPY.capped);
          noteWorkboardPasted(a.orgId, "text", "added");
          return;
        }
        toast(BOARD_PASTE_COPY[read.reason]);
        noteWorkboardPasted(a.orgId, read.reason, "refused");
      })();
    };

    document.addEventListener("paste", onPaste);
    shell?.addEventListener("pointermove", onMove);
    shell?.addEventListener("pointerleave", onLeave);
    return () => {
      document.removeEventListener("paste", onPaste);
      shell?.removeEventListener("pointermove", onMove);
      shell?.removeEventListener("pointerleave", onLeave);
    };
  }, [enabled, shellRef]);
}
