/**
 * The signed rendition url lives 15 minutes, and every call mints a new
 * signature. Refetching on window focus would hand the viewer a different url
 * for the same bytes and tear the rendered pages down for nothing.
 */
export const RENDITION_STALE_MS = 10 * 60 * 1000;

export const renditionQueryOptions = {
  staleTime: RENDITION_STALE_MS,
  refetchOnWindowFocus: false as const,
};

/**
 * Holds the pdf.js render task for one canvas so a superseded render is
 * cancelled rather than left half painted. Cancelling throws
 * RenderingCancelledException, which is the expected outcome, not a fault.
 */
export function makeRenderGuard() {
  let task: { cancel: () => void } | null = null;
  return {
    set(next: { cancel: () => void } | null) {
      task = next;
    },
    cancel() {
      const current = task;
      task = null;
      try {
        current?.cancel();
      } catch {
        /* RenderingCancelledException is how a cancelled render reports in */
      }
    },
  };
}
