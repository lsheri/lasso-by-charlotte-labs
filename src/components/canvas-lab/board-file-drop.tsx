import { useCallback, useRef, useState, type DragEvent } from "react";
import { toast } from "sonner";

import { useCaptureFiles } from "@/components/work/use-capture-files";
import type { Point } from "@/lib/canvas-drag";

export const BOARD_FILE_DROP_COPY = {
  prompt: "Drop to add to this board",
  capped: "Added the first 10. Drop the rest in another go.",
  failed: (name: string) => `${name} did not come in.`,
} as const;

export const BOARD_FILE_DROP_CAP = 10;

/** Only a real file drag from the desktop, never a sidebar or answer drag. */
export function isFileDrag(types: ReadonlyArray<string> | DOMStringList | undefined | null): boolean {
  if (!types) return false;
  return Array.from(types as ArrayLike<string>).includes("Files");
}

/**
 * DD1-a: files dropped on the board go through the same capture path as the
 * upload button, then land as cards at the release point.
 */
export function useBoardFileDrop({
  enabled,
  toBoard,
  place,
}: {
  enabled: boolean;
  toBoard: (clientX: number, clientY: number) => Point;
  place: (ids: string[], at: Point) => Promise<void> | void;
}) {
  const { captureWithResult } = useCaptureFiles();
  const [over, setOver] = useState(false);
  const busy = useRef(false);

  const onDragEnter = useCallback((event: DragEvent<HTMLElement>) => {
    if (!enabled || !isFileDrag(event.dataTransfer?.types)) return;
    event.preventDefault();
    setOver(true);
  }, [enabled]);

  const onDragOver = useCallback((event: DragEvent<HTMLElement>) => {
    if (!enabled || !isFileDrag(event.dataTransfer?.types)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setOver(true);
  }, [enabled]);

  const onDragLeave = useCallback((event: DragEvent<HTMLElement>) => {
    const related = event.relatedTarget as Node | null;
    if (related && (event.currentTarget as Node).contains(related)) return;
    setOver(false);
  }, []);

  const onDrop = useCallback((event: DragEvent<HTMLElement>) => {
    if (!isFileDrag(event.dataTransfer?.types)) return;
    event.preventDefault();
    setOver(false);
    if (!enabled || busy.current) return;
    const all = Array.from(event.dataTransfer.files ?? []);
    if (all.length === 0) return;
    const files = all.slice(0, BOARD_FILE_DROP_CAP);
    if (all.length > BOARD_FILE_DROP_CAP) toast(BOARD_FILE_DROP_COPY.capped);
    const at = toBoard(event.clientX, event.clientY);
    busy.current = true;
    void (async () => {
      try {
        const { ids, failures } = await captureWithResult(files, { channel: "drop" });
        for (const failure of failures) toast.error(BOARD_FILE_DROP_COPY.failed(failure.name));
        if (ids.length > 0) await place(ids, at);
      } finally {
        busy.current = false;
      }
    })();
  }, [enabled, toBoard, place, captureWithResult]);

  return { over, handlers: { onDragEnter, onDragOver, onDragLeave, onDrop } };
}

export function BoardFileDropOverlay({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div
      data-testid="board-file-drop"
      aria-live="polite"
      className="pointer-events-none absolute inset-3 z-40 flex items-center justify-center rounded-lg border-2 border-dashed border-primary/60 bg-primary/5"
    >
      <span className="rounded-md bg-background px-3 py-1.5 text-sm text-foreground shadow-sm">{BOARD_FILE_DROP_COPY.prompt}</span>
    </div>
  );
}
